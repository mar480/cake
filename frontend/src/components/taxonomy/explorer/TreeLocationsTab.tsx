import React, { useEffect, useMemo, useState } from "react";
import { Tree } from "primereact/tree";
import type { TreeNode as PrimeTreeNode } from "primereact/treenode";

export interface TreeLocationPathNode {
  label: string;
  xbrlType?: string;
  fullType?: string;
  substitutionGroup?: string;
}

export interface TreeLocationTarget {
  network: string;
  elr: string;
  elrDefinition: string;
  numericPart?: number;
  qname: string;
  uuid?: string;
  label: string;
  treeId?: string;
  pathNodes: TreeLocationPathNode[];
}

interface Props {
  qname: string;
  locations: TreeLocationTarget[];
  onNavigateToLocation: (target: TreeLocationTarget) => void;
}

const NETWORK_LABELS: Record<string, string> = {
  presentation: "Presentation",
  definition_hydim: "definitionLink: hypercube-dimension",
  definition_dimdom: "definitionLink: dimension-domain",
  definition_dimdef: "definitionLink: dimension-default",
  definition_dommem: "definitionLink: domain-member",
  definition_all: "definitionLink: all",
  definition_crossref: "definitionLink: crossref",
  definition_inflow: "definitionLink: inflow",
  definition_outflow: "definitionLink: outflow",
};

