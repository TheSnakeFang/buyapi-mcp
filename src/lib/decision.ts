import type {
  DecisionMatrixRow,
  ClaimLedgerEntry,
  CoverageSignal,
  VendorClaim,
  VendorCostEstimate,
  VendorProfile,
  WorkloadInput,
} from "./types.js";

export function buildVendorClaims(vendor: VendorProfile): VendorClaim[] {
  if (vendor.claims?.length) return vendor.claims;
  return [
    {
      path: "pricing",
      summary: `${vendor.name} pricing model, tier names, and scale estimates`,
      sourceUrl: vendor.url,
      observedAt: vendor.lastUpdated,
      confidence: vendor.confidence,
      staleAfter: addDays(vendor.lastUpdated, 90),
    },
    {
      path: "limits",
      summary: `${vendor.name} free and paid limits`,
      sourceUrl: vendor.url,
      observedAt: vendor.lastUpdated,
      confidence: vendor.confidence,
      staleAfter: addDays(vendor.lastUpdated, 90),
    },
  ];
}

export function buildClaimLedgerFromVendor(vendor: VendorProfile): ClaimLedgerEntry[] {
  const claims = buildVendorClaims(vendor);
  const pricingClaim = claims.find((claim) => claim.path.startsWith("pricing"));
  const limitsClaim = claims.find((claim) => claim.path.startsWith("limits"));
  const entries: ClaimLedgerEntry[] = [
    {
      id: claimId(vendor.slug, "pricing-model"),
      type: "pricing",
      text: `${vendor.name} pricing model is recorded as ${vendor.pricing.model}.`,
      sourceUrls: sourceUrls(pricingClaim),
      observedAt: pricingClaim?.observedAt ?? vendor.lastUpdated,
      confidence: pricingClaim?.confidence ?? vendor.confidence,
    },
  ];

  if (vendor.pricing.freeTier) {
    entries.push({
      id: claimId(vendor.slug, "free-tier"),
      type: "pricing",
      text: `${vendor.name} free tier is recorded as ${vendor.pricing.freeTier.exists ? "available" : "not available"} with limits: ${vendor.pricing.freeTier.keyLimits.join(", ") || "none recorded"}.`,
      sourceUrls: sourceUrls(pricingClaim),
      observedAt: pricingClaim?.observedAt ?? vendor.lastUpdated,
      confidence: pricingClaim?.confidence ?? vendor.confidence,
    });
  }

  for (const tier of vendor.pricing.tiers) {
    entries.push({
      id: claimId(vendor.slug, `tier-${tier.name}`),
      type: "pricing",
      text: `${vendor.name} ${tier.name} tier is recorded as ${tier.price}; inclusions: ${tier.keyInclusions.join(", ") || "none recorded"}.`,
      sourceUrls: sourceUrls(pricingClaim),
      observedAt: pricingClaim?.observedAt ?? vendor.lastUpdated,
      confidence: pricingClaim?.confidence ?? vendor.confidence,
    });
  }

  for (const limit of vendor.limits) {
    entries.push({
      id: claimId(vendor.slug, `limit-${limit.dimension}`),
      type: "limit",
      text: `${vendor.name} ${limit.dimension} limit is recorded as free: ${limit.free}; paid: ${limit.paid}${limit.notes ? `; notes: ${limit.notes}` : ""}.`,
      sourceUrls: sourceUrls(limitsClaim),
      observedAt: limitsClaim?.observedAt ?? vendor.lastUpdated,
      confidence: limitsClaim?.confidence ?? vendor.confidence,
    });
  }

  return entries;
}

export function buildClaimLedgerFromCostEstimate(
  estimate: VendorCostEstimate
): ClaimLedgerEntry[] {
  const primary = estimate.sources[0];
  return [
    {
      id: claimId(estimate.vendorId, "computed-cost"),
      type: "cost-estimate",
      text: `${estimate.vendorName} estimated monthly cost is ${estimate.display}. Basis: ${estimate.basis}.`,
      sourceUrls: estimate.sources.map((source) => source.sourceUrl),
      observedAt: primary?.observedAt ?? new Date().toISOString().slice(0, 10),
      confidence: estimate.confidence,
      value: estimate.monthlyUsd,
      unit: "USD/month",
      formula: estimate.basis,
      computed: estimate.monthlyUsd !== null,
      assumption: estimate.assumptions.length > 0,
      inputs: {
        assumptions: estimate.assumptions,
        unknowns: estimate.unknowns,
      },
    },
  ];
}

