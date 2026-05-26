export interface AdvancedSearchFilters {
  namespace: string[];
  balance: string[];
  periodType: string[];
  xbrlType: string[];
  conceptType: string[];
  fullType: string[];
  abstract: boolean[];
  nillable: boolean[];
  substitutionGroup: string[];
  referenceSource: string | null;
  referenceParagraph: string[];
  excludeNotInPresentationTree: boolean;
}

export interface AdvancedSearchResult {
  id: string;
  qname: string;
  localName?: string;
  label?: string;
  namespace?: string;
  balance?: string;
  periodType?: string;
  xbrlType?: string;
  fullType?: string;
  abstract?: boolean;
  nillable?: boolean;
  conceptType?: string;
  substitutionGroup?: string;
  hypercubes?: string[];
  referenceDisplays?: string[];
  score?: number;
  matchedFields?: string[];
}

export interface AdvancedSearchPagination {
  limit: number;
  offset: number;
  total: number;
}

export interface AdvancedSearchState {
  query: string;
  filters: AdvancedSearchFilters;
  results: AdvancedSearchResult[];
  allResults: AdvancedSearchResult[];
  hasRun: boolean;
  loading: boolean;
  exportLoading: boolean;
  error: string | null;
  exportError: string | null;
  pagination: AdvancedSearchPagination;
  lastRunAt: string | null;
}

export interface AdvancedSearchFilterOptions {
  namespace: string[];
  balance: string[];
  periodType: string[];
  xbrlType: string[];
  conceptType: string[];
  fullType: string[];
  abstract: boolean[];
  nillable: boolean[];
  substitutionGroup: string[];
  referenceSources: string[];
}
