import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMcpServer } from "../index.js";
import { searchVendors } from "../lib/api.js";

vi.mock("../lib/api.js", () => ({
  compareVendors: vi.fn(),
  estimateCosts: vi.fn(),
  findSimilarStacks: vi.fn(),
  getAccountStatus: vi.fn(),
  getEvidence: vi.fn(),
  getVendorDetails: vi.fn(),
  recommendStack: vi.fn(),
  searchVendors: vi.fn(),
  syncStackScan: vi.fn(),
}));

const TOOL_NAMES = [
  "vendors.resolve",
  "vendors.details",
  "vendors.evidence",
  "stacks.findSimilar",
  "vendors.compare",
  "vendors.estimateCost",
  "stacks.recommend",
];

async function connectTestClient() {
  const server = createMcpServer();
  const client = new Client(
    { name: "buyapi-test-client", version: "0.1.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, server };
}

afterEach(() => {
  vi.mocked(searchVendors).mockReset();
});

describe("BuyAPI MCP server", () => {
  it("declares output schemas for every public tool", async () => {
    const { client, server } = await connectTestClient();
    try {
      const { tools } = await client.listTools();

      expect(tools.map((tool) => tool.name).sort()).toEqual(
        [...TOOL_NAMES].sort()
      );
      for (const tool of tools) {
        expect(tool.outputSchema, tool.name).toMatchObject({ type: "object" });
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("validates a successful structured response against outputSchema", async () => {
    vi.mocked(searchVendors).mockResolvedValue({
      results: [
        {
          id: "/database/convex",
          name: "Convex",
          description: "Reactive app backend",
          pricingModel: "usage-based",
          bestFor: "realtime TypeScript apps",
          lastUpdated: "2026-04-17",
          confidence: "medium",
        },
      ],
    });
    const { client, server } = await connectTestClient();
    try {
      await client.listTools();
      const result = await client.callTool({
        name: "vendors.resolve",
        arguments: {
          query: "database for realtime TypeScript app",
          category: "database",
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        results: [{ id: "/database/convex" }],
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("validates an unknown-corpus fallback against outputSchema", async () => {
    vi.mocked(searchVendors).mockResolvedValue({
      unknown: {
        kind: "unknown",
        query: "vector database for semantic search",
        message: "BuyAPI does not cover vector databases yet.",
        suggestedNextSteps: ["Use vendor docs directly."],
        availableCategories: ["database", "auth", "hosting", "payments", "email"],
      },
      results: [],
    });
    const { client, server } = await connectTestClient();
    try {
      await client.listTools();
      const result = await client.callTool({
        name: "vendors.resolve",
        arguments: {
          query: "vector database for semantic search",
          category: "vector-database",
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        message: "BuyAPI does not cover vector databases yet.",
        availableCategories: ["database", "auth", "hosting", "payments", "email"],
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