export function buildClaimLedgerFromDecisionMatrix(
  rows: DecisionMatrixRow[]
): ClaimLedgerEntry[] {
  return uniqueLedger(
    rows.flatMap((row) =>
      row.sources.map((source) => ({
        id: claimId(row.vendor, source.path),
        type: source.path.startsWith("limits")
          ? "limit"
          : source.path.startsWith("pricing")
            ? "pricing"
            : "source",
        text: `${row.vendorName}: ${source.summary}.`,
        sourceUrls: [source.sourceUrl],
        observedAt: source.observedAt,
        confidence: source.confidence,
      }))
    )
  );
}

export function coverageForVendors(args: {
  vendors: VendorProfile[];
  requestedVendorIds?: string[];
  category?: string;
}): CoverageSignal {
  if (args.vendors.length === 0) {
    return {
      status: "unknown",
      category: args.category,
      message: "BuyAPI did not find matching reviewed vendor profiles for this request.",
    };
  }
  return {
    status: "covered",
    category: args.category ?? args.vendors[0]?.category,
    message: `BuyAPI has reviewed profile coverage for ${args.vendors.length} vendor(s) in this result.`,
  };
}

export function estimateVendorCost(
  vendor: VendorProfile,
  workload: WorkloadInput = {}
): VendorCostEstimate {
  const usageEstimate = estimateUsageCost(vendor, workload);
  const assumptions = inferAssumptions(vendor.category, workload);
  const sources = buildVendorClaims(vendor).filter((claim) =>
    ["pricing", "limits"].some((path) => claim.path.startsWith(path))
  );

  if (usageEstimate) {
    return {
      vendorId: vendor.slug,
      vendorName: vendor.name,
      category: vendor.category,
      monthlyUsd: usageEstimate.monthlyUsd,
      display: formatUsd(usageEstimate.monthlyUsd),
      basis: usageEstimate.basis,
      confidence: vendor.confidence,
      assumptions,
      unknowns: [],
      sources,
    };
  }

  const scale = pickScaleCost(vendor, workload);
  const monthlyUsd = parseFirstUsd(scale.value);
  return {
    vendorId: vendor.slug,
    vendorName: vendor.name,
    category: vendor.category,
    monthlyUsd,
    display: scale.value,
    basis: scale.basis,
    confidence: monthlyUsd === null ? "low" : vendor.confidence,
    assumptions,
    unknowns:
      monthlyUsd === null
        ? [`No machine-readable unit price for ${vendor.name}; using scale estimate text.`]
        : [],
    sources,
  };
}

export function buildDecisionMatrix(
  vendors: VendorProfile[],
  query: string,
  workload: WorkloadInput = {}
): DecisionMatrixRow[] {
  const requestedCapabilities = extractRequestedCapabilities(query);

  return vendors.map((vendor, index) => {
    const cost = estimateVendorCost(vendor, workload);
    return {
      layer: vendor.category,
      vendor: vendor.slug,
      vendorName: vendor.name,
      fit: index === 0 ? "strong" : index <= 2 ? "reasonable" : "weak",
      why: `${vendor.name} is ${vendor.positioning.toLowerCase()} for this query; cost basis is ${cost.display}.`,
      capabilities: requestedCapabilities.map((capability) =>
        assessCapability(vendor, capability)
      ),
      tradeoffs: vendor.signals.knownIssues.slice(0, 2),
      estimatedMonthlyCost: cost.display,
      confidence: cost.confidence,
      dataFreshness: freshnessLabel(vendor.lastUpdated),
      sources: buildVendorClaims(vendor),
    };
  });
}

type CapabilityDefinition = {
  label: string;
  queryPatterns: RegExp[];
  positivePatterns: RegExp[];
  partialPatterns?: RegExp[];
  negativePatterns?: RegExp[];
};

