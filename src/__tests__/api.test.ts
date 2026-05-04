import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the API client URL construction and error handling
// We mock fetch since these tests verify the client logic, not the backend

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after stubbing fetch
const {
  searchVendors,
  getVendorDetails,
  recommendStack,
  getEvidence,
  findSimilarStacks,
} = await import("../lib/api.js");
const { PACKAGE_VERSION } = await import("../lib/version.js");

beforeEach(() => {
  mockFetch.mockReset();
  // Reset env
  delete process.env.BUYAPI_API_URL;
  delete process.env.BUYAPI_API_KEY;
});

describe("searchVendors", () => {
  it("calls the correct URL with query params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    await searchVendors("real-time app", "database");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/vendors/search");
    expect(url).toContain("query=real-time+app");
    expect(url).toContain("category=database");
  });

  it("defaults to buyapi.ai when no env var set", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    await searchVendors("test", "database");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/^https:\/\/buyapi\.ai/);
  });

  it("throws on non-ok response with status info", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: () => Promise.resolve("Rate limit exceeded"),
    });

    await expect(searchVendors("test", "database")).rejects.toThrow(
      "429 Too Many Requests"
    );
  });

  it("surfaces structured rate-limit upgrade guidance", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: () =>
        Promise.resolve(
          JSON.stringify({
            message: "Anonymous BuyAPI rate limit exceeded.",
            retryAfter: 12,
            upgradeUrl: "https://buyapi.ai/dashboard",
            docsUrl: "https://buyapi.ai/docs#limits",
          })
        ),
    });

    await expect(searchVendors("test", "database")).rejects.toThrow(
      "Anonymous BuyAPI rate limit exceeded. Retry after 12s. Dashboard: https://buyapi.ai/dashboard Limits: https://buyapi.ai/docs#limits"
    );
  });
});

describe("getVendorDetails", () => {
  it("constructs clean URL without encoding slashes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await getVendorDetails("/database/supabase", "free tier limits");

    const [url] = mockFetch.mock.calls[0];
    // Should be /api/vendors/database/supabase — no %2F encoding
    expect(url).toContain("/api/vendors/database/supabase");
    expect(url).not.toContain("%2F");
    expect(url).toContain("query=free+tier+limits");
  });

  it("handles vendor IDs without leading slash", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await getVendorDetails("database/supabase");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/vendors/database/supabase");
  });

  it("omits query param when not provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await getVendorDetails("/database/neon");

    const [url] = mockFetch.mock.calls[0];
    expect(url).not.toContain("query=");
  });
});

describe("recommendStack", () => {
  it("sends POST with correct body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stack: {} }),
    });

    await recommendStack("SaaS for restaurants", "under $50/month");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/recommend");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.projectDescription).toBe("SaaS for restaurants");
    expect(body.constraints).toBe("under $50/month");
  });

  it("can send existing stack context", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stack: {} }),
    });

    await recommendStack("B2B app", undefined, undefined, [
      {
        vendorSlug: "/database/convex",
        category: "database",
        confidence: "high",
      },
    ]);

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.stackContext).toEqual([
      {
        vendorSlug: "/database/convex",
        category: "database",
        confidence: "high",
      },
    ]);
  });

  it("can send derived stack facts", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stack: {} }),
    });

    await recommendStack(
      "B2B app",
      undefined,
      undefined,
      undefined,
      {
        languages: ["TypeScript"],
        frameworks: ["Next.js", "React"],
        packageManagers: ["pnpm"],
      }
    );

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.stackFacts).toEqual({
      languages: ["TypeScript"],
      frameworks: ["Next.js", "React"],
      packageManagers: ["pnpm"],
    });
  });

  it("sends API key as Bearer token when set", async () => {
    process.env.BUYAPI_API_KEY = "ba_live_test123";
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stack: {} }),
    });

    // Re-import to pick up env change — actually the module caches,
    // but the request function reads env at call time
    await recommendStack("test project");

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer ba_live_test123");
  });
});

describe("getEvidence", () => {
  it("calls the evidence endpoint with subject params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ evidence: [] }),
    });

    await getEvidence({
      subjectType: "vendor",
      subjectId: "/database/supabase",
      limit: 5,
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/evidence");
    expect(url).toContain("subjectType=vendor");
    expect(url).toContain("subjectId=%2Fdatabase%2Fsupabase");
    expect(url).toContain("limit=5");
  });
});

describe("findSimilarStacks", () => {
  it("calls the similar stacks endpoint with optional vendor", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stacks: [] }),
    });

    await findSimilarStacks({ vendorId: "/database/convex", limit: 3 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/stacks/similar");
    expect(url).toContain("vendorId=%2Fdatabase%2Fconvex");
    expect(url).toContain("limit=3");
  });
});

describe("User-Agent header", () => {
  it("includes buyapi version in all requests", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    await searchVendors("test", "database");

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["User-Agent"]).toContain(`buyapi/${PACKAGE_VERSION}`);
  });
});
