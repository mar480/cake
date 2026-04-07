import React from "react";
import Split from "react-split";
import TaxonomyTreeView from "./TaxonomyTreeView";
import DetailsPanelContainer from "./DetailsPanelContainer";
import { TreeNode } from "@/components/taxonomy/explorer/tree_utils";
import { TreeLocationTarget } from "./TreeLocationsTab";
import {
    AdvancedSearchFilterOptions,
  AdvancedSearchFilters,
  AdvancedSearchState,
} from "@/types/advancedSearch";

interface Props {
  selectedNode: TreeNode | null;
  detailNode: TreeNode | null;
  expandedKeys: { [key: string]: boolean };
  highlightedKey: string | null;
  language: "en" | "cy";
  onSelectNode: (node: TreeNode) => void;
  onExpandedKeysChange: (keys: { [key: string]: boolean }) => void;
  onNavigateToNode: (qname: string, options?: { preserveDetails?: boolean }) => void;
  onNavigateToLocation: (target: TreeLocationTarget) => void;
  onLanguageChange: (lang: "en" | "cy") => void;
  network: string;
  onNetworkChange: (network: string) => void;
  year: string | null;
  entrypoint: string | null;
  entrypoints: { name: string; href: string }[];
  onYearChange: (year: string | null) => void;
  onEntrypointChange: (entrypoint: string | null) => void;
  currentTreeNodes: TreeNode[];
  entrypointLoaded: boolean;
  treeLocations: TreeLocationTarget[];
  advancedSearchState: AdvancedSearchState;
  advancedSearchFilterOptions: AdvancedSearchFilterOptions;
  referenceParagraphsBySource: Record<string, string[]>;
  onAdvancedSearchQueryChange: (query: string) => void;
  onAdvancedSearchFiltersChange: (next: AdvancedSearchFilters) => void;
  onRunAdvancedSearch: (nextOffset?: number) => void;
  onResetAdvancedSearch: () => void;
}

const XBRLTaxonomyExplorer: React.FC<Props> = ({
  selectedNode,
  expandedKeys,
  highlightedKey,
  language,
  network,
  onSelectNode,
  detailNode,
  onExpandedKeysChange,
  onNavigateToNode,
  onNavigateToLocation,
  onNetworkChange,
  onLanguageChange,
  year,
  entrypoint,
  entrypoints,
  onYearChange,
  onEntrypointChange,
  currentTreeNodes,
  entrypointLoaded,
  treeLocations,
  advancedSearchState,
  advancedSearchFilterOptions,
  referenceParagraphsBySource,
  onAdvancedSearchQueryChange,
  onAdvancedSearchFiltersChange,
  onRunAdvancedSearch,
  onResetAdvancedSearch,
}) => {
  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="bg-blue-800 text-white p-2 flex justify-between items-center">
        <div className="grid grid-cols-4 gap-4 items-center">
          <div className="flex flex-col">
            <span className="font-semibold">Year</span>
            <select
              className="bg-blue-700 text-white text-sm px-1 py-0.5 rounded border border-blue-600"
              value={year || ""}
              onChange={(e) => onYearChange(e.target.value)}
            >
              <option value="">Select year</option>
              <option value="lloyds-2025">Lloyds</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>

          <div className="flex flex-col">
            <span className="font-semibold">Entrypoint</span>
            <select
              className="bg-blue-700 text-white text-sm px-1 py-0.5 rounded border border-blue-600"
              value={entrypoint || ""}
              onChange={(e) => onEntrypointChange(e.target.value)}
              disabled={!year}
            >
              <option value="">Select entrypoint</option>
              {entrypoints.map((ep) => (
                <option key={ep.href} value={ep.href}>
                  {ep.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <span className="font-semibold">Network</span>
            <select
              className="bg-blue-700 text-white text-sm px-1 py-0.5 rounded border border-blue-600"
              value={network}
              onChange={(e) => onNetworkChange(e.target.value)}
              disabled={!entrypointLoaded}
            >
              <option value="presentation">Presentation</option>
              <option value="definition_hydim">Definition: hypercube-dimension</option>
              <option value="definition_dimdom">Definition: dimension-domain</option>
              <option value="definition_dimdef">Definition: dimension-default</option>
              <option value="definition_dommem">Definition: domain-member</option>
              <option value="definition_all">Definition: all</option>
              <option value="definition_crossref">Definition: crossref</option>
              <option value="definition_inflow">Definition: inflow</option>
              <option value="definition_outflow">Definition: outflow</option>
            </select>
          </div>

          <div className="flex flex-col">
            <span className="font-semibold">Language</span>
            <select
              className="bg-blue-700 text-white text-sm px-1 py-0.5 rounded border border-blue-600"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as "en" | "cy")}
              disabled={!network}
            >
              <option value="en">English</option>
              <option value="cy">Welsh</option>
            </select>
          </div>
        </div>
      </header>

      <Split
        className="flex flex-row-reverse flex-1 overflow-hidden"
        sizes={[50, 50]}
        minSize={[30, 40]}
        gutterSize={15}
      >
        <div className="min-w-[30%] max-w-full overflow-auto h-full p-4">
          <DetailsPanelContainer
            selectedNode={detailNode}
            onNavigateToNode={onNavigateToNode}
            year={year}
            onNavigateToCrossReference={(qname) => onNavigateToNode(qname, { preserveDetails: true })}
            onNavigateToLocation={onNavigateToLocation}
            treeLocations={treeLocations}
            language={language}
            network={network}
            advancedSearchState={advancedSearchState}
            advancedSearchFilterOptions={advancedSearchFilterOptions}
            referenceParagraphsBySource={referenceParagraphsBySource}
            onAdvancedSearchQueryChange={onAdvancedSearchQueryChange}
            onAdvancedSearchFiltersChange={onAdvancedSearchFiltersChange}
            onRunAdvancedSearch={onRunAdvancedSearch}
            onResetAdvancedSearch={onResetAdvancedSearch}
          />
        </div>

        <div className="min-w-[40%] max-w-full overflow-auto border-r h-full">
          <TaxonomyTreeView
            treeNodes={currentTreeNodes}
            key={network}
            network={network}
            expandedKeys={expandedKeys}
            highlightedKey={highlightedKey}
            onSelectNode={onSelectNode}
            onExpandedKeysChange={onExpandedKeysChange}
            language={language}
          />
        </div>
      </Split>
    </div>
  );
};

export default XBRLTaxonomyExplorer;