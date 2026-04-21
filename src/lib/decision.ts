import type {
  DecisionMatrixRow,
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
  return vendors.map((vendor, index) => {
    const cost = estimateVendorCost(vendor, workload);
    return {
      layer: vendor.category,
      vendor: vendor.slug,
      vendorName: vendor.name,
      fit: index === 0 ? "strong" : index <= 2 ? "reasonable" : "weak",
      why: `${vendor.name} is ${vendor.positioning.toLowerCase()} for this query; cost basis is ${cost.display}.`,
      tradeoffs: vendor.signals.knownIssues.slice(0, 2),
      estimatedMonthlyCost: cost.display,
      confidence: cost.confidence,
      dataFreshness: freshnessLabel(vendor.lastUpdated),
      sources: buildVendorClaims(vendor),
    };
  });
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
