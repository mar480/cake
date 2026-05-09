import { useCallback, useMemo, useRef, useState } from "react";

import {
  AdvancedSearchFilters,
  AdvancedSearchPagination,
  AdvancedSearchResult,
  AdvancedSearchState,
} from "@/types/advancedSearch";

import {
  mapSearchResultsPayload,
  sanitizeAdvancedFilters,
} from "../explorerDataUtils";
import { EMPTY_ADVANCED_FILTERS } from "../explorerTypes";
import { exportSearchConcepts, searchConcepts } from "../services/explorerApi";

interface RunAdvancedSearchExportOptions {
  format: "csv" | "json";
  fields: string[];
  filters?: AdvancedSearchFilters;
}

interface UseAdvancedSearchResult {
  advancedSearchState: AdvancedSearchState;
  resetAdvancedSearch: () => void;
  updateAdvancedSearchQuery: (next: string) => void;
  updateAdvancedSearchFilters: (next: AdvancedSearchFilters) => void;
  runAdvancedSearch: (nextOffset?: number) => Promise<void>;
  runAdvancedSearchExport: (options: RunAdvancedSearchExportOptions) => Promise<void>;
}

export function useAdvancedSearch(
  year: string | null,
  entrypoint: string | null
): UseAdvancedSearchResult {
  const [advancedSearchQuery, setAdvancedSearchQuery] = useState("");
  const [advancedSearchFilters, setAdvancedSearchFilters] =
    useState<AdvancedSearchFilters>(EMPTY_ADVANCED_FILTERS);
  const [advancedSearchResults, setAdvancedSearchResults] = useState<AdvancedSearchResult[]>([]);
  const [advancedSearchAllResults, setAdvancedSearchAllResults] = useState<AdvancedSearchResult[]>([]);
  const [advancedSearchLoading, setAdvancedSearchLoading] = useState(false);
  const [advancedSearchExportLoading, setAdvancedSearchExportLoading] = useState(false);
  const [advancedSearchError, setAdvancedSearchError] = useState<string | null>(null);
  const [advancedSearchExportError, setAdvancedSearchExportError] = useState<string | null>(null);
  const [advancedSearchPagination, setAdvancedSearchPagination] = useState<AdvancedSearchPagination>({
    limit: 25,
    offset: 0,
    total: 0,
  });
  const [advancedSearchLastRunAt, setAdvancedSearchLastRunAt] = useState<string | null>(null);

  const latestAdvancedQueryRef = useRef("");
  const latestAdvancedFiltersRef = useRef<AdvancedSearchFilters>(EMPTY_ADVANCED_FILTERS);
  const lastRunCriteriaKeyRef = useRef<string | null>(null);

  const resetAdvancedSearch = useCallback(() => {
    setAdvancedSearchQuery("");
    setAdvancedSearchFilters(EMPTY_ADVANCED_FILTERS);
    latestAdvancedQueryRef.current = "";
    latestAdvancedFiltersRef.current = EMPTY_ADVANCED_FILTERS;
    lastRunCriteriaKeyRef.current = null;
    setAdvancedSearchResults([]);
    setAdvancedSearchAllResults([]);
    setAdvancedSearchLoading(false);
    setAdvancedSearchExportLoading(false);
    setAdvancedSearchError(null);
    setAdvancedSearchExportError(null);
    setAdvancedSearchPagination({ limit: 25, offset: 0, total: 0 });
    setAdvancedSearchLastRunAt(null);
  }, []);

  const updateAdvancedSearchQuery = useCallback((next: string) => {
    latestAdvancedQueryRef.current = next;
    setAdvancedSearchQuery(next);
  }, []);

  const updateAdvancedSearchFilters = useCallback((next: AdvancedSearchFilters) => {
    const sanitized = sanitizeAdvancedFilters(next);
    latestAdvancedFiltersRef.current = sanitized;
    setAdvancedSearchFilters(sanitized);
  }, []);

  const runAdvancedSearch = useCallback(
    async (nextOffset?: number) => {
      if (!year || !entrypoint) {
        setAdvancedSearchError("Select a taxonomy year and entrypoint before searching.");
        return;
      }

      const trimmedQuery = latestAdvancedQueryRef.current.trim();
      const criteriaKey = JSON.stringify({
        q: trimmedQuery,
        filters: latestAdvancedFiltersRef.current,
      });
      const criteriaChanged = criteriaKey !== lastRunCriteriaKeyRef.current;

      const requestedOffset =
        typeof nextOffset === "number"
          ? Math.max(0, nextOffset)
          : criteriaChanged
            ? 0
            : advancedSearchPagination.offset;

      setAdvancedSearchLoading(true);
      setAdvancedSearchError(null);

      try {
        const payload = await searchConcepts({
          year,
          href: entrypoint,
          q: trimmedQuery,
          filters: latestAdvancedFiltersRef.current,
          limit: advancedSearchPagination.limit,
          offset: requestedOffset,
        });

        const results = mapSearchResultsPayload(payload.results || [], requestedOffset);
        const totalResults = payload.total ?? results.length;

        setAdvancedSearchResults(results);
        setAdvancedSearchAllResults(results);
        setAdvancedSearchPagination((prev) => ({
          ...prev,
          limit: payload.limit ?? prev.limit,
          offset: payload.offset ?? requestedOffset,
          total: totalResults,
        }));

        setAdvancedSearchLastRunAt(new Date().toISOString());
        lastRunCriteriaKeyRef.current = criteriaKey;
      } catch (error) {
        console.error("Advanced search failed", error);
        setAdvancedSearchError("Advanced search failed. Please try again.");
      } finally {
        setAdvancedSearchLoading(false);
      }
    },
    [advancedSearchPagination.limit, advancedSearchPagination.offset, entrypoint, year]
  );

  const runAdvancedSearchExport = useCallback(
    async ({ format, fields, filters }: RunAdvancedSearchExportOptions) => {
      if (!year || !entrypoint) {
        setAdvancedSearchExportError("Select a taxonomy year and entrypoint before exporting.");
        return;
      }

      const trimmedQuery = latestAdvancedQueryRef.current.trim();
      const exportFilters = filters ? sanitizeAdvancedFilters(filters) : latestAdvancedFiltersRef.current;
      setAdvancedSearchExportLoading(true);
      setAdvancedSearchExportError(null);

      try {
        const { blob, filename } = await exportSearchConcepts({
          year,
          href: entrypoint,
          q: trimmedQuery,
          filters: exportFilters,
          format,
          fields,
        });

        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(objectUrl);
      } catch (error) {
        console.error("Advanced search export failed", error);
        setAdvancedSearchExportError(
          error instanceof Error ? error.message : "Advanced search export failed. Please try again."
        );
      } finally {
        setAdvancedSearchExportLoading(false);
      }
    },
    [entrypoint, year]
  );

  const advancedSearchState = useMemo<AdvancedSearchState>(
    () => ({
      query: advancedSearchQuery,
      filters: advancedSearchFilters,
      results: advancedSearchResults,
      allResults: advancedSearchAllResults,
      loading: advancedSearchLoading,
      exportLoading: advancedSearchExportLoading,
      error: advancedSearchError,
      exportError: advancedSearchExportError,
      pagination: advancedSearchPagination,
      lastRunAt: advancedSearchLastRunAt,
    }),
    [
      advancedSearchQuery,
      advancedSearchFilters,
      advancedSearchResults,
      advancedSearchAllResults,
      advancedSearchLoading,
      advancedSearchExportLoading,
      advancedSearchError,
      advancedSearchExportError,
      advancedSearchPagination,
      advancedSearchLastRunAt,
    ]
  );

  return {
    advancedSearchState,
    resetAdvancedSearch,
    updateAdvancedSearchQuery,
    updateAdvancedSearchFilters,
    runAdvancedSearch,
    runAdvancedSearchExport,
  };
}
