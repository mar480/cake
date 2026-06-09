import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import XBRLTaxonomyExplorer from "./XBRLTaxonomyExplorer";
import Loader from "@/components/loader/Loader";
import "@/components/loader/loader.scss";
import { toast } from "@/components/ui/use-toast";
import { useHelp } from "@/components/help/helpContext";
import {
  TreeNode,
  mapElrGroupedTreeToTreeNodes,
} from "@/components/taxonomy/explorer/tree_utils";
import {
  buildConceptElrMapForNetwork,
  buildConceptNetworksMap,
} from "./explorerDataUtils";
import type { DetailsTabName, ExplorerDemoActions, ExplorerDemoState } from "./explorerHelpTypes";
import { useAdvancedSearch } from "./hooks/useAdvancedSearch";
import { useEntrypointData } from "./hooks/useEntrypointData";
import { findFirstVisibleConceptQname } from "./treeSearchUtils";
import { useTreeNavigation } from "./hooks/useTreeNavigation";

const NETWORK_TAB_ORDER = [
  "presentation",
  "definition_hydim",
  "definition_dimdom",
  "definition_dimdef",
  "definition_dommem",
  "definition_all",
  "definition_crossref",
  "definition_inflow",
  "definition_outflow",
] as const;

const NETWORK_LABELS: Record<string, string> = {
  presentation: "Presentation",
  definition_hydim: "Definition: hypercube-dimension",
  definition_dimdom: "Definition: dimension-domain",
  definition_dimdef: "Definition: dimension-default",
  definition_dommem: "Definition: domain-member",
  definition_all: "Definition: all",
  definition_crossref: "Definition: crossref",
  definition_inflow: "Definition: inflow",
  definition_outflow: "Definition: outflow",
};

