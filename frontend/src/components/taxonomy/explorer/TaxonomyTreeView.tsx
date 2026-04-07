import { useEffect, useRef } from "react";
import { Tree } from "primereact/tree";
import { TreeNode } from "./tree_utils";

interface TaxonomyTreeViewProps {
  onSelectNode: (node: TreeNode) => void;
  onNavigateToQName?: (qname: string) => void;
  treeNodes: TreeNode[];
  expandedKeys: { [key: string]: boolean };
  highlightedKey: string | null;
  onExpandedKeysChange: (keys: { [key: string]: boolean }) => void;
  language: "en" | "cy";
  network: string;
}

const TaxonomyTreeView = ({
  treeNodes,
  expandedKeys,
  highlightedKey,
  onExpandedKeysChange,
  onSelectNode,
  language,
  network,
}: TaxonomyTreeViewProps) => {
  const nodeRefs = useRef<{ [key: string]: HTMLSpanElement | null }>({});

  // Clear refs on dataset change to avoid stale elements
  useEffect(() => {
    nodeRefs.current = {};
  }, [network, treeNodes]);

  // Smooth scroll once the highlighted node exists in the DOM
  useEffect(() => {
    if (!highlightedKey) return;

    // Wait for React to paint expansion + highlight, then scroll.
    const id = `tree-node-${String(highlightedKey)}`;
    const scroll = () => {
      const el = document.getElementById(id) || nodeRefs.current[highlightedKey];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    // Two rAFs ensures paint has happened even after a big expand
    requestAnimationFrame(() => requestAnimationFrame(scroll));
  }, [highlightedKey, expandedKeys, network]);

  return (
    <div className="p-2">
      <Tree
        key={network} // stable per dataset; don't remount on highlight
        value={treeNodes}
        expandedKeys={expandedKeys}
        onToggle={(e) => onExpandedKeysChange(e.value)}
        selectionMode="single"
        onSelect={(e) => {
          const node = e.node as TreeNode;
          onSelectNode(node);

          // Also scroll on normal clicks
          const id = `tree-node-${String(node.key)}`;
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const el =
                document.getElementById(id) || nodeRefs.current[String(node.key)];
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            })
          );
        }}
        nodeTemplate={(node) => {
          const fullType = node.data?.full_type;
          const xbrlType = node.data?.xbrl_type;
          const substitutionGroup = node.data?.substitution_group;
          const isHighlighted = node.key === highlightedKey;

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

          // Independent secondary icons
          const secondaryIcon =
            fullType === "types:fixedItemType" ? (
              <i
                className="pi pi-star text-red-500 text-xs ml-1"
                title="Fixed item"
              />
            ) : fullType === "types:groupingItemType" ? (
              <i
                className="pi pi-star text-blue-500 text-xs ml-1"
                title="Grouping item"
              />
            ) : null;

          // Extra icon if it's a [Dimension] and has a known xbrl_type
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
            <span
              id={`tree-node-${String(node.key)}`}
              ref={(el) => {
                if (el && node.key) nodeRefs.current[String(node.key)] = el;
              }}
              title={node.data?.qname || node.label}
                className={`flex items-center gap-2 transition duration-500 ${
    isHighlighted
      ? "bg-yellow-200 animate-pulse rounded"
      : ""
  }`}
            >
              <span className="flex items-center gap-[4px] mr-1">
                <i className={iconClass} />
                {dimensionTypeIcon}
                {domainTypeIcon}
              </span>
              <span>
                {language === "cy" && node.data?.label_cy
                  ? node.data.label_cy
                  : node.label}
              </span>
              {secondaryIcon}
            </span>
          );
        }}
        filter
        filterPlaceholder="Search..."
        filterMode="lenient"
        showHeader={true}
        className="w-full taxonomy-tree"
      />
    </div>
  );
};

export default TaxonomyTreeView;
