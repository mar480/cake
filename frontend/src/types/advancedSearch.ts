export interface AdvancedSearchFilters {
  namespace: string[];
  balance: string[];
  periodType: string[];
  xbrlType: string[];
  fullType: string[];
  abstract: boolean[];
  nillable: boolean[];
  substitutionGroup: string[];
  referenceSource: string | null;
  referenceParagraph: string[];
}

export interface AdvancedSearchResult {
  id: string;
  qname: string;
  localName?: string;
  label?: string;
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
  loading: boolean;
  error: string | null;
  pagination: AdvancedSearchPagination;
  lastRunAt: string | null;
}

export interface AdvancedSearchFilterOptions {
  namespace: string[];
  balance: string[];
  periodType: string[];
  xbrlType: string[];
  fullType: string[];
  abstract: boolean[];
  nillable: boolean[];
  substitutionGroup: string[];
  referenceSources: string[];
}