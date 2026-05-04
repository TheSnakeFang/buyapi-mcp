import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  compareVendors,
  estimateCosts,
  findSimilarStacks,
  getAccountStatus,
  getEvidence,
  getVendorDetails,
  recommendStack,
  searchVendors,
  syncStackScan,
} from "./lib/api.js";
import { helpText, parseCliCommand } from "./lib/cli.js";
import {
  clearStoredApiKey,
  configPath,
  readStoredApiKey,
  writeStoredApiKey,
} from "./lib/config.js";
import { runBrowserLogin } from "./lib/login.js";
import { formatStackScan, scanStack, type StackScanResult } from "./lib/scan.js";
import {
  installClientConfig,
  MCP_URL,
  SETUP_CLIENTS,
  type SetupClient,
  setupSnippet,
  setupTargetPath,
} from "./lib/setup.js";
import {
  installStackSkill,
  SKILL_CLIENTS,
  stackSkillContent,
  stackSkillTargetPath,
  type SkillClient,
} from "./lib/skill.js";
import {
  formatCostEstimates,
  formatDecisionMatrix,
  formatEvidenceRows,
  formatSearchResults,
  formatStackRows,
  formatStackRecommendation,
  formatUnknown,
  formatVendorProfile,
} from "./lib/format.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./lib/version.js";

const workloadSchema = z
  .object({
    users: z.number().optional(),
    monthlyActiveUsers: z.number().optional(),
    storageGb: z.number().optional(),
    databaseSizeGb: z.number().optional(),
    emailSendsPerMonth: z.number().optional(),
    authMau: z.number().optional(),
    regions: z.number().optional(),
    teamSeats: z.number().optional(),
    monthlyTransactions: z.number().optional(),
    averageTransactionUsd: z.number().optional(),
    monthlyRevenueUsd: z.number().optional(),
    notes: z.string().optional(),
  })
  .describe(
    "Explicit workload assumptions for deterministic cost estimates. Missing fields become assumptions, not fabricated precision."
  );

const stackContextSchema = z
  .array(
    z.object({
      vendorSlug: z.string().describe("BuyAPI vendor ID, e.g. /database/convex"),
      category: z.string().describe("The role/category this tool fills"),
      confidence: z
        .string()
        .optional()
        .describe("Scanner or user confidence for this detected tool"),
    })
  )
  .optional()
  .describe(
    "Optional existing stack context from a repo scan or saved private stack. Pass derived tool metadata only, not source code."
  );

const stackFactsSchema = z
  .object({
    languages: z.array(z.string()).optional(),
    frameworks: z.array(z.string()).optional(),
    runtimes: z.array(z.string()).optional(),
    packageManagers: z.array(z.string()).optional(),
    testing: z.array(z.string()).optional(),
    devWorkflow: z.array(z.string()).optional(),
  })
  .optional()
  .describe(
    "Optional derived stack facts such as languages, frameworks, runtimes, package managers, test tools, and dev workflow. Do not pass source code or secrets."
  );

function errorContent(prefix: string, error: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
    isError: true,
  };
}

