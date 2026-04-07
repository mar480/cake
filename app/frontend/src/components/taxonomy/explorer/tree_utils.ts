export interface TreeNode {
  key: string;
  label: string;
  data?: {
    qname?: string;
    xbrl_type?: string;
    full_type?: string;
    abstract?: boolean;
    substitution_group?: string;
    label_cy?: string;
    elr?: string;
    definition?: string;
    uuid?:string;
    /** unique instance ID to avoid key collisions */
    treeId?: string;
  };
  children?: TreeNode[];
}

type Lang = "en" | "cy";

export const mapElrGroupedTreeToTreeNodes = (
  groups: any[],
  language: Lang = "en"
): TreeNode[] => {
  if (!Array.isArray(groups)) return [];

  const pickConceptLabel = (n: any, lang: Lang) =>
    lang === "cy" ? (n.label_cy ?? n.name ?? "Unnamed Node")
                  : (n.name ?? n.label_cy ?? "Unnamed Node");

const mapConcept = (n: any, pathKey: string, elrKey: string): TreeNode => ({
  // Instance key first (tree occurrence), then deterministic fallback.
  key: String(
    n.tree_id
      ? `${elrKey}::${n.tree_id}`
      : `${pathKey}:${n.uuid ?? n.qname ?? n.concept_id ?? "node"}`
  ),
  label: n.name ?? n.label_cy ?? "Unnamed Node",
  data: {
    qname: n.qname ?? n.concept_id,
    xbrl_type: n.xbrl_type,
    full_type: n.full_type,
    substitution_group: n.substitution_group,
    abstract: n.abstract === true,
    treeId: n.tree_id,
    uuid: n.uuid,
    label_cy: n.label_cy,
  },
  children: Array.isArray(n.children)
    ? n.children.map((c: any, idx: number) => mapConcept(c, `${pathKey}.${idx}`, elrKey))
    : [],
});

return groups.map((g: any, gIdx: number) => ({
  key: String(g.elr ?? `elr-${gIdx}`),
  label: g.definition ?? "Unnamed Node",
  data: {
    elr: g.elr,
    definition: g.definition,
    numeric_part: g.numeric_part,
    uuid: g.uuid,
  },
  children: Array.isArray(g.root_tree)
    ? g.root_tree.map((n: any, rootIdx: number) =>
        mapConcept(n, `${g.elr ?? "elr"}:${gIdx}.${rootIdx}`,String(g.elr ?? `elr-${gIdx}`))
      )
    : [],
}));
};