const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    label: "realtime",
    queryPatterns: [/\breal[-\s]?time\b/i, /\blive updates?\b/i, /\bcollaboration\b/i],
    positivePatterns: [/\breal[-\s]?time\b/i, /\bwebsockets?\b/i, /\blive updates?\b/i, /\breactive queries?\b/i],
    partialPatterns: [/\bsubscriptions?\b/i],
  },
  {
    label: "preview environments",
    queryPatterns: [/\bpreview\b/i, /\bbranch(?:es|ing)?\b/i, /\benvironments?\b/i],
    positivePatterns: [/\bpreview\b/i, /\bbranch(?:es|ing)?\b/i, /\bbranches\b/i, /\bstaging environments?\b/i],
    negativePatterns: [/\bno native preview\b/i, /\bmust configure manually\b/i],
  },
  {
    label: "auth",
    queryPatterns: [/\bauth\b/i, /\bauthentication\b/i, /\blogin\b/i, /\boauth\b/i],
    positivePatterns: [/\bauth\b/i, /\bauthentication\b/i, /\boauth\b/i, /\bmagic links?\b/i, /\bsso\b/i],
  },
  {
    label: "storage",
    queryPatterns: [/\bstorage\b/i, /\bfile uploads?\b/i, /\bobject storage\b/i, /\bs3\b/i],
    positivePatterns: [/\bstorage\b/i, /\bfile uploads?\b/i, /\bobject storage\b/i, /\bs3\b/i],
  },
  {
    label: "sql",
    queryPatterns: [/\bsql\b/i, /\bpostgres\b/i, /\bmysql\b/i],
    positivePatterns: [/\bsql\b/i, /\bpostgres\b/i, /\bmysql\b/i],
    negativePatterns: [/\bno raw sql\b/i, /\bdon't expose sql\b/i],
  },
];

function extractRequestedCapabilities(query: string): string[] {
  if (!query.trim()) return [];
  return CAPABILITY_DEFINITIONS.filter((capability) =>
    capability.queryPatterns.some((pattern) => pattern.test(query))
  ).map((capability) => capability.label);
}

