import { AdvancedSearchFilterOptions, AdvancedSearchFilters } from "@/types/advancedSearch";

export type RawTreeNode = {
  qname?: string;
  uuid?: string;
  tree_id?: string;
  name?: string;
  xbrl_type?: string;
  full_type?: string;
  substitution_group?: string;
  children?: RawTreeNode[];
};

export type RawElrGroup = {
  elr: string;
  definition?: string;
  numeric_part?: number;
  root_tree?: RawTreeNode[];
};

export type PendingNavigation = {
  network: string;
  elr?: string;
  qname: string;
  uuid?: string;
  updateDetails?: boolean;
};

export type SearchConceptApiResult = {
  qname: string;
  local_name?: string;
  label?: string;
  balance?: string;
  period_type?: string;
  xbrl_type?: string;
  substitution_group?: string;
  is_dimension?: boolean;
  reference_displays?: string[];
  score?: number;
  matched_fields?: string[];
};

export const EMPTY_ADVANCED_FILTERS: AdvancedSearchFilters = {
  namespace: [],
  balance: [],
  periodType: [],
  xbrlType: [],
  isDimension: [],
  fullType: [],
  abstract: [],
  nillable: [],
  substitutionGroup: [],
  referenceSource: null,
  referenceParagraph: [],
};

export const EMPTY_ADVANCED_FILTER_OPTIONS: AdvancedSearchFilterOptions = {
  namespace: [],
  balance: [],
  periodType: [],
  xbrlType: [],
  isDimension: [true, false],
  fullType: [],
  abstract: [true, false],
  nillable: [true, false],
  substitutionGroup: [],
  referenceSources: [],
};

export const EXCLUDED_TREE_KEYS = new Set(["concepts", "dimensions", "hypercubes", "primary_items"]);
export const NAV_LOG_PREFIX = "[TreeLocationNavigation]";
