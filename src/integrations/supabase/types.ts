export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      carrier_configs: {
        Row: {
          account_group: string | null
          account_name: string
          carrier_type: string
          connection_status: string | null
          created_at: string
          dhl_account_number: string | null
          dhl_password: string | null
          dhl_site_id: string | null
          dimensional_divisor: number | null
          enabled_services: Json | null
          fedex_account_number: string | null
          fedex_key: string | null
          fedex_meter_number: string | null
          fedex_password: string | null
          fuel_auto_lookup: boolean | null
          fuel_surcharge_percent: number | null
          id: string
          is_active: boolean
          is_rate_card: boolean | null
          is_sandbox: boolean
          last_test_at: string | null
          rate_card_filename: string | null
          rate_card_uploaded_at: string | null
          updated_at: string
          ups_account_number: string | null
          ups_client_id: string | null
          ups_client_secret: string | null
          user_id: string
          usps_password: string | null
          usps_user_id: string | null
          weight_unit: string | null
        }
        Insert: {
          account_group?: string | null
          account_name: string
          carrier_type: string
          connection_status?: string | null
          created_at?: string
          dhl_account_number?: string | null
          dhl_password?: string | null
          dhl_site_id?: string | null
          dimensional_divisor?: number | null
          enabled_services?: Json | null
          fedex_account_number?: string | null
          fedex_key?: string | null
          fedex_meter_number?: string | null
          fedex_password?: string | null
          fuel_auto_lookup?: boolean | null
          fuel_surcharge_percent?: number | null
          id?: string
          is_active?: boolean
          is_rate_card?: boolean | null
          is_sandbox?: boolean
          last_test_at?: string | null
          rate_card_filename?: string | null
          rate_card_uploaded_at?: string | null
          updated_at?: string
          ups_account_number?: string | null
          ups_client_id?: string | null
          ups_client_secret?: string | null
          user_id: string
          usps_password?: string | null
          usps_user_id?: string | null
          weight_unit?: string | null
        }
        Update: {
          account_group?: string | null
          account_name?: string
          carrier_type?: string
          connection_status?: string | null
          created_at?: string
          dhl_account_number?: string | null
          dhl_password?: string | null
          dhl_site_id?: string | null
          dimensional_divisor?: number | null
          enabled_services?: Json | null
          fedex_account_number?: string | null
          fedex_key?: string | null
          fedex_meter_number?: string | null
          fedex_password?: string | null
          fuel_auto_lookup?: boolean | null
          fuel_surcharge_percent?: number | null
          id?: string
          is_active?: boolean
          is_rate_card?: boolean | null
          is_sandbox?: boolean
          last_test_at?: string | null
          rate_card_filename?: string | null
          rate_card_uploaded_at?: string | null
          updated_at?: string
          ups_account_number?: string | null
          ups_client_id?: string | null
          ups_client_secret?: string | null
          user_id?: string
          usps_password?: string | null
          usps_user_id?: string | null
          weight_unit?: string | null
        }
        Relationships: []
      }
      carrier_services: {
        Row: {
          carrier_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_international: boolean
          service_code: string
          service_name: string
        }
        Insert: {
          carrier_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_international?: boolean
          service_code: string
          service_name: string
        }
        Update: {
          carrier_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_international?: boolean
          service_code?: string
          service_name?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          branding_config: Json | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          industry: string | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          branding_config?: Json | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          branding_config?: Json | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      column_mappings: {
        Row: {
          confidence_score: number | null
          created_at: string
          csv_header: string
          csv_upload_id: string
          field_name: string
          id: string
          is_auto_detected: boolean
          is_required: boolean
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          csv_header: string
          csv_upload_id: string
          field_name: string
          id?: string
          is_auto_detected?: boolean
          is_required?: boolean
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          csv_header?: string
          csv_upload_id?: string
          field_name?: string
          id?: string
          is_auto_detected?: boolean
          is_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "column_mappings_csv_upload_id_fkey"
            columns: ["csv_upload_id"]
            isOneToOne: false
            referencedRelation: "csv_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_uploads: {
        Row: {
          created_at: string
          csv_content: string | null
          detected_headers: string[]
          file_name: string
          file_size: number
          id: string
          row_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          csv_content?: string | null
          detected_headers: string[]
          file_name: string
          file_size: number
          id?: string
          row_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          csv_content?: string | null
          detected_headers?: string[]
          file_name?: string
          file_size?: number
          id?: string
          row_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      markup_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          markup_config: Json
          markup_type: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          markup_config?: Json
          markup_type?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          markup_config?: Json
          markup_type?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_card_rates: {
        Row: {
          carrier_config_id: string
          created_at: string
          id: string
          rate_amount: number
          service_code: string
          service_name: string | null
          updated_at: string
          weight_break: number
          zone: string | null
        }
        Insert: {
          carrier_config_id: string
          created_at?: string
          id?: string
          rate_amount: number
          service_code: string
          service_name?: string | null
          updated_at?: string
          weight_break: number
          zone?: string | null
        }
        Update: {
          carrier_config_id?: string
          created_at?: string
          id?: string
          rate_amount?: number
          service_code?: string
          service_name?: string | null
          updated_at?: string
          weight_break?: number
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_rates_carrier_config_id_fkey"
            columns: ["carrier_config_id"]
            isOneToOne: false
            referencedRelation: "carrier_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_quotes: {
        Row: {
          created_at: string
          currency: string
          expires_at: string | null
          has_negotiated_rates: boolean | null
          id: string
          negotiated_rate: number | null
          published_rate: number | null
          quote_date: string
          rate_type: string | null
          rates: Json
          savings_amount: number | null
          savings_percentage: number | null
          service_codes: string[]
          shipment_data: Json
          status: string
          total_cost: number | null
          ups_response: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          expires_at?: string | null
          has_negotiated_rates?: boolean | null
          id?: string
          negotiated_rate?: number | null
          published_rate?: number | null
          quote_date?: string
          rate_type?: string | null
          rates: Json
          savings_amount?: number | null
          savings_percentage?: number | null
          service_codes?: string[]
          shipment_data: Json
          status?: string
          total_cost?: number | null
          ups_response?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          expires_at?: string | null
          has_negotiated_rates?: boolean | null
          id?: string
          negotiated_rate?: number | null
          published_rate?: number | null
          quote_date?: string
          rate_type?: string | null
          rates?: Json
          savings_amount?: number | null
          savings_percentage?: number | null
          service_codes?: string[]
          shipment_data?: Json
          status?: string
          total_cost?: number | null
          ups_response?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      report_shares: {
        Row: {
          analysis_id: string
          client_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_viewed_at: string | null
          password_hash: string | null
          share_token: string
          view_count: number | null
        }
        Insert: {
          analysis_id: string
          client_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_viewed_at?: string | null
          password_hash?: string | null
          share_token: string
          view_count?: number | null
        }
        Update: {
          analysis_id?: string
          client_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_viewed_at?: string | null
          password_hash?: string | null
          share_token?: string
          view_count?: number | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          analysis_results: Json | null
          client_id: string | null
          created_at: string
          current_section: string
          deleted_at: string | null
          detected_headers: string[] | null
          header_mappings: Json | null
          id: string
          is_deleted: boolean | null
          raw_csv_data: string
          raw_csv_filename: string
          report_name: string
          sections_completed: string[] | null
          service_mappings: Json | null
          total_rows: number
          total_savings: number | null
          total_shipments: number | null
          updated_at: string
          ups_rate_quotes: Json | null
          user_id: string
        }
        Insert: {
          analysis_results?: Json | null
          client_id?: string | null
          created_at?: string
          current_section?: string
          deleted_at?: string | null
          detected_headers?: string[] | null
          header_mappings?: Json | null
          id?: string
          is_deleted?: boolean | null
          raw_csv_data: string
          raw_csv_filename: string
          report_name: string
          sections_completed?: string[] | null
          service_mappings?: Json | null
          total_rows?: number
          total_savings?: number | null
          total_shipments?: number | null
          updated_at?: string
          ups_rate_quotes?: Json | null
          user_id: string
        }
        Update: {
          analysis_results?: Json | null
          client_id?: string | null
          created_at?: string
          current_section?: string
          deleted_at?: string | null
          detected_headers?: string[] | null
          header_mappings?: Json | null
          id?: string
          is_deleted?: boolean | null
          raw_csv_data?: string
          raw_csv_filename?: string
          report_name?: string
          sections_completed?: string[] | null
          service_mappings?: Json | null
          total_rows?: number
          total_savings?: number | null
          total_shipments?: number | null
          updated_at?: string
          ups_rate_quotes?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      service_mappings: {
        Row: {
          carrier: string
          carrier_type: string | null
          confidence_score: number | null
          created_at: string
          id: string
          is_verified: boolean
          original_service: string
          standardized_service: string
        }
        Insert: {
          carrier: string
          carrier_type?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_verified?: boolean
          original_service: string
          standardized_service: string
        }
        Update: {
          carrier?: string
          carrier_type?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_verified?: boolean
          original_service?: string
          standardized_service?: string
        }
        Relationships: []
      }
      service_notes: {
        Row: {
          analysis_id: string
          created_at: string
          id: string
          notes: string | null
          service_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          id?: string
          notes?: string | null
          service_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          service_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shipment_rates: {
        Row: {
          account_name: string
          analysis_id: string
          carrier_config_id: string
          carrier_type: string
          created_at: string
          currency: string
          id: string
          is_negotiated: boolean | null
          published_rate: number | null
          rate_amount: number
          rate_response: Json | null
          service_code: string
          service_name: string | null
          shipment_data: Json
          shipment_index: number
          transit_days: number | null
          updated_at: string
        }
        Insert: {
          account_name: string
          analysis_id: string
          carrier_config_id: string
          carrier_type: string
          created_at?: string
          currency?: string
          id?: string
          is_negotiated?: boolean | null
          published_rate?: number | null
          rate_amount: number
          rate_response?: Json | null
          service_code: string
          service_name?: string | null
          shipment_data: Json
          shipment_index: number
          transit_days?: number | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          analysis_id?: string
          carrier_config_id?: string
          carrier_type?: string
          created_at?: string
          currency?: string
          id?: string
          is_negotiated?: boolean | null
          published_rate?: number | null
          rate_amount?: number
          rate_response?: Json | null
          service_code?: string
          service_name?: string | null
          shipment_data?: Json
          shipment_index?: number
          transit_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_rates_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "shipping_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_rates_carrier_config_id_fkey"
            columns: ["carrier_config_id"]
            isOneToOne: false
            referencedRelation: "carrier_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_analyses: {
        Row: {
          account_assignments: Json | null
          analysis_date: string
          base_data: Json | null
          carrier_configs_used: Json | null
          client_facing_data: Json | null
          client_id: string | null
          column_mappings: Json | null
          created_at: string
          csv_upload_id: string | null
          deleted_at: string | null
          file_name: string
          global_assignment: Json | null
          id: string
          is_deleted: boolean | null
          markup_data: Json | null
          markup_profile_id: string | null
          original_data: Json
          orphaned_shipments: Json | null
          processed_shipments: Json | null
          processing_metadata: Json | null
          recommendations: Json | null
          report_name: string | null
          report_status: string | null
          sales_rep_id: string | null
          savings_analysis: Json | null
          service_assignments: Json | null
          service_mappings: Json | null
          status: string
          total_savings: number | null
          total_shipments: number
          updated_at: string
          ups_quotes: Json | null
          user_id: string
        }
        Insert: {
          account_assignments?: Json | null
          analysis_date?: string
          base_data?: Json | null
          carrier_configs_used?: Json | null
          client_facing_data?: Json | null
          client_id?: string | null
          column_mappings?: Json | null
          created_at?: string
          csv_upload_id?: string | null
          deleted_at?: string | null
          file_name: string
          global_assignment?: Json | null
          id?: string
          is_deleted?: boolean | null
          markup_data?: Json | null
          markup_profile_id?: string | null
          original_data: Json
          orphaned_shipments?: Json | null
          processed_shipments?: Json | null
          processing_metadata?: Json | null
          recommendations?: Json | null
          report_name?: string | null
          report_status?: string | null
          sales_rep_id?: string | null
          savings_analysis?: Json | null
          service_assignments?: Json | null
          service_mappings?: Json | null
          status?: string
          total_savings?: number | null
          total_shipments?: number
          updated_at?: string
          ups_quotes?: Json | null
          user_id: string
        }
        Update: {
          account_assignments?: Json | null
          analysis_date?: string
          base_data?: Json | null
          carrier_configs_used?: Json | null
          client_facing_data?: Json | null
          client_id?: string | null
          column_mappings?: Json | null
          created_at?: string
          csv_upload_id?: string | null
          deleted_at?: string | null
          file_name?: string
          global_assignment?: Json | null
          id?: string
          is_deleted?: boolean | null
          markup_data?: Json | null
          markup_profile_id?: string | null
          original_data?: Json
          orphaned_shipments?: Json | null
          processed_shipments?: Json | null
          processing_metadata?: Json | null
          recommendations?: Json | null
          report_name?: string | null
          report_status?: string | null
          sales_rep_id?: string | null
          savings_analysis?: Json | null
          service_assignments?: Json | null
          service_mappings?: Json | null
          status?: string
          total_savings?: number | null
          total_shipments?: number
          updated_at?: string
          ups_quotes?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_analyses_csv_upload_id_fkey"
            columns: ["csv_upload_id"]
            isOneToOne: false
            referencedRelation: "csv_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      ups_configs: {
        Row: {
          account_number: string | null
          client_id: string
          client_secret: string
          created_at: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          client_id: string
          client_secret: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ups_services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_international: boolean
          service_code: string
          service_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_international?: boolean
          service_code: string
          service_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_international?: boolean
          service_code?: string
          service_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
