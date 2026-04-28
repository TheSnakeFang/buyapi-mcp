import { describe, it, expect } from "vitest";
import {
  formatDecisionMatrix,
  formatSearchResults,
  formatVendorProfile,
  formatStackRecommendation,
} from "../lib/format.js";
import type {
  VendorSearchResult,
  VendorProfile,
  StackRecommendation,
} from "../lib/types.js";

describe("formatSearchResults", () => {
  it("returns helpful message when no results found", () => {
    const result = formatSearchResults([]);
    expect(result).toContain("No vendors found");
  });

  it("formats a single vendor result with all fields", () => {
    const results: VendorSearchResult[] = [
      {
        id: "/database/supabase",
        name: "Supabase",
        description: "Open-source Firebase alternative",
        pricingModel: "freemium",
        bestFor: "Full-stack apps with Postgres",
        lastUpdated: "2026-04-15",
      },
    ];
    const text = formatSearchResults(results);
    expect(text).toContain("**Supabase**");
    expect(text).toContain("/database/supabase");
    expect(text).toContain("freemium");
    expect(text).toContain("Full-stack apps with Postgres");
    expect(text).toContain("2026-04-15");
  });

  it("separates multiple vendors with dividers", () => {
    const results: VendorSearchResult[] = [
      {
        id: "/database/supabase",
        name: "Supabase",
        description: "desc1",
        pricingModel: "freemium",
        bestFor: "bf1",
        lastUpdated: "2026-04-15",
      },
      {
        id: "/database/neon",
        name: "Neon",
        description: "desc2",
        pricingModel: "freemium",
        bestFor: "bf2",
        lastUpdated: "2026-04-10",
      },
    ];
    const text = formatSearchResults(results);
    expect(text).toContain("---");
    expect(text).toContain("Supabase");
    expect(text).toContain("Neon");
  });
});

describe("formatDecisionMatrix", () => {
  it("includes capability-by-capability comparison rows", () => {
    const text = formatDecisionMatrix([
      {
        layer: "database",
        vendor: "/database/convex",
        vendorName: "Convex",
        fit: "strong",
        why: "Good fit.",
        capabilities: [
          {
            capability: "realtime",
            support: "yes",
            evidence: "Realtime sync",
          },
          {
            capability: "preview environments",
            support: "unknown",
            evidence: "No explicit preview environment evidence is recorded.",
          },
        ],
        tradeoffs: [],
        estimatedMonthlyCost: "$25/month",
        confidence: "high",
        dataFreshness: "fresh",
        sources: [],
      },
    ]);

    expect(text).toContain("Capabilities:");
    expect(text).toContain("realtime: yes");
    expect(text).toContain("preview environments: unknown");
  });
});

describe("formatVendorProfile", () => {
  const baseVendor: VendorProfile = {
    id: "supabase",
    slug: "/database/supabase",
    name: "Supabase",
    category: "database",
    subcategories: ["postgres"],
    url: "https://supabase.com",
    description: "Open-source Firebase alternative",
    positioning: "Best for full-stack apps",
    pricing: {
      model: "freemium",
      freeTier: {
        exists: true,
        generous: true,
        keyLimits: ["500MB database"],
        creditCardRequired: false,
        expiresAfter: null,
      },
      tiers: [
        { name: "Free", price: "$0/month", keyInclusions: ["500MB DB"] },
        { name: "Pro", price: "$25/month", keyInclusions: ["8GB DB"] },
      ],
      estimatedMonthlyCost: {
        at100Users: "$0",
        at1kUsers: "$25/month",
        at10kUsers: "$50/month",
        firstPaidTrigger: "DB exceeds 500MB",
      },
    },
    features: [
      { key: "Postgres", included: true, tier: "Free", notes: "Full Postgres" },
    ],
    limits: [
      { dimension: "DB size", free: "500MB", paid: "8GB", notes: "" },
    ],
    company: {
      founded: 2020,
      funding: "$116M Series C",
      teamSize: "100-500",
      headquarters: "Singapore",
      openSource: true,
      githubStars: 78000,
      status: "active",
    },
    signals: {
      lastMajorUpdate: "2026-03-01",
      updateFrequency: "weekly",
      knownIssues: ["Free tier pauses after inactivity"],
      breakingChanges: [],
      communitySize: "Large",
    },
    comparisons: [
      {
        vsVendor: "neon",
        advantage: "bundled auth/storage/realtime",
        disadvantage: "you only need serverless Postgres",
      },
    ],
    lastUpdated: "2026-04-15",
    dataSource: "manual",
    confidence: "high",
  };

  it("includes vendor name and description as heading", () => {
    const text = formatVendorProfile(baseVendor);
    expect(text).toContain("# Supabase");
    expect(text).toContain("Open-source Firebase alternative");
  });

  it("includes pricing tiers with prices", () => {
    const text = formatVendorProfile(baseVendor);
    expect(text).toContain("$0/month");
    expect(text).toContain("$25/month");
  });

  it("includes free tier info when present", () => {
    const text = formatVendorProfile(baseVendor);
    expect(text).toContain("Generous");
    expect(text).toContain("500MB database");
    expect(text).toContain("Credit card required:** No");
  });

  it("includes cost estimates at scale points", () => {
    const text = formatVendorProfile(baseVendor);
    expect(text).toContain("100 users: $0");
    expect(text).toContain("1K users: $25/month");
    expect(text).toContain("DB exceeds 500MB");
  });

  it("includes known issues", () => {
    const text = formatVendorProfile(baseVendor);
    expect(text).toContain("Free tier pauses after inactivity");
  });

  it("includes comparison data", () => {
    const text = formatVendorProfile(baseVendor);
    expect(text).toContain("vs neon");
    expect(text).toContain("bundled auth/storage/realtime");
  });

  it("includes company info with GitHub stars", () => {
    const text = formatVendorProfile(baseVendor);
    expect(text).toContain("78,000 stars");
    expect(text).toContain("$116M Series C");
  });
});

describe("formatStackRecommendation", () => {
  it("formats a complete stack recommendation", () => {
    const rec: StackRecommendation = {
      stack: {
        database: { vendor: "/database/supabase", reason: "Great free tier" },
        hosting: { vendor: "/hosting/vercel", reason: "Best for Next.js" },
      },
      costEstimate: {
        at100Users: "$0/month",
        at1kUsers: "$25/month",
        at10kUsers: "$75/month",
        firstPaidTrigger: "DB exceeds 500MB",
      },
      alternativeStack: {
        if: "You need reactive queries",
        swap: {
          database: { vendor: "/database/convex", reason: "Built-in reactivity" },
        },
      },
    };
    const text = formatStackRecommendation(rec);
    expect(text).toContain("Recommended Stack");
    expect(text).toContain("/database/supabase");
    expect(text).toContain("/hosting/vercel");
    expect(text).toContain("$0/month");
    expect(text).toContain("Alternative");
    expect(text).toContain("reactive queries");
  });

  it("handles null alternative stack", () => {
    const rec: StackRecommendation = {
      stack: {
        database: { vendor: "/database/neon", reason: "Pure Postgres" },
      },
      costEstimate: {
        at100Users: "$0",
        at1kUsers: "$20",
        at10kUsers: "$50",
        firstPaidTrigger: "Compute hours",
      },
      alternativeStack: null,
    };
    const text = formatStackRecommendation(rec);
    expect(text).toContain("/database/neon");
    expect(text).not.toContain("Alternative");
  });
});
