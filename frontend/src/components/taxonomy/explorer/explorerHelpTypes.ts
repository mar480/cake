export type DetailsTabName =
  | "Details"
  | "Hypercube Relationships"
  | "Tree Locations"
  | "Advanced Search"
  | "Search Results";

export type ExplorerDemoState = {
  year: string | null;
  entrypoint: string | null;
  entrypointsYear: string | null;
  availableEntrypoints: Array<{ name: string; href: string }>;
  loadedYear: string | null;
  loadedEntrypoint: string | null;
  entrypointLoaded: boolean;
  network: string;
  treeFilter: string;
  selectedConceptQname: string | null;
  activeDetailsTab: DetailsTabName;
  advancedSearchQuery: string;
  advancedSearchHasRun: boolean;
  advancedSearchLoading: boolean;
  advancedSearchResultCount: number;
};

export type ExplorerDemoNavigateOptions = {
  network?: string;
  elr?: string;
  entrypoint?: string;
  uuid?: string;
  preserveDetails?: boolean;
};

export type ExplorerDemoActions = {
  selectYear: (year: string) => void;
  loadEntrypoint: (entrypointHref: string) => void;
  selectNetwork: (network: string) => void;
  navigateToConcept: (qname: string, options?: ExplorerDemoNavigateOptions) => void;
  selectFirstVisibleConcept: () => void;
  setTreeFilter: (value: string) => void;
  openDetailsTab: (tab: DetailsTabName) => void;
  setAdvancedSearchQuery: (query: string) => void;
  runAdvancedSearch: () => void;
};
