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
    uuid?: string;
    treeId?: string;
  };
  children?: TreeNode[];
}

export interface TreeNodeVisualSpec {
  iconClass: string;
  iconGlyph: string;
  iconColor: string;
  secondaryIconClass?: string;
  secondaryGlyph?: string;
  secondaryColor?: string;
  tertiaryIconClass?: string;
  tertiaryGlyph?: string;
  tertiaryColor?: string;
  nodeTypeLabel: string;
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

export function getTreeNodeVisualSpec(nodeData?: TreeNode["data"]): TreeNodeVisualSpec {
  const fullType = nodeData?.full_type;
  const xbrlType = nodeData?.xbrl_type;
  const substitutionGroup = nodeData?.substitution_group;

  const isDimension = substitutionGroup === "xbrldt:dimensionItem";
  const isHypercube = substitutionGroup === "xbrldt:hypercubeItem";
  const isDomainMember = fullType === "nonnum:domainItemType";
  const isElrGroup = Boolean(nodeData?.definition || nodeData?.elr) && !nodeData?.qname;

  const fullTypeIcons: Record<string, { cls: string; glyph: string; color: string; label: string }> = {
    "types:guidanceItemType": { cls: "pi pi-exclamation-triangle text-red-500", glyph: "!", color: "#ef4444", label: "Guidance item" },
    "types:headingItemType": { cls: "pi pi-folder text-black-500", glyph: "\uD83D\uDCC1", color: "#1f2937", label: "Heading item" },
    "types:xrefItemType": { cls: "pi pi-arrow-right-arrow-left text-red-400", glyph: "\u2194", color: "#f87171", label: "Cross-reference item" },
    "nonnum:domainItemType": { cls: "pi pi-globe text-pink-500", glyph: "\u25CE", color: "#ec4899", label: "Domain member" },
    "Q2:domainItemType": { cls: "pi pi-globe text-pink-500", glyph: "\u25CE", color: "#ec4899", label: "Domain member" },
    "num:energyItemType": { cls: "pi pi-sun text-orange-500", glyph: "\u2600", color: "#f97316", label: "Energy item" },
    "num:massItemType": { cls: "pi pi-gauge text-green-500", glyph: "\u25D4", color: "#22c55e", label: "Mass item" },
    "num:percentItemType": { cls: "pi pi-percentage text-teal-500", glyph: "%", color: "#14b8a6", label: "Percent item" },
    "types:fixedItemType": { cls: "pi pi-align-left text-cyan-500", glyph: "\u2261", color: "#06b6d4", label: "Fixed item" },
    "types:syndicateNumberItemType": { cls: "pi pi-hashtag text-green-500", glyph: "#", color: "#22c55e", label: "Syndicate number item" },
    "dtr2022:ghgEmissionsItemType": { cls: "pi pi-gauge text-green-500", glyph: "\u2601", color: "#22c55e", label: "GHG emissions item" },
  };

  const xbrlTypeIcons: Record<string, { cls: string; glyph: string; color: string; label: string }> = {
    anyURIItemType: { cls: "pi pi-link text-blue-400", glyph: "\uD83D\uDD17", color: "#60a5fa", label: "URI type" },
    booleanItemType: { cls: "pi pi-check-square text-green-500", glyph: "\u2713", color: "#22c55e", label: "Boolean type" },
    dateItemType: { cls: "pi pi-calendar-clock text-fuchsia-500", glyph: "\u25F7", color: "#d946ef", label: "Date type" },
    decimalItemType: { cls: "pi pi-sort-numeric-down text-neutral-500", glyph: "1", color: "#737373", label: "Decimal type" },
    monetaryItemType: { cls: "pi pi-pound text-amber-500", glyph: "\u00A3", color: "#f59e0b", label: "Monetary type" },
    sharesItemType: { cls: "pi pi-chart-line text-purple-500", glyph: "\u2197", color: "#a855f7", label: "Shares type" },
    stringItemType: { cls: "pi pi-align-left text-cyan-500", glyph: "T", color: "#06b6d4", label: "String type" },
  };

  if (isElrGroup) {
    return {
      iconClass: "pi pi-folder text-slate-700",
      iconGlyph: "\uD83D\uDCC1",
      iconColor: "#334155",
      nodeTypeLabel: "ELR group",
    };
  }

  const primarySpec = isDimension
    ? {
        cls: "pi pi-sort-amount-down-alt text-indigo-500",
        glyph: "\u21C5",
        color: "#6366f1",
        label: "Dimension",
      }
    : isHypercube
      ? {
          cls: "pi pi-table text-rose-400",
          glyph: "\u25A6",
          color: "#fb7185",
          label: "Hypercube",
        }
    : fullTypeIcons[fullType ?? ""] ??
      xbrlTypeIcons[xbrlType ?? ""] ?? {
        cls: "pi pi-home text-gray-500",
        glyph: "\u2022",
        color: "#6b7280",
        label: "Concept",
      };

  const secondarySpec =
    fullType === "types:fixedItemType"
      ? { cls: "pi pi-star text-red-500 text-xs ml-1", glyph: "\u2605", color: "#ef4444" }
      : fullType === "types:groupingItemType"
        ? { cls: "pi pi-star text-blue-500 text-xs ml-1", glyph: "\u2605", color: "#3b82f6" }
        : undefined;

  const tertiarySpec =
    isDimension && xbrlType && xbrlTypeIcons[xbrlType]
      ? {
          cls: `${xbrlTypeIcons[xbrlType].cls} text-xs ml-1`,
          glyph: xbrlTypeIcons[xbrlType].glyph,
          color: xbrlTypeIcons[xbrlType].color,
        }
      : isDomainMember && xbrlType && xbrlTypeIcons[xbrlType]
        ? {
            cls: `${xbrlTypeIcons[xbrlType].cls} text-xs ml-1`,
            glyph: xbrlTypeIcons[xbrlType].glyph,
            color: xbrlTypeIcons[xbrlType].color,
          }
        : undefined;

  return {
    iconClass: primarySpec.cls,
    iconGlyph: primarySpec.glyph,
    iconColor: primarySpec.color,
    secondaryIconClass: secondarySpec?.cls,
    secondaryGlyph: secondarySpec?.glyph,
    secondaryColor: secondarySpec?.color,
    tertiaryIconClass: tertiarySpec?.cls,
    tertiaryGlyph: tertiarySpec?.glyph,
    tertiaryColor: tertiarySpec?.color,
    nodeTypeLabel: primarySpec.label,
  };
}

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

  return nodes.map((node, idx) => mapConceptNode(node, `${treeKey}.${idx}`, treeKey, language));
};

export const mapElrGroupedTreeToTreeNodes = (
  groups: RawElrGroup[],
  language: Lang = "en"
): TreeNode[] => {
  if (!Array.isArray(groups)) return [];

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
