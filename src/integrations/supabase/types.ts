export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          id: string
          meta: Json | null
          text: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json | null
          text: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json | null
          text?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      digital_tools: {
        Row: {
          status: string
          tool: string
          updated_at: string
          user_id: string
        }
        Insert: {
          status?: string
          tool: string
          updated_at?: string
          user_id: string
        }
        Update: {
          status?: string
          tool?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          budget: string | null
          created_at: string
          cuisine: string[] | null
          dietary_restrictions: string[] | null
          email: string | null
          extra: Json | null
          group_type: string | null
          has_international_card: boolean | null
          id: string
          interests: string[] | null
          mobility: string | null
          name: string | null
          nationality: string | null
          onboarded: boolean | null
          pace: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          budget?: string | null
          created_at?: string
          cuisine?: string[] | null
          dietary_restrictions?: string[] | null
          email?: string | null
          extra?: Json | null
          group_type?: string | null
          has_international_card?: boolean | null
          id: string
          interests?: string[] | null
          mobility?: string | null
          name?: string | null
          nationality?: string | null
          onboarded?: boolean | null
          pace?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          budget?: string | null
          created_at?: string
          cuisine?: string[] | null
          dietary_restrictions?: string[] | null
          email?: string | null
          extra?: Json | null
          group_type?: string | null
          has_international_card?: boolean | null
          id?: string
          interests?: string[] | null
          mobility?: string | null
          name?: string | null
          nationality?: string | null
          onboarded?: boolean | null
          pace?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_pois: {
        Row: {
          name: string | null
          poi_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          name?: string | null
          poi_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          name?: string | null
          poi_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          archived_at: string | null
          cities: Json
          created_at: string
          current_city_id: string | null
          id: string
          is_active: boolean
          itinerary: Json
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          cities?: Json
          created_at?: string
          current_city_id?: string | null
          id?: string
          is_active?: boolean
          itinerary?: Json
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          cities?: Json
          created_at?: string
          current_city_id?: string | null
          id?: string
          is_active?: boolean
          itinerary?: Json
          name?: string | null
          updated_at?: string
          user_id?: string
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
