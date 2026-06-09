import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TreeNode } from "@/components/taxonomy/explorer/tree_utils";

import {
  chooseNavigationMatcher,
  collectTreeLocations,
  findPathInTreeNodes,
} from "../navigationUtils";
import { NAV_LOG_PREFIX, PendingNavigation, RawElrGroup } from "../explorerTypes";
import { TreeLocationTarget } from "../TreeLocationsTab";

interface UseTreeNavigationArgs {
  currentTreeNodes: TreeNode[];
  rawTreeData: Record<string, RawElrGroup[]>;
  detailNode: TreeNode | null;
  network: string;
  entrypoint?: string | null;
  setNetwork: (next: string) => void;
  setExpandedKeys: Dispatch<SetStateAction<{ [key: string]: boolean }>>;
  setHighlightedKey: (next: string | null) => void;
  setSelectedNode: (next: TreeNode | null) => void;
  setDetailNode: (next: TreeNode | null) => void;
  onNavigationFailure?: (pendingNavigation: PendingNavigation) => void;
}

export function useTreeNavigation({
  currentTreeNodes,
  rawTreeData,
  detailNode,
  network,
  entrypoint,
  setNetwork,
  setExpandedKeys,
  setHighlightedKey,
  setSelectedNode,
  setDetailNode,
  onNavigationFailure,
}: UseTreeNavigationArgs) {
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const treeLocations = useMemo<TreeLocationTarget[]>(
    () => collectTreeLocations(rawTreeData, detailNode?.data?.qname),
    [rawTreeData, detailNode?.data?.qname]
  );

  const clearHighlightTimeout = useCallback(() => {
    if (highlightTimeoutRef.current !== null) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  const applyHighlight = useCallback(
    (key: string, persistent = false) => {
      clearHighlightTimeout();
      setHighlightedKey(key);

      if (!persistent) {
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedKey(null);
          highlightTimeoutRef.current = null;
        }, 5000);
      }
    },
    [clearHighlightTimeout, setHighlightedKey]
  );

  useEffect(() => {
    return () => {
      clearHighlightTimeout();
    };
  }, [clearHighlightTimeout]);

  const expandPathToQName = useCallback(
    (targetQName: string, options?: { preserveDetails?: boolean; persistentHighlight?: boolean }) => {
      const path = findPathInTreeNodes(
        currentTreeNodes,
        (node) => node.data?.qname === targetQName
      );
      if (!path) return;

      const expanded: Record<string, boolean> = {};
      for (const node of path) expanded[node.key] = true;
      setExpandedKeys((prev) => ({ ...prev, ...expanded }));

      const target = path[path.length - 1];
      applyHighlight(target.key, options?.persistentHighlight);
      setSelectedNode(target);
      if (!options?.preserveDetails) {
        setDetailNode(target);
      }
    },
    [applyHighlight, currentTreeNodes, setDetailNode, setExpandedKeys, setSelectedNode]
  );

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
        targetEntrypoint: entrypoint ?? undefined,
        network: target.network,
        elr: target.elr,
        qname: target.qname,
        uuid: target.uuid,
        updateDetails: true,
      });

      if (network !== target.network) {
        setNetwork(target.network);
        setExpandedKeys({});
        setHighlightedKey(null);
      }
    },
    [entrypoint, network, setExpandedKeys, setHighlightedKey, setNetwork]
  );

  const navigateToQNameInNetwork = useCallback(
    (
      targetQName: string,
      targetNetwork: string,
      targetElr?: string,
      options?: { preserveDetails?: boolean; targetEntrypoint?: string; uuid?: string }
    ) => {
      if (!targetQName || !targetNetwork) return;
      if (!rawTreeData[targetNetwork]) return;

      setPendingNavigation({
        targetEntrypoint: options?.targetEntrypoint ?? entrypoint ?? undefined,
        network: targetNetwork,
        elr: targetElr,
        qname: targetQName,
        uuid: options?.uuid,
        updateDetails: options?.preserveDetails ? false : true,
        persistentHighlight: options?.persistentHighlight,
      });

      if (network !== targetNetwork) {
        setNetwork(targetNetwork);
        setExpandedKeys({});
        setHighlightedKey(null);
      }
    },
    [entrypoint, network, rawTreeData, setExpandedKeys, setHighlightedKey, setNetwork]
  );

  useEffect(() => {
    if (!pendingNavigation) return;
    if (network !== pendingNavigation.network) return;

    const { matcher, matchStrategy, uuidMatches, elrQNameMatches, qnameMatches } =
      chooseNavigationMatcher(currentTreeNodes, pendingNavigation);

    console.debug(`${NAV_LOG_PREFIX} candidates`, {
      network,
      requested: pendingNavigation,
      uuidMatches: uuidMatches.length,
      elrQNameMatches: elrQNameMatches.length,
      qnameMatches: qnameMatches.length,
      using: matchStrategy,
    });

    const path = findPathInTreeNodes(currentTreeNodes, matcher) ?? null;

    if (!path) {
      console.warn(`${NAV_LOG_PREFIX} no path found`, {
        network,
        requested: pendingNavigation,
      });
      onNavigationFailure?.(pendingNavigation);
      setPendingNavigation(null);
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
    applyHighlight(targetNode.key, pendingNavigation.persistentHighlight);

    console.debug(`${NAV_LOG_PREFIX} resolved`, {
      using: matchStrategy,
      targetKey: targetNode.key,
      targetQname: targetNode.data?.qname,
      targetUuid: targetNode.data?.uuid,
      targetTreeId: targetNode.data?.treeId,
      pathDepth: path.length,
    });

    setPendingNavigation(null);
  }, [
    currentTreeNodes,
    network,
    pendingNavigation,
    setDetailNode,
    setExpandedKeys,
    setSelectedNode,
    onNavigationFailure,
    applyHighlight,
  ]);

  return {
    treeLocations,
    expandPathToQName,
    clearPendingNavigation: useCallback(() => setPendingNavigation(null), []),
    clearHighlight: useCallback(() => {
      clearHighlightTimeout();
      setHighlightedKey(null);
    }, [clearHighlightTimeout, setHighlightedKey]),
    navigateToLocation,
    navigateToQNameInNetwork,
  };
}
