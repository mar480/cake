import { useEffect, useState } from "react";

import { toast } from "@/components/ui/use-toast";
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
  LoadEntrypointResponse,
  loadEntrypoint,
} from "../services/explorerApi";

interface EntrypointLoadRequest {
  year: string;
  entrypoint: string;
  entrypointName?: string | null;
  revision?: string;
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
    const controller = new AbortController();

    fetchEntrypoints(year, controller.signal)
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
        toast({ title: "Unable to load entry points", description: err instanceof Error ? err.message : "Please select the taxonomy year again to retry.", variant: "destructive" });
        setEntrypoints([]);
        setEntrypointsYear(year);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [year]);

  useEffect(() => {
    if (!activeLoadRequest) return;

    const { year: loadYear, entrypoint: loadEntrypointHref } = activeLoadRequest;
    let cancelled = false;
    const controller = new AbortController();

    setEntrypointLoaded(false);
    setLoadingEntrypoint(true);

    loadEntrypoint(loadYear, loadEntrypointHref, controller.signal)
      .then((data: LoadEntrypointResponse) => {
        if (cancelled) {
          return;
        }
        if (data.status !== "loaded") {
          throw new Error(data.error || "The taxonomy bundle could not be loaded.");
        }

        const mappedTreeData = mapTreesPayloadToNetworkMap(data.trees || {}, EXCLUDED_TREE_KEYS);
        clearTreeUiState();
        resetAdvancedSearch();
        setAdvancedSearchFilterOptions(EMPTY_ADVANCED_FILTER_OPTIONS);
        setReferenceParagraphsBySource({});
        setRawTreeData(mappedTreeData);

        const opts = data.filterOptions ?? {};
        setAdvancedSearchFilterOptions(mapSearchOptionsPayload(opts));
        setReferenceParagraphsBySource(opts.referenceParagraphsBySource ?? {});

        setEntrypointLoaded(true);
        onEntrypointLoadSuccess?.({ ...activeLoadRequest, revision: data.revision });
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load entrypoint", err);
        toast({ title: "Unable to load taxonomy", description: err instanceof Error ? err.message : "Please select the entry point again to retry.", variant: "destructive" });
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoadingEntrypoint(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
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
