import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchVendors, getVendorDetails, recommendStack } from "./lib/api.js";
import {
  formatSearchResults,
  formatVendorProfile,
  formatStackRecommendation,
} from "./lib/format.js";

const server = new McpServer({
  name: "buyapi-mcp",
  version: "0.1.0",
});

// Tool 1: resolve-vendor
server.tool(
  "resolve-vendor",
  `Resolves a product category or vendor name into BuyAPI vendor IDs with comparison metadata.
You MUST call this before 'get-vendor-details' to find the correct vendor ID.

Selection guidance:
- Choose vendors marked as "Best for" matching the user's stated requirements
- Consider pricing model alignment with the user's scale expectations
- Prefer vendors with more recent "Last updated" dates
- If multiple vendors match equally, return the top 3-4 for the user to evaluate

IMPORTANT: Do not call this tool more than 3 times per question.
Do not include sensitive information (API keys, passwords) in queries.`,
  {
    query: z
      .string()
      .describe(
        "The user's question or task context. Used for relevance ranking. Example: 'I need a database for a real-time collaborative app with 10K users'"
      ),
    category: z
      .string()
      .describe(
        "The vendor category to search. Example: 'database', 'auth', 'hosting', 'payments', 'email'"
      ),
  },
  async ({ query, category }) => {
    try {
      const data = await searchVendors(query, category);
      return {
        content: [{ type: "text", text: formatSearchResults(data.results) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching vendors: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 2: get-vendor-details
server.tool(
  "get-vendor-details",
  `Retrieves detailed vendor information including pricing, features, limits, and comparisons.
You must call 'resolve-vendor' first to obtain the vendor ID, UNLESS the user provides
a vendor ID in the format '/category/vendor-name' directly.

The response includes concrete pricing numbers, free tier limits, and scaling characteristics.
Use this data to make specific recommendations based on the user's constraints.

IMPORTANT: Do not call this tool more than 3 times per question.`,
  {
    vendorId: z
      .string()
      .describe(
        "BuyAPI vendor ID from resolve-vendor (e.g., '/database/supabase')"
      ),
    query: z
      .string()
      .describe("The specific question or use case to focus the response on"),
  },
  async ({ vendorId, query }) => {
    try {
      const vendor = await getVendorDetails(vendorId, query);
      return {
        content: [{ type: "text", text: formatVendorProfile(vendor) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching vendor details: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 3: recommend-stack
server.tool(
  "recommend-stack",
  `Recommends a complete technology stack based on project requirements and constraints.
Returns vendor recommendations for each infrastructure layer with cost projections.

Call this when the user is starting a new project and needs full stack guidance.
Do NOT call resolve-vendor or get-vendor-details first — this tool handles everything.

Provide as much context as possible about the project: what it does, expected scale,
budget constraints, existing accounts/tools, team size, and any compliance requirements.
The more specific the input, the better the recommendation.`,
  {
    projectDescription: z
      .string()
      .describe(
        "What the user is building. Example: 'A SaaS app for restaurant inventory management with real-time updates'"
      ),
    constraints: z
      .string()
      .optional()
      .describe(
        "Budget, scale expectations, existing accounts, compliance needs, team size. Example: 'Solo founder, want to stay under $50/month until 1000 users, already have a Vercel account'"
      ),
  },
  async ({ projectDescription, constraints }) => {
    try {
      const recommendation = await recommendStack(
        projectDescription,
        constraints
      );
      return {
        content: [
          { type: "text", text: formatStackRecommendation(recommendation) },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating recommendation: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BuyAPI MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
