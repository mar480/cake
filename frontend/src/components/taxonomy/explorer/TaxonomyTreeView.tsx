import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Tree } from "primereact/tree";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { getHelpContent } from "@/components/help/helpContent";
import { useHelp } from "@/components/help/helpContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TreeNode, getTreeNodeVisualSpec } from "./tree_utils";
import {
  buildTreeExportSnapshot,
  buildTreeSnapshotCsv,
  buildTreeSnapshotHtmlDocument,
  buildTreeSnapshotJson,
  buildTreeSnapshotPngBlob,
  downloadBlob,
  downloadTextFile,
} from "./treeExportUtils";
import {
  filterTreeNodes,
  normalizeTreeSearchValue,
} from "./treeSearchUtils";

interface TaxonomyTreeViewProps {
  onSelectNode: (node: TreeNode) => void;
  onNavigateToQName?: (qname: string) => void;
  treeNodes: TreeNode[];
  expandedKeys: { [key: string]: boolean };
  highlightedKey: string | null;
  onExpandedKeysChange: (keys: { [key: string]: boolean }) => void;
  language: "en" | "cy";
  network: string;
  networkLabel: string;
  year: string | null;
  entrypoint: string | null;
  treeFilter: string;
  onTreeFilterChange: (value: string) => void;
}

function buildFullyExpandedKeys(nodes: TreeNode[]): { [key: string]: boolean } {
  const next: { [key: string]: boolean } = {};

  const visit = (node: TreeNode) => {
    if ((node.children?.length ?? 0) === 0) {
      return;
    }

    next[String(node.key)] = true;
    node.children?.forEach(visit);
  };

  nodes.forEach(visit);
  return next;
}

