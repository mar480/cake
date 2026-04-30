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
interface RawConceptNode {
  tree_id?: string;
  uuid?: string;
  qname?: string;
  concept_id?: string;
  name?: string;
  label_cy?: string;
  xbrl_type?: string;
  full_type?: string;
  substitution_group?: string;
  abstract?: boolean;
  children?: RawConceptNode[];
}

interface RawElrGroup {
  elr?: string;
  definition?: string;
  numeric_part?: number;
  uuid?: string;
  root_tree?: RawConceptNode[];
}


export const mapElrGroupedTreeToTreeNodes = (
  groups: RawElrGroup[],
  language: Lang = "en"
): TreeNode[] => {
  if (!Array.isArray(groups)) return [];

  const pickConceptLabel = (n: RawConceptNode, lang: Lang) =>
    lang === "cy" ? (n.label_cy ?? n.name ?? "Unnamed Node")
                  : (n.name ?? n.label_cy ?? "Unnamed Node");

const mapConcept = (n: RawConceptNode, pathKey: string, elrKey: string): TreeNode => ({
  // Instance key first (tree occurrence), then deterministic fallback.
  key: String(
        n.uuid
      ? `${elrKey}::${n.uuid}`
      : `${elrKey}::${n.tree_id ?? "no-tree-id"}::${pathKey}:${n.qname ?? n.concept_id ?? "node"}`
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
    ? n.children.map((c: RawConceptNode, idx: number) => mapConcept(c, `${pathKey}.${idx}`, elrKey))
    : [],
});

return groups.map((g: RawElrGroup, gIdx: number) => ({
  key: String(g.elr ?? `elr-${gIdx}`),
  label: g.definition ?? "Unnamed Node",
  data: {
    elr: g.elr,
    definition: g.definition,
    numeric_part: g.numeric_part,
    uuid: g.uuid,
  },
  children: Array.isArray(g.root_tree)
    ? g.root_tree.map((n: RawConceptNode, rootIdx: number) =>
        mapConcept(n, `${g.elr ?? "elr"}:${gIdx}.${rootIdx}`,String(g.elr ?? `elr-${gIdx}`))
      )
    : [],
}));
};