import { AdvancedSearchFilters } from "@/types/advancedSearch";

import { RawElrGroup, SearchConceptApiResult } from "../explorerTypes";

export interface EntrypointOption {
  name: string;
  href: string;
}

export interface LoadEntrypointResponse {
  status?: string;
  error?: string;
  trees?: Record<string, RawElrGroup[] | unknown>;
}

export interface SearchFilterOptionsResponse {
  namespace?: string[];
  balance?: string[];
  periodType?: string[];
  xbrlType?: string[];
  fullType?: string[];
  abstract?: boolean[];
  nillable?: boolean[];
  substitutionGroup?: string[];
  referenceSources?: string[];
  referenceParagraphsBySource?: Record<string, string[]>;
}

interface SearchConceptRequest {
  year: string;
  href: string;
  q: string;
  filters: AdvancedSearchFilters;
  limit: number;
  offset: number;
}

export interface SearchConceptsResponse {
  results?: SearchConceptApiResult[];
  limit?: number;
  offset?: number;
  total?: number;
  error?: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | { error?: unknown };
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String(payload.error)
        : "Request failed";
    throw new Error(message);
  }
  return payload as T;
}

export async function fetchEntrypoints(year: string): Promise<EntrypointOption[]> {
  const response = await fetch(`/api/entrypoints?year=${encodeURIComponent(year)}`);
  const payload = await parseJsonResponse<{ entrypoints?: EntrypointOption[] }>(response);
  return payload.entrypoints ?? [];
}

export async function loadEntrypoint(year: string, href: string): Promise<LoadEntrypointResponse> {
  const response = await fetch("/api/load-entrypoint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, href }),
  });
  return parseJsonResponse<LoadEntrypointResponse>(response);
}

export async function fetchSearchFilterOptions(
  year: string,
  href: string
): Promise<SearchFilterOptionsResponse> {
  const filtersUrl =
    `/api/search-filter-options?year=${encodeURIComponent(year)}` +
    `&href=${encodeURIComponent(href)}`;
  const response = await fetch(filtersUrl);
  return parseJsonResponse<SearchFilterOptionsResponse>(response);
}

export async function searchConcepts(payload: SearchConceptRequest): Promise<SearchConceptsResponse> {
  const response = await fetch("/api/search-concepts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<SearchConceptsResponse>(response);
}

export async function warmConceptDetails(): Promise<void> {
  await fetch("/api/concept-details?qname=core:TurnoverRevenue");
}
