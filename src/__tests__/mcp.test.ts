import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMcpServer } from "../index.js";
import { getVendorDetails, searchVendors } from "../lib/api.js";

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
  vi.mocked(getVendorDetails).mockReset();
});

describe("BuyAPI MCP server", () => {
  it("declares output schemas for every public tool", async () => {
    const { client, server } = await connectTestClient();
    try {
      const { tools } = await client.listTools();

      expect(client.getInstructions()).toContain(
        "before choosing, installing, or replacing a software vendor"
      );

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

  it("passes through decision matrix rows from vendor resolution", async () => {
    vi.mocked(searchVendors).mockResolvedValue({
      results: [
        {
          id: "/database/neon",
          name: "Neon",
          description: "Branchable serverless Postgres",
          pricingModel: "freemium",
          bestFor: "serverless Postgres with branching",
          lastUpdated: "2026-04-17",
          confidence: "medium",
        },
      ],
      decisionMatrix: [
        {
          layer: "database",
          vendor: "/database/neon",
          vendorName: "Neon",
          fit: "strong",
          why: "Neon fits a branchable Postgres side project.",
          capabilities: [],
          tradeoffs: ["Verify exact included usage before production."],
          estimatedMonthlyCost: "$0",
          confidence: "medium",
          dataFreshness: "fresh",
          sources: [
            {
              path: "pricing",
              summary: "Neon pricing and free tier",
              sourceUrl: "https://neon.tech/pricing",
              observedAt: "2026-04-17",
              confidence: "medium",
              staleAfter: "2026-07-16",
            },
          ],
        },
      ],
    });

    const { client, server } = await connectTestClient();
    try {
      await client.listTools();
      const result = await client.callTool({
        name: "vendors.resolve",
        arguments: {
          query: "postgres for a weekend project with a free tier",
          category: "database",
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        results: [{ id: "/database/neon" }],
        decisionMatrix: [
          expect.objectContaining({
            vendor: "/database/neon",
            fit: "strong",
          }),
        ],
      });
      expect((result.content as Array<{ text?: string }>)[0]).toMatchObject({
        text: expect.stringContaining("Top fit: Neon"),
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
        coverage: expect.objectContaining({ status: "not-in-corpus" }),
        claims: [],
        availableCategories: ["database", "auth", "hosting", "payments", "email"],
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("adds claim ledger and coverage to vendor details", async () => {
    vi.mocked(getVendorDetails).mockResolvedValue({
      id: "convex",
      slug: "/database/convex",
      name: "Convex",
      category: "database",
      subcategories: ["realtime"],
      url: "https://www.convex.dev/pricing",
      description: "Reactive backend",
      positioning: "Realtime backend",
      pricing: {
        model: "freemium",
        freeTier: {
          exists: true,
          generous: true,
          keyLimits: ["starter usage"],
          creditCardRequired: false,
          expiresAfter: null,
        },
        tiers: [{ name: "Pro", price: "$25/month", keyInclusions: ["team"] }],
        estimatedMonthlyCost: {
          at100Users: "$0",
          at1kUsers: "$25",
          at10kUsers: "$100+",
          firstPaidTrigger: "team or usage",
        },
      },
      features: [],
      limits: [
        {
          dimension: "bandwidth",
          free: "limited",
          paid: "higher",
          notes: "see pricing",
        },
      ],
      company: {
        founded: 2021,
        funding: "unknown",
        teamSize: "unknown",
        headquarters: "unknown",
        openSource: false,
        githubStars: null,
        status: "active",
      },
      signals: {
        lastMajorUpdate: "2026-04-17",
        updateFrequency: "monthly",
        knownIssues: [],
        breakingChanges: [],
        communitySize: "unknown",
      },
      comparisons: [],
      lastUpdated: "2026-04-17",
      dataSource: "manual",
      confidence: "medium",
    });

    const { client, server } = await connectTestClient();
    try {
      await client.listTools();
      const result = await client.callTool({
        name: "vendors.details",
        arguments: { vendorId: "/database/convex" },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        claims: expect.arrayContaining([
          expect.objectContaining({
            id: "database.convex.pricing-model",
            type: "pricing",
          }),
        ]),
        coverage: expect.objectContaining({ status: "covered" }),
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
