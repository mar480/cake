import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DetailsTab from "./DetailsTab";
import HypercubeRelationshipsTab from "./HypercubeRelationshipsTab";
import TreeLocationsTab, { TreeLocationTarget } from "./TreeLocationsTab";
import AdvancedSearchTab from "./AdvancedSearchTab";
import SearchResultsTab from "./SearchResultsTab";
import HelpHint from "@/components/help/HelpHint";
import { getHelpContent } from "@/components/help/helpContent";
import {
  AdvancedSearchState,
  AdvancedSearchFilterOptions,
  AdvancedSearchFilters,
} from "@/types/advancedSearch";
import {
  ConceptDetailsResponse,
  DimensionalRelationshipsResponse,
  PrefetchedDimensionalRelationshipsState,
} from "./apiTypes";
import { TreeNode } from "./tree_utils";
import type { RawElrGroup } from "./explorerTypes";
import type { DetailsTabName } from "./explorerHelpTypes";
import type { HelpContentId } from "@/components/help/helpContent";

interface DetailPanelProps {
  selectedNode: TreeNode | null;
  onNavigateToNode?: (qname: string, options?: { preserveDetails?: boolean }) => void;
  onNavigateToSearchNode?: (
    qname: string,
    network?: string,
    elr?: string,
    entrypoint?: string,
    uuid?: string
  ) => void;
  onNavigateToCrossReference?: (qname: string) => void;
  onNavigateToLocation?: (target: TreeLocationTarget) => void;
  networkLabels?: Record<string, string>;
  resultNetworks?: Record<string, string[]>;
  resultPresentationElrs?: Record<string, string[]>;
  rawTreeData?: Record<string, RawElrGroup[]>;
  treeLocations: TreeLocationTarget[];
  language: "en" | "cy";
  network: string;
  year: string | null;
  entrypoint?: string | null;
  entrypointLoaded: boolean;
  activeTab?: DetailsTabName;
  onActiveTabChange?: (tab: DetailsTabName) => void;
  advancedSearchState: AdvancedSearchState;
  advancedSearchFilterOptions: AdvancedSearchFilterOptions;
  referenceParagraphsBySource: Record<string, string[]>;
  onAdvancedSearchQueryChange: (query: string) => void;
  onAdvancedSearchFiltersChange: (next: AdvancedSearchFilters) => void;
  onRunAdvancedSearch: (nextOffset?: number) => void;
  onRunAdvancedSearchExport: (options: {
    format: "csv" | "json";
    fields: string[];
    filters?: AdvancedSearchFilters;
  }) => void;
  onResetAdvancedSearch: () => void;
}