const parseNumericPartFromDefinition = (definition: string): number => {
  const m = definition.match(/\b(\d{1,6})\b/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
};

const getNetworkSortRank = (networkKey: string): number => {
  // Presentation always first
  if (networkKey === "presentation") return 0;
  return 1;
};

// Brought across from TaxonomyTreeView icon approach
const getConceptIconClass = (meta?: {
  fullType?: string;
  xbrlType?: string;
  substitutionGroup?: string;
}) => {
  if (!meta) return "pi pi-file text-gray-500";

  const fullType = meta.fullType;
  const xbrlType = meta.xbrlType;
  const substitutionGroup = meta.substitutionGroup;

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

  if (isDimension) return "pi pi-sort-amount-down-alt text-indigo-500";
  return (
    fullTypeIcons[fullType ?? ""] ??
    xbrlTypeIcons[xbrlType ?? ""] ??
    "pi pi-file text-gray-500"
  );
};

const TreeLocationsTab: React.FC<Props> = ({
  qname,
  locations,
  onNavigateToLocation,
}) => {
  const { treeValue, allExpandedKeys } = useMemo(() => {
    const byNetwork = new Map<string, TreeLocationTarget[]>();

    for (const loc of locations) {
      if (!byNetwork.has(loc.network)) byNetwork.set(loc.network, []);
      byNetwork.get(loc.network)!.push(loc);
    }

    // Presentation first, then alpha by label
    const networkEntries = Array.from(byNetwork.entries()).sort(([a], [b]) => {
      const rankA = getNetworkSortRank(a);
      const rankB = getNetworkSortRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return (NETWORK_LABELS[a] ?? a).localeCompare(NETWORK_LABELS[b] ?? b);
    });

    const rootNodes: PrimeTreeNode[] = [];

    for (const [networkKey, networkLocs] of networkEntries) {
      const byElr = new Map<
        string,
        { def: string; numeric: number; locs: TreeLocationTarget[] }
      >();

      for (const loc of networkLocs) {
        const elrKey = loc.elr;
        if (!byElr.has(elrKey)) {
          const numeric = Number.isFinite(loc.numericPart)
            ? Number(loc.numericPart)
            : parseNumericPartFromDefinition(loc.elrDefinition);
          byElr.set(elrKey, {
            def: loc.elrDefinition || loc.elr,
            numeric,
            locs: [],
          });
        }
        byElr.get(elrKey)!.locs.push(loc);
      }

      // Numeric ascending: 0002 before 0016
      const elrNodes: PrimeTreeNode[] = Array.from(byElr.entries())
        .sort(([, a], [, b]) => {
          if (a.numeric !== b.numeric) return a.numeric - b.numeric;
          return a.def.localeCompare(b.def);
        })
        .map(([elr, data], elrIdx) => {
          const elrNode: PrimeTreeNode = {
            key: `elr-${networkKey}-${elrIdx}-${elr}`,
            label: data.def,
            selectable: false,
            children: [],
          };

          // Build nested concept path chain under ELR:
          // ELR -> concept1 -> concept2 -> ... -> conceptN (leaf selectable)
          for (const loc of data.locs) {
            let currentChildren = elrNode.children!;

            loc.pathNodes.forEach((segment, depth) => {
              const pathKey = `path-${networkKey}-${elr}-${loc.pathNodes
                .slice(0, depth + 1)
                .map((p) => p.label)
                .join("||")}-${loc.uuid ?? loc.treeId ?? ""}`;
                
              let existing = currentChildren.find((c) => c.key === pathKey);

              if (!existing) {
                const isLeaf = depth === loc.pathNodes.length - 1;
                existing = {
                  key: pathKey,
                  label: segment.label,
                  selectable: isLeaf,
                  data: {
                    target: isLeaf ? loc : undefined,
                    segmentMeta: segment,
                    isNetwork: false,
                    isElr: false,
                    isLeaf,
                  },
                  children: [],
                };
                currentChildren.push(existing);
              }

              currentChildren = existing.children ?? (existing.children = []);
            });
          }

          // Deterministic order
          const sortChildrenRecursively = (nodes: PrimeTreeNode[]) => {
            nodes.sort((a, b) =>
              String(a.label ?? "").localeCompare(String(b.label ?? ""))
            );
            for (const n of nodes) {
              if (n.children?.length) sortChildrenRecursively(n.children);
            }
          };
          sortChildrenRecursively(elrNode.children!);

          // add meta so we can style in nodeTemplate
          elrNode.data = { isNetwork: false, isElr: true, isLeaf: false };

          return elrNode;
        });

      rootNodes.push({
        key: `network-${networkKey}`,
        label: NETWORK_LABELS[networkKey] ?? networkKey,
        selectable: false,
        data: { isNetwork: true, isElr: false, isLeaf: false },
        children: elrNodes,
      });
    }

    // Build "expand all" map
    const expanded: Record<string, boolean> = {};
    const markExpanded = (nodes: PrimeTreeNode[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          expanded[String(n.key)] = true;
          markExpanded(n.children);
        }
      }
    };
    markExpanded(rootNodes);

    return { treeValue: rootNodes, allExpandedKeys: expanded };
  }, [locations]);

  // Ensure auto-expand actually applies on initial render and when data updates
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setExpandedKeys(allExpandedKeys);
  }, [allExpandedKeys]);

  return (
    <div className="p-2">
      <div className="text-sm text-gray-600 mb-2">
        Locations for <span className="font-semibold">{qname}</span> (
        {locations.length})
      </div>

      <Tree
        value={treeValue}
        expandedKeys={expandedKeys}
        onToggle={(e) => setExpandedKeys((e.value as Record<string, boolean>) ?? {})}
        selectionMode="single"
        onSelect={(e) => {
          const target = (e.node?.data as { target?: TreeLocationTarget } | undefined)?.target;
          if (target) onNavigateToLocation(target);
        }}
        nodeTemplate={(node) => {
          const data = (node.data ?? {}) as {
            isNetwork?: boolean;
            isElr?: boolean;
            segmentMeta?: TreeLocationPathNode;
          };
          const isNetwork = !!data.isNetwork;
          const isElr = !!data.isElr;
          const segmentMeta = data.segmentMeta as
            | TreeLocationPathNode
            | undefined;

          // Bold network labels
          if (isNetwork) {
            return <span className="font-semibold">{String(node.label)}</span>;
          }

          // ELR row
          if (isElr) {
            return (
              <span className="flex items-center gap-2">
                <i className="pi pi-home text-gray-500" />
                <span>{String(node.label)}</span>
              </span>
            );
          }

          // Concept-path rows with normal presentation icons
          const iconClass = getConceptIconClass({
            fullType: segmentMeta?.fullType,
            xbrlType: segmentMeta?.xbrlType,
            substitutionGroup: segmentMeta?.substitutionGroup,
          });

          return (
            <span className="flex items-center gap-2">
              <i className={iconClass} />
              <span>{String(node.label)}</span>
            </span>
          );
        }}
        filter
        filterPlaceholder="Filter locations..."
        filterMode="lenient"
        className=" taxonomy-tree"
      />
    </div>
  );
};

export default TreeLocationsTab;