const TaxonomyTreeView = ({
  treeNodes,
  expandedKeys,
  highlightedKey,
  onExpandedKeysChange,
  onSelectNode,
  language,
  network,
  networkLabel,
  year,
  entrypoint,
  treeFilter,
  onTreeFilterChange,
}: TaxonomyTreeViewProps) => {
  const nodeRefs = useRef<{ [key: string]: HTMLSpanElement | null }>({});
  const { helpModeEnabled } = useHelp();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [treeExportLoading, setTreeExportLoading] = useState<"json" | "csv" | "html" | "png" | null>(null);
  const deferredTreeFilter = useDeferredValue(treeFilter);
  const appliedTreeFilter = treeFilter.trim().length === 0 ? "" : deferredTreeFilter;

  // Clear refs on dataset change to avoid stale elements
  useEffect(() => {
    nodeRefs.current = {};
  }, [network, treeNodes]);

  useEffect(() => {
    onTreeFilterChange("");
  }, [network, onTreeFilterChange]);

  const hasActiveTreeFilter = appliedTreeFilter.trim().length > 0;
  const visibleTreeNodes = useMemo(
    () => filterTreeNodes(treeNodes, appliedTreeFilter, language),
    [appliedTreeFilter, language, treeNodes]
  );
  const effectiveExpandedKeys = useMemo(
    () => (hasActiveTreeFilter ? buildFullyExpandedKeys(visibleTreeNodes) : expandedKeys),
    [expandedKeys, hasActiveTreeFilter, visibleTreeNodes]
  );

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
  }, [effectiveExpandedKeys, highlightedKey, network]);

  const exportSnapshot = useMemo(
    () =>
      buildTreeExportSnapshot({
        treeNodes,
        expandedKeys: effectiveExpandedKeys,
        treeFilter: appliedTreeFilter,
        language,
        network,
        networkLabel,
        year,
        entrypoint,
      }),
    [appliedTreeFilter, effectiveExpandedKeys, entrypoint, language, network, networkLabel, treeNodes, year]
  );
  const treeSearchHelp = getHelpContent("tree.search");

  const handleTreeExport = async (format: "json" | "csv" | "html" | "png") => {
    const filterSlug = appliedTreeFilter.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "tree-filter";
    const networkSlug = networkLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
    const baseFilename = `tree-export-${networkSlug || network}-${filterSlug}`;

    setTreeExportLoading(format);

    try {
      if (format === "json") {
        downloadTextFile(buildTreeSnapshotJson(exportSnapshot), `${baseFilename}.json`, "application/json");
      } else if (format === "csv") {
        downloadTextFile(buildTreeSnapshotCsv(exportSnapshot), `${baseFilename}.csv`, "text/csv;charset=utf-8");
      } else if (format === "html") {
        downloadTextFile(buildTreeSnapshotHtmlDocument(exportSnapshot), `${baseFilename}.html`, "text/html;charset=utf-8");
      } else {
        const pngBlob = await buildTreeSnapshotPngBlob(exportSnapshot);
        downloadBlob(pngBlob, `${baseFilename}.png`);
      }

      setIsExportDialogOpen(false);
      toast({
        title: "Tree exported",
        description: `Saved ${format.toUpperCase()} for the current tree filter.`,
      });
    } catch (error) {
      console.error("Tree export failed", error);
      toast({
        title: "Tree export failed",
        description: error instanceof Error ? error.message : "Unable to export the filtered tree.",
        variant: "destructive",
      });
    } finally {
      setTreeExportLoading(null);
    }
  };

  return (
    <div className="p-2" data-help-anchor="taxonomy-tree">
      <Tree
        key={network} // stable per dataset; don't remount on highlight
        value={visibleTreeNodes}
        expandedKeys={effectiveExpandedKeys}
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
          const isHighlighted = node.key === highlightedKey;
          const visual = getTreeNodeVisualSpec(node.data);

          return (
            <span
              id={`tree-node-${String(node.key)}`}
              ref={(el) => {
                if (el && node.key) nodeRefs.current[String(node.key)] = el;
              }}
              title={node.data?.qname || node.label}
              className={`flex items-center gap-2 transition duration-500 ${isHighlighted ? "bg-yellow-200 animate-pulse rounded" : ""}`}
            >
              <span className="flex items-center gap-[4px] mr-1">
                <i className={visual.iconClass} />
                {visual.tertiaryIconClass ? <i className={visual.tertiaryIconClass} /> : null}
              </span>
              <span>
                {language === "cy" && node.data?.label_cy
                  ? node.data.label_cy
                  : node.label}
              </span>
              {visual.secondaryIconClass ? <i className={visual.secondaryIconClass} /> : null}
            </span>
          );
        }}
        filter
        filterTemplate={() => (
          <div className="taxonomy-tree-filter-shell flex items-center gap-2">
            <TooltipProvider delayDuration={helpModeEnabled ? 0 : 3000}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative flex-1" data-help-anchor="taxonomy-tree-search">
                    <input
                      type="text"
                      value={treeFilter}
                      onChange={(e) => {
                        onTreeFilterChange(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          onTreeFilterChange("");
                        }
                      }}
                      placeholder="Search..."
                      className="taxonomy-tree-filter-input"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="max-w-xs border-slate-200 bg-white text-left text-slate-900 opacity-100"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">{treeSearchHelp.title}</div>
                    <div className="text-xs leading-5 text-slate-700">{treeSearchHelp.shortText}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {treeFilter ? (
              <button
                type="button"
                className="taxonomy-tree-filter-clear"
                onClick={() => {
                  onTreeFilterChange("");
                }}
                aria-label="Clear tree search"
                title="Clear"
              >
                <X size={14} />
              </button>
            ) : null}
            {hasActiveTreeFilter ? (
              <TooltipProvider delayDuration={helpModeEnabled ? 0 : 3000}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-help-anchor="tree-export-filtered"
                      className="taxonomy-tree-filter-download"
                      onClick={() => setIsExportDialogOpen(true)}
                      aria-label="Export filtered tree"
                      title="Export filtered tree"
                    >
                      <i className="pi pi-download" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-xs border-slate-200 bg-white text-left text-slate-900 opacity-100"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">Export filtered tree</div>
                      <div className="text-xs leading-5 text-slate-700">
                        {getHelpContent("tree.exportFiltered").shortText}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            <span className="taxonomy-tree-filter-icon" aria-hidden="true">
              <Search size={16} />
            </span>
          </div>
        )}
        filterPlaceholder="Search..."
        showHeader={true}
        className="w-full taxonomy-tree"
      />

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>Export Filtered Tree</DialogTitle>
            <DialogDescription>
              Export the current filtered tree view as CSV, JSON, HTML, or PNG.
            </DialogDescription>
          </DialogHeader>

            <div className="space-y-3">
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div><span className="font-medium">Filter:</span> {treeFilter}</div>
                <div><span className="font-medium">Network:</span> {networkLabel}</div>
                <div><span className="font-medium">Visible nodes:</span> {exportSnapshot.visibleNodeCount}</div>
              </div>

            <div className="grid grid-cols-2 gap-3">
              {(["csv", "json", "html", "png"] as const).map((format) => (
                <Button
                  key={format}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-20 flex-col items-start justify-start gap-1 border-slate-300 bg-white px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => void handleTreeExport(format)}
                  disabled={treeExportLoading !== null}
                >
                  <span className="text-sm font-semibold uppercase text-slate-900">{format}</span>
                  <span className="text-xs text-slate-600">
                    {format === "csv"
                      ? "Flat rows for spreadsheet review."
                      : format === "json"
                        ? "Full tree snapshot with metadata."
                        : format === "html"
                          ? "Styled standalone tree document."
                          : "Static image of the filtered tree."}
                  </span>
                  {treeExportLoading === format ? (
                    <span className="text-[11px] font-medium text-blue-700">Exporting...</span>
                  ) : null}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsExportDialogOpen(false)} disabled={treeExportLoading !== null}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaxonomyTreeView;