const XBRLTaxonomyExplorerContainer: React.FC = () => {
  const { activeTourId, setExplorerDemoRuntime, clearExplorerDemoRuntime } = useHelp();
  // UI state
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [detailNode, setDetailNode] = useState<TreeNode | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<{ [key: string]: boolean }>({});
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "cy">("en");
  const [network, setNetwork] = useState<string>("");
  const [treeFilter, setTreeFilter] = useState("");
  const [activeDetailsTab, setActiveDetailsTab] = useState<DetailsTabName>("Details");

  // Taxonomy selection state
  const [year, setYear] = useState<string | null>(null);
  const [entrypoint, setEntrypoint] = useState<string | null>(null);
  const [activeLoadRequest, setActiveLoadRequest] = useState<{
    year: string;
    entrypoint: string;
    entrypointName?: string | null;
  } | null>(null);
  const [loadedYear, setLoadedYear] = useState<string | null>(null);
  const [loadedEntrypoint, setLoadedEntrypoint] = useState<string | null>(null);
  const [loadedEntrypointName, setLoadedEntrypointName] = useState<string | null>(null);
  const [pendingEntrypointNavigation, setPendingEntrypointNavigation] = useState<{
    targetEntrypoint: string;
    qname: string;
    network: string;
    elr?: string;
    uuid?: string;
  } | null>(null);
  const pendingTreeFilterNavigationRef = useRef<(() => void) | null>(null);

  const {
    advancedSearchState,
    resetAdvancedSearch,
    updateAdvancedSearchQuery,
    updateAdvancedSearchFilters,
    runAdvancedSearch,
    runAdvancedSearchExport,
  } = useAdvancedSearch(loadedYear, loadedEntrypoint);

  const clearTreeUiState = useCallback(() => {
    setNetwork("");
    setTreeFilter("");
    setSelectedNode(null);
    setDetailNode(null);
    setExpandedKeys({});
    setHighlightedKey(null);
    setActiveDetailsTab("Details");
  }, []);

  const handleEntrypointLoadSuccess = useCallback((
    {
      year: nextLoadedYear,
      entrypoint: nextLoadedEntrypoint,
      entrypointName,
    }: {
      year: string;
      entrypoint: string;
      entrypointName?: string | null;
    }
  ) => {
    setLoadedYear(nextLoadedYear);
    setLoadedEntrypoint(nextLoadedEntrypoint);
    setLoadedEntrypointName(entrypointName ?? nextLoadedEntrypoint);
  }, []);

  const {
    entrypoints,
    entrypointsYear,
    rawTreeData,
    entrypointLoaded,
    loadingEntrypoint,
    advancedSearchFilterOptions,
    referenceParagraphsBySource,
  } = useEntrypointData(
    year,
    activeLoadRequest,
    resetAdvancedSearch,
    clearTreeUiState,
    handleEntrypointLoadSuccess
  );

  useEffect(() => {
    if (!year || !entrypoint || entrypointsYear !== year) {
      return;
    }

    if (entrypoints.some((ep) => ep.href === entrypoint)) {
      return;
    }

    setEntrypoint(null);
  }, [entrypoint, entrypoints, entrypointsYear, year]);

  const requestEntrypointLoad = useCallback((nextEntrypoint: string) => {
    if (!year) {
      return;
    }

    const matchingEntrypoint = entrypoints.find((ep) => ep.href === nextEntrypoint);

    setEntrypoint(nextEntrypoint);
    setActiveLoadRequest({
      year,
      entrypoint: nextEntrypoint,
      entrypointName: matchingEntrypoint?.name ?? nextEntrypoint,
    });
  }, [entrypoints, year]);

  const currentTreeNodes: TreeNode[] = useMemo(() => {
    const raw = rawTreeData?.[network];
    if (!raw || !Array.isArray(raw)) return [];
    return mapElrGroupedTreeToTreeNodes(raw);
  }, [rawTreeData, network]);

  const { treeLocations, expandPathToQName, clearPendingNavigation, clearHighlight, navigateToLocation, navigateToQNameInNetwork } = useTreeNavigation({
    currentTreeNodes,
    rawTreeData,
    detailNode,
    network,
    entrypoint: loadedEntrypoint,
    setNetwork,
    setExpandedKeys,
    setHighlightedKey,
    setSelectedNode,
    setDetailNode,
    onNavigationFailure: (pendingNavigation) => {
      toast({
        title: "Navigation failed",
        description:
          pendingNavigation.targetEntrypoint && pendingNavigation.targetEntrypoint !== loadedEntrypoint
            ? "The target concept could not be found in the selected entrypoint."
            : "The target concept could not be found in the current tree.",
        variant: "destructive",
      });
    },
  });

  const resultNetworks = useMemo(() => {
    const mapped = buildConceptNetworksMap(rawTreeData);

    return Object.fromEntries(
      Object.entries(mapped).map(([qname, networks]) => {
        const networkSet = new Set(networks);
        const ordered = NETWORK_TAB_ORDER.filter((networkKey) => networkSet.has(networkKey));
        const extras = networks.filter((networkKey) => !NETWORK_TAB_ORDER.includes(networkKey as never));
        return [qname, [...ordered, ...extras]];
      })
    );
  }, [rawTreeData]);

  const buildElrMap = useCallback((networkKey: string) => {
    return buildConceptElrMapForNetwork(rawTreeData[networkKey] ?? []);
  }, [rawTreeData]);

  const resultPresentationElrs = useMemo(() => {
    return buildElrMap("presentation");
  }, [buildElrMap]);

  const navigateFromSearch = useCallback(
    (qname: string, targetNetwork?: string, elr?: string, targetEntrypoint?: string, uuid?: string) => {
      const destinationNetwork = targetNetwork || "presentation";
      if (targetEntrypoint && targetEntrypoint !== loadedEntrypoint) {
        setPendingEntrypointNavigation({
          targetEntrypoint,
          qname,
          network: destinationNetwork,
          elr,
          uuid,
        });
        requestEntrypointLoad(targetEntrypoint);
        return;
      }

      navigateToQNameInNetwork(qname, destinationNetwork, elr, { uuid });
    },
    [loadedEntrypoint, navigateToQNameInNetwork, requestEntrypointLoad]
  );

  const runAfterTreeFilterClears = useCallback((action: () => void) => {
    if (!treeFilter) {
      action();
      return;
    }

    pendingTreeFilterNavigationRef.current = action;
    setTreeFilter("");
  }, [treeFilter]);

  useEffect(() => {
    if (treeFilter) {
      return;
    }

    const pendingAction = pendingTreeFilterNavigationRef.current;
    if (!pendingAction) {
      return;
    }

    pendingTreeFilterNavigationRef.current = null;
    pendingAction();
  }, [treeFilter]);

  useEffect(() => {
    if (!pendingEntrypointNavigation) return;
    if (!entrypointLoaded) return;
    if (loadedEntrypoint !== pendingEntrypointNavigation.targetEntrypoint) return;

    navigateToQNameInNetwork(
      pendingEntrypointNavigation.qname,
      pendingEntrypointNavigation.network,
      pendingEntrypointNavigation.elr,
      {
        targetEntrypoint: pendingEntrypointNavigation.targetEntrypoint,
        uuid: pendingEntrypointNavigation.uuid,
      }
    );
    setPendingEntrypointNavigation(null);
  }, [entrypointLoaded, loadedEntrypoint, navigateToQNameInNetwork, pendingEntrypointNavigation]);

  const handleYearChange = useCallback((nextYear: string | null) => {
    setPendingEntrypointNavigation(null);
    clearPendingNavigation();
    setYear(nextYear);

    if (!nextYear) {
      setEntrypoint(null);
    }
  }, [clearPendingNavigation]);

  const handleEntrypointChange = useCallback((nextEntrypoint: string | null) => {
    setPendingEntrypointNavigation(null);
    clearPendingNavigation();

    if (!nextEntrypoint) {
      setEntrypoint(null);
      return;
    }

    requestEntrypointLoad(nextEntrypoint);
  }, [clearPendingNavigation, requestEntrypointLoad]);

  // Default network
  useEffect(() => {
    if (!entrypointLoaded || !Object.keys(rawTreeData).length) return;

    if (!network || !rawTreeData[network]) {
      const preferred = rawTreeData.presentation ? "presentation" : Object.keys(rawTreeData)[0];
      if (preferred) setNetwork(preferred);
    }
  }, [rawTreeData, entrypointLoaded, network]);

  const demoState = useMemo<ExplorerDemoState>(
    () => ({
      year,
      entrypoint,
      entrypointsYear,
      availableEntrypoints: entrypoints,
      loadedYear,
      loadedEntrypoint,
      entrypointLoaded,
      network,
      treeFilter,
      selectedConceptQname: detailNode?.data?.qname ?? null,
      activeDetailsTab,
      advancedSearchQuery: advancedSearchState.query,
      advancedSearchHasRun: advancedSearchState.hasRun,
      advancedSearchLoading: advancedSearchState.loading,
      advancedSearchResultCount: advancedSearchState.results.length,
    }),
    [
      activeDetailsTab,
      advancedSearchState.hasRun,
      advancedSearchState.loading,
      advancedSearchState.query,
      advancedSearchState.results.length,
      entrypoints,
      entrypointsYear,
      detailNode?.data?.qname,
      entrypoint,
      entrypointLoaded,
      loadedEntrypoint,
      loadedYear,
      network,
      treeFilter,
      year,
    ]
  );

  const demoActions = useMemo<ExplorerDemoActions>(
    () => ({
      selectYear: (nextYear) => {
        handleYearChange(nextYear);
      },
      loadEntrypoint: (entrypointHref) => {
        handleEntrypointChange(entrypointHref);
      },
      selectNetwork: (nextNetwork) => {
        if (entrypointLoaded && rawTreeData[nextNetwork]) {
          pendingTreeFilterNavigationRef.current = null;
          setNetwork(nextNetwork);
          setTreeFilter("");
          setExpandedKeys({});
          setHighlightedKey(null);
        }
      },
      navigateToConcept: (qname, options) => {
        runAfterTreeFilterClears(() => {
          if (options?.network || options?.entrypoint || options?.elr || options?.uuid) {
            navigateFromSearch(
              qname,
              options?.network,
              options?.elr,
              options?.entrypoint,
              options?.uuid
            );
            return;
          }

          expandPathToQName(qname, {
            preserveDetails: options?.preserveDetails,
            persistentHighlight: options?.persistentHighlight,
          });
        });
      },
      selectFirstVisibleConcept: () => {
        const firstVisibleQname = findFirstVisibleConceptQname(currentTreeNodes, treeFilter, language);
        if (firstVisibleQname) {
          expandPathToQName(firstVisibleQname);
        }
      },
      setTreeFilter: (value) => {
        setTreeFilter(value);
      },
      clearTreeHighlight: () => {
        clearHighlight();
      },
      openDetailsTab: (tab) => {
        setActiveDetailsTab(tab);
      },
      setAdvancedSearchQuery: (query) => {
        updateAdvancedSearchQuery(query);
      },
      runAdvancedSearch: () => {
        runAdvancedSearch(0);
        setActiveDetailsTab("Search Results");
      },
    }),
    [
      entrypointLoaded,
      expandPathToQName,
      handleEntrypointChange,
      handleYearChange,
      currentTreeNodes,
      clearHighlight,
      navigateFromSearch,
      rawTreeData,
      runAfterTreeFilterClears,
      runAdvancedSearch,
      treeFilter,
      updateAdvancedSearchQuery,
      language,
    ]
  );

  useEffect(() => {
    setExplorerDemoRuntime(demoState, demoActions);
  }, [demoActions, demoState, setExplorerDemoRuntime]);

  useEffect(() => clearExplorerDemoRuntime, [clearExplorerDemoRuntime]);

  return (
    <>
      {loadingEntrypoint && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
            activeTourId
              ? "pointer-events-none bg-transparent"
              : "bg-white bg-opacity-90"
          }`}
        >
          <Loader />
        </div>
      )}

      <XBRLTaxonomyExplorer
        selectedNode={selectedNode}
        detailNode={detailNode}
        expandedKeys={expandedKeys}
        highlightedKey={highlightedKey}
        language={language}
        network={network}
        year={year}
        entrypoint={entrypoint}
        loadedYear={loadedYear}
        loadedEntrypoint={loadedEntrypoint}
        loadedEntrypointName={loadedEntrypointName}
        entrypoints={entrypoints}
        onYearChange={handleYearChange}
        onEntrypointChange={handleEntrypointChange}
        treeFilter={treeFilter}
        onTreeFilterChange={setTreeFilter}
        onSelectNode={(node) => {
          if (!node.data?.qname) {
            return;
          }
          setSelectedNode(node);
          setDetailNode(node);
        }}
        onExpandedKeysChange={setExpandedKeys}
        onLanguageChange={setLanguage}
        onNetworkChange={(val) => {
          if (entrypointLoaded && rawTreeData[val]) {
            pendingTreeFilterNavigationRef.current = null;
            setNetwork(val);
            setTreeFilter("");
            setExpandedKeys({});
            setHighlightedKey(null);
          } else {
            console.warn("[NetworkChange] Ignored invalid or unloaded network:", val);
          }
        }}
        onNavigateToNode={(qname, options) => {
          runAfterTreeFilterClears(() => {
            expandPathToQName(qname, options);
          });
        }}
        onNavigateToSearchNode={(qname, targetNetwork, elr, targetEntrypoint, uuid) => {
          runAfterTreeFilterClears(() => {
            navigateFromSearch(qname, targetNetwork, elr, targetEntrypoint, uuid);
          });
        }}
        onNavigateToLocation={(target) => {
          runAfterTreeFilterClears(() => {
            navigateToLocation(target);
          });
        }}
        currentTreeNodes={currentTreeNodes}
        entrypointLoaded={entrypointLoaded}
        treeLocations={treeLocations}
        activeDetailsTab={activeDetailsTab}
        onActiveDetailsTabChange={setActiveDetailsTab}
        advancedSearchState={advancedSearchState}
        advancedSearchFilterOptions={advancedSearchFilterOptions}
        referenceParagraphsBySource={referenceParagraphsBySource}
        onAdvancedSearchQueryChange={updateAdvancedSearchQuery}
        onAdvancedSearchFiltersChange={updateAdvancedSearchFilters}
        onRunAdvancedSearch={runAdvancedSearch}
        onRunAdvancedSearchExport={runAdvancedSearchExport}
        onResetAdvancedSearch={resetAdvancedSearch}
        networkLabels={NETWORK_LABELS}
        resultNetworks={resultNetworks}
        resultPresentationElrs={resultPresentationElrs}
        rawTreeData={rawTreeData}
      />
    </>
  );
};

export default XBRLTaxonomyExplorerContainer;
