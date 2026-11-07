export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          environment: string;
          id: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          environment?: string;
          id?: boolean;
          updated_at?: string;
        };
        Update: {
          environment?: string;
          id?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      appointment_events: {
        Row: {
          appointment_id: string;
          event: string;
          id: number;
          recorded_at: string;
          slot: unknown;
        };
        ComputedFields: never;
        Insert: {
          appointment_id: string;
          event: string;
          id?: never;
          recorded_at?: string;
          slot: unknown;
        };
        Update: {
          appointment_id?: string;
          event?: string;
          id?: never;
          recorded_at?: string;
          slot?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: 'appointment_events_appointment_id_fkey';
            columns: ['appointment_id'];
            isOneToOne: false;
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
        ];
      };
      appointments: {
        Row: {
          created_at: string;
          id: string;
          method: string;
          order_id: string;
          patient_id: string;
          pharmacist_id: string;
          reschedule_count: number;
          slot: unknown;
          starts_at: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          method: string;
          order_id: string;
          patient_id: string;
          pharmacist_id: string;
          reschedule_count?: number;
          slot: unknown;
          starts_at?: never;
          status: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          method?: string;
          order_id?: string;
          patient_id?: string;
          pharmacist_id?: string;
          reschedule_count?: number;
          slot?: unknown;
          starts_at?: never;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'appointments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'review_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          entity_id: string | null;
          entity_type: string;
          id: number;
          metadata: NonNullable<Json>;
          occurred_at: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
        };
        Relationships: [];
      };
      checkout_sessions: {
        Row: {
          amount_pence: number;
          created_at: string;
          currency: string;
          id: string;
          order_id: string;
          patient_id: string;
          product_code: string;
          provider: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          amount_pence: number;
          created_at?: string;
          currency?: string;
          id?: string;
          order_id: string;
          patient_id: string;
          product_code: string;
          provider: string;
          status?: string;
        };
        Update: {
          amount_pence?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          order_id?: string;
          patient_id?: string;
          product_code?: string;
          provider?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'checkout_sessions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'review_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkout_sessions_product_code_fkey';
            columns: ['product_code'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['code'];
          },
        ];
      };
      consents: {
        Row: {
          consent_type: Database['public']['Enums']['consent_type'];
          document_version: string;
          granted: boolean;
          id: string;
          recorded_at: string;
          source: Database['public']['Enums']['consent_source'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          consent_type: Database['public']['Enums']['consent_type'];
          document_version: string;
          granted: boolean;
          id?: string;
          recorded_at?: string;
          source?: Database['public']['Enums']['consent_source'];
          user_id?: string;
        };
        Update: {
          consent_type?: Database['public']['Enums']['consent_type'];
          document_version?: string;
          granted?: boolean;
          id?: string;
          recorded_at?: string;
          source?: Database['public']['Enums']['consent_source'];
          user_id?: string;
        };
        Relationships: [];
      };
      consultations: {
        Row: {
          clinical_notes: string;
          created_at: string;
          id: string;
          method: string;
          occurred_at: string;
          order_id: string;
          pharmacist_id: string;
          two_way_completed: boolean;
        };
        ComputedFields: never;
        Insert: {
          clinical_notes: string;
          created_at?: string;
          id?: string;
          method: string;
          occurred_at: string;
          order_id: string;
          pharmacist_id: string;
          two_way_completed: boolean;
        };
        Update: {
          clinical_notes?: string;
          created_at?: string;
          id?: string;
          method?: string;
          occurred_at?: string;
          order_id?: string;
          pharmacist_id?: string;
          two_way_completed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'consultations_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'review_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      deletion_requests: {
        Row: {
          id: string;
          requested_at: string;
          retention_assessment: Json | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          requested_at?: string;
          retention_assessment?: Json | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          requested_at?: string;
          retention_assessment?: Json | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          mime_type: string;
          order_id: string;
          original_filename: string;
          patient_id: string;
          scan_engine: string;
          scan_status: string;
          size_bytes: number;
          storage_path: string;
          uploaded_at: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          mime_type: string;
          order_id: string;
          original_filename: string;
          patient_id: string;
          scan_engine?: string;
          scan_status?: string;
          size_bytes: number;
          storage_path: string;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          mime_type?: string;
          order_id?: string;
          original_filename?: string;
          patient_id?: string;
          scan_engine?: string;
          scan_status?: string;
          size_bytes?: number;
          storage_path?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'review_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      high_risk_medicine_changes: {
        Row: {
          category: string | null;
          change: string;
          id: number;
          recorded_at: string;
          recorded_by: string | null;
          term: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string | null;
          change: string;
          id?: never;
          recorded_at?: string;
          recorded_by?: string | null;
          term: string;
        };
        Update: {
          category?: string | null;
          change?: string;
          id?: never;
          recorded_at?: string;
          recorded_by?: string | null;
          term?: string;
        };
        Relationships: [];
      };
      high_risk_medicine_terms: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          category: string;
          effective_from: string;
          effective_to: string | null;
          status: string;
          term: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          category: string;
          effective_from?: string;
          effective_to?: string | null;
          status?: string;
          term: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          category?: string;
          effective_from?: string;
          effective_to?: string | null;
          status?: string;
          term?: string;
        };
        Relationships: [];
      };
      launch_signoffs: {
        Row: {
          decision: string;
          evidence_reference: string;
          gate: Database['public']['Enums']['launch_gate'];
          id: number;
          recorded_at: string;
          signed_off_by: string;
        };
        ComputedFields: never;
        Insert: {
          decision: string;
          evidence_reference: string;
          gate: Database['public']['Enums']['launch_gate'];
          id?: never;
          recorded_at?: string;
          signed_off_by: string;
        };
        Update: {
          decision?: string;
          evidence_reference?: string;
          gate?: Database['public']['Enums']['launch_gate'];
          id?: never;
          recorded_at?: string;
          signed_off_by?: string;
        };
        Relationships: [];
      };
      legal_holds: {
        Row: {
          id: string;
          order_id: string | null;
          placed_at: string;
          placed_by: string;
          reason_category: string;
          released_at: string | null;
          released_by: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          order_id?: string | null;
          placed_at?: string;
          placed_by: string;
          reason_category: string;
          released_at?: string | null;
          released_by?: string | null;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          placed_at?: string;
          placed_by?: string;
          reason_category?: string;
          released_at?: string | null;
          released_by?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'legal_holds_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'review_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      mfa_recovery_events: {
        Row: {
          approved_by: string;
          id: string;
          outcome: string;
          recorded_at: string;
          user_id: string;
          verification_method: string;
        };
        ComputedFields: never;
        Insert: {
          approved_by: string;
          id?: string;
          outcome: string;
          recorded_at?: string;
          user_id: string;
          verification_method: string;
        };
        Update: {
          approved_by?: string;
          id?: string;
          outcome?: string;
          recorded_at?: string;
          user_id?: string;
          verification_method?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_pence: number;
          checkout_session_id: string | null;
          created_at: string;
          currency: string;
          id: string;
          manual_reference: string | null;
          order_id: string;
          patient_id: string;
          provider_event_id: string | null;
          receipt_number: string;
          source: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          amount_pence: number;
          checkout_session_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          manual_reference?: string | null;
          order_id: string;
          patient_id: string;
          provider_event_id?: string | null;
          receipt_number: string;
          source: string;
          status: string;
        };
        Update: {
          amount_pence?: number;
          checkout_session_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          manual_reference?: string | null;
          order_id?: string;
          patient_id?: string;
          provider_event_id?: string | null;
          receipt_number?: string;
          source?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_checkout_session_id_fkey';
            columns: ['checkout_session_id'];
            isOneToOne: false;
            referencedRelation: 'checkout_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'review_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_provider_event_id_fkey';
            columns: ['provider_event_id'];
            isOneToOne: true;
            referencedRelation: 'provider_events';
            referencedColumns: ['event_id'];
          },
        ];
      };
      pharmacist_availability: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          pharmacist_id: string;
          starts_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          pharmacist_id: string;
          starts_at: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          pharmacist_id?: string;
          starts_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          code: string;
          created_at: string;
          currency: string;
          description: string;
          display_order: number;
          is_active: boolean;
          name: string;
          price_pence: number;
          standard_price_pence: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          currency?: string;
          description: string;
          display_order?: number;
          is_active?: boolean;
          name: string;
          price_pence: number;
          standard_price_pence?: number | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          currency?: string;
          description?: string;
          display_order?: number;
          is_active?: boolean;
          name?: string;
          price_pence?: number;
          standard_price_pence?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          date_of_birth: string | null;
          family_name: string | null;
          given_name: string | null;
          id: string;
          phone_number: string | null;
          phone_verified_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          date_of_birth?: string | null;
          family_name?: string | null;
          given_name?: string | null;
          id: string;
          phone_number?: string | null;
          phone_verified_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date_of_birth?: string | null;
          family_name?: string | null;
          given_name?: string | null;
          id?: string;
          phone_number?: string | null;
          phone_verified_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      provider_events: {
        Row: {
          event_id: string;
          event_type: string;
          outcome: string | null;
          payload_hash: string;
          processed_at: string | null;
          received_at: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          event_type: string;
          outcome?: string | null;
          payload_hash: string;
          processed_at?: string | null;
          received_at?: string;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          outcome?: string | null;
          payload_hash?: string;
          processed_at?: string | null;
          received_at?: string;
        };
        Relationships: [];
      };
      questionnaire_submissions: {
        Row: {
          amends_submission_id: string | null;
          answers: NonNullable<Json>;
          attention_flags: string[];
          created_at: string;
          current_step: number;
          id: string;
          medications: NonNullable<Json>;
          order_id: string;
          patient_id: string;
          status: string;
          submitted_at: string | null;
          updated_at: string;
          version_no: number | null;
        };
        ComputedFields: never;
        Insert: {
          amends_submission_id?: string | null;
          answers?: NonNullable<Json>;
          attention_flags?: string[];
          created_at?: string;
          current_step?: number;
          id?: string;
          medications?: NonNullable<Json>;
          order_id: string;
          patient_id: string;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          version_no?: number | null;
        };
        Update: {
          amends_submission_id?: string | null;
          answers?: NonNullable<Json>;
          attention_flags?: string[];
          created_at?: string;
          current_step?: number;
          id?: string;
          medications?: NonNullable<Json>;
          order_id?: string;
          patient_id?: string;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          version_no?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'questionnaire_submissions_amends_submission_id_fkey';
            columns: ['amends_submission_id'];
            isOneToOne: false;
            referencedRelation: 'questionnaire_submissions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'questionnaire_submissions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'review_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      refunds: {
        Row: {
          amount_pence: number;
          id: string;
          payment_id: string;
          provider_refund_id: string | null;
          reason: string;
          recorded_at: string;
          recorded_by: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          amount_pence: number;
          id?: string;
          payment_id: string;
          provider_refund_id?: string | null;
          reason: string;
          recorded_at?: string;
          recorded_by: string;
          status?: string;
        };
        Update: {
          amount_pence?: number;
          id?: string;
          payment_id?: string;
          provider_refund_id?: string | null;
          reason?: string;
          recorded_at?: string;
          recorded_by?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'refunds_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          adequacy_confirmed_at: string | null;
          adequacy_confirmed_by: string | null;
          approved_at: string | null;
          approved_by: string | null;
          approver_display_name: string | null;
          approver_gphc_number: string | null;
          consultation_id: string | null;
          content: NonNullable<Json>;
          created_at: string;
          id: string;
          information_sufficient_at: string | null;
          information_sufficient_by: string | null;
          order_id: string;
          released_at: string | null;
          released_by: string | null;
          status: Database['public']['Enums']['report_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          adequacy_confirmed_at?: string | null;
          adequacy_confirmed_by?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          approver_display_name?: string | null;
          approver_gphc_number?: string | null;
          consultation_id?: string | null;
          content?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          information_sufficient_at?: string | null;
          information_sufficient_by?: string | null;
          order_id: string;
          released_at?: string | null;
          released_by?: string | null;
          status?: Database['public']['Enums']['report_status'];
          updated_at?: string;
        };
        Update: {
          adequacy_confirmed_at?: string | null;
          adequacy_confirmed_by?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          approver_display_name?: string | null;
          approver_gphc_number?: string | null;
          consultation_id?: string | null;
          content?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          information_sufficient_at?: string | null;
          information_sufficient_by?: string | null;
          order_id?: string;
          released_at?: string | null;
          released_by?: string | null;
          status?: Database['public']['Enums']['report_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_consultation_id_fkey';
            columns: ['consultation_id'];
            isOneToOne: false;
            referencedRelation: 'consultations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'review_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      retention_policies: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          basis: string;
          period_starts_from: string;
          record_category: string;
          retention_period: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          basis: string;
          period_starts_from: string;
          record_category: string;
          retention_period: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          basis?: string;
          period_starts_from?: string;
          record_category?: string;
          retention_period?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      review_orders: {
        Row: {
          assigned_pharmacist_id: string | null;
          created_at: string;
          exclusion_label: string | null;
          id: string;
          last_clinical_contact_at: string | null;
          patient_id: string;
          prior_concern_confirmed_at: string | null;
          product_code: string;
          requires_prior_exclusion_review: boolean;
          status: Database['public']['Enums']['order_status'];
          status_changed_at: string;
          suitability_review_required: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_pharmacist_id?: string | null;
          created_at?: string;
          exclusion_label?: string | null;
          id?: string;
          last_clinical_contact_at?: string | null;
          patient_id: string;
          prior_concern_confirmed_at?: string | null;
          product_code?: string;
          requires_prior_exclusion_review?: boolean;
          status?: Database['public']['Enums']['order_status'];
          status_changed_at?: string;
          suitability_review_required?: boolean;
          updated_at?: string;
        };
        Update: {
          assigned_pharmacist_id?: string | null;
          created_at?: string;
          exclusion_label?: string | null;
          id?: string;
          last_clinical_contact_at?: string | null;
          patient_id?: string;
          prior_concern_confirmed_at?: string | null;
          product_code?: string;
          requires_prior_exclusion_review?: boolean;
          status?: Database['public']['Enums']['order_status'];
          status_changed_at?: string;
          suitability_review_required?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'review_orders_product_code_fkey';
            columns: ['product_code'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['code'];
          },
        ];
      };
      safety_rulesets: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          definition: NonNullable<Json>;
          is_active: boolean;
          status: Database['public']['Enums']['ruleset_status'];
          version: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          definition: NonNullable<Json>;
          is_active?: boolean;
          status?: Database['public']['Enums']['ruleset_status'];
          version: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          definition?: NonNullable<Json>;
          is_active?: boolean;
          status?: Database['public']['Enums']['ruleset_status'];
          version?: string;
        };
        Relationships: [];
      };
      safety_screenings: {
        Row: {
          acknowledged_at: string | null;
          answers: NonNullable<Json>;
          created_at: string;
          flags: string[];
          id: string;
          matched_rule_ids: string[];
          order_id: string;
          outcome: string;
          patient_id: string;
          ruleset_version: string;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string | null;
          answers: NonNullable<Json>;
          created_at?: string;
          flags?: string[];
          id?: string;
          matched_rule_ids?: string[];
          order_id: string;
          outcome: string;
          patient_id: string;
          ruleset_version: string;
        };
        Update: {
          acknowledged_at?: string | null;
          answers?: NonNullable<Json>;
          created_at?: string;
          flags?: string[];
          id?: string;
          matched_rule_ids?: string[];
          order_id?: string;
          outcome?: string;
          patient_id?: string;
          ruleset_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'safety_screenings_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'review_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'safety_screenings_ruleset_version_fkey';
            columns: ['ruleset_version'];
            isOneToOne: false;
            referencedRelation: 'safety_rulesets';
            referencedColumns: ['version'];
          },
        ];
      };
      staff_roles: {
        Row: {
          created_at: string;
          gphc_registration_number: string | null;
          id: string;
          role: Database['public']['Enums']['staff_role'];
          updated_at: string;
          user_id: string;
          verification_status: Database['public']['Enums']['verification_status'];
          verified_at: string | null;
          verified_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          gphc_registration_number?: string | null;
          id?: string;
          role: Database['public']['Enums']['staff_role'];
          updated_at?: string;
          user_id: string;
          verification_status?: Database['public']['Enums']['verification_status'];
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          gphc_registration_number?: string | null;
          id?: string;
          role?: Database['public']['Enums']['staff_role'];
          updated_at?: string;
          user_id?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [];
      };
      suitability_assessments: {
        Row: {
          assessed_by: string;
          created_at: string;
          id: string;
          kind: string;
          notes: string;
          order_id: string;
          outcome: string;
        };
        ComputedFields: never;
        Insert: {
          assessed_by: string;
          created_at?: string;
          id?: string;
          kind: string;
          notes: string;
          order_id: string;
          outcome: string;
        };
        Update: {
          assessed_by?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          notes?: string;
          order_id?: string;
          outcome?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'suitability_assessments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'review_orders';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      acknowledge_safety_advice: { Args: { p_screening_id: string }; Returns: undefined };
      add_high_risk_term: { Args: { p_category: string; p_term: string }; Returns: undefined };
      apply_provider_event: {
        Args: {
          p_amount_pence: number;
          p_currency: string;
          p_event_id: string;
          p_event_type: string;
          p_payload_hash: string;
          p_session_id: string;
        };
        Returns: Json;
      };
      assign_pharmacist: {
        Args: { p_order_id: string; p_pharmacist_id: string };
        Returns: undefined;
      };
      begin_checkout: { Args: { p_order_id: string }; Returns: Json };
      book_appointment: {
        Args: { p_order_id: string; p_pharmacist_id: string; p_starts: string };
        Returns: string;
      };
      bookable_slots: {
        Args: { p_from: string; p_to: string };
        Returns: {
          ends_at: string;
          pharmacist_id: string;
          starts_at: string;
        }[];
      };
      confirm_prior_safety_concern: { Args: { p_order_id: string }; Returns: undefined };
      launch_readiness: {
        Args: Record<PropertyKey, never>;
        Returns: {
          decision: string;
          evidence_reference: string;
          gate: Database['public']['Enums']['launch_gate'];
          recorded_at: string;
        }[];
      };
      patient_safety_history: {
        Args: { p_patient_id: string };
        Returns: {
          exclusion_label: string;
          matched_rule_ids: string[];
          order_id: string;
          outcome: string;
          recorded_at: string;
          ruleset_version: string;
        }[];
      };
      pharmacist_approve_report: {
        Args: { p_consultation_id: string; p_report_id: string };
        Returns: undefined;
      };
      pharmacist_confirm_report_checks: {
        Args: {
          p_clinically_adequate: boolean;
          p_information_sufficient: boolean;
          p_report_id: string;
        };
        Returns: undefined;
      };
      pharmacist_create_report: { Args: { p_order_id: string }; Returns: string };
      pharmacist_record_consultation: {
        Args: {
          p_method: string;
          p_notes: string;
          p_occurred_at: string;
          p_order_id: string;
          p_two_way_completed: boolean;
        };
        Returns: string;
      };
      pharmacist_release_report: { Args: { p_report_id: string }; Returns: undefined };
      place_legal_hold: {
        Args: { p_order_id: string; p_reason: string; p_user_id: string };
        Returns: string;
      };
      record_manual_payment: { Args: { p_order_id: string; p_reference: string }; Returns: Json };
      record_refund: {
        Args: { p_amount_pence: number; p_payment_id: string; p_reason: string };
        Returns: string;
      };
      record_suitability_assessment: {
        Args: { p_kind: string; p_notes: string; p_order_id: string; p_outcome: string };
        Returns: string;
      };
      recover_staff_mfa: { Args: { p_method: string; p_user_id: string }; Returns: undefined };
      register_document: {
        Args: {
          p_filename: string;
          p_mime: string;
          p_order_id: string;
          p_size: number;
          p_storage_path: string;
        };
        Returns: string;
      };
      request_account_deletion: { Args: Record<PropertyKey, never>; Returns: string };
      request_cancellation: { Args: { p_appointment_id: string }; Returns: undefined };
      reschedule_appointment: {
        Args: { p_appointment_id: string; p_pharmacist_id: string; p_starts: string };
        Returns: undefined;
      };
      review_deletion_request: {
        Args: { p_decision: string; p_request_id: string };
        Returns: Json;
      };
      save_questionnaire_draft: {
        Args: { p_answers: Json; p_medications: Json; p_order_id: string; p_step: number };
        Returns: string;
      };
      service_status: { Args: Record<PropertyKey, never>; Returns: Json };
      set_availability: { Args: { p_ends: string; p_starts: string }; Returns: string };
      start_questionnaire_amendment: { Args: { p_order_id: string }; Returns: string };
      start_review_order: { Args: Record<PropertyKey, never>; Returns: string };
      submit_questionnaire: { Args: { p_order_id: string }; Returns: number };
      submit_safety_screening: { Args: { p_answers: Json; p_order_id: string }; Returns: Json };
    };
    Enums: {
      consent_source: 'sign_up' | 'account_settings' | 'staff_recorded' | 'intake';
      consent_type:
        | 'terms_of_service'
        | 'privacy_notice'
        | 'adult_declaration'
        | 'health_data_processing'
        | 'remote_consultation';
      launch_gate:
        | 'clinical_screening_content_and_sop'
        | 'operational_response_arrangements'
        | 'mhra_device_classification'
        | 'cqc_scope_assessment'
        | 'professional_indemnity'
        | 'legal_terms_and_privacy_notice'
        | 'retention_policy_and_dpia'
        | 'company_ico_gphc_details'
        | 'vat_and_brand_checks'
        | 'processor_agreements_and_security_review';
      order_status:
        | 'draft'
        | 'safety_emergency_excluded'
        | 'safety_urgent_hold'
        | 'intake'
        | 'questionnaire_submitted'
        | 'awaiting_payment'
        | 'paid'
        | 'consultation_booked'
        | 'in_review'
        | 'report_released'
        | 'completed'
        | 'declined'
        | 'cancelled'
        | 'refunded';
      report_status:
        | 'draft'
        | 'clinically_approved'
        | 'generating'
        | 'generation_failed'
        | 'ready_for_release'
        | 'released';
      ruleset_status: 'draft' | 'approved' | 'retired';
      staff_role: 'pharmacist' | 'clinical_admin' | 'ops_admin';
      verification_status: 'pending' | 'verified' | 'suspended' | 'revoked';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      consent_source: ['sign_up', 'account_settings', 'staff_recorded', 'intake'],
      consent_type: [
        'terms_of_service',
        'privacy_notice',
        'adult_declaration',
        'health_data_processing',
        'remote_consultation',
      ],
      launch_gate: [
        'clinical_screening_content_and_sop',
        'operational_response_arrangements',
        'mhra_device_classification',
        'cqc_scope_assessment',
        'professional_indemnity',
        'legal_terms_and_privacy_notice',
        'retention_policy_and_dpia',
        'company_ico_gphc_details',
        'vat_and_brand_checks',
        'processor_agreements_and_security_review',
      ],
      order_status: [
        'draft',
        'safety_emergency_excluded',
        'safety_urgent_hold',
        'intake',
        'questionnaire_submitted',
        'awaiting_payment',
        'paid',
        'consultation_booked',
        'in_review',
        'report_released',
        'completed',
        'declined',
        'cancelled',
        'refunded',
      ],
      report_status: [
        'draft',
        'clinically_approved',
        'generating',
        'generation_failed',
        'ready_for_release',
        'released',
      ],
      ruleset_status: ['draft', 'approved', 'retired'],
      staff_role: ['pharmacist', 'clinical_admin', 'ops_admin'],
      verification_status: ['pending', 'verified', 'suspended', 'revoked'],
    },
  },
} as const;
