import { useEffect, useState } from "react";

import { AdvancedSearchFilterOptions } from "@/types/advancedSearch";

import {
  mapSearchOptionsPayload,
  mapTreesPayloadToNetworkMap,
} from "../explorerDataUtils";
import {
  EMPTY_ADVANCED_FILTER_OPTIONS,
  EXCLUDED_TREE_KEYS,
  RawElrGroup,
} from "../explorerTypes";
import {
  EntrypointOption,
  fetchEntrypoints,
  fetchSearchFilterOptions,
  LoadEntrypointResponse,
  loadEntrypoint,
} from "../services/explorerApi";

interface EntrypointLoadRequest {
  year: string;
  entrypoint: string;
  entrypointName?: string | null;
}

interface EntrypointDataState {
  entrypoints: EntrypointOption[];
  entrypointsYear: string | null;
  rawTreeData: Record<string, RawElrGroup[]>;
  entrypointLoaded: boolean;
  loadingEntrypoint: boolean;
  advancedSearchFilterOptions: AdvancedSearchFilterOptions;
  referenceParagraphsBySource: Record<string, string[]>;
}

export function useEntrypointData(
  year: string | null,
  activeLoadRequest: EntrypointLoadRequest | null,
  resetAdvancedSearch: () => void,
  clearTreeUiState: () => void,
  onEntrypointLoadSuccess?: (request: EntrypointLoadRequest) => void
): EntrypointDataState {
  const [entrypoints, setEntrypoints] = useState<EntrypointOption[]>([]);
  const [entrypointsYear, setEntrypointsYear] = useState<string | null>(null);
  const [rawTreeData, setRawTreeData] = useState<Record<string, RawElrGroup[]>>({});
  const [entrypointLoaded, setEntrypointLoaded] = useState(false);
  const [loadingEntrypoint, setLoadingEntrypoint] = useState(false);
  const [advancedSearchFilterOptions, setAdvancedSearchFilterOptions] =
    useState(EMPTY_ADVANCED_FILTER_OPTIONS);
  const [referenceParagraphsBySource, setReferenceParagraphsBySource] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    if (!year) {
      setEntrypoints([]);
      setEntrypointsYear(null);
      return;
    }

    let cancelled = false;

    fetchEntrypoints(year)
      .then((nextEntrypoints) => {
        if (cancelled) {
          return;
        }
        setEntrypoints(nextEntrypoints);
        setEntrypointsYear(year);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to fetch entrypoints", err);
        setEntrypoints([]);
        setEntrypointsYear(year);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  useEffect(() => {
    if (!activeLoadRequest) return;

    const { year: loadYear, entrypoint: loadEntrypointHref } = activeLoadRequest;
    let cancelled = false;

    setEntrypointLoaded(false);
    setLoadingEntrypoint(true);

    loadEntrypoint(loadYear, loadEntrypointHref)
      .then((data: LoadEntrypointResponse) => {
        if (cancelled) {
          return;
        }
        if (data.status !== "loaded") {
          console.error("Load error:", data.error);
          return;
        }

        const mappedTreeData = mapTreesPayloadToNetworkMap(data.trees || {}, EXCLUDED_TREE_KEYS);
        clearTreeUiState();
        resetAdvancedSearch();
        setAdvancedSearchFilterOptions(EMPTY_ADVANCED_FILTER_OPTIONS);
        setReferenceParagraphsBySource({});
        setRawTreeData(mappedTreeData);

        fetchSearchFilterOptions(loadYear, loadEntrypointHref)
          .then((opts) => {
            if (cancelled) {
              return;
            }
            setAdvancedSearchFilterOptions(mapSearchOptionsPayload(opts));
            setReferenceParagraphsBySource(opts.referenceParagraphsBySource ?? {});
          })
          .catch((err) => {
            if (cancelled) {
              return;
            }
            console.error("Failed to load search filter options", err);
            setAdvancedSearchFilterOptions(EMPTY_ADVANCED_FILTER_OPTIONS);
            setReferenceParagraphsBySource({});
          });

        setEntrypointLoaded(true);
        onEntrypointLoadSuccess?.(activeLoadRequest);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load entrypoint", err);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoadingEntrypoint(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeLoadRequest, clearTreeUiState, onEntrypointLoadSuccess, resetAdvancedSearch]);

  return {
    entrypoints,
    entrypointsYear,
    rawTreeData,
    entrypointLoaded,
    loadingEntrypoint,
    advancedSearchFilterOptions,
    referenceParagraphsBySource,
  };
}
