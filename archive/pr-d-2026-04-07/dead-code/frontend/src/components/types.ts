export type PresentationTree = {
    elr: string;
    definition: string;
    numeric_part: number;
    root_tree: PresentationNode[];
  }
  
  export type PresentationNode = {
    qname: string;
    name: string;
    xbrl_type: string;
    full_type:string;
    substitution_group:string;
    label_cy?: string;
    concept_id: string;
    abstract?: boolean;
    children?: PresentationNode[];
  }
  
  