function structured(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

const readOnlyTool = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const jsonArraySchema = z.array(z.unknown());

const unknownCorpusOutputSchema = {
  kind: z.string().optional(),
  query: z.string().optional(),
  message: z.string().optional(),
  suggestedNextSteps: z.array(z.string()).optional(),
  availableCategories: z.array(z.string()).optional(),
};

const resolveOutputSchema = z.object({
  results: jsonArraySchema.optional(),
  ...unknownCorpusOutputSchema,
}).passthrough();

const detailsOutputSchema = z.object({
  sources: jsonArraySchema.optional(),
}).passthrough();

const evidenceOutputSchema = z.object({
  evidence: jsonArraySchema,
}).passthrough();

const similarStacksOutputSchema = z.object({
  stacks: jsonArraySchema,
}).passthrough();

const compareOutputSchema = z.object({
  decisionMatrix: jsonArraySchema.optional(),
  ...unknownCorpusOutputSchema,
}).passthrough();

const estimateCostOutputSchema = z.object({
  estimates: jsonArraySchema.optional(),
  ...unknownCorpusOutputSchema,
}).passthrough();

const recommendOutputSchema = z.object({
  stack: z.record(z.string(), z.unknown()).optional(),
  decisionMatrix: jsonArraySchema.optional(),
  costEstimate: z.record(z.string(), z.unknown()).optional(),
  alternativesConsidered: jsonArraySchema.optional(),
  unknowns: z.array(z.string()).optional(),
  sources: jsonArraySchema.optional(),
}).passthrough();

export function createMcpServer() {
  const server = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  server.registerTool(
    "vendors.resolve",
    {
      description: `Finds BuyAPI vendor IDs for a user question. Category is optional; provide it when known.

Use this for vendor discovery before vendors.details, or when the user asks which provider in a category fits their constraints. Do not use this for local coding/debugging/docs questions unless they involve choosing a software vendor or tool.
If the category is outside BuyAPI's corpus, the tool returns an explicit "not in corpus yet" result instead of inventing vendors.`,
      inputSchema: {
        query: z
          .string()
          .describe("The user's question or task context for relevance ranking"),
        category: z
          .string()
          .optional()
          .describe("Optional category: database, auth, hosting, payments, email"),
      },
      outputSchema: resolveOutputSchema,
      annotations: readOnlyTool,
    },
    async ({ query, category }) => {
      try {
        const data = await searchVendors(query, category);
        return {
          structuredContent: structured(data.unknown ?? { results: data.results }),
          content: [
            {
              type: "text",
              text: data.unknown
                ? formatUnknown(data.unknown)
                : formatSearchResults(data.results),
            },
          ],
        };
      } catch (error) {
        return errorContent("Error searching vendors", error);
      }
    }
  );

  server.registerTool(
    "vendors.details",
    {
      description: `Retrieves detailed vendor information including pricing, features, limits, gotchas, comparisons, and source provenance.

Call vendors.resolve first unless the user already provided a BuyAPI vendor ID like /database/supabase.`,
      inputSchema: {
        vendorId: z.string().describe("BuyAPI vendor ID, e.g. /database/supabase"),
        query: z
          .string()
          .optional()
          .describe("Specific question to focus the response on"),
      },
      outputSchema: detailsOutputSchema,
      annotations: readOnlyTool,
    },
    async ({ vendorId, query }) => {
      try {
        const vendor = await getVendorDetails(vendorId, query);
        return {
          structuredContent: structured(vendor),
          content: [{ type: "text", text: formatVendorProfile(vendor) }],
        };
      } catch (error) {
        return errorContent("Error fetching vendor details", error);
      }
    }
  );

  server.registerTool(
    "vendors.evidence",
    {
      description: `Returns recent BuyAPI evidence rows for a vendor, category, stack, or comparison.

Use this when the user asks why BuyAPI believes something, what sources support a vendor page, or what recent human/source signals exist.`,
      inputSchema: {
        subjectType: z
          .enum(["vendor", "category", "stack", "comparison"])
          .describe("Evidence subject type"),
        subjectId: z
          .string()
          .describe("Subject ID, e.g. /database/supabase or database"),
        limit: z.number().optional().describe("Maximum rows to return"),
      },
      outputSchema: evidenceOutputSchema,
      annotations: readOnlyTool,
    },
    async ({ subjectType, subjectId, limit }) => {
      try {
        const result = await getEvidence({ subjectType, subjectId, limit });
        return {
          structuredContent: structured(result),
          content: [{ type: "text", text: formatEvidenceRows(result.evidence) }],
        };
      } catch (error) {
        return errorContent("Error fetching evidence", error);
      }
    }
  );

  server.registerTool(
    "stacks.findSimilar",
    {
      description: `Finds public stack profiles related to a vendor or recent curated stack examples.

Use this when the user asks who uses a tool, what similar builders use, or wants examples of real stack combinations.`,
      inputSchema: {
        vendorId: z
          .string()
          .optional()
          .describe("Optional BuyAPI vendor ID, e.g. /database/convex"),
        limit: z.number().optional().describe("Maximum stacks to return"),
      },
      outputSchema: similarStacksOutputSchema,
      annotations: readOnlyTool,
    },
    async ({ vendorId, limit }) => {
      try {
        const result = await findSimilarStacks({ vendorId, limit });
        return {
          structuredContent: structured(result),
          content: [{ type: "text", text: formatStackRows(result.stacks) }],
        };
      } catch (error) {
        return errorContent("Error finding similar stacks", error);
      }
    }
  );

  server.registerTool(
    "vendors.compare",
    {
      description: `Compares two or more BuyAPI vendors for a specific workload or decision.

Use this for head-to-head questions like "Convex vs Supabase vs Neon for a realtime SaaS" or "Stripe vs Paddle for a marketplace".`,
      inputSchema: {
        vendorIds: z
          .array(z.string())
          .min(2)
          .describe("BuyAPI vendor IDs, e.g. ['/database/convex', '/database/neon']"),
        query: z.string().describe("The user's decision context"),
        workload: workloadSchema.optional(),
      },
      outputSchema: compareOutputSchema,
      annotations: readOnlyTool,
    },
    async ({ vendorIds, query, workload }) => {
      try {
        const result = await compareVendors(vendorIds, query, workload);
        return {
          structuredContent: structured(result),
          content: [
            { type: "text", text: formatDecisionMatrix(result.decisionMatrix) },
          ],
        };
      } catch (error) {
        return errorContent("Error comparing vendors", error);
      }
    }
  );

  server.registerTool(
    "vendors.estimateCost",
    {
      description: `Produces deterministic monthly cost estimates from BuyAPI pricing data and explicit workload inputs.

Use this when the user asks for cost math. Missing workload fields are returned as assumptions or unknowns instead of being hallucinated.`,
      inputSchema: {
        vendorIds: z
          .array(z.string())
          .optional()
          .describe("Optional vendor IDs to estimate directly"),
        category: z
          .string()
          .optional()
          .describe("Optional category to estimate across the current corpus"),
        workload: workloadSchema,
      },
      outputSchema: estimateCostOutputSchema,
      annotations: readOnlyTool,
    },
    async ({ vendorIds, category, workload }) => {
      try {
        const result = await estimateCosts({ vendorIds, category, workload });
        return {
          structuredContent: structured(result),
          content: [
            { type: "text", text: formatCostEstimates(result.estimates) },
          ],
        };
      } catch (error) {
        return errorContent("Error estimating cost", error);
      }
    }
  );

  server.registerTool(
    "stacks.recommend",
    {
      description: `Recommends a complete stack from BuyAPI's corpus with a structured decision matrix, cost estimate, assumptions, unknowns, alternatives, and sources.

Use this when the user is starting a project or asks for a complete stack choice. Do not use this for local coding/debugging/docs questions that do not involve software or vendor selection. Do not call vendors.resolve first; this tool handles retrieval and ranking.`,
      inputSchema: {
        projectDescription: z.string().describe("What the user is building"),
        constraints: z
          .string()
          .optional()
          .describe("Budget, scale, existing tools, team size, compliance needs"),
        workload: workloadSchema.optional(),
        stackContext: stackContextSchema,
        stackFacts: stackFactsSchema,
      },
      outputSchema: recommendOutputSchema,
      annotations: readOnlyTool,
    },
    async ({ projectDescription, constraints, workload, stackContext, stackFacts }) => {
      try {
        const recommendation = await recommendStack(
          projectDescription,
          constraints,
          workload,
          stackContext,
          stackFacts
        );
        return {
          structuredContent: structured(recommendation),
          content: [
            { type: "text", text: formatStackRecommendation(recommendation) },
          ],
        };
      } catch (error) {
        return errorContent("Error generating recommendation", error);
      }
    }
  );

  return server;
}

async function main() {
  const command = parseCliCommand(process.argv.slice(2));
  if (command.name !== "mcp") {
    await runCliCommand(command);
    return;
  }

  const transport = new StdioServerTransport();
  const server = createMcpServer();
  await server.connect(transport);
  console.error("BuyAPI MCP server running on stdio");
}

async function runCliCommand(command: ReturnType<typeof parseCliCommand>) {
  switch (command.name) {
    case "setup":
      if (!command.client) {
        if (process.stdin.isTTY && process.stdout.isTTY && !command.print) {
          await runInteractiveSetup(command.mode);
        } else {
          console.log(setupText());
        }
        return;
      }
      if (command.print) {
        console.log(setupPrintText(command.client, command.mode, command.skill));
        return;
      }
      {
        const skillClient = skillClientForSetup(command.client);
        if (command.skill && !skillClient) {
          throw new Error(
            "The /stack skill installer currently supports claude-code and codex."
          );
        }
        const result = installClientConfig(command.client, command.mode);
        console.log(result.message);
        console.log(
          result.changed ? "Updated config." : "Config was already up to date."
        );
        if (command.skill && skillClient) {
          const skillResult = installStackSkill(skillClient);
          console.log(skillResult.message);
          console.log(
            skillResult.changed
              ? "Updated /stack skill."
              : "/stack skill was already up to date."
          );
        }
      }
      return;
    case "setup-skill":
      if (!command.client) {
        console.log(setupSkillText());
        return;
      }
      if (command.print) {
        console.log(setupSkillPrintText(command.client));
        return;
      }
      {
        const result = installStackSkill(command.client);
        console.log(result.message);
        console.log(
          result.changed
            ? "Updated /stack skill."
            : "/stack skill was already up to date."
        );
      }
      return;
    case "version":
      console.log(`${PACKAGE_NAME} ${PACKAGE_VERSION}`);
      return;
    case "help":
      console.log(helpText());
      return;
    case "login":
      if (!command.apiKey) {
        const key = await runBrowserLogin();
        console.log(`BuyAPI API key saved to ${configPath()}`);
        console.log(`Logged in with key ${key.slice(0, 16)}...`);
        return;
      }
      writeStoredApiKey(command.apiKey);
      console.log(`BuyAPI API key saved to ${configPath()}`);
      return;
    case "logout":
      clearStoredApiKey();
      console.log("BuyAPI API key removed.");
      return;
    case "whoami":
      {
        const key = process.env.BUYAPI_API_KEY || readStoredApiKey();
        if (!key) {
          if (command.quiet) {
            process.exitCode = 1;
            return;
          }
          const result = {
            authenticated: false,
            source: null,
            message: "No BuyAPI API key configured.",
          };
          console.log(
            command.json
              ? JSON.stringify(result, null, 2)
              : `${result.message} Run buyapi login.`
          );
          return;
        }
        const status = await getAccountStatus();
        if (command.quiet) {
          process.exitCode = status.authenticated ? 0 : 1;
          return;
        }
        const result = {
          authenticated: status.authenticated,
          keyPrefix: status.keyPrefix,
          source: process.env.BUYAPI_API_KEY ? "env" : "config",
        };
        console.log(
          command.json
            ? JSON.stringify(result, null, 2)
            : `Logged in to BuyAPI with ${result.keyPrefix} (${result.source}).`
        );
      }
      return;
    case "scan":
      {
        const scanTarget = resolveScanTarget(command.root);
        let scan: StackScanResult;
        try {
          scan = scanStack(scanTarget.root, {
            includeAll: command.all,
            repoUrl: scanTarget.repoUrl,
          });
        } finally {
          scanTarget.cleanup?.();
        }
        if (command.dryRun || (command.json && !command.sync)) {
          console.log(
            command.json
              ? JSON.stringify(scan, null, 2)
              : formatStackScan(scan, {
                  verbose: command.verbose,
                  syncHint: command.dryRun && command.sync,
                })
          );
          return;
        }

        if (!command.json) {
          console.log(formatStackScan(scan, {
            verbose: command.verbose,
            syncing: command.sync,
          }));
        }

        if (!hasSyncableScanData(scan, command.allowEmpty)) {
          if (command.json) {
            throw new Error(
              "No known tools to sync. Run from the project folder that contains vendor SDKs/config, or pass --allow-empty."
            );
          }
          if (command.sync && !command.json) {
            console.log(
              "No known tools were detected, so no stack was saved. Pass --allow-empty if you intentionally want an empty stack."
            );
          }
          return;
        }

        if (!command.sync) {
          if (!canPrompt()) return;
          const hasKey = Boolean(process.env.BUYAPI_API_KEY || readStoredApiKey());
          const confirmed = await promptYesNo(
            hasKey
              ? "Save/update this private stack in your BuyAPI dashboard? [y/N] "
              : "Save this private stack to BuyAPI? This opens browser login first. [y/N] "
          );
          if (!confirmed) {
            console.log("No data was uploaded. Run buyapi scan --sync when you want to save this stack.");
            return;
          }
        } else if (!command.yes) {
          const confirmed = await confirmSync(
            scan.tools.length,
            scan.unknownDependencies.length
          );
          if (!confirmed) {
            console.log("Sync cancelled. No data was uploaded.");
            return;
          }
        }

        await ensureApiKeyForSync(command.sync);
        if (!command.json) printSyncPrivacyNotice(scan);
        await syncAndPrintStackScan(command, scan);
      }
      return;
    case "search": {
      const result = await searchVendors(command.query, command.category);
      console.log(
        command.json
          ? JSON.stringify(result, null, 2)
          : result.unknown
            ? formatUnknown(result.unknown)
            : formatSearchResults(result.results)
      );
      return;
    }
    case "details": {
      const result = await getVendorDetails(command.vendorId, command.query);
      console.log(
        command.json ? JSON.stringify(result, null, 2) : formatVendorProfile(result)
      );
      return;
    }
    case "recommend": {
      const result = await recommendStack(
        command.projectDescription,
        command.constraints,
        command.workload
      );
      console.log(
        command.json
          ? JSON.stringify(result, null, 2)
          : formatStackRecommendation(result)
      );
      return;
    }
    case "compare": {
      const result = await compareVendors(
        command.vendorIds,
        command.query,
        command.workload
      );
      console.log(
        command.json
          ? JSON.stringify(result, null, 2)
          : formatDecisionMatrix(result.decisionMatrix)
      );
      return;
    }
    case "cost": {
      const result = await estimateCosts({
        vendorIds: command.vendorIds,
        category: command.category,
        workload: command.workload,
      });
      console.log(
        command.json
          ? JSON.stringify(result, null, 2)
          : formatCostEstimates(result.estimates)
      );
      return;
    }
    case "mcp":
      return;
  }
}

function setupText() {
  return `BuyAPI setup

Interactive setup:
  npx buyapi

Install BuyAPI for an agent:
  ${SETUP_CLIENTS.map((client) => `  buyapi setup ${client}`).join("\n")}

Install the /stack planning skill where supported:
  buyapi setup claude-code --skill
  buyapi setup-skill codex

Install the CLI globally if you do not want to type npx:
  npm install -g buyapi
  buyapi scan

Default setup writes a hosted MCP URL:
  ${MCP_URL}

If your client needs a local stdio server, configure it to run:
  buyapi setup <client> --local

To inspect config instead of writing it:
  buyapi setup <client> --print
  buyapi setup-skill <client> --print

For stack-aware recommendations:
  1. Run: buyapi login
  2. Run: buyapi scan --sync --yes

Read the docs: https://buyapi.ai/docs`;
}

async function runInteractiveSetup(defaultMode: "remote" | "local") {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("BuyAPI interactive setup");
    console.log("");
    console.log("Choose your coding agent:");
    SETUP_CLIENTS.forEach((client, index) => {
      console.log(`  ${index + 1}. ${client}`);
    });

    const clientAnswer = await rl.question("Agent [1]: ");
    const client =
      SETUP_CLIENTS[Number(clientAnswer.trim() || "1") - 1] ?? SETUP_CLIENTS[0];

    const modeAnswer = await rl.question(
      `Use hosted MCP URL? ${defaultMode === "remote" ? "[Y/n]" : "[y/N]"} `
    );
    const normalizedModeAnswer = modeAnswer.trim().toLowerCase();
    const mode =
      normalizedModeAnswer === ""
        ? defaultMode
        : normalizedModeAnswer.startsWith("y")
          ? "remote"
          : "local";

    const result = installClientConfig(client, mode);
    console.log(result.message);
    console.log(
      result.changed ? "Updated config." : "Config was already up to date."
    );
    printSetupModeSummary(mode);

    const skillClient = skillClientForSetup(client);
    if (skillClient) {
      const skillAnswer = await rl.question(
        "Install the /stack planning skill? [Y/n] "
      );
      if (!skillAnswer.trim().toLowerCase().startsWith("n")) {
        const skillResult = installStackSkill(skillClient);
        console.log(skillResult.message);
        console.log(
          skillResult.changed
            ? "Updated /stack skill."
            : "/stack skill was already up to date."
        );
      } else {
        console.log("Skipped /stack skill. You can run buyapi setup-skill later.");
      }
    } else {
      console.log(
        "/stack skill install is currently available for Claude Code and Codex."
      );
    }

    const loginAnswer = await rl.question(
      "Login now for higher limits and stack sync? [Y/n] "
    );
    if (!loginAnswer.trim().toLowerCase().startsWith("n")) {
      const key = await runBrowserLogin();
      console.log(`BuyAPI API key saved to ${configPath()}`);
      console.log(`Logged in with key ${key.slice(0, 16)}...`);
    } else {
      console.log("Skipped login. You can run buyapi login later.");
    }

    console.log("");
    console.log("Next steps:");
    console.log("  Restart your agent so it reloads MCP config.");
    console.log("  buyapi scan");
    console.log("  buyapi scan --sync --yes");
    console.log("");
    console.log("If you do not want to type npx later:");
    console.log("  npm install -g buyapi");
  } finally {
    rl.close();
  }
}

