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
  conceptType?: string[];
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

export interface SearchConceptExportRequest {
  year: string;
  href: string;
  q: string;
  filters: AdvancedSearchFilters;
  format: "csv" | "json";
  fields: string[];
}

export interface SearchConceptExportResponse {
  blob: Blob;
  filename: string;
}

export interface PresentationEntrypointLocationMatch {
  entrypoint: EntrypointOption;
  elrs: string[];
}

export interface PresentationEntrypointLocationsResponse {
  matches?: PresentationEntrypointLocationMatch[];
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

export async function exportSearchConcepts(
  payload: SearchConceptExportRequest
): Promise<SearchConceptExportResponse> {
  const response = await fetch("/api/search-concepts/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Export failed";
    try {
      const errorPayload = (await response.json()) as { error?: unknown };
      if (typeof errorPayload?.error === "string") {
        message = errorPayload.error;
      }
    } catch {
      // Ignore JSON parsing failures for non-JSON error responses.
    }
    throw new Error(message);
  }

  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = /filename="?([^"]+)"?/i.exec(contentDisposition);

  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] ?? `search-export.${payload.format}`,
  };
}

export async function fetchPresentationEntrypointLocations(
  year: string,
  qname: string,
  excludeHref?: string | null
): Promise<PresentationEntrypointLocationMatch[]> {
  const url =
    `/api/presentation-entrypoint-locations?year=${encodeURIComponent(year)}` +
    `&qname=${encodeURIComponent(qname)}` +
    (excludeHref ? `&excludeHref=${encodeURIComponent(excludeHref)}` : "");
  const response = await fetch(url);
  const payload = await parseJsonResponse<PresentationEntrypointLocationsResponse>(response);
  return payload.matches ?? [];
}
