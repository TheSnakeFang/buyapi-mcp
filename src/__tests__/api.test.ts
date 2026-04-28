import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the API client URL construction and error handling
// We mock fetch since these tests verify the client logic, not the backend

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after stubbing fetch
const { searchVendors, getVendorDetails, recommendStack } = await import(
  "../lib/api.js"
);

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

describe("User-Agent header", () => {
  it("includes buyapi version in all requests", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    await searchVendors("test", "database");

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["User-Agent"]).toContain("buyapi/0.3.1");
  });
});