function printSetupModeSummary(mode: "remote" | "local") {
  if (mode === "remote") {
    console.log(`Configured hosted MCP: ${MCP_URL}`);
    return;
  }
  console.log("Configured local MCP over stdio.");
  console.log("Your agent will run this command when it starts BuyAPI:");
  console.log("  npx -y buyapi mcp");
  console.log("You do not need to run that server manually.");
}

function hasSyncableScanData(scan: StackScanResult, allowEmpty: boolean) {
  if (allowEmpty) {
    return (
      scan.tools.length > 0 ||
      scan.unknownDependencies.length > 0 ||
      Object.values(scan.context).some((values) => values.length > 0)
    );
  }
  return scan.tools.length > 0;
}

function canPrompt() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function ensureApiKeyForSync(explicitSync: boolean) {
  if (process.env.BUYAPI_API_KEY || readStoredApiKey()) return;

  if (!canPrompt()) {
    throw new Error(
      "scan --sync requires an API key. Run buyapi login or set BUYAPI_API_KEY."
    );
  }

  if (explicitSync) {
    const confirmed = await promptYesNo(
      "scan --sync needs a BuyAPI login. Open browser login now? [Y/n] ",
      true
    );
    if (!confirmed) {
      throw new Error("Sync cancelled. Run buyapi login when you are ready.");
    }
  }

  const key = await runBrowserLogin();
  console.log(`BuyAPI API key saved to ${configPath()}`);
  console.log(`Logged in with key ${key.slice(0, 16)}...`);
}

