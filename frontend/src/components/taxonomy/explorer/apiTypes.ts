import type { TreeLocationTarget } from "./TreeLocationsTab";

export interface ConceptCore {
  qname: string;
  local_name: string;
  namespace?: string;
  balance?: string | null;
  period_type?: string;
  full_type?: string;
  xbrl_type?: string;
  substitution_group?: string;
  abstract?: boolean;
  nillable?: boolean;
  preferred_label_role?: string;
}

export interface ConceptLabel {
  type: string;
  lang: string;
  label_text: string;
}

export interface ConceptReference {
  reference_role?: string | null;
  reference_key_values?: Record<string, unknown>;
  name?: string;
  number?: string;
  year?: string;
  schedule?: string;
  part?: string;
  report?: string;
  section?: string;
  paragraph?: string;
  [key: string]: unknown;
}

export interface ConceptDetailsResponse {
  concept: ConceptCore;
  labels?: ConceptLabel[];
  references?: ConceptReference[];
  cross_ref_destination?: string | string[];
  cash_flow_classification?: string;
}

export interface HypercubeApiResponse {
  hypercubes: unknown[];
}

export interface RelationshipTreeNode {
  qname?: string;
  concept_id?: string;
  label?: string;
  name?: string;
  label_cy?: string;
  xbrl_type?: string;
  full_type?: string;
  substitution_group?: string;
  abstract?: boolean;
  tree_id?: string;
  uuid?: string;
  children?: RelationshipTreeNode[];
}

export interface RelationshipDomainMember {
  name: string;
  label: string;
  label_cy: string;
  children: RelationshipDomainMember[];
}

export interface DimensionalRelationshipDimension {
  dimensionName: string;
  dimensionELR?: string | null;
  definition: string;
  elr_id: number | null;
  defaultMember: string | null;
  domainMembers: RelationshipDomainMember[];
  isSelectedDimension?: boolean;
  containsSelectedMember?: boolean;
}

export interface DimensionalRelationshipHypercube {
  hypercubeName: string;
  hypercubeELR?: string | null;
  definition: string;
  elr_id: number | null;
  dimensions: DimensionalRelationshipDimension[];
  primaryItemsTree: RelationshipTreeNode[];
  primaryItemRoots?: string[];
  isSelectedHypercube?: boolean;
  containsSelectedDimension?: boolean;
}

export interface DimensionalRelationshipsResponse {
  selection: {
    qname: string;
    concept_type: string;
    matched_dimensions: string[];
  };
  hypercubes: DimensionalRelationshipHypercube[];
}

export interface PrefetchedDimensionalRelationshipsState {
  key: string;
  data: DimensionalRelationshipsResponse | null;
  loading: boolean;
  error: string | null;
}

export interface PopOutPayload {
  hypercube: DimensionalRelationshipHypercube;
  language: "en" | "cy";
  sourceQName?: string;
}

export interface TreeLocationsPopOutPayload {
  qname: string;
  locations: TreeLocationTarget[];
}
