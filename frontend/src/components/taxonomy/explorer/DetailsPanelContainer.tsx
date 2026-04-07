import React, { useEffect, useMemo, useState } from "react";
import DetailsTab from "./DetailsTab";
import HypercubeRelationshipsTab from "./HypercubeRelationshipsTab";
import TreeLocationsTab, { TreeLocationTarget } from "./TreeLocationsTab";
import AdvancedSearchTab from "./AdvancedSearchTab";
import SearchResultsTab from "./SearchResultsTab";
import {
  AdvancedSearchState,
  AdvancedSearchFilterOptions,
  AdvancedSearchFilters,
} from "@/types/advancedSearch";
import { ConceptDetailsResponse } from "./apiTypes";
import { TreeNode } from "./tree_utils";

type DetailsTabName =
  | "Details"
  | "Hypercube Relationships"
  | "Tree Locations"
  | "Advanced Search"
  | "Search Results";

interface DetailPanelProps {
  selectedNode: TreeNode | null;
  onNavigateToNode?: (qname: string) => void;
  onNavigateToSearchNode?: (qname: string, network?: string) => void;
  onNavigateToCrossReference?: (qname: string) => void;
  onNavigateToLocation?: (target: TreeLocationTarget) => void;
  networkLabels?: Record<string, string>;
  resultNetworks?: Record<string, string[]>;
  treeLocations: TreeLocationTarget[];
  language: "en" | "cy";
  network: string;
  year: string | null;
  advancedSearchState: AdvancedSearchState;
  advancedSearchFilterOptions: AdvancedSearchFilterOptions;
  referenceParagraphsBySource: Record<string, string[]>;
  onAdvancedSearchQueryChange: (query: string) => void;
  onAdvancedSearchFiltersChange: (next: AdvancedSearchFilters) => void;
  onRunAdvancedSearch: (nextOffset?: number) => void;
  onResetAdvancedSearch: () => void;
}

const DetailPanelContainer: React.FC<DetailPanelProps> = ({
  selectedNode,
  onNavigateToNode,
  onNavigateToSearchNode,
  onNavigateToCrossReference,
  onNavigateToLocation,
  networkLabels,
  resultNetworks,
  treeLocations,
  language,
  network,
  year,
  advancedSearchState,
  advancedSearchFilterOptions,
  referenceParagraphsBySource,
  onAdvancedSearchQueryChange,
  onAdvancedSearchFiltersChange,
  onRunAdvancedSearch,
  onResetAdvancedSearch,
}) => {
  const [activeTab, setActiveTab] = useState<DetailsTabName>("Details");
  const [concept, setConcept] = useState<ConceptDetailsResponse | null>(null);

  const showHypercubeTab = network === "presentation";

  const tabs = useMemo(
    () =>
      showHypercubeTab
        ? ([
            "Details",
            "Hypercube Relationships",
            "Tree Locations",
            "Advanced Search",
            "Search Results",
          ] as const)
        : (["Details", "Tree Locations", "Advanced Search", "Search Results"] as const),
    [showHypercubeTab]
  );

  const hasSearchRun = Boolean(advancedSearchState?.lastRunAt);

  useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab("Details");
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (selectedNode?.data?.qname) {
      const qname = selectedNode.data.qname;
      fetch(`/api/concept-details?qname=${encodeURIComponent(qname)}`)
        .then((res) => res.json())
        .then((data) => setConcept(data))
        .catch((err) => {
          console.error("Error fetching concept:", err);
          setConcept(null);
        });
    } else {
      setConcept(null);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedNode) {
      setActiveTab("Details");
    }
  }, [selectedNode]);

  const renderNoSelection = () => (
    <div className="p-4 text-gray-500 text-center">Please select a concept.</div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b px-1 pt-1 shadow-sm">
  {tabs.map((tab) => (
    <button
      key={tab}
      className={`px-4 py-1.5 text-sm font-medium border border-b-0 rounded-t-md shadow-sm transition-colors mr-1 ${
        activeTab === tab
          ? "bg-blue-100 border-blue-300 text-blue-900"
          : "bg-gray-200 border-gray-300 text-gray-800 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
      }`}
      onClick={() => setActiveTab(tab)}
      disabled={tab === "Search Results" && !hasSearchRun}
    >
      {tab}
    </button>
  ))}
</div>

      <div className="flex-1 overflow-auto">
        {activeTab === "Advanced Search" && (
          <AdvancedSearchTab
            state={advancedSearchState}
            filterOptions={advancedSearchFilterOptions}
            referenceParagraphsBySource={referenceParagraphsBySource}
            onQueryChange={onAdvancedSearchQueryChange}
            onFiltersChange={onAdvancedSearchFiltersChange}
            onRunSearch={onRunAdvancedSearch}
            onOpenResultsTab={() => setActiveTab("Search Results")}
            onResetSearch={onResetAdvancedSearch}
            year={year}
          />
        )}

        {activeTab === "Search Results" && (
          <SearchResultsTab
            state={advancedSearchState}
            onFiltersChange={onAdvancedSearchFiltersChange}
            onRunSearch={onRunAdvancedSearch}
            onResetSearch={onResetAdvancedSearch}
            onNavigateToSearchNode={onNavigateToSearchNode}
            onReturnToSearch={() => setActiveTab("Advanced Search")}
            networkLabels={networkLabels}
            resultNetworks={resultNetworks}
          />
        )}

        {activeTab === "Details" &&
          (!selectedNode || !concept ? (
            renderNoSelection()
          ) : (
            <DetailsTab
              concept={concept}
              selectedNode={selectedNode}
              onNavigateToNode={onNavigateToNode}
              onNavigateToCrossReference={onNavigateToCrossReference}
            />
          ))}

        {activeTab === "Hypercube Relationships" &&
          (showHypercubeTab ? (
            !selectedNode || !concept ? (
              renderNoSelection()
            ) : (
              <HypercubeRelationshipsTab qname={concept.concept.qname} language={language} />
            )
          ) : null)}

        {activeTab === "Tree Locations" &&
          (!selectedNode || !concept ? (
            renderNoSelection()
          ) : (
            <TreeLocationsTab
              qname={concept.concept.qname}
              locations={treeLocations}
              onNavigateToLocation={(target) => onNavigateToLocation?.(target)}
            />
          ))}
      </div>
    </div>
  );
};

export default DetailPanelContainer;
