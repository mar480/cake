import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import XBRLTaxonomyExplorer from "./XBRLTaxonomyExplorer";
import Loader from "@/components/loader/Loader";
import "@/components/loader/loader.scss";
import {
  TreeNode,
  mapElrGroupedTreeToTreeNodes,
} from "@/components/taxonomy/explorer/tree_utils";
import { TreeLocationTarget } from "./TreeLocationsTab";
import {
  AdvancedSearchFilters,
  AdvancedSearchResult,
  AdvancedSearchFilterOptions,
} from "@/types/advancedSearch";

type RawTreeNode = {
  qname?: string;
  uuid?: string;
  tree_id?: string;
  name?: string;
  xbrl_type?: string;
  full_type?: string;
  substitution_group?: string;
  children?: RawTreeNode[];
};

type RawElrGroup = {
  elr: string;
  definition?: string;
  numeric_part?: number;
  root_tree?: RawTreeNode[];
};

type PendingNavigation = {
  network: string;
  qname: string;
  uuid?: string;
  treeId?: string;
  updateDetails?: boolean;
};

type SearchConceptApiResult = {
  qname: string;
  local_name?: string;
  label?: string;
  score?: number;
  matched_fields?: string[];
};

const NAV_LOG_PREFIX = "[TreeLocationNavigation]";
const EXCLUDED_TREE_KEYS = new Set(["concepts", "dimensions", "hypercubes", "primary_items"]);

const EMPTY_ADVANCED_FILTERS: AdvancedSearchFilters = {
  namespace: [],
  balance: [],
  periodType: [],
  xbrlType: [],
  fullType: [],
  abstract: [],
  nillable: [],
  substitutionGroup: [],
  referenceSource: null,
  referenceParagraph: [],
};

const EMPTY_ADVANCED_FILTER_OPTIONS: AdvancedSearchFilterOptions = {
  namespace: [],
  balance: [],
  periodType: [],
  xbrlType: [],
  fullType: [],
  abstract: [true, false],
  nillable: [true, false],
  substitutionGroup: [],
  referenceSources: [],
};