async function syncAndPrintStackScan(
  command: Extract<ReturnType<typeof parseCliCommand>, { name: "scan" }>,
  scan: StackScanResult
) {
  const result = await syncStackScan({
    projectName:
      command.projectName ??
      command.stackSlug ??
      inferProjectName(command.root ?? process.cwd()),
    stackSlug: command.stackSlug,
    summary: command.summary,
    scan,
  });
  console.log(
    command.json
      ? JSON.stringify(result, null, 2)
      : `Stack ${result.updated ? "updated" : "saved"}: ${result.url}\nSynced ${scan.tools.length} detected tool${scan.tools.length === 1 ? "" : "s"}${
          scan.repoUrl ? ` from ${scan.repoUrl}` : ""
        }.${
          result.candidateCount
            ? `\nQueued ${result.candidateCount} unknown package candidates for review.`
            : ""
        }`
  );
}

function printSyncPrivacyNotice(scan: StackScanResult) {
  console.log("");
  console.log(
    "Sync uploads the stack name, detected tools, derived stack context, file names checked, and package names queued for review."
  );
  console.log("Source code and environment values are not uploaded.");
  if (scan.tools.length === 0) {
    console.log("No known tools were detected in this scan.");
  }
  console.log("");
}

function resolveScanTarget(rootArg: string | undefined): {
  root: string;
  repoUrl?: string;
  cleanup?: () => void;
} {
  if (!rootArg) return { root: process.cwd() };
  const repoUrl = normalizeGithubRepoUrl(rootArg);
  if (!repoUrl) return { root: rootArg };

  const target = mkdtempSync(join(tmpdir(), "buyapi-scan-repo-"));
  execFileSync("git", ["clone", "--depth", "1", repoUrl, target], {
    stdio: "ignore",
  });
  return {
    root: target,
    repoUrl,
    cleanup: () => rmSync(target, { recursive: true, force: true }),
  };
}

