export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      cash_flow_classification: {
        Row: {
          classification: string
          elr: string | null
          elr_id: number | null
          id: string
          qname: string
          role_definition: string | null
        }
        Insert: {
          classification: string
          elr?: string | null
          elr_id?: number | null
          id?: string
          qname: string
          role_definition?: string | null
        }
        Update: {
          classification?: string
          elr?: string | null
          elr_id?: number | null
          id?: string
          qname?: string
          role_definition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_cashflow_concept"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_cashflow_concept"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_cashflow_concept"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      concept_references: {
        Row: {
          concept_qname: string | null
          id: string
          number: string | null
          paragraph: string | null
          part: string | null
          schedule: string | null
          section: string | null
          source: string | null
          year: string | null
        }
        Insert: {
          concept_qname?: string | null
          id?: string
          number?: string | null
          paragraph?: string | null
          part?: string | null
          schedule?: string | null
          section?: string | null
          source?: string | null
          year?: string | null
        }
        Update: {
          concept_qname?: string | null
          id?: string
          number?: string | null
          paragraph?: string | null
          part?: string | null
          schedule?: string | null
          section?: string | null
          source?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_concept_references_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_concept_references_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_concept_references_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      concepts: {
        Row: {
          abstract: boolean | null
          balance: string | null
          full_type: string | null
          id: string
          is_analysis_dimension: boolean | null
          is_dimension: boolean | null
          is_grouping_dimension: boolean | null
          is_typed_dimension: boolean | null
          local_name: string
          namespace: string
          nillable: boolean | null
          period_type: string | null
          preferred_label_role: string | null
          qname: string
          substitution_group: string | null
          typed_domain_type: string | null
          xbrl_type: string | null
        }
        Insert: {
          abstract?: boolean | null
          balance?: string | null
          full_type?: string | null
          id?: string
          is_analysis_dimension?: boolean | null
          is_dimension?: boolean | null
          is_grouping_dimension?: boolean | null
          is_typed_dimension?: boolean | null
          local_name: string
          namespace: string
          nillable?: boolean | null
          period_type?: string | null
          preferred_label_role?: string | null
          qname: string
          substitution_group?: string | null
          typed_domain_type?: string | null
          xbrl_type?: string | null
        }
        Update: {
          abstract?: boolean | null
          balance?: string | null
          full_type?: string | null
          id?: string
          is_analysis_dimension?: boolean | null
          is_dimension?: boolean | null
          is_grouping_dimension?: boolean | null
          is_typed_dimension?: boolean | null
          local_name?: string
          namespace?: string
          nillable?: boolean | null
          period_type?: string | null
          preferred_label_role?: string | null
          qname?: string
          substitution_group?: string | null
          typed_domain_type?: string | null
          xbrl_type?: string | null
        }
        Relationships: []
      }
      cross_refs: {
        Row: {
          elr: string | null
          elr_id: number | null
          from_qname: string
          id: string
          role_definition: string | null
          to_qname: string
        }
        Insert: {
          elr?: string | null
          elr_id?: number | null
          from_qname: string
          id?: string
          role_definition?: string | null
          to_qname: string
        }
        Update: {
          elr?: string | null
          elr_id?: number | null
          from_qname?: string
          id?: string
          role_definition?: string | null
          to_qname?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_cross_refs_from"
            columns: ["from_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_cross_refs_from"
            columns: ["from_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_cross_refs_from"
            columns: ["from_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_cross_refs_to"
            columns: ["to_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_cross_refs_to"
            columns: ["to_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_cross_refs_to"
            columns: ["to_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      definition_tree: {
        Row: {
          depth: number | null
          elr: string | null
          elr_id: number | null
          elr_order: number | null
          id: string
          order: number | null
          parent_qname: string | null
          qname: string
          role_definition: string | null
        }
        Insert: {
          depth?: number | null
          elr?: string | null
          elr_id?: number | null
          elr_order?: number | null
          id?: string
          order?: number | null
          parent_qname?: string | null
          qname: string
          role_definition?: string | null
        }
        Update: {
          depth?: number | null
          elr?: string | null
          elr_id?: number | null
          elr_order?: number | null
          id?: string
          order?: number | null
          parent_qname?: string | null
          qname?: string
          role_definition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_definition_tree_parent"
            columns: ["parent_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_definition_tree_parent"
            columns: ["parent_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_definition_tree_parent"
            columns: ["parent_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_definition_tree_qname"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_definition_tree_qname"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_definition_tree_qname"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      dimension_members: {
        Row: {
          depth: number
          dimension_qname: string
          elr_id: number | null
          id: string
          is_default: boolean
          member_qname: string
          order: number
          parent_qname: string | null
        }
        Insert: {
          depth: number
          dimension_qname: string
          elr_id?: number | null
          id?: string
          is_default: boolean
          member_qname: string
          order: number
          parent_qname?: string | null
        }
        Update: {
          depth?: number
          dimension_qname?: string
          elr_id?: number | null
          id?: string
          is_default?: boolean
          member_qname?: string
          order?: number
          parent_qname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_dim_members_dimension"
            columns: ["dimension_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_dim_members_dimension"
            columns: ["dimension_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_dim_members_dimension"
            columns: ["dimension_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_dim_members_member"
            columns: ["member_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_dim_members_member"
            columns: ["member_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_dim_members_member"
            columns: ["member_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_dim_members_parent"
            columns: ["parent_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_dim_members_parent"
            columns: ["parent_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_dim_members_parent"
            columns: ["parent_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      hypercube_dimensions: {
        Row: {
          dimension_qname: string
          elr: string | null
          elr_id: number | null
          hypercube_qname: string
          id: string
          primary_qname: string
          role_definition: string | null
        }
        Insert: {
          dimension_qname: string
          elr?: string | null
          elr_id?: number | null
          hypercube_qname: string
          id?: string
          primary_qname: string
          role_definition?: string | null
        }
        Update: {
          dimension_qname?: string
          elr?: string | null
          elr_id?: number | null
          hypercube_qname?: string
          id?: string
          primary_qname?: string
          role_definition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hypercube_dims_dimension"
            columns: ["dimension_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_hypercube_dims_dimension"
            columns: ["dimension_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_hypercube_dims_dimension"
            columns: ["dimension_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_hypercube_dims_hypercube"
            columns: ["hypercube_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_hypercube_dims_hypercube"
            columns: ["hypercube_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_hypercube_dims_hypercube"
            columns: ["hypercube_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_hypercube_dims_primary"
            columns: ["primary_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_hypercube_dims_primary"
            columns: ["primary_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_hypercube_dims_primary"
            columns: ["primary_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      hypercubes: {
        Row: {
          concept_qname: string | null
          hypercube_qname: string | null
          id: string
        }
        Insert: {
          concept_qname?: string | null
          hypercube_qname?: string | null
          id?: string
        }
        Update: {
          concept_qname?: string | null
          hypercube_qname?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_hypercubes_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_hypercubes_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_hypercubes_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      labels: {
        Row: {
          concept_qname: string | null
          id: string
          lang: string | null
          role: string | null
          text: string | null
          type: string | null
        }
        Insert: {
          concept_qname?: string | null
          id?: string
          lang?: string | null
          role?: string | null
          text?: string | null
          type?: string | null
        }
        Update: {
          concept_qname?: string | null
          id?: string
          lang?: string | null
          role?: string | null
          text?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_labels_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_labels_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_labels_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      presentation_tree: {
        Row: {
          depth: number | null
          elr: string | null
          elr_id: number | null
          elr_order: number | null
          id: string
          order: number | null
          parent_qname: string | null
          qname: string
          role_definition: string | null
        }
        Insert: {
          depth?: number | null
          elr?: string | null
          elr_id?: number | null
          elr_order?: number | null
          id?: string
          order?: number | null
          parent_qname?: string | null
          qname: string
          role_definition?: string | null
        }
        Update: {
          depth?: number | null
          elr?: string | null
          elr_id?: number | null
          elr_order?: number | null
          id?: string
          order?: number | null
          parent_qname?: string | null
          qname?: string
          role_definition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_presentation_tree_parent"
            columns: ["parent_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_presentation_tree_parent"
            columns: ["parent_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_presentation_tree_parent"
            columns: ["parent_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_presentation_tree_qname"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_presentation_tree_qname"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_presentation_tree_qname"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
    }
    Views: {
      concept_cash_flow_view: {
        Row: {
          classification: string | null
          elr: string | null
          elr_id: number | null
          id: string | null
          qname: string | null
          role_definition: string | null
        }
        Insert: {
          classification?: string | null
          elr?: string | null
          elr_id?: number | null
          id?: string | null
          qname?: string | null
          role_definition?: string | null
        }
        Update: {
          classification?: string | null
          elr?: string | null
          elr_id?: number | null
          id?: string | null
          qname?: string | null
          role_definition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_cashflow_concept"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_cashflow_concept"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_cashflow_concept"
            columns: ["qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      concept_cross_refs_view: {
        Row: {
          destination_local_name: string | null
          destination_period_type: string | null
          destination_qname: string | null
          destination_type: string | null
          elr: string | null
          elr_id: number | null
          from_qname: string | null
          id: string | null
          role_definition: string | null
          to_qname: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_cross_refs_from"
            columns: ["from_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_cross_refs_from"
            columns: ["from_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_cross_refs_from"
            columns: ["from_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_cross_refs_to"
            columns: ["to_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_cross_refs_to"
            columns: ["to_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_cross_refs_to"
            columns: ["to_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      concept_labels_view: {
        Row: {
          concept_qname: string | null
          label_text: string | null
          lang: string | null
          role: string | null
          type: string | null
        }
        Insert: {
          concept_qname?: string | null
          label_text?: string | null
          lang?: string | null
          role?: string | null
          type?: string | null
        }
        Update: {
          concept_qname?: string | null
          label_text?: string | null
          lang?: string | null
          role?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_labels_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_labels_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_labels_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      concept_refs_view: {
        Row: {
          concept_qname: string | null
          id: string | null
          number: string | null
          paragraph: string | null
          part: string | null
          schedule: string | null
          section: string | null
          source: string | null
          year: string | null
        }
        Insert: {
          concept_qname?: string | null
          id?: string | null
          number?: string | null
          paragraph?: string | null
          part?: string | null
          schedule?: string | null
          section?: string | null
          source?: string | null
          year?: string | null
        }
        Update: {
          concept_qname?: string | null
          id?: string | null
          number?: string | null
          paragraph?: string | null
          part?: string | null
          schedule?: string | null
          section?: string | null
          source?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_concept_references_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concept_cross_refs_view"
            referencedColumns: ["destination_qname"]
          },
          {
            foreignKeyName: "fk_concept_references_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["qname"]
          },
          {
            foreignKeyName: "fk_concept_references_concepts"
            columns: ["concept_qname"]
            isOneToOne: false
            referencedRelation: "concepts_full_view"
            referencedColumns: ["qname"]
          },
        ]
      }
      concepts_full_view: {
        Row: {
          abstract: boolean | null
          balance: string | null
          full_type: string | null
          is_analysis_dimension: boolean | null
          is_dimension: boolean | null
          is_grouping_dimension: boolean | null
          is_typed_dimension: boolean | null
          local_name: string | null
          namespace: string | null
          nillable: boolean | null
          period_type: string | null
          preferred_label_role: string | null
          qname: string | null
          substitution_group: string | null
          typed_domain_type: string | null
          xbrl_type: string | null
        }
        Insert: {
          abstract?: boolean | null
          balance?: string | null
          full_type?: string | null
          is_analysis_dimension?: boolean | null
          is_dimension?: boolean | null
          is_grouping_dimension?: boolean | null
          is_typed_dimension?: boolean | null
          local_name?: string | null
          namespace?: string | null
          nillable?: boolean | null
          period_type?: string | null
          preferred_label_role?: string | null
          qname?: string | null
          substitution_group?: string | null
          typed_domain_type?: string | null
          xbrl_type?: string | null
        }
        Update: {
          abstract?: boolean | null
          balance?: string | null
          full_type?: string | null
          is_analysis_dimension?: boolean | null
          is_dimension?: boolean | null
          is_grouping_dimension?: boolean | null
          is_typed_dimension?: boolean | null
          local_name?: string | null
          namespace?: string | null
          nillable?: boolean | null
          period_type?: string | null
          preferred_label_role?: string | null
          qname?: string | null
          substitution_group?: string | null
          typed_domain_type?: string | null
          xbrl_type?: string | null
        }
        Relationships: []
      }
      presentation_tree_view: {
        Row: {
          depth: number | null
          elr: string | null
          elr_id: number | null
          elr_order: number | null
          id: string | null
          parent_qname: string | null
          path: string | null
          qname: string | null
          role_definition: string | null
          sibling_order: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
