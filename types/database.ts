/**
 * Types de la base Supabase.
 *
 * En production, régénérer avec :
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 *
 * Tant que le projet Supabase n'est pas créé, ces types sont maintenus à la
 * main et reflètent exactement le schéma `supabase/migrations/0001_init.sql`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = "patient" | "accompagnant" | "admin";

export type DocumentType =
  | "anapath"
  | "biologie"
  | "imagerie"
  | "courrier"
  | "ordonnance"
  | "compte_rendu_op"
  | "rcp"
  | "genetique"
  | "autre";

export type ConsultationType =
  | "oncologie"
  | "endocrinologie"
  | "chirurgie"
  | "rcp"
  | "genetique"
  | "radiologie"
  | "soins_support"
  | "autre";

export type ConsultationStatus = "upcoming" | "completed" | "cancelled";

export type AlertLevel = "normal" | "warning" | "critical";

export type EventType =
  | "surgery"
  | "consultation"
  | "biology"
  | "imaging"
  | "anapath"
  | "treatment_start"
  | "treatment_adjustment"
  | "treatment_end"
  | "rcp"
  | "clinical_trial"
  | "hospitalization"
  | "emergency"
  | "other";

export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string;
          name: string;
          onboarding_completed: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          onboarding_completed?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["families"]["Insert"]>;
        Relationships: [];
      };
      family_members: {
        Row: {
          id: string;
          family_id: string;
          user_id: string;
          role: Role;
          display_name: string;
          relation: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          user_id: string;
          role: Role;
          display_name: string;
          relation?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["family_members"]["Insert"]>;
        Relationships: [];
      };
      cancer_profiles: {
        Row: {
          id: string;
          family_id: string;
          cancer_type: string;
          cancer_label: string;
          patient_first_name: string | null;
          patient_birth_date: string | null;
          diagnosis_date: string | null;
          stage: string | null;
          surgery_date: string | null;
          surgery_result: string | null;
          active_treatments: Json;
          key_biomarkers: Json;
          care_team: Json;
          custom_markers: Json;
          reference_network: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          cancer_type: string;
          cancer_label: string;
          patient_first_name?: string | null;
          patient_birth_date?: string | null;
          diagnosis_date?: string | null;
          stage?: string | null;
          surgery_date?: string | null;
          surgery_result?: string | null;
          active_treatments?: Json;
          key_biomarkers?: Json;
          care_team?: Json;
          custom_markers?: Json;
          reference_network?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cancer_profiles"]["Insert"]>;
        Relationships: [];
      };
      biology_records: {
        Row: {
          id: string;
          family_id: string;
          recorded_at: string;
          marker_name: string;
          value: number;
          unit: string;
          out_of_range: boolean | null;
          alert_level: AlertLevel | null;
          notes: string | null;
          source_document_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          recorded_at: string;
          marker_name: string;
          value: number;
          unit: string;
          out_of_range?: boolean | null;
          alert_level?: AlertLevel | null;
          notes?: string | null;
          source_document_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["biology_records"]["Insert"]>;
        Relationships: [];
      };
      medical_documents: {
        Row: {
          id: string;
          family_id: string;
          document_type: DocumentType;
          document_date: string | null;
          title: string;
          raw_text: string | null;
          analysis_summary: Json | null;
          doctor_name: string | null;
          storage_path: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          document_type: DocumentType;
          document_date?: string | null;
          title: string;
          raw_text?: string | null;
          analysis_summary?: Json | null;
          doctor_name?: string | null;
          storage_path?: string | null;
          uploaded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["medical_documents"]["Insert"]>;
        Relationships: [];
      };
      consultations: {
        Row: {
          id: string;
          family_id: string;
          consultation_date: string;
          doctor_name: string | null;
          consultation_type: ConsultationType | null;
          hospital: string | null;
          prepared_questions: Json | null;
          notes_during: string | null;
          decisions_made: Json | null;
          followup_actions: Json | null;
          status: ConsultationStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          consultation_date: string;
          doctor_name?: string | null;
          consultation_type?: ConsultationType | null;
          hospital?: string | null;
          prepared_questions?: Json | null;
          notes_during?: string | null;
          decisions_made?: Json | null;
          followup_actions?: Json | null;
          status?: ConsultationStatus;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["consultations"]["Insert"]>;
        Relationships: [];
      };
      timeline_events: {
        Row: {
          id: string;
          family_id: string;
          event_type: EventType;
          event_date: string;
          title: string;
          summary: string | null;
          is_critical: boolean | null;
          linked_document_id: string | null;
          linked_consultation_id: string | null;
          linked_biology_date: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          event_type: EventType;
          event_date: string;
          title: string;
          summary?: string | null;
          is_critical?: boolean | null;
          linked_document_id?: string | null;
          linked_consultation_id?: string | null;
          linked_biology_date?: string | null;
          metadata?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["timeline_events"]["Insert"]>;
        Relationships: [];
      };
      symptom_logs: {
        Row: {
          id: string;
          family_id: string;
          logged_at: string;
          logged_by: string | null;
          digestif: number | null;
          neuro: number | null;
          fatigue: number | null;
          douleur: number | null;
          autres: Json | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          family_id: string;
          logged_at?: string;
          logged_by?: string | null;
          digestif?: number | null;
          neuro?: number | null;
          fatigue?: number | null;
          douleur?: number | null;
          autres?: Json | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["symptom_logs"]["Insert"]>;
        Relationships: [];
      };
      watch_findings: {
        Row: {
          id: string;
          family_id: string;
          generated_at: string;
          generated_by: string | null;
          patient_context: Json;
          clinical_trials: Json;
          publications: Json;
          expert_centers: Json;
          patient_resources: Json;
          contextual_alerts: Json;
          executive_summary: string | null;
          top_priorities: Json;
          model_used: string;
          token_usage: Json | null;
          is_archived: boolean;
        };
        Insert: {
          id?: string;
          family_id: string;
          generated_by?: string | null;
          patient_context: Json;
          clinical_trials?: Json;
          publications?: Json;
          expert_centers?: Json;
          patient_resources?: Json;
          contextual_alerts?: Json;
          executive_summary?: string | null;
          top_priorities?: Json;
          model_used?: string;
          token_usage?: Json | null;
          is_archived?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["watch_findings"]["Insert"]>;
        Relationships: [];
      };
      ai_cache: {
        Row: {
          id: string;
          family_id: string;
          cache_type: string;
          data_version: string;
          content: Json;
          model: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          cache_type: string;
          data_version: string;
          content: Json;
          model?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["ai_cache"]["Insert"]>;
        Relationships: [];
      };
      surveillance_alerts: {
        Row: {
          id: string;
          family_id: string;
          alert_type: string;
          label: string;
          due_date: string;
          is_done: boolean | null;
          linked_event_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          alert_type: string;
          label: string;
          due_date: string;
          is_done?: boolean | null;
          linked_event_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["surveillance_alerts"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_family_member: {
        Args: { p_family_id: string };
        Returns: boolean;
      };
      is_family_admin: {
        Args: { p_family_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}