function normalizeGithubRepoUrl(value: string): string | null {
  const httpsMatch = value.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (httpsMatch) {
    return `https://github.com/${httpsMatch[1]}/${httpsMatch[2].replace(/\.git$/i, "")}.git`;
  }
  const sshMatch = value.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (sshMatch) {
    return `https://github.com/${sshMatch[1]}/${sshMatch[2].replace(/\.git$/i, "")}.git`;
  }
  return null;
}

function inferProjectName(root: string) {
  const repoUrl = normalizeGithubRepoUrl(root);
  if (repoUrl) {
    return repoUrl
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.replace(/\.git$/i, "") || "Untitled stack";
  }
  return root.split(/[\\/]/).filter(Boolean).at(-1) || "Untitled stack";
}

function setupPrintText(
  client: "claude-code" | "cursor" | "codex" | "windsurf" | "cline",
  mode: "remote" | "local",
  includeSkill = false
) {
  const vscode = client === "cline";
  const mcpText = `BuyAPI config for ${client}
Path: ${setupTargetPath(client)}

${client === "codex" ? codexPrintSnippet(mode) : setupSnippet(mode, vscode)}`;
  if (!includeSkill) return mcpText;
  const skillClient = skillClientForSetup(client);
  if (!skillClient) {
    return `${mcpText}

/stack skill install is currently available for Claude Code and Codex.`;
  }
  return `${mcpText}

${setupSkillPrintText(skillClient)}`;
}

