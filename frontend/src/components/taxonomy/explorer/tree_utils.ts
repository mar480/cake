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
  label?: string;
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

export type { RawConceptNode, RawElrGroup };

const mapConceptNode = (
  n: RawConceptNode,
  pathKey: string,
  elrKey: string,
  language: Lang
): TreeNode => ({
  key: String(
    n.uuid
      ? `${elrKey}::${n.uuid}`
      : `${elrKey}::${n.tree_id ?? "no-tree-id"}::${pathKey}:${n.qname ?? n.concept_id ?? "node"}`
  ),
  label:
    language === "cy"
      ? n.label_cy ?? n.label ?? n.name ?? "Unnamed Node"
      : n.label ?? n.name ?? n.label_cy ?? "Unnamed Node",
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
    ? n.children.map((c: RawConceptNode, idx: number) =>
        mapConceptNode(c, `${pathKey}.${idx}`, elrKey, language)
      )
    : [],
});

export const mapRawConceptTreeToTreeNodes = (
  nodes: RawConceptNode[],
  language: Lang = "en",
  treeKey = "tree"
): TreeNode[] => {
  if (!Array.isArray(nodes)) return [];

  return nodes.map((node, idx) => {
    return mapConceptNode(node, `${treeKey}.${idx}`, treeKey, language);
  });
};


export const mapElrGroupedTreeToTreeNodes = (
  groups: RawElrGroup[],
  language: Lang = "en"
): TreeNode[] => {
  if (!Array.isArray(groups)) return [];

  const pickConceptLabel = (n: RawConceptNode, lang: Lang) =>
    lang === "cy" ? (n.label_cy ?? n.name ?? "Unnamed Node")
                  : (n.name ?? n.label_cy ?? "Unnamed Node");

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
        mapConceptNode(
          n,
          `${g.elr ?? "elr"}:${gIdx}.${rootIdx}`,
          String(g.elr ?? `elr-${gIdx}`),
          language
        )
      )
    : [],
}));
};
