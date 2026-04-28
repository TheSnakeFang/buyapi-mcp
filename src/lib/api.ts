import type {
  VendorSearchResponse,
  VendorProfile,
  StackRecommendation,
  WorkloadInput,
} from "./types.js";
import { buildDecisionMatrix, estimateVendorCost } from "./decision.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./version.js";
import { readStoredApiKey } from "./config.js";
import type { StackScanResult } from "./scan.js";

const API_BASE = process.env.BUYAPI_API_URL || "https://buyapi.ai";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": `${PACKAGE_NAME}/${PACKAGE_VERSION}`,
  };

  const apiKey = process.env.BUYAPI_API_KEY || readStoredApiKey();
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `BuyAPI request failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`
    );
  }

  return res.json() as Promise<T>;
}

export async function searchVendors(
  query: string,
  category?: string
): Promise<VendorSearchResponse> {
  const params = new URLSearchParams({ query });
  if (category) params.set("category", category);
  return request<VendorSearchResponse>(`/api/vendors/search?${params}`);
}

export async function getVendorDetails(
  vendorId: string,
  query?: string
): Promise<VendorProfile> {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  const qs = params.toString();
  // vendorId is "/database/supabase" → URL becomes /api/vendors/database/supabase
  const cleanId = vendorId.startsWith("/") ? vendorId.slice(1) : vendorId;
  return request<VendorProfile>(
    `/api/vendors/${cleanId}${qs ? `?${qs}` : ""}`
  );
}

export async function recommendStack(
  projectDescription: string,
  constraints?: string,
  workload?: WorkloadInput
): Promise<StackRecommendation> {
  return request<StackRecommendation>("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ projectDescription, constraints, workload }),
  });
}

export async function compareVendors(
  vendorIds: string[],
  query: string,
  workload?: WorkloadInput
) {
  const vendors = await Promise.all(
    vendorIds.map((vendorId) => getVendorDetails(vendorId, query))
  );
  return { decisionMatrix: buildDecisionMatrix(vendors, query, workload) };
}

export async function estimateCosts(args: {
  vendorIds?: string[];
  category?: string;
  workload: WorkloadInput;
}) {
  const vendorIds = args.vendorIds?.length
    ? args.vendorIds
    : args.category
      ? (await searchVendors(JSON.stringify(args.workload), args.category)).results.map(
          (result) => result.id
        )
      : [];

  const vendors = await Promise.all(
    vendorIds.map((vendorId) => getVendorDetails(vendorId))
  );

  return {
    estimates: vendors.map((vendor) => estimateVendorCost(vendor, args.workload)),
  };
}

export async function syncStackScan(args: {
  projectName: string;
  stackSlug?: string;
  summary?: string;
  scan: StackScanResult;
}): Promise<{
  slug: string;
  updated: boolean;
  url: string;
  candidateCount?: number;
}> {
  return request<{
    slug: string;
    updated: boolean;
    url: string;
    candidateCount?: number;
  }>(
    "/api/stacks/import",
    {
      method: "POST",
      body: JSON.stringify(args),
    }
  );
}

export async function getAccountStatus(): Promise<{
  authenticated: boolean;
  keyPrefix: string;
}> {
  return request<{ authenticated: boolean; keyPrefix: string }>("/api/me");
}
