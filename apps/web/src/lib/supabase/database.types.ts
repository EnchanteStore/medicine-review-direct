export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      consent_source: 'sign_up' | 'account_settings' | 'staff_recorded';
      consent_type: 'terms_of_service' | 'privacy_notice' | 'adult_declaration';
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
      consent_source: ['sign_up', 'account_settings', 'staff_recorded'],
      consent_type: ['terms_of_service', 'privacy_notice', 'adult_declaration'],
      staff_role: ['pharmacist', 'clinical_admin', 'ops_admin'],
      verification_status: ['pending', 'verified', 'suspended', 'revoked'],
    },
  },
} as const;
