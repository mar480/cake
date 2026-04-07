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

export interface PopOutPayload {
  hypercube: unknown;
  language: "en" | "cy";
  sourceQName?: string;
}
