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
      service_mappings: {
        Row: {
          carrier: string
          confidence_score: number | null
          created_at: string
          id: string
          is_verified: boolean
          original_service: string
          standardized_service: string
        }
        Insert: {
          carrier: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_verified?: boolean
          original_service: string
          standardized_service: string
        }
        Update: {
          carrier?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          is_verified?: boolean
          original_service?: string
          standardized_service?: string
        }
        Relationships: []
      }
      shipping_analyses: {
        Row: {
          analysis_date: string
          created_at: string
          file_name: string
          id: string
          original_data: Json
          recommendations: Json | null
          savings_analysis: Json | null
          status: string
          total_savings: number | null
          total_shipments: number
          updated_at: string
          ups_quotes: Json | null
          user_id: string
        }
        Insert: {
          analysis_date?: string
          created_at?: string
          file_name: string
          id?: string
          original_data: Json
          recommendations?: Json | null
          savings_analysis?: Json | null
          status?: string
          total_savings?: number | null
          total_shipments?: number
          updated_at?: string
          ups_quotes?: Json | null
          user_id: string
        }
        Update: {
          analysis_date?: string
          created_at?: string
          file_name?: string
          id?: string
          original_data?: Json
          recommendations?: Json | null
          savings_analysis?: Json | null
          status?: string
          total_savings?: number | null
          total_shipments?: number
          updated_at?: string
          ups_quotes?: Json | null
          user_id?: string
        }
        Relationships: []
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
