// Shared types — duplicated in buyapi-app/lib/types.ts
// Extract to @buyapi/types package once types stabilize

export type VendorCategory =
  | "database"
  | "auth"
  | "hosting"
  | "payments"
  | "email"
  | "analytics"
  | "storage"
  | "cms"
  | "search"
  | "monitoring";

export interface VendorSearchResult {
  id: string;
  name: string;
  description: string;
  pricingModel: "free" | "freemium" | "usage-based" | "flat-rate" | "per-seat";
  bestFor: string;
  lastUpdated: string;
  confidence?: "high" | "medium" | "low";
  dataSource?: "manual" | "scraped" | "vendor-claimed";
}

export interface VendorSearchResponse {
  results: VendorSearchResult[];
  unknown?: UnknownCorpusResult;
}

export interface FreeTierDetails {
  exists: boolean;
  generous: boolean;
  keyLimits: string[];
  creditCardRequired: boolean;
  expiresAfter: string | null;
}

export interface PricingTier {
  name: string;
  price: string;
  keyInclusions: string[];
}

export interface CostEstimate {
  at100Users: string;
  at1kUsers: string;
  at10kUsers: string;
  firstPaidTrigger: string;
}

export interface WorkloadInput {
  users?: number;
  monthlyActiveUsers?: number;
  storageGb?: number;
  databaseSizeGb?: number;
  emailSendsPerMonth?: number;
  authMau?: number;
  regions?: number;
  teamSeats?: number;
  monthlyTransactions?: number;
  averageTransactionUsd?: number;
  monthlyRevenueUsd?: number;
  notes?: string;
}

export interface StackContextInput {
  vendorSlug: string;
  category: string;
  confidence?: string;
}

export interface VendorClaim {
  path: string;
  summary: string;
  sourceUrl: string;
  observedAt: string;
  confidence: "high" | "medium" | "low";
  staleAfter: string;
}

export interface EvidenceRow {
  subjectType: "vendor" | "category" | "stack" | "comparison";
  subjectId: string;
  sourceType:
    | "first-party-docs"
    | "pricing-page"
    | "changelog"
    | "company-stack"
    | "repo-scan"
    | "video"
    | "podcast"
    | "tweet"
    | "blog"
    | "benchmark"
    | "reddit"
    | "user-review"
    | "vendor-claim"
    | "manual-note";
  sourceUrl: string;
  sourceTitle: string;
  authorName: string | null;
  authorUrl: string | null;
  publishedAt: string | null;
  observedAt: string;
  summary: string;
  stance: "positive" | "negative" | "mixed" | "neutral";
  appliesTo: string[];
  confidence: "high" | "medium" | "low";
  staleAfter: string;
  createdBy: "system" | "user" | "admin" | "vendor";
  reviewStatus: "unreviewed" | "reviewed" | "rejected";
}

export interface StackProfile {
  slug: string;
  ownerType: "user" | "company" | "project" | "curated";
  ownerName: string;
  projectName: string;
  projectUrl: string | null;
  summary: string;
  stage:
    | "idea"
    | "prototype"
    | "launched"
    | "revenue"
    | "funded"
    | "enterprise";
  teamSize: string | null;
  audience: string[];
  tools: Array<{
    vendorSlug: string;
    category: string;
    role: string;
    sourceType: "company-stack" | "repo-scan" | "user-submitted" | "manual-note";
    confidence: "high" | "medium" | "low";
    notes: string;
  }>;
  submittedBy: string | null;
  visibility: "private" | "unlisted" | "public";
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
}

export interface UnknownCorpusResult {
  kind: "unknown";
  requestedCategory?: string;
  query: string;
  message: string;
  availableCategories: readonly string[];
  suggestedNextSteps: string[];
}

export interface VendorFeature {
  key: string;
  included: boolean;
  tier: string;
  notes: string;
}

export interface VendorLimit {
  dimension: string;
  free: string;
  paid: string;
  notes: string;
}

export interface VendorComparison {
  vsVendor: string;
  advantage: string;
  disadvantage: string;
}

export interface VendorProfile {
  id: string;
  slug: string;
  name: string;
  category: VendorCategory;
  subcategories: string[];
  url: string;
  description: string;
  positioning: string;

  pricing: {
    model: "free" | "freemium" | "usage-based" | "flat-rate" | "per-seat";
    freeTier: FreeTierDetails | null;
    tiers: PricingTier[];
    estimatedMonthlyCost: CostEstimate;
  };

  features: VendorFeature[];
  limits: VendorLimit[];

  company: {
    founded: number;
    funding: string;
    teamSize: string;
    headquarters: string;
    openSource: boolean;
    githubStars: number | null;
    status: "active" | "acquired" | "sunset" | "pivot";
  };

  signals: {
    lastMajorUpdate: string;
    updateFrequency: "daily" | "weekly" | "monthly" | "quarterly";
    knownIssues: string[];
    breakingChanges: string[];
    communitySize: string;
  };

  comparisons: VendorComparison[];
  claims?: VendorClaim[];

  lastUpdated: string;
  dataSource: "manual" | "scraped" | "vendor-claimed";
  confidence: "high" | "medium" | "low";
}

export interface VendorCostEstimate {
  vendorId: string;
  vendorName: string;
  category: string;
  monthlyUsd: number | null;
  display: string;
  basis: string;
  confidence: "high" | "medium" | "low";
  assumptions: string[];
  unknowns: string[];
  sources: VendorClaim[];
}

export interface DecisionMatrixRow {
  layer: string;
  vendor: string;
  vendorName: string;
  fit: "strong" | "reasonable" | "weak";
  why: string;
  capabilities: {
    capability: string;
    support: "yes" | "partial" | "no" | "unknown";
    evidence: string;
  }[];
  tradeoffs: string[];
  estimatedMonthlyCost: string;
  confidence: "high" | "medium" | "low";
  dataFreshness: string;
  sources: VendorClaim[];
}

export interface StackRecommendation {
  stack: Record<
    string,
    {
      vendor: string;
      vendorName?: string;
      reason: string;
    }
  >;
  costEstimate: CostEstimate & {
    monthlyUsd?: number | null;
    byVendor?: VendorCostEstimate[];
    assumptions?: string[];
    unknowns?: string[];
  };
  decisionMatrix?: DecisionMatrixRow[];
  assumptions?: string[];
  unknowns?: string[];
  alternatives?: {
    if: string;
    swap: Record<string, { vendor: string; vendorName?: string; reason: string }>;
  }[];
  alternativeStack: {
    if: string;
    swap: Record<string, { vendor: string; reason: string }>;
  } | null;
  sources?: VendorClaim[];
  generatedAt?: string;
}

export interface RecommendRequest {
  projectDescription: string;
  constraints?: string;
  workload?: WorkloadInput;
  stackContext?: StackContextInput[];
}