function assessCapability(
  vendor: VendorProfile,
  capability: string
): DecisionMatrixRow["capabilities"][number] {
  const definition = CAPABILITY_DEFINITIONS.find(
    (item) => item.label === capability
  );
  if (!definition) {
    return {
      capability,
      support: "unknown",
      evidence: "BuyAPI has no capability rule for this query term yet.",
    };
  }

  const directFeature = vendor.features.find((feature) =>
    matchesAny(`${feature.key} ${feature.notes}`, definition.positivePatterns)
  );
  if (directFeature) {
    return {
      capability,
      support: directFeature.included ? "yes" : "no",
      evidence: `${directFeature.key}: ${directFeature.notes || directFeature.tier}`,
    };
  }

  const negativeIssue = [
    ...vendor.signals.knownIssues,
    ...vendor.comparisons.flatMap((comparison) => [
      comparison.advantage,
      comparison.disadvantage,
    ]),
  ].find((text) => matchesAny(text, definition.negativePatterns ?? []));
  if (negativeIssue) {
    return { capability, support: "no", evidence: negativeIssue };
  }

  const haystack = [
    vendor.name,
    vendor.category,
    ...(vendor.subcategories ?? []),
    vendor.description,
    vendor.positioning,
    ...vendor.features.flatMap((feature) => [feature.key, feature.notes]),
    ...vendor.limits.flatMap((limit) => [
      limit.dimension,
      limit.free,
      limit.paid,
      limit.notes,
    ]),
    ...vendor.signals.knownIssues,
    ...vendor.comparisons.flatMap((comparison) => [
      comparison.advantage,
      comparison.disadvantage,
    ]),
  ].join(" ");

  if (matchesAny(haystack, definition.positivePatterns)) {
    return {
      capability,
      support: "yes",
      evidence: `Mentioned in ${vendor.name} profile data.`,
    };
  }

  if (matchesAny(haystack, definition.partialPatterns ?? [])) {
    return {
      capability,
      support: "partial",
      evidence: `Related support appears in ${vendor.name} data, but the exact capability is not explicit.`,
    };
  }

  return {
    capability,
    support: "unknown",
    evidence: `No explicit ${capability} evidence is recorded for ${vendor.name}.`,
  };
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function estimateUsageCost(
  vendor: VendorProfile,
  workload: WorkloadInput
): { monthlyUsd: number; basis: string } | null {
  if (vendor.category === "email" && workload.emailSendsPerMonth) {
    const rate = findPerThousandEmailRate(vendor);
    if (rate !== null) {
      return {
        monthlyUsd: roundUsd((workload.emailSendsPerMonth / 1000) * rate),
        basis: `${workload.emailSendsPerMonth.toLocaleString()} emails/month at ${formatUsd(rate)} per 1,000 emails`,
      };
    }
  }

  if (vendor.category === "payments") {
    const fees = findTransactionFee(vendor);
    const revenue =
      workload.monthlyRevenueUsd ??
      (workload.monthlyTransactions && workload.averageTransactionUsd
        ? workload.monthlyTransactions * workload.averageTransactionUsd
        : null);
    if (fees && revenue !== null) {
      const fixedFee =
        workload.monthlyTransactions && fees.fixedUsd
          ? workload.monthlyTransactions * fees.fixedUsd
          : 0;
      return {
        monthlyUsd: roundUsd(revenue * fees.percent + fixedFee),
        basis: `${roundUsd(fees.percent * 100)}% + ${formatUsd(fees.fixedUsd)} per transaction on ${formatUsd(revenue)} monthly volume`,
      };
    }
  }

  return null;
}

function inferAssumptions(category: string, workload: WorkloadInput): string[] {
  const assumptions: string[] = [];
  if (category === "email" && !workload.emailSendsPerMonth) {
    assumptions.push("Email send volume was not provided.");
  }
  if (category === "auth" && !workload.authMau && !workload.monthlyActiveUsers) {
    assumptions.push("Auth MAU was not provided.");
  }
  if (
    category === "payments" &&
    !workload.monthlyRevenueUsd &&
    (!workload.monthlyTransactions || !workload.averageTransactionUsd)
  ) {
    assumptions.push("Payment volume was not provided.");
  }
  return assumptions;
}

function findPerThousandEmailRate(vendor: VendorProfile): number | null {
  const haystack = [
    vendor.description,
    ...vendor.pricing.tiers.map((tier) => tier.price),
    ...vendor.features.map((feature) => feature.notes),
    ...vendor.limits.flatMap((limit) => [limit.free, limit.paid, limit.notes]),
  ].join(" ");
  const match = haystack.match(/\$(\d+(?:\.\d+)?)\s*per\s*1,?000\s*emails/i);
  return match ? Number(match[1]) : null;
}

function findTransactionFee(
  vendor: VendorProfile
): { percent: number; fixedUsd: number } | null {
  const haystack = [
    ...vendor.pricing.tiers.map((tier) => tier.price),
    ...vendor.limits.flatMap((limit) => [limit.free, limit.paid, limit.notes]),
  ].join(" ");
  const percent = haystack.match(/(\d+(?:\.\d+)?)%/);
  const cents = haystack.match(/(?:\+\s*)?(\d+)c\b/i);
  if (!percent) return null;
  return {
    percent: Number(percent[1]) / 100,
    fixedUsd: cents ? Number(cents[1]) / 100 : 0,
  };
}

function pickScaleCost(
  vendor: VendorProfile,
  workload: WorkloadInput
): { value: string; basis: string } {
  const users =
    workload.users ?? workload.monthlyActiveUsers ?? workload.authMau ?? null;
  const cost = vendor.pricing.estimatedMonthlyCost;
  if (users === null) {
    return { value: cost.at1kUsers, basis: "default 1K-user scale estimate" };
  }
  if (users <= 100) {
    return { value: cost.at100Users, basis: `${users} users mapped to 100-user estimate` };
  }
  if (users <= 1000) {
    return { value: cost.at1kUsers, basis: `${users} users mapped to 1K-user estimate` };
  }
  return { value: cost.at10kUsers, basis: `${users} users mapped to 10K-user estimate` };
}

function freshnessLabel(lastUpdated: string): string {
  const updated = Date.parse(`${lastUpdated}T00:00:00.000Z`);
  if (Number.isNaN(updated)) return "unknown";
  const ageDays = Math.floor((Date.now() - updated) / 86_400_000);
  if (ageDays <= 30) return "fresh";
  if (ageDays <= 90) return "review soon";
  return "stale";
}

function addDays(date: string, days: number): string {
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return date;
  return new Date(parsed + days * 86_400_000).toISOString().slice(0, 10);
}

function parseFirstUsd(value: string): number | null {
  if (/\$0(?:\D|$)/.test(value)) return 0;
  const match = value.match(/\$([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ""));
}

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function sourceUrls(claim: VendorClaim | undefined): string[] {
  return claim?.sourceUrl ? [claim.sourceUrl] : [];
}

function claimId(vendorId: string, label: string): string {
  return `${vendorId.replace(/^\/+/, "").replaceAll("/", ".")}.${slugify(label)}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function uniqueLedger(claims: ClaimLedgerEntry[]): ClaimLedgerEntry[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    if (seen.has(claim.id)) return false;
    seen.add(claim.id);
    return true;
  });
}
