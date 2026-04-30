import { useMemo, useState } from "react";
import { Tree } from "primereact/tree";

import type { RelationshipTreeNode } from "./apiTypes";
import { mapRawConceptTreeToTreeNodes, TreeNode } from "./tree_utils";

interface RelationshipPrimaryItemsTreeProps {
  nodes: RelationshipTreeNode[];
  language: "en" | "cy";
}

const RelationshipPrimaryItemsTree: React.FC<RelationshipPrimaryItemsTreeProps> = ({
  nodes,
  language,
}) => {
  const treeNodes = useMemo(
    () => mapRawConceptTreeToTreeNodes(nodes, language, "relationship-primary-items"),
    [language, nodes]
  );
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  if (treeNodes.length === 0) {
    return <p className="text-sm text-slate-500">No primary items available for this hypercube.</p>;
  }

  return (
    <Tree
      value={treeNodes}
      expandedKeys={expandedKeys}
      onToggle={(e) => setExpandedKeys((e.value ?? {}) as Record<string, boolean>)}
      nodeTemplate={(node) => {
        const fullType = node.data?.full_type;
        const xbrlType = node.data?.xbrl_type;
        const substitutionGroup = node.data?.substitution_group;

        const isDimension = substitutionGroup === "xbrldt:dimensionItem";

        const fullTypeIcons: Record<string, string> = {
          "types:guidanceItemType": "pi pi-exclamation-triangle text-red-500",
          "types:headingItemType": "pi pi-folder text-black-500",
          "types:xrefItemType": "pi pi-arrow-right-arrow-left text-red-400",
          "nonnum:domainItemType": "pi pi-globe text-pink-500",
          "Q2:domainItemType": "pi pi-globe text-pink-500",
          "num:energyItemType": "pi pi-sun text-orange-500",
          "num:massItemType": "pi pi-gauge text-green-500",
          "num:percentItemType": "pi pi-percentage text-teal-500",
          "types:fixedItemType": "pi pi-align-left text-cyan-500",
          "types:syndicateNumberItemType": "pi pi-hashtag text-green-500",
        };

        const xbrlTypeIcons: Record<string, string> = {
          anyURIItemType: "pi pi-link text-blue-400",
          booleanItemType: "pi pi-check-square text-green-500",
          dateItemType: "pi pi-calendar-clock text-fuchsia-500",
          decimalItemType: "pi pi-sort-numeric-down text-neutral-500",
          monetaryItemType: "pi pi-pound text-amber-500",
          sharesItemType: "pi pi-chart-line text-purple-500",
          stringItemType: "pi pi-align-left text-cyan-500",
        };

        const iconClass = isDimension
          ? "pi pi-sort-amount-down-alt text-indigo-500"
          : fullTypeIcons[fullType ?? ""] ??
            xbrlTypeIcons[xbrlType ?? ""] ??
            "pi pi-home text-gray-500";

        const secondaryIcon =
          fullType === "types:fixedItemType" ? (
            <i className="pi pi-star text-red-500 text-xs ml-1" title="Fixed item" />
          ) : fullType === "types:groupingItemType" ? (
            <i className="pi pi-star text-blue-500 text-xs ml-1" title="Grouping item" />
          ) : null;

        const dimensionTypeIcon =
          isDimension && xbrlType && xbrlTypeIcons[xbrlType] ? (
            <i
              className={`${xbrlTypeIcons[xbrlType]} text-xs ml-1`}
              title={`Dimension type: ${xbrlType}`}
            />
          ) : null;

        const isDomainMember = fullType === "nonnum:domainItemType";
        const domainTypeIcon =
          isDomainMember && xbrlType && xbrlTypeIcons[xbrlType] ? (
            <i
              className={`${xbrlTypeIcons[xbrlType]} text-xs ml-1`}
              title={`Domain type: ${xbrlType}`}
            />
          ) : null;

        return (
          <span className="flex items-center gap-2" title={node.data?.qname || node.label}>
            <span className="flex items-center gap-[4px] mr-1">
              <i className={iconClass} />
              {dimensionTypeIcon}
              {domainTypeIcon}
            </span>
            <span>{node.label}</span>
            {secondaryIcon}
          </span>
        );
      }}
      className="w-full border rounded-md bg-white/80 relationship-primary-tree"
    />
  );
};

export default RelationshipPrimaryItemsTree;
