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

  const { treeLocations, expandPathToQName, navigateToLocation, navigateToQNameInNetwork } = useTreeNavigation({
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

  const resultNetworks = useMemo(() => {
    const networksByQname = new Map<string, Set<string>>();

    const walk = (networkKey: string, node: { qname?: string; children?: { qname?: string; children?: unknown[] }[] }) => {
      if (node.qname) {
        if (!networksByQname.has(node.qname)) networksByQname.set(node.qname, new Set());
        networksByQname.get(node.qname)?.add(networkKey);
      }
      (node.children ?? []).forEach((child) => walk(networkKey, child as never));
    };

    Object.entries(rawTreeData).forEach(([networkKey, groups]) => {
      (groups ?? []).forEach((group) => {
        (group.root_tree ?? []).forEach((root) => walk(networkKey, root));
      });
    });

    const mapped: Record<string, string[]> = {};
    networksByQname.forEach((networkSet, qname) => {
      const ordered = NETWORK_TAB_ORDER.filter((networkKey) => networkSet.has(networkKey));
      const extras = Array.from(networkSet).filter((networkKey) => !NETWORK_TAB_ORDER.includes(networkKey as never));
      mapped[qname] = [...ordered, ...extras];
    });
    return mapped;
  }, [rawTreeData]);

  const resultElrDefinitions = useMemo(() => {
    const elrsByQname = new Map<string, string[]>();

    const addElr = (qname: string, elrDefinition: string) => {
      if (!qname || !elrDefinition) return;
      const existing = elrsByQname.get(qname) ?? [];
      if (!existing.includes(elrDefinition)) {
        existing.push(elrDefinition);
        elrsByQname.set(qname, existing);
      }
    };

    const walk = (
      elrDefinition: string,
      node: { qname?: string; children?: { qname?: string; children?: unknown[] }[] }
    ) => {
      if (node.qname) {
        addElr(node.qname, elrDefinition);
      }
      (node.children ?? []).forEach((child) => walk(elrDefinition, child as never));
    };

    Object.values(rawTreeData).forEach((groups) => {
      (groups ?? []).forEach((group) => {
        const elrDefinition = group.definition ?? group.elr ?? "";
        (group.root_tree ?? []).forEach((root) => walk(elrDefinition, root));
      });
    });

    return Object.fromEntries(elrsByQname);
  }, [rawTreeData]);

  const navigateFromSearch = useCallback(
    (qname: string, targetNetwork?: string) => {
      const destinationNetwork = targetNetwork || "presentation";
      navigateToQNameInNetwork(qname, destinationNetwork);
    },
    [navigateToQNameInNetwork]
  );

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
        onNavigateToSearchNode={navigateFromSearch}
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
        networkLabels={NETWORK_LABELS}
        resultNetworks={resultNetworks}
        resultElrDefinitions={resultElrDefinitions}
      />
    </>
  );
};

export default XBRLTaxonomyExplorerContainer;
