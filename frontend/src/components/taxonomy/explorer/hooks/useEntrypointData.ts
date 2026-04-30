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
  warmConceptDetails,
} from "../services/explorerApi";

interface EntrypointDataState {
  entrypoints: EntrypointOption[];
  rawTreeData: Record<string, RawElrGroup[]>;
  entrypointLoaded: boolean;
  loadingEntrypoint: boolean;
  advancedSearchFilterOptions: AdvancedSearchFilterOptions;
  referenceParagraphsBySource: Record<string, string[]>;
}

export function useEntrypointData(
  year: string | null,
  entrypoint: string | null,
  resetAdvancedSearch: () => void,
  clearTreeUiState: () => void
): EntrypointDataState {
  const [entrypoints, setEntrypoints] = useState<EntrypointOption[]>([]);
  const [rawTreeData, setRawTreeData] = useState<Record<string, RawElrGroup[]>>({});
  const [entrypointLoaded, setEntrypointLoaded] = useState(false);
  const [loadingEntrypoint, setLoadingEntrypoint] = useState(false);
  const [advancedSearchFilterOptions, setAdvancedSearchFilterOptions] =
    useState(EMPTY_ADVANCED_FILTER_OPTIONS);
  const [referenceParagraphsBySource, setReferenceParagraphsBySource] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    if (!entrypointLoaded) return;

    warmConceptDetails()
      .then(() => console.log("Backend warmed up"))
      .catch((err) => console.warn("Warm-up failed", err));
  }, [entrypointLoaded]);

  useEffect(() => {
    if (!year) return;

    fetchEntrypoints(year)
      .then((nextEntrypoints) => {
        setEntrypoints(nextEntrypoints);
      })
      .catch((err) => {
        console.error("Failed to fetch entrypoints", err);
        setEntrypoints([]);
      });
  }, [year]);

  useEffect(() => {
    if (!year || !entrypoint) return;

    setEntrypointLoaded(false);
    setLoadingEntrypoint(true);
    setRawTreeData({});
    clearTreeUiState();
    resetAdvancedSearch();
    setAdvancedSearchFilterOptions(EMPTY_ADVANCED_FILTER_OPTIONS);
    setReferenceParagraphsBySource({});

    loadEntrypoint(year, entrypoint)
      .then((data: LoadEntrypointResponse) => {
        if (data.status !== "loaded") {
          console.error("Load error:", data.error);
          return;
        }

        setRawTreeData(mapTreesPayloadToNetworkMap(data.trees || {}, EXCLUDED_TREE_KEYS));

        fetchSearchFilterOptions(year, entrypoint)
          .then((opts) => {
            setAdvancedSearchFilterOptions(mapSearchOptionsPayload(opts));
            setReferenceParagraphsBySource(opts.referenceParagraphsBySource ?? {});
          })
          .catch((err) => {
            console.error("Failed to load search filter options", err);
            setAdvancedSearchFilterOptions(EMPTY_ADVANCED_FILTER_OPTIONS);
            setReferenceParagraphsBySource({});
          });

        setEntrypointLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load entrypoint", err);
      })
      .finally(() => {
        setLoadingEntrypoint(false);
      });
  }, [clearTreeUiState, entrypoint, resetAdvancedSearch, year]);

  return {
    entrypoints,
    rawTreeData,
    entrypointLoaded,
    loadingEntrypoint,
    advancedSearchFilterOptions,
    referenceParagraphsBySource,
  };
}
