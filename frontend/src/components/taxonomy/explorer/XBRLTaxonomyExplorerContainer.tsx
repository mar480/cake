import React, { useState, useEffect, useMemo, useCallback } from "react";
import XBRLTaxonomyExplorer from "./XBRLTaxonomyExplorer";
import Loader from "@/components/loader/Loader";
import "@/components/loader/loader.scss";
import {
  TreeNode,
  mapElrGroupedTreeToTreeNodes,
} from "@/components/taxonomy/explorer/tree_utils";
import { useAdvancedSearch } from "./hooks/useAdvancedSearch";
import { useEntrypointData } from "./hooks/useEntrypointData";
import { useTreeNavigation } from "./hooks/useTreeNavigation";

const XBRLTaxonomyExplorerContainer: React.FC = () => {
  // UI state
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [detailNode, setDetailNode] = useState<TreeNode | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<{ [key: string]: boolean }>({});
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "cy">("en");
  const [network, setNetwork] = useState<string>("");

  // Taxonomy selection state
  const [year, setYear] = useState<string | null>(null);
  const [entrypoint, setEntrypoint] = useState<string | null>(null);

  const {
    advancedSearchState,
    resetAdvancedSearch,
    updateAdvancedSearchQuery,
    updateAdvancedSearchFilters,
    runAdvancedSearch,
  } = useAdvancedSearch(year, entrypoint);

  const clearTreeUiState = useCallback(() => {
    setNetwork("");
    setSelectedNode(null);
    setDetailNode(null);
    setExpandedKeys({});
    setHighlightedKey(null);
  }, []);

  const {
    entrypoints,
    rawTreeData,
    entrypointLoaded,
    loadingEntrypoint,
    advancedSearchFilterOptions,
    referenceParagraphsBySource,
  } = useEntrypointData(year, entrypoint, resetAdvancedSearch, clearTreeUiState);

  const currentTreeNodes: TreeNode[] = useMemo(() => {
    const raw = rawTreeData?.[network];
    if (!raw || !Array.isArray(raw)) return [];
    return mapElrGroupedTreeToTreeNodes(raw);
  }, [rawTreeData, network]);

  const { treeLocations, expandPathToQName, navigateToLocation } = useTreeNavigation({
    currentTreeNodes,
    rawTreeData,
    detailNode,
    network,
    setNetwork,
    setExpandedKeys,
    setHighlightedKey,
    setSelectedNode,
    setDetailNode,
  });

  // Default network
  useEffect(() => {
    if (!entrypointLoaded || !Object.keys(rawTreeData).length) return;

    if (!network || !rawTreeData[network]) {
      const preferred = rawTreeData.presentation ? "presentation" : Object.keys(rawTreeData)[0];
      if (preferred) setNetwork(preferred);
    }
  }, [rawTreeData, entrypointLoaded, network]);

  return (
    <>
      {loadingEntrypoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90 transition-opacity duration-300">
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
        entrypoints={entrypoints}
        onYearChange={setYear}
        onEntrypointChange={setEntrypoint}
        onSelectNode={(node) => {
          setSelectedNode(node);
          setDetailNode(node);
        }}
        onExpandedKeysChange={setExpandedKeys}
        onLanguageChange={setLanguage}
        onNetworkChange={(val) => {
          if (entrypointLoaded && rawTreeData[val]) {
            setNetwork(val);
            setExpandedKeys({});
            setHighlightedKey(null);
          } else {
            console.warn("[NetworkChange] Ignored invalid or unloaded network:", val);
          }
        }}
        onNavigateToNode={expandPathToQName}
        onNavigateToLocation={navigateToLocation}
        currentTreeNodes={currentTreeNodes}
        entrypointLoaded={entrypointLoaded}
        treeLocations={treeLocations}
        advancedSearchState={advancedSearchState}
        advancedSearchFilterOptions={advancedSearchFilterOptions}
        referenceParagraphsBySource={referenceParagraphsBySource}
        onAdvancedSearchQueryChange={updateAdvancedSearchQuery}
        onAdvancedSearchFiltersChange={updateAdvancedSearchFilters}
        onRunAdvancedSearch={runAdvancedSearch}
        onResetAdvancedSearch={resetAdvancedSearch}
      />
    </>
  );
};

export default XBRLTaxonomyExplorerContainer;