function sanitizeAdvancedFilters(next: AdvancedSearchFilters): AdvancedSearchFilters {
  return {
    ...next,
    referenceSource:
      typeof next.referenceSource === "string" && next.referenceSource.trim()
        ? next.referenceSource
        : null,
    referenceParagraph: (Array.isArray(next.referenceParagraph) ? next.referenceParagraph : [])
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0),
  };
}


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
  const [entrypoints, setEntrypoints] = useState<{ name: string; href: string }[]>([]);

  // Tree data + loading state
  const [rawTreeData, setRawTreeData] = useState<Record<string, RawElrGroup[]>>({});
  const [entrypointLoaded, setEntrypointLoaded] = useState(false);
  const [loadingEntrypoint, setLoadingEntrypoint] = useState(false);

  // navigation queue (for cross-network jumps)
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);

  // Advanced Search state
  const [advancedSearchQuery, setAdvancedSearchQuery] = useState("");
  const [advancedSearchFilters, setAdvancedSearchFilters] =
    useState<AdvancedSearchFilters>(EMPTY_ADVANCED_FILTERS);
  const [advancedSearchResults, setAdvancedSearchResults] = useState<AdvancedSearchResult[]>([]);
  const [advancedSearchLoading, setAdvancedSearchLoading] = useState(false);
  const [advancedSearchError, setAdvancedSearchError] = useState<string | null>(null);
  const [advancedSearchPagination, setAdvancedSearchPagination] = useState({
    limit: 25,
    offset: 0,
    total: 0,
  });
  const [advancedSearchLastRunAt, setAdvancedSearchLastRunAt] = useState<string | null>(null);


    const latestAdvancedQueryRef = useRef("");
  const latestAdvancedFiltersRef = useRef<AdvancedSearchFilters>(EMPTY_ADVANCED_FILTERS);
  const lastRunCriteriaKeyRef = useRef<string | null>(null);
  // Option scaffolding for upcoming advanced UI
  const [advancedSearchFilterOptions, setAdvancedSearchFilterOptions] =
    useState<AdvancedSearchFilterOptions>(EMPTY_ADVANCED_FILTER_OPTIONS);
  const [referenceParagraphsBySource, setReferenceParagraphsBySource] = useState<
    Record<string, string[]>
  >({});

  const currentTreeNodes: TreeNode[] = useMemo(() => {
    const raw = rawTreeData?.[network];
    if (!raw || !Array.isArray(raw)) return [];
    return mapElrGroupedTreeToTreeNodes(raw);
  }, [rawTreeData, network]);

  const resetAdvancedSearch = useCallback(() => {
    setAdvancedSearchQuery("");
    setAdvancedSearchFilters(EMPTY_ADVANCED_FILTERS);
        latestAdvancedQueryRef.current = "";
    latestAdvancedFiltersRef.current = EMPTY_ADVANCED_FILTERS;
    lastRunCriteriaKeyRef.current = null;
    setAdvancedSearchResults([]);
    setAdvancedSearchLoading(false);
    setAdvancedSearchError(null);
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

  const runAdvancedSearch = useCallback(async (nextOffset?: number) => {
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

      const response = await fetch("/api/search-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          href: entrypoint,
          q: trimmedQuery,
          filters: latestAdvancedFiltersRef.current,
          limit: advancedSearchPagination.limit,
          offset: requestedOffset,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Search request failed");
      }

      const results: AdvancedSearchResult[] = (payload.results || []).map(

        (result: SearchConceptApiResult, idx: number) => ({

          id: `${result.qname}-${requestedOffset + idx}`,
          qname: result.qname,
          localName: result.local_name,
          label: result.label,
          score: result.score,
          matchedFields: result.matched_fields ?? [],
        })
      );

      setAdvancedSearchResults(results);
      setAdvancedSearchPagination((prev) => ({
        ...prev,
        limit: payload.limit ?? prev.limit,
        offset: payload.offset ?? requestedOffset,
        total: payload.total ?? results.length,
      }));

      setAdvancedSearchLastRunAt(new Date().toISOString());
      lastRunCriteriaKeyRef.current = criteriaKey;
    } catch (error) {
      console.error("Advanced search failed", error);
      setAdvancedSearchError("Advanced search failed. Please try again.");
    } finally {
      setAdvancedSearchLoading(false);
    }
  }, [

    advancedSearchPagination.limit,

    advancedSearchPagination.offset,
    entrypoint,
    year,
  ]);

  const advancedSearchState = useMemo(
    () => ({
      query: advancedSearchQuery,
      filters: advancedSearchFilters,
      results: advancedSearchResults,
      loading: advancedSearchLoading,
      error: advancedSearchError,
      pagination: advancedSearchPagination,
      lastRunAt: advancedSearchLastRunAt,
    }),
    [
      advancedSearchQuery,
      advancedSearchFilters,
      advancedSearchResults,
      advancedSearchLoading,
      advancedSearchError,
      advancedSearchPagination,
      advancedSearchLastRunAt,
    ]
  );

  // Warm backend
  useEffect(() => {
    if (entrypointLoaded) {
      fetch("/api/concept-details?qname=core:TurnoverRevenue")
        .then(() => console.log("Backend warmed up"))
        .catch((err) => console.warn("Warm-up failed", err));
    }
  }, [entrypointLoaded]);

  // Fetch entrypoints when year changes
  useEffect(() => {
    if (!year) return;
    fetch(`/api/entrypoints?year=${year}`)
      .then((res) => res.json())
      .then((data) => {
        setEntrypoints(data.entrypoints || []);
      })
      .catch((err) => {
        console.error("Failed to fetch entrypoints", err);
        setEntrypoints([]);
      });
  }, [year]);

  // Load entrypoint and raw trees
  useEffect(() => {
    if (!year || !entrypoint) return;

    setEntrypointLoaded(false);
    setLoadingEntrypoint(true);
    setRawTreeData({});
    setNetwork("");
    setSelectedNode(null);
    setDetailNode(null);
    setExpandedKeys({});
    setHighlightedKey(null);
    setPendingNavigation(null);
    resetAdvancedSearch();

    // keep options reset deterministic on entrypoint change
    setAdvancedSearchFilterOptions(EMPTY_ADVANCED_FILTER_OPTIONS);
    setReferenceParagraphsBySource({});

    fetch("/api/load-entrypoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, href: entrypoint }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "loaded") {
          console.error("Load error:", data.error);
          setLoadingEntrypoint(false);
          return;
        }

        const treeMap: Record<string, RawElrGroup[]> = {};
        for (const [key, rawTree] of Object.entries(data.trees || {})) {
          const normalizedKey = key.replace(/_tree$/, "");
          if (EXCLUDED_TREE_KEYS.has(normalizedKey)) continue;
          if (Array.isArray(rawTree)) {
            treeMap[normalizedKey] = rawTree as RawElrGroup[];
          }
        }

        setRawTreeData(treeMap);

        const filtersUrl =
          `/api/search-filter-options?year=${encodeURIComponent(year)}` +
          `&href=${encodeURIComponent(entrypoint)}`;

        fetch(filtersUrl)
          .then((res) => res.json())
          .then((opts) => {
            setAdvancedSearchFilterOptions({
              namespace: opts.namespace ?? [],
              balance: opts.balance ?? [],
              periodType: opts.periodType ?? [],
              xbrlType: opts.xbrlType ?? [],
              fullType: opts.fullType ?? [],
              abstract: opts.abstract ?? [true, false],
              nillable: opts.nillable ?? [true, false],
              substitutionGroup: opts.substitutionGroup ?? [],
              referenceSources: opts.referenceSources ?? [],
            });
            setReferenceParagraphsBySource(opts.referenceParagraphsBySource ?? {});
          })
          .catch((err) => {
            console.error("Failed to load search filter options", err);
            setAdvancedSearchFilterOptions(EMPTY_ADVANCED_FILTER_OPTIONS); // fallback
            setReferenceParagraphsBySource({});
          });

        setEntrypointLoaded(true);
        setLoadingEntrypoint(false);
      })
      .catch((err) => {
        console.error("Failed to load entrypoint", err);
        setLoadingEntrypoint(false);
      });
  }, [entrypoint, year, resetAdvancedSearch]);

  // Default network
  useEffect(() => {
    if (!entrypointLoaded || !Object.keys(rawTreeData).length) return;

    if (!network || !rawTreeData[network]) {
      const preferred = rawTreeData["presentation"] ? "presentation" : Object.keys(rawTreeData)[0];
      if (preferred) setNetwork(preferred);
    }
  }, [rawTreeData, entrypointLoaded, network]);

  const findPathInTreeNodes = useCallback(
    (nodes: TreeNode[], predicate: (node: TreeNode) => boolean): TreeNode[] | null => {
      const dfs = (arr: TreeNode[], acc: TreeNode[]): TreeNode[] | null => {
        for (const node of arr) {
          const next = [...acc, node];
          if (predicate(node)) return next;
          if (node.children?.length) {
            const found = dfs(node.children, next);
            if (found) return found;
          }
        }
        return null;
      };
      return dfs(nodes, []);
    },
    []
  );

  const expandPathToQName = useCallback(
    (targetQName: string, options?: { preserveDetails?: boolean }) => {
      const path = findPathInTreeNodes(currentTreeNodes, (node) => node.data?.qname === targetQName);
      if (!path) return;

      const expanded: Record<string, boolean> = {};
      for (const node of path) expanded[node.key] = true;
      setExpandedKeys((prev) => ({ ...prev, ...expanded }));

      const target = path[path.length - 1];
      setHighlightedKey(target.key);
      setTimeout(() => setHighlightedKey(null), 5000);
      setSelectedNode(target);
            if (!options?.preserveDetails) {
        setDetailNode(target);
      }
    },
    [currentTreeNodes, findPathInTreeNodes]
  );

  const treeLocations = useMemo<TreeLocationTarget[]>(() => {
    const qname = detailNode?.data?.qname;
    if (!qname) return [];

    const results: TreeLocationTarget[] = [];

    const walk = (
      networkKey: string,
      elr: string,
      elrDefinition: string,
      node: RawTreeNode,
      pathNodes: {
        label: string;
        xbrlType?: string;
        fullType?: string;
        substitutionGroup?: string;
      }[],
      numericPart?: number
    ) => {
      const currentLabel = node.name ?? node.qname ?? "Unnamed";
      const nextPathNodes = [
        ...pathNodes,
        {
          label: currentLabel,
          xbrlType: node.xbrl_type,
          fullType: node.full_type,
          substitutionGroup: node.substitution_group,
        },
      ];

      if (node.qname === qname) {
        results.push({
          network: networkKey,
          elr,
          elrDefinition,
          numericPart,
          qname,
          uuid: node.uuid,
          label: currentLabel,
          treeId: node.tree_id,
          pathNodes: nextPathNodes,
        });
      }

      for (const child of node.children ?? []) {
        walk(networkKey, elr, elrDefinition, child, nextPathNodes, numericPart);
      }
    };

    for (const [networkKey, groups] of Object.entries(rawTreeData)) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups as RawElrGroup[]) {
        const elr = group.elr ?? "";
        const elrDefinition = group.definition ?? elr;
        const numericPart = group.numeric_part;
        for (const root of group.root_tree ?? []) {
          walk(networkKey, elr, elrDefinition, root, [], numericPart);
        }
      }
    }

    return results;
  }, [rawTreeData, detailNode?.data?.qname]);

  const navigateToLocation = useCallback(
    (target: TreeLocationTarget) => {
      console.debug(`${NAV_LOG_PREFIX} request`, {
        fromNetwork: network,
        toNetwork: target.network,
        qname: target.qname,
        uuid: target.uuid,
        treeId: target.treeId,
        label: target.label,
        elr: target.elr,
      });

      setPendingNavigation({
        network: target.network,
        qname: target.qname,
        uuid: target.uuid,
        treeId: target.treeId,
        updateDetails: true,
      });

      if (network !== target.network) {
        setNetwork(target.network);
        setExpandedKeys({});
        setHighlightedKey(null);
      }
    },
    [network]
  );

  useEffect(() => {
    if (!pendingNavigation) return;
    if (network !== pendingNavigation.network) return;

    const uuidMatches: TreeNode[] = [];
    const treeIdMatches: TreeNode[] = [];
    const qnameMatches: TreeNode[] = [];
    const collectMatches = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (pendingNavigation.uuid && node.data?.uuid === pendingNavigation.uuid) {
          uuidMatches.push(node);
        }
        if (pendingNavigation.treeId && node.data?.treeId === pendingNavigation.treeId) {
          treeIdMatches.push(node);
        }
        if (node.data?.qname === pendingNavigation.qname) {
          qnameMatches.push(node);
        }
        if (node.children?.length) collectMatches(node.children);
      }
    };
    collectMatches(currentTreeNodes);

    let matcher: (node: TreeNode) => boolean;
    let matchStrategy: "uuid" | "treeId" | "treeId+qname" | "qname";
    if (pendingNavigation.uuid && uuidMatches.length > 0) {
      matcher = (node) => node.data?.uuid === pendingNavigation.uuid;
      matchStrategy = "uuid";
    } else if (pendingNavigation.treeId && treeIdMatches.length > 0) {
      matcher = (node) => node.data?.treeId === pendingNavigation.treeId;
      matchStrategy = "treeId";
    } else {
      matcher = (node) => node.data?.qname === pendingNavigation.qname;
      matchStrategy = "qname";
    }

    console.debug(`${NAV_LOG_PREFIX} candidates`, {
      network,
      requested: pendingNavigation,
      uuidMatches: uuidMatches.length,
      treeIdMatches: treeIdMatches.length,
      qnameMatches: qnameMatches.length,
      using: matchStrategy,
    });

    const path = findPathInTreeNodes(currentTreeNodes, matcher) ?? null;

    if (!path) {
      console.warn(`${NAV_LOG_PREFIX} no path found`, {
        network,
        requested: pendingNavigation,
      });
      return;
    }

    const expanded: Record<string, boolean> = {};
    for (const node of path) expanded[node.key] = true;
    setExpandedKeys((prev) => ({ ...prev, ...expanded }));

    const targetNode = path[path.length - 1];
    setSelectedNode(targetNode);
        if (pendingNavigation.updateDetails !== false) {
      setDetailNode(targetNode);
    }
    setHighlightedKey(targetNode.key);
    setTimeout(() => setHighlightedKey(null), 5000);

    console.debug(`${NAV_LOG_PREFIX} resolved`, {
      using: matchStrategy,
      targetKey: targetNode.key,
      targetQname: targetNode.data?.qname,
      targetUuid: targetNode.data?.uuid,
      targetTreeId: targetNode.data?.treeId,
      pathDepth: path.length,
    });

    setPendingNavigation(null);
  }, [pendingNavigation, network, currentTreeNodes, findPathInTreeNodes]);

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
