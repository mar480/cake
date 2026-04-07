import { TreeNode } from "@/components/taxonomy/explorer/tree_utils";

import { TreeLocationTarget } from "./TreeLocationsTab";
import { PendingNavigation, RawElrGroup, RawTreeNode } from "./explorerTypes";

export function findPathInTreeNodes(
  nodes: TreeNode[],
  predicate: (node: TreeNode) => boolean
): TreeNode[] | null {
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
}

export function collectTreeLocations(
  rawTreeData: Record<string, RawElrGroup[]>,
  qname: string | undefined
): TreeLocationTarget[] {
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
}

export function chooseNavigationMatcher(
  currentTreeNodes: TreeNode[],
  pendingNavigation: PendingNavigation
): {
  matcher: (node: TreeNode) => boolean;
  matchStrategy: "uuid" | "elr+qname" | "qname"; 
  uuidMatches: TreeNode[];
  elrQNameMatches: TreeNode[];
  qnameMatches: TreeNode[];
} {
  const uuidMatches: TreeNode[] = [];
  const elrQNameMatches: TreeNode[] = [];
  const qnameMatches: TreeNode[] = [];

  const collectMatches = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (pendingNavigation.uuid && node.data?.uuid === pendingNavigation.uuid) {
        uuidMatches.push(node);
      }
            const nodeElr = node.key.includes("::") ? node.key.split("::")[0] : undefined;
      if (
        pendingNavigation.elr &&
        nodeElr === pendingNavigation.elr &&
        node.data?.qname === pendingNavigation.qname
      ) {
        elrQNameMatches.push(node);
      }
      if (node.data?.qname === pendingNavigation.qname) {
        qnameMatches.push(node);
      }
      if (node.children?.length) collectMatches(node.children);
    }
  };

  collectMatches(currentTreeNodes);

  if (elrQNameMatches.length > 0) {
    return {
      matcher: (node) =>
        node.key.startsWith(`${pendingNavigation.elr}::`) &&
        node.data?.qname === pendingNavigation.qname,
      matchStrategy: "elr+qname",
      uuidMatches,
      elrQNameMatches,
      qnameMatches,
    };
  }


  return {
    matcher: (node) => node.data?.qname === pendingNavigation.qname,
    matchStrategy: "qname",
    uuidMatches,
    elrQNameMatches,
    qnameMatches,
  };
}