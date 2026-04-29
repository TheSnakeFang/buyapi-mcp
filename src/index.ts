import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createInterface } from "node:readline/promises";
import { z } from "zod";
import {
  compareVendors,
  estimateCosts,
  getAccountStatus,
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
import { formatStackScan, scanStack } from "./lib/scan.js";
import {
  installClientConfig,
  MCP_URL,
  SETUP_CLIENTS,
  setupSnippet,
  setupTargetPath,
} from "./lib/setup.js";
import {
  formatCostEstimates,
  formatDecisionMatrix,
  formatSearchResults,
  formatStackRecommendation,
  formatUnknown,
  formatVendorProfile,
} from "./lib/format.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./lib/version.js";

const server = new McpServer({
  name: PACKAGE_NAME,
  version: PACKAGE_VERSION,
});

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

server.tool(
  "vendors.resolve",
  `Finds BuyAPI vendor IDs for a user question. Category is optional; provide it when known.

Use this for vendor discovery before vendors.details, or when the user asks which provider in a category fits their constraints.
If the category is outside BuyAPI's corpus, the tool returns an explicit "not in corpus yet" result instead of inventing vendors.`,
  {
    query: z
      .string()
      .describe("The user's question or task context for relevance ranking"),
    category: z
      .string()
      .optional()
      .describe("Optional category: database, auth, hosting, payments, email"),
  },
  readOnlyTool,
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

server.tool(
  "vendors.details",
  `Retrieves detailed vendor information including pricing, features, limits, gotchas, comparisons, and source provenance.

Call vendors.resolve first unless the user already provided a BuyAPI vendor ID like /database/supabase.`,
  {
    vendorId: z.string().describe("BuyAPI vendor ID, e.g. /database/supabase"),
    query: z
      .string()
      .optional()
      .describe("Specific question to focus the response on"),
  },
  readOnlyTool,
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

server.tool(
  "vendors.compare",
  `Compares two or more BuyAPI vendors for a specific workload or decision.

Use this for head-to-head questions like "Convex vs Supabase vs Neon for a realtime SaaS" or "Stripe vs Paddle for a marketplace".`,
  {
    vendorIds: z
      .array(z.string())
      .min(2)
      .describe("BuyAPI vendor IDs, e.g. ['/database/convex', '/database/neon']"),
    query: z.string().describe("The user's decision context"),
    workload: workloadSchema.optional(),
  },
  readOnlyTool,
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

server.tool(
  "vendors.estimateCost",
  `Produces deterministic monthly cost estimates from BuyAPI pricing data and explicit workload inputs.

Use this when the user asks for cost math. Missing workload fields are returned as assumptions or unknowns instead of being hallucinated.`,
  {
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
  readOnlyTool,
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

server.tool(
  "stacks.recommend",
  `Recommends a complete stack from BuyAPI's corpus with a structured decision matrix, cost estimate, assumptions, unknowns, alternatives, and sources.

Use this when the user is starting a project or asks for a complete stack choice. Do not call vendors.resolve first; this tool handles retrieval and ranking.`,
  {
    projectDescription: z.string().describe("What the user is building"),
    constraints: z
      .string()
      .optional()
      .describe("Budget, scale, existing tools, team size, compliance needs"),
    workload: workloadSchema.optional(),
  },
  readOnlyTool,
  async ({ projectDescription, constraints, workload }) => {
    try {
      const recommendation = await recommendStack(
        projectDescription,
        constraints,
        workload
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

async function main() {
  const command = parseCliCommand(process.argv.slice(2));
  if (command.name !== "mcp") {
    await runCliCommand(command);
    return;
  }

  const transport = new StdioServerTransport();
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
        console.log(setupPrintText(command.client, command.mode));
        return;
      }
      {
        const result = installClientConfig(command.client, command.mode);
        console.log(result.message);
        console.log(
          result.changed ? "Updated config." : "Config was already up to date."
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
        const scan = scanStack(command.root ?? process.cwd(), {
          includeAll: command.all,
        });
        if (!command.sync || command.dryRun) {
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
        if (!process.env.BUYAPI_API_KEY && !readStoredApiKey()) {
          throw new Error(
            "scan --sync requires an API key. Run buyapi login or set BUYAPI_API_KEY."
          );
        }
        if (!command.yes && !command.json) {
          const confirmed = await confirmSync(scan.tools.length);
          if (!confirmed) {
            console.log("Sync cancelled. No data was uploaded.");
            return;
          }
        }
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
            : `Stack ${result.updated ? "updated" : "saved"}: ${result.url}${
                result.candidateCount
                  ? `\nQueued ${result.candidateCount} unknown package candidates for review.`
                  : ""
              }`
        );
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

Install the CLI globally if you do not want to type npx:
  npm install -g buyapi
  buyapi scan

Default setup writes a hosted MCP URL:
  ${MCP_URL}

If your client needs a local stdio server, configure it to run:
  buyapi setup <client> --local

To inspect config instead of writing it:
  buyapi setup <client> --print

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

function inferProjectName(root: string) {
  return root.split(/[\\/]/).filter(Boolean).at(-1) || "Untitled stack";
}

function setupPrintText(
  client: "claude-code" | "cursor" | "codex" | "windsurf" | "cline",
  mode: "remote" | "local"
) {
  const vscode = client === "cline";
  return `BuyAPI config for ${client}
Path: ${setupTargetPath(client)}

${client === "codex" ? codexPrintSnippet(mode) : setupSnippet(mode, vscode)}`;
}

function codexPrintSnippet(mode: "remote" | "local") {
  return mode === "remote"
    ? `[mcp_servers.buyapi]\nurl = "${MCP_URL}"`
    : `[mcp_servers.buyapi]\ncommand = "npx"\nargs = ["-y", "buyapi", "mcp"]`;
}

async function confirmSync(toolCount: number): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  process.stdout.write(
    `Sync ${toolCount} detected tools to your private BuyAPI dashboard? [y/N] `
  );
  const answer = await new Promise<string>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", (chunk) => {
      process.stdin.pause();
      resolve(String(chunk).trim().toLowerCase());
    });
  });
  return answer === "y" || answer === "yes";
}

main().catch((error) => {
  console.error(error instanceof Error ? `Error: ${error.message}` : String(error));
  process.exit(1);
});