const DetailPanelContainer: React.FC<DetailPanelProps> = ({
  selectedNode,
  onNavigateToNode,
  onNavigateToSearchNode,
  onNavigateToCrossReference,
  onNavigateToLocation,
  networkLabels,
  resultNetworks,
  resultPresentationElrs,
  rawTreeData,
  treeLocations,
  language,
  network,
  year,
  entrypoint,
  entrypointLoaded,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  advancedSearchState,
  advancedSearchFilterOptions,
  referenceParagraphsBySource,
  onAdvancedSearchQueryChange,
  onAdvancedSearchFiltersChange,
  onRunAdvancedSearch,
  onRunAdvancedSearchExport,
  onResetAdvancedSearch,
}) => {
  const conceptCacheRef = useRef(new Map<string, ConceptDetailsResponse>());
  const previousSelectedNodeKeyRef = useRef<string | null>(null);
  const [internalActiveTab, setInternalActiveTab] = useState<DetailsTabName>("Details");
  const [concept, setConcept] = useState<ConceptDetailsResponse | null>(null);
  const [isConceptLoading, setIsConceptLoading] = useState(false);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [prefetchedRelationships, setPrefetchedRelationships] =
    useState<PrefetchedDimensionalRelationshipsState | null>(null);
  const hasNodeSelection = Boolean(selectedNode?.data?.qname);
  const hasSearchRun = Boolean(advancedSearchState?.hasRun);
  const hasSearchContext = entrypointLoaded && Boolean(year && entrypoint);
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const setActiveTab = useCallback(
    (tab: DetailsTabName) => {
      if (controlledActiveTab === undefined) {
        setInternalActiveTab(tab);
      }
      onActiveTabChange?.(tab);
    },
    [controlledActiveTab, onActiveTabChange]
  );

  const tabs = useMemo(
    () =>
      [
        "Details",
        "Hypercube Relationships",
        "Tree Locations",
        "Advanced Search",
        "Search Results",
      ] as const,
    []
  );
  const tabHelpIds = useMemo<Record<DetailsTabName, HelpContentId | null>>(
    () => ({
      Details: "details.tabs",
      "Hypercube Relationships": "details.tab.hypercubeRelationships",
      "Tree Locations": "details.tab.treeLocations",
      "Advanced Search": "details.tab.advancedSearch",
      "Search Results": "details.tab.searchResults",
    }),
    []
  );

  useEffect(() => {
    if ((activeTab === "Advanced Search" || activeTab === "Search Results") && !hasSearchContext) {
      setActiveTab("Details");
    }
  }, [activeTab, hasSearchContext, setActiveTab]);

  useEffect(() => {
    const requiresSelection =
      activeTab === "Details" ||
      activeTab === "Hypercube Relationships" ||
      activeTab === "Tree Locations";

    if (requiresSelection && !hasNodeSelection) {
      setActiveTab(hasSearchContext ? "Advanced Search" : "Details");
    }
  }, [activeTab, hasNodeSelection, hasSearchContext, setActiveTab]);

  useEffect(() => {
    if (activeTab === "Search Results" && !hasSearchRun) {
      setActiveTab("Advanced Search");
    }
  }, [activeTab, hasSearchRun, setActiveTab]);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const getConceptCacheKey = useCallback(
    (conceptYear: string, conceptEntrypoint: string, qname: string) =>
      `${conceptYear}::${conceptEntrypoint}::${qname}`,
    []
  );

  const fetchConceptDetailsWithRetry = useCallback(
    async (
      qname: string,
      conceptYear: string,
      conceptEntrypoint: string,
      signal: AbortSignal,
      maxAttempts = 3
    ): Promise<ConceptDetailsResponse> => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await fetch(
            `/api/concept-details?year=${encodeURIComponent(conceptYear)}` +
              `&href=${encodeURIComponent(conceptEntrypoint)}` +
              `&qname=${encodeURIComponent(qname)}`,
            { signal }
          );

          const payload = await response.json();

          if (response.ok && payload?.concept) {
            return payload as ConceptDetailsResponse;
          }

          const message =
            typeof payload?.error === "string"
              ? payload.error
              : `Failed to load concept (${response.status})`;
          const retryable =
            response.status === 503 ||
            response.status === 502 ||
            response.status === 500 ||
            response.status === 429 ||
            payload?.retryable === true;

          if (!retryable || attempt === maxAttempts) {
            throw new Error(message);
          }

          await sleep(200 * attempt);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            throw err;
          }

          lastError = err instanceof Error ? err : new Error("Unknown error");
          if (attempt === maxAttempts) {
            throw lastError;
          }

          await sleep(200 * attempt);
        }
      }

      throw lastError ?? new Error("Failed to load concept");
    },
    []
  );

  useEffect(() => {
    const conceptYear = year?.trim();
    const conceptEntrypoint = entrypoint?.trim();
    const qname = selectedNode?.data?.qname?.trim();

    if (conceptYear && conceptEntrypoint && qname) {
      const cacheKey = getConceptCacheKey(conceptYear, conceptEntrypoint, qname);
      const cached = conceptCacheRef.current.get(cacheKey);
      const controller = new AbortController();
      let isActive = true;
      let loadingTimer: ReturnType<typeof setTimeout> | null = null;

      setConceptError(null);
      setIsConceptLoading(false);

      if (cached) {
        setConcept(cached);
        return () => {
          isActive = false;
          controller.abort();
        };
      }

      loadingTimer = setTimeout(() => {
        if (isActive) {
          setIsConceptLoading(true);
        }
      }, 250);

      fetchConceptDetailsWithRetry(qname, conceptYear, conceptEntrypoint, controller.signal)
        .then((data) => {
          if (!isActive) return;
          conceptCacheRef.current.set(cacheKey, data);
          setConcept(data);
          setConceptError(null);
        })
        .catch((err) => {
          if (!isActive) return;
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          console.error("Error fetching concept:", err);
          const message =
            err instanceof Error ? err.message : "Failed to load concept details";
          setConceptError(message);
        })
        .finally(() => {
          if (loadingTimer) {
            clearTimeout(loadingTimer);
          }
          if (isActive) {
            setIsConceptLoading(false);
          }
        });

      return () => {
        isActive = false;
        if (loadingTimer) {
          clearTimeout(loadingTimer);
        }
        controller.abort();
      };
    } else {
      setConcept(null);
      setConceptError(null);
      setIsConceptLoading(false);
    }
  }, [entrypoint, fetchConceptDetailsWithRetry, getConceptCacheKey, selectedNode, year]);

  useEffect(() => {
    const selectedNodeKey = selectedNode?.key ? String(selectedNode.key) : null;
    if (selectedNodeKey && previousSelectedNodeKeyRef.current !== selectedNodeKey) {
      setActiveTab("Details");
    }
    previousSelectedNodeKeyRef.current = selectedNodeKey;
  }, [selectedNode?.key, setActiveTab]);

  useEffect(() => {
    if (!selectedNode?.data?.qname || !year || !entrypoint) {
      setPrefetchedRelationships(null);
      return;
    }

    const qname = selectedNode.data.qname;
    const requestKey = `${year}::${entrypoint}::${qname}`;
    const controller = new AbortController();

    setPrefetchedRelationships({
      key: requestKey,
      data: null,
      loading: true,
      error: null,
    });

    fetch("/api/dimensional-relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qname, year, href: entrypoint }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((payload: DimensionalRelationshipsResponse) => {
        setPrefetchedRelationships({
          key: requestKey,
          data: payload,
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setPrefetchedRelationships({
          key: requestKey,
          data: null,
          loading: false,
          error: "Failed to fetch data from backend.",
        });
      });

    return () => controller.abort();
  }, [entrypoint, selectedNode, year]);

  const renderNoSelection = () => (
    <div className="p-4 text-gray-500 text-center">Please select a concept.</div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b px-1 pt-1 shadow-sm" data-help-anchor="details-tab-bar">
        {tabs.map((tab) => {
          const requiresSelection =
            tab === "Details" || tab === "Hypercube Relationships" || tab === "Tree Locations";
          const disabled =
            ((tab === "Advanced Search" || tab === "Search Results") && !hasSearchContext) ||
            (requiresSelection && !hasNodeSelection) || (tab === "Search Results" && !hasSearchRun);

          const helpId = tabHelpIds[tab];
          const helpEntry = helpId ? getHelpContent(helpId) : null;

          return (
            <div
              key={tab}
              className="mr-1 flex items-center gap-1"
              data-help-anchor={`details-tab-${tab.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <button
                type="button"
                className={`px-4 py-1.5 text-sm font-medium border border-b-0 rounded-t-md shadow-sm transition-colors ${
                  activeTab === tab
                    ? "bg-blue-100 border-blue-300 text-blue-900"
                    : "bg-gray-200 border-gray-300 text-gray-800 hover:bg-gray-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400"
                }`}
                onClick={() => setActiveTab(tab)}
                disabled={disabled}
                title={helpEntry?.shortText}
              >
                {tab}
              </button>
              {helpId ? <HelpHint helpId={helpId} side="bottom" mode="subtle" /> : null}
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto" data-help-anchor="details-tab-content">
        {conceptError && (
          <div className="mx-3 mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {conceptError}
          </div>
        )}

        {isConceptLoading && (
          <div className="px-4 pt-3 text-sm text-gray-500">Loading concept details...</div>
        )}

        {activeTab === "Advanced Search" && (
          <div data-help-anchor="details-view-advanced-search">
            <AdvancedSearchTab
              state={advancedSearchState}
              filterOptions={advancedSearchFilterOptions}
              referenceParagraphsBySource={referenceParagraphsBySource}
              onQueryChange={onAdvancedSearchQueryChange}
              onFiltersChange={onAdvancedSearchFiltersChange}
              onRunSearch={onRunAdvancedSearch}
              onOpenResultsTab={() => setActiveTab("Search Results")}
              onResetSearch={onResetAdvancedSearch}
              year={year}
            />
          </div>
        )}

        {activeTab === "Search Results" && (
          <div data-help-anchor="details-view-search-results">
            <SearchResultsTab
              state={advancedSearchState}
              onFiltersChange={onAdvancedSearchFiltersChange}
              onRunSearch={onRunAdvancedSearch}
              onRunExport={onRunAdvancedSearchExport}
              onResetSearch={onResetAdvancedSearch}
              onNavigateToSearchNode={onNavigateToSearchNode}
              onReturnToSearch={() => setActiveTab("Advanced Search")}
              networkLabels={networkLabels}
              resultNetworks={resultNetworks}
              resultPresentationElrs={resultPresentationElrs}
              rawTreeData={rawTreeData}
              year={year}
              currentEntrypoint={entrypoint}
            />
          </div>
        )}

        {activeTab === "Details" &&
          (!selectedNode || !concept ? (
            renderNoSelection()
          ) : (
            <div data-help-anchor="details-view-details">
              <DetailsTab
                concept={concept}
                selectedNode={selectedNode}
                onNavigateToNode={onNavigateToNode}
                onNavigateToCrossReference={onNavigateToCrossReference}
              />
            </div>
          ))}

        {!selectedNode || !concept ? (
          activeTab === "Hypercube Relationships" ? renderNoSelection() : null
        ) : (
          <div
            className={activeTab === "Hypercube Relationships" ? "block" : "hidden"}
            data-help-anchor="details-view-hypercube-relationships"
          >
            <HypercubeRelationshipsTab
              qname={concept.concept.qname}
              language={language}
              year={year ?? ""}
              href={entrypoint ?? ""}
              prefetchedState={prefetchedRelationships}
              onNavigateToNode={(qname) =>
                onNavigateToNode?.(qname, { preserveDetails: true })
              }
            />
          </div>
        )}

        {activeTab === "Tree Locations" &&
          (!selectedNode || !concept ? (
            renderNoSelection()
          ) : (
            <div data-help-anchor="details-view-tree-locations">
              <TreeLocationsTab
                qname={concept.concept.qname}
                locations={treeLocations}
                onNavigateToLocation={(target) => onNavigateToLocation?.(target)}
              />
            </div>
          ))}
      </div>
    </div>
  );
};

export default DetailPanelContainer;
