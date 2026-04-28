import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  compareVendors,
  estimateCosts,
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
import { formatStackScan, scanStack } from "./lib/scan.js";
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

server.tool(
  "resolve-vendor",
  `Finds BuyAPI vendor IDs for a user question. Category is optional; provide it when known.

Use this for vendor discovery before get-vendor-details, or when the user asks which provider in a category fits their constraints.
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
  "get-vendor-details",
  `Retrieves detailed vendor information including pricing, features, limits, gotchas, comparisons, and source provenance.

Call resolve-vendor first unless the user already provided a BuyAPI vendor ID like /database/supabase.`,
  {
    vendorId: z.string().describe("BuyAPI vendor ID, e.g. /database/supabase"),
    query: z
      .string()
      .optional()
      .describe("Specific question to focus the response on"),
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

server.tool(
  "compare-vendors",
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
  "estimate-cost",
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
  "recommend-stack",
  `Recommends a complete stack from BuyAPI's corpus with a structured decision matrix, cost estimate, assumptions, unknowns, alternatives, and sources.

Use this when the user is starting a project or asks for a complete stack choice. Do not call resolve-vendor first; this tool handles retrieval and ranking.`,
  {
    projectDescription: z.string().describe("What the user is building"),
    constraints: z
      .string()
      .optional()
      .describe("Budget, scale, existing tools, team size, compliance needs"),
    workload: workloadSchema.optional(),
  },
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
      console.log(setupText());
      return;
    case "version":
      console.log(`${PACKAGE_NAME} ${PACKAGE_VERSION}`);
      return;
    case "help":
      console.log(helpText());
      return;
    case "login":
      if (!command.apiKey) {
        console.log(loginHelpText());
        return;
      }
      writeStoredApiKey(command.apiKey);
      console.log(`BuyAPI API key saved to ${configPath()}`);
      return;
    case "logout":
      clearStoredApiKey();
      console.log("BuyAPI API key removed.");
      return;
    case "scan":
      {
        const scan = scanStack(command.root ?? process.cwd());
        if (!command.sync) {
          console.log(
            command.json ? JSON.stringify(scan, null, 2) : formatStackScan(scan)
          );
          return;
        }
        if (!process.env.BUYAPI_API_KEY && !readStoredApiKey()) {
          throw new Error(
            "scan --sync requires an API key. Run buyapi login <api-key> or set BUYAPI_API_KEY."
          );
        }
        const result = await syncStackScan({
          projectName:
            command.projectName ??
            inferProjectName(command.root ?? process.cwd()),
          summary: command.summary,
          scan,
        });
        console.log(
          command.json
            ? JSON.stringify(result, null, 2)
            : `Stack ${result.updated ? "updated" : "saved"}: ${result.url}`
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

Recommended: add the hosted MCP endpoint to your agent.
  URL: https://buyapi.ai/api/mcp

If your client needs a local stdio server, configure it to run:
  npx -y buyapi mcp

For stack-aware recommendations:
  1. Create an API key at https://buyapi.ai/dashboard
  2. Run: buyapi login <api-key>
  3. Run: buyapi scan --sync

Read the docs: https://buyapi.ai/docs`;
}

function loginHelpText() {
  return `BuyAPI login

Create an API key at https://buyapi.ai/dashboard, then run:
  buyapi login <api-key>

You can also set BUYAPI_API_KEY in your environment for CI or one-off runs.`;
}

function inferProjectName(root: string) {
  return root.split(/[\\/]/).filter(Boolean).at(-1) || "Untitled stack";
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
