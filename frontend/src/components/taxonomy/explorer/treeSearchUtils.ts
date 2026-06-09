import { TreeNode } from "./tree_utils";

export function normalizeTreeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function tokenizeTreeSearchValue(value: string): string[] {
  return normalizeTreeSearchValue(value)
    .replace(/(?<=[a-z0-9])(?=[A-Z])/g, " ")
    .split(/[\s:._-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function matchesTreeNodeSearch(
  node: TreeNode,
  treeFilter: string,
  language: "en" | "cy"
): boolean {
  const rawFilter = normalizeTreeSearchValue(treeFilter);
  if (!rawFilter) return true;

  const haystack = normalizeTreeSearchValue(
    [
      language === "cy" && node.data?.label_cy ? node.data.label_cy : node.label,
      node.data?.qname ?? "",
      node.data?.definition ?? "",
      node.data?.elr ?? "",
    ].join(" ")
  );

  const filterTokens = tokenizeTreeSearchValue(treeFilter);
  if (filterTokens.length === 0) {
    return haystack.includes(rawFilter);
  }

  return filterTokens.every((token) => haystack.includes(token));
}

export function filterTreeNodes(
  nodes: TreeNode[],
  treeFilter: string,
  language: "en" | "cy"
): TreeNode[] {
  if (!normalizeTreeSearchValue(treeFilter)) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const filteredChildren = filterTreeNodes(node.children ?? [], treeFilter, language);
    const isMatch = matchesTreeNodeSearch(node, treeFilter, language);

    if (!isMatch && filteredChildren.length === 0) {
      return [];
    }

    return [
      {
        ...node,
        children: filteredChildren,
      },
    ];
  });
}

export function findFirstVisibleConceptQname(
  nodes: TreeNode[],
  treeFilter: string,
  language: "en" | "cy"
): string | null {
  const visibleNodes = filterTreeNodes(nodes, treeFilter, language);

  const visit = (branch: TreeNode[]): string | null => {
    for (const node of branch) {
      if (node.data?.qname) {
        return node.data.qname;
      }

      const nested = visit(node.children ?? []);
      if (nested) {
        return nested;
      }
    }

    return null;
  };

  return visit(visibleNodes);
}