function codexPrintSnippet(mode: "remote" | "local") {
  return mode === "remote"
    ? `[mcp_servers.buyapi]\nurl = "${MCP_URL}"`
    : `[mcp_servers.buyapi]\ncommand = "npx"\nargs = ["-y", "buyapi", "mcp"]`;
}

async function confirmSync(
  toolCount: number,
  unknownCandidateCount: number
): Promise<boolean> {
  if (!canPrompt()) return false;
  return promptYesNo(
    `Sync ${toolCount} detected tools${
      unknownCandidateCount ? ` and ${unknownCandidateCount} unknown package candidates` : ""
    } to your private BuyAPI dashboard? [y/N] `
  );
}

async function promptYesNo(message: string, defaultYes = false): Promise<boolean> {
  if (!canPrompt()) return false;
  process.stdout.write(message);
  const answer = await new Promise<string>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", (chunk) => {
      process.stdin.pause();
      resolve(String(chunk).trim().toLowerCase());
    });
  });
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

function skillClientForSetup(client: SetupClient): SkillClient | null {
  if (client === "claude-code" || client === "codex") return client;
  return null;
}

function setupSkillText() {
  return `BuyAPI /stack skill setup

Install:
${SKILL_CLIENTS.map((client) => `  buyapi setup-skill ${client}`).join("\n")}

Add it during MCP setup:
  buyapi setup claude-code --skill
  buyapi setup codex --skill

To inspect the skill instead of writing it:
  buyapi setup-skill <client> --print`;
}

function setupSkillPrintText(client: SkillClient) {
  return `BuyAPI /stack skill for ${client}
Path: ${stackSkillTargetPath(client)}

${stackSkillContent()}`;
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? `Error: ${error.message}` : String(error)
    );
    process.exit(1);
  });
}
