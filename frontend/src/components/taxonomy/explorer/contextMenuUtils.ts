import type { TreeNode } from "./tree_utils";

export const canCopyTreeNode = (node: TreeNode | null | undefined): node is TreeNode => Boolean(node?.data?.qname);

export interface ConceptContextMenu { x: number; y: number; node: TreeNode }

export function contextMenuForRightClick(node: TreeNode | null | undefined, x: number, y: number): ConceptContextMenu | null {
  return canCopyTreeNode(node) ? { x, y, node } : null;
}
