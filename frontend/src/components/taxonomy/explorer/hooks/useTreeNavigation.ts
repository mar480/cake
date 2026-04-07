import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";

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
  setNetwork: (next: string) => void;
  setExpandedKeys: Dispatch<SetStateAction<{ [key: string]: boolean }>>;
  setHighlightedKey: (next: string | null) => void;
  setSelectedNode: (next: TreeNode | null) => void;
  setDetailNode: (next: TreeNode | null) => void;
}

export function useTreeNavigation({
  currentTreeNodes,
  rawTreeData,
  detailNode,
  network,
  setNetwork,
  setExpandedKeys,
  setHighlightedKey,
  setSelectedNode,
  setDetailNode,
}: UseTreeNavigationArgs) {
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);


  useEffect(() => {
    if (currentTreeNodes.length === 0) {
      setPendingNavigation(null);
    }
  }, [currentTreeNodes.length]);
  const treeLocations = useMemo<TreeLocationTarget[]>(
    () => collectTreeLocations(rawTreeData, detailNode?.data?.qname),
    [rawTreeData, detailNode?.data?.qname]
  );

  const expandPathToQName = useCallback(
    (targetQName: string, options?: { preserveDetails?: boolean }) => {
      const path = findPathInTreeNodes(
        currentTreeNodes,
        (node) => node.data?.qname === targetQName
      );
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
    [currentTreeNodes, setDetailNode, setExpandedKeys, setHighlightedKey, setSelectedNode]
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
    [network, setExpandedKeys, setHighlightedKey, setNetwork]
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
  }, [
    currentTreeNodes,
    network,
    pendingNavigation,
    setDetailNode,
    setExpandedKeys,
    setHighlightedKey,
    setSelectedNode,
  ]);

  return {
    treeLocations,
    expandPathToQName,
    navigateToLocation,
  };
}
