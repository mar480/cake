import React from "react";
import Split from "react-split";
import TaxonomyTreeView from "./TaxonomyTreeView";
import DetailsPanelContainer from "./DetailsPanelContainer";
import HelpLauncherButton from "@/components/help/HelpLauncherButton";
import HelpLabel from "@/components/help/HelpLabel";
import { useHelp } from "@/components/help/helpContext";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TreeNode } from "@/components/taxonomy/explorer/tree_utils";
import { TreeLocationTarget } from "./TreeLocationsTab";
import {
  AdvancedSearchFilterOptions,
  AdvancedSearchFilters,
  AdvancedSearchState,
} from "@/types/advancedSearch";
import { EntrypointOption } from "./services/explorerApi";
import type { RawElrGroup } from "./explorerTypes";
import type { DetailsTabName } from "./explorerHelpTypes";

const ENTRYPOINT_GROUP_ORDER = [
  "UK Accounting Standards",
  "ROI Accounting Standards",
  "HMRC only",
  "Companies House forms",
  "Charities SORP",
  "UKSEF dual filing approach",
  "Taxonomy views",
] as const;

interface Props {
  selectedNode: TreeNode | null;
  detailNode: TreeNode | null;
  expandedKeys: { [key: string]: boolean };
  highlightedKey: string | null;
  language: "en" | "cy";
  onSelectNode: (node: TreeNode) => void;
  onExpandedKeysChange: (keys: { [key: string]: boolean }) => void;
  onNavigateToNode: (qname: string, options?: { preserveDetails?: boolean }) => void;
  onNavigateToSearchNode: (
    qname: string,
    network?: string,
    elr?: string,
    entrypoint?: string,
    uuid?: string
  ) => void;
  onNavigateToLocation: (target: TreeLocationTarget) => void;
  onLanguageChange: (lang: "en" | "cy") => void;
  network: string;
  onNetworkChange: (network: string) => void;
  year: string | null;
  entrypoint: string | null;
  loadedYear: string | null;
  loadedEntrypoint: string | null;
  loadedEntrypointName: string | null;
  entrypoints: EntrypointOption[];
  onYearChange: (year: string | null) => void;
  onEntrypointChange: (entrypoint: string | null) => void;
  treeFilter: string;
  onTreeFilterChange: (value: string) => void;
  currentTreeNodes: TreeNode[];
  entrypointLoaded: boolean;
  treeLocations: TreeLocationTarget[];
  activeDetailsTab: DetailsTabName;
  onActiveDetailsTabChange: (tab: DetailsTabName) => void;
  advancedSearchState: AdvancedSearchState;
  advancedSearchFilterOptions: AdvancedSearchFilterOptions;
  referenceParagraphsBySource: Record<string, string[]>;
  onAdvancedSearchQueryChange: (query: string) => void;
  onAdvancedSearchFiltersChange: (next: AdvancedSearchFilters) => void;
  onRunAdvancedSearch: (nextOffset?: number) => void;
  onRunAdvancedSearchExport: (options: {
    format: "csv" | "json";
    fields: string[];
    filters?: AdvancedSearchFilters;
  }) => void;
  onResetAdvancedSearch: () => void;
  networkLabels: Record<string, string>;
  resultNetworks: Record<string, string[]>;
  resultPresentationElrs: Record<string, string[]>;
  rawTreeData: Record<string, RawElrGroup[]>;
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
  onNavigateToSearchNode,
  onNavigateToLocation,
  onNetworkChange,
  onLanguageChange,
  year,
  entrypoint,
  loadedYear,
  loadedEntrypoint,
  loadedEntrypointName,
  entrypoints,
  onYearChange,
  onEntrypointChange,
  treeFilter,
  onTreeFilterChange,
  currentTreeNodes,
  entrypointLoaded,
  treeLocations,
  activeDetailsTab,
  onActiveDetailsTabChange,
  advancedSearchState,
  advancedSearchFilterOptions,
  referenceParagraphsBySource,
  onAdvancedSearchQueryChange,
  onAdvancedSearchFiltersChange,
  onRunAdvancedSearch,
  onRunAdvancedSearchExport,
  onResetAdvancedSearch,
  networkLabels,
  resultNetworks,
  resultPresentationElrs,
  rawTreeData,
}) => {
  const { helpModeEnabled, setHelpModeEnabled } = useHelp();
  const viewingLabel = loadedYear
    ? `Viewing: ${loadedYear} / ${loadedEntrypointName || loadedEntrypoint || "Unknown entrypoint"}`
    : "";
  const activeViewYear = loadedYear;
  const activeViewEntrypoint = loadedEntrypoint;
  const groupedEntrypoints = ENTRYPOINT_GROUP_ORDER.map((group) => ({
    group,
    entrypoints: entrypoints.filter((entrypointOption) => entrypointOption.group === group),
  })).filter((group) => group.entrypoints.length > 0);
  const ungroupedEntrypoints = entrypoints.filter((entrypointOption) => !entrypointOption.group);

  return (
    <div className="flex flex-col h-screen bg-white">
      <header
        className="flex flex-wrap items-center justify-between gap-3 bg-blue-800 p-2 text-white"
        data-help-anchor="app-header"
      >
        <div className="grid grid-cols-2 items-center gap-3 md:grid-cols-4">
          <div className="flex flex-col" data-help-anchor="year-selector">
            <HelpLabel
              label={<span className="font-semibold">Year</span>}
              helpId="app.yearSelector"
              side="bottom"
              className="mb-0.5 flex items-center gap-1.5"
            />
            <select
              className="w-[210px] max-w-full bg-blue-700 text-white text-sm px-1 py-0.5 rounded border border-blue-600"
              value={year || ""}
              onChange={(e) => onYearChange(e.target.value)}
            >
              <option value="">Select year</option>
              <option value="lloyds-2025">Lloyds</option>
              <option value="2027">2027 - draft</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>
          </div>

          <div className="flex flex-col" data-help-anchor="entrypoint-selector">
            <HelpLabel
              label={<span className="font-semibold">Entry point</span>}
              helpId="app.entrypoint"
              side="bottom"
              className="mb-0.5 flex items-center gap-1.5"
            />
            <Select
              key={year ?? "no-year"}
              value={entrypoint ?? undefined}
              onValueChange={(value) => onEntrypointChange(value)}
              disabled={!year}
            >
              <SelectTrigger className="h-8 w-[210px] max-w-full rounded-md border border-blue-500/70 bg-gradient-to-b from-blue-700 to-blue-800 px-2 text-left text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] focus:ring-cyan-300/80">
                <SelectValue placeholder="Select entry point" />
              </SelectTrigger>
              <SelectContent
                disableScrollButtons
                className="max-h-[28rem] overflow-hidden rounded-xl border border-blue-200 bg-slate-50 text-slate-900 shadow-2xl"
              >
                {groupedEntrypoints.map(({ group, entrypoints: groupedOptions }) => (
                  <SelectGroup key={group}>
                    <SelectLabel className="rounded-md bg-blue-800 px-3 py-2 text-xs font-bold tracking-[0.08em] text-blue-50">
                      {group}
                    </SelectLabel>
                    {groupedOptions.map((ep) => (
                      <SelectItem
                        key={ep.href}
                        value={ep.href}
                        className="my-1 rounded-lg border border-transparent py-2 pl-8 pr-3 text-[13px] font-medium text-blue-950 focus:bg-blue-100 focus:text-blue-950 data-[state=checked]:border-blue-200 data-[state=checked]:bg-white data-[state=checked]:text-blue-900"
                      >
                        {ep.label ?? ep.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                {ungroupedEntrypoints.length > 0 ? (
                  <SelectGroup>
                    {ungroupedEntrypoints.map((ep) => (
                      <SelectItem
                        key={ep.href}
                        value={ep.href}
                        className="my-1 rounded-lg border border-transparent py-2 pl-8 pr-3 text-[13px] font-medium text-blue-950 focus:bg-blue-100 focus:text-blue-950 data-[state=checked]:border-blue-200 data-[state=checked]:bg-white data-[state=checked]:text-blue-900"
                      >
                        {ep.label ?? ep.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col" data-help-anchor="network-selector">
            <HelpLabel
              label={<span className="font-semibold">Network</span>}
              helpId="app.networkSelector"
              side="bottom"
              className="mb-0.5 flex items-center gap-1.5"
            />
            <select
              className="w-[210px] max-w-full bg-blue-700 text-white text-sm px-1 py-0.5 rounded border border-blue-600"
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

          <div className="flex flex-col" data-help-anchor="language-selector">
            <HelpLabel
              label={<span className="font-semibold">Language</span>}
              helpId="app.languageSelector"
              side="bottom"
              className="mb-0.5 flex items-center gap-1.5"
            />
            <select
              className="w-[210px] max-w-full bg-blue-700 text-white text-sm px-1 py-0.5 rounded border border-blue-600"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as "en" | "cy")}
              disabled={!network}
            >
              <option value="en">English</option>
              <option value="cy">Welsh</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 md:pl-4">
          <button
            type="button"
            onClick={() => setHelpModeEnabled(!helpModeEnabled)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors sm:text-sm ${
              helpModeEnabled
                ? "border-amber-300 bg-amber-400 text-slate-950 hover:bg-amber-300"
                : "border-cyan-300/60 bg-blue-700 text-cyan-100 hover:bg-blue-600"
            }`}
          >
            {helpModeEnabled ? "App info on" : "App info off"}
          </button>
          <div className="hidden whitespace-nowrap text-sm text-blue-100 xl:block">
            {viewingLabel}
          </div>
          <HelpLauncherButton />
        </div>
      </header>

      <Split
        className="flex flex-row-reverse flex-1 overflow-hidden"
        sizes={[50, 50]}
        minSize={[30, 40]}
        gutterSize={15}
      >
        <div
          className="min-w-[30%] max-w-full overflow-auto h-full p-4"
          data-help-anchor="details-panel"
        >
          <DetailsPanelContainer
            selectedNode={detailNode}
            onNavigateToNode={onNavigateToNode}
            onNavigateToSearchNode={onNavigateToSearchNode}
            year={activeViewYear}
            entrypoint={activeViewEntrypoint}
            onNavigateToCrossReference={(qname) => onNavigateToNode(qname, { preserveDetails: true })}
            onNavigateToLocation={onNavigateToLocation}
            treeLocations={treeLocations}
            language={language}
            network={network}
            advancedSearchState={advancedSearchState}
            entrypointLoaded={entrypointLoaded}
            activeTab={activeDetailsTab}
            onActiveTabChange={onActiveDetailsTabChange}
            advancedSearchFilterOptions={advancedSearchFilterOptions}
            referenceParagraphsBySource={referenceParagraphsBySource}
            onAdvancedSearchQueryChange={onAdvancedSearchQueryChange}
            onAdvancedSearchFiltersChange={onAdvancedSearchFiltersChange}
            onRunAdvancedSearch={onRunAdvancedSearch}
            onRunAdvancedSearchExport={onRunAdvancedSearchExport}
            onResetAdvancedSearch={onResetAdvancedSearch}
            networkLabels={networkLabels}
            resultNetworks={resultNetworks}
            resultPresentationElrs={resultPresentationElrs}
            rawTreeData={rawTreeData}
          />
        </div>

        <div
          className="min-w-[40%] max-w-full overflow-auto border-r h-full"
          data-help-anchor="taxonomy-tree-panel"
        >
          <TaxonomyTreeView
            treeNodes={currentTreeNodes}
            key={network}
            network={network}
            networkLabel={networkLabels[network] ?? network}
            year={activeViewYear}
            entrypoint={activeViewEntrypoint}
            treeFilter={treeFilter}
            onTreeFilterChange={onTreeFilterChange}
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
