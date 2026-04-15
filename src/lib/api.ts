import type {
  VendorSearchResponse,
  VendorProfile,
  StackRecommendation,
} from "./types.js";

const API_BASE = process.env.BUYAPI_API_URL || "https://buyapi.ai";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "buyapi-mcp/0.1.0",
  };

  const apiKey = process.env.BUYAPI_API_KEY;
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
  category: string
): Promise<VendorSearchResponse> {
  const params = new URLSearchParams({ query, category });
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
  constraints?: string
): Promise<StackRecommendation> {
  return request<StackRecommendation>("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ projectDescription, constraints }),
  });
}
