export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      expense_splits: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          member_id: string
          share_cents: number
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          member_id: string
          share_cents: number
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          member_id?: string
          share_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: 'expense_splits_expense_id_fkey'
            columns: ['expense_id']
            isOneToOne: false
            referencedRelation: 'expenses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expense_splits_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'trip_members'
            referencedColumns: ['id']
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number
          base_amount_cents: number
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string
          fx_rate: number
          id: string
          paid_by: string | null
          trip_id: string
          updated_at: string
          version: number
        }
        Insert: {
          amount_cents: number
          base_amount_cents: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description: string
          fx_rate?: number
          id?: string
          paid_by?: string | null
          trip_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount_cents?: number
          base_amount_cents?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          fx_rate?: number
          id?: string
          paid_by?: string | null
          trip_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_paid_by_fkey'
            columns: ['paid_by']
            isOneToOne: false
            referencedRelation: 'trip_members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      media: {
        Row: {
          created_at: string
          event_id: string | null
          height: number | null
          id: string
          kind: string
          mime_type: string | null
          name: string | null
          owner_id: string | null
          size_bytes: number | null
          storage_path: string
          trip_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          name?: string | null
          owner_id?: string | null
          size_bytes?: number | null
          storage_path: string
          trip_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          name?: string | null
          owner_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          trip_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'media_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'trip_events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      member_locations: {
        Row: {
          accuracy_m: number | null
          heading_deg: number | null
          lat: number
          lng: number
          trip_member_id: string
          updated_at: string
        }
        Insert: {
          accuracy_m?: number | null
          heading_deg?: number | null
          lat: number
          lng: number
          trip_member_id: string
          updated_at?: string
        }
        Update: {
          accuracy_m?: number | null
          heading_deg?: number | null
          lat?: number
          lng?: number
          trip_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'member_locations_trip_member_id_fkey'
            columns: ['trip_member_id']
            isOneToOne: true
            referencedRelation: 'trip_members'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          preferred_currency: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          preferred_currency?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      trip_events: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          gate_location: Json | null
          id: string
          lat: number | null
          lng: number | null
          location: unknown
          notes: string | null
          starts_at: string | null
          title: string
          trip_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          gate_location?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          notes?: string | null
          starts_at?: string | null
          title: string
          trip_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          gate_location?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          notes?: string | null
          starts_at?: string | null
          title?: string
          trip_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trip_events_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_events_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      trip_members: {
        Row: {
          id: string
          joined_at: string
          role: Database['public']['Enums']['trip_role']
          status: Database['public']['Enums']['member_status']
          trip_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database['public']['Enums']['trip_role']
          status?: Database['public']['Enums']['member_status']
          trip_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database['public']['Enums']['trip_role']
          status?: Database['public']['Enums']['member_status']
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trip_members_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      trip_pois: {
        Row: {
          created_at: string
          created_by: string | null
          icon: string
          id: string
          label: string
          lat: number
          lng: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          label: string
          lat: number
          lng: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          label?: string
          lat?: number
          lng?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trip_pois_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_pois_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          currency: string
          destination: string | null
          end_date: string | null
          id: string
          invite_code: string
          owner_id: string
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          destination?: string | null
          end_date?: string | null
          id?: string
          invite_code?: string
          owner_id: string
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          destination?: string | null
          end_date?: string | null
          id?: string
          invite_code?: string
          owner_id?: string
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trips_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_member_location: { Args: { _trip_id: string }; Returns: undefined }
      create_expense_with_splits: {
        Args: {
          _amount_cents: number
          _base_amount_cents: number
          _category?: string
          _currency: string
          _description: string
          _fx_rate: number
          _splits: Json
          _trip_id: string
        }
        Returns: {
          amount_cents: number
          base_amount_cents: number
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string
          fx_rate: number
          id: string
          paid_by: string | null
          trip_id: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: '*'
          to: 'expenses'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_trip_balances: {
        Args: { _trip_id: string }
        Returns: {
          balance_cents: number
          member_id: string
          owed_cents: number
          paid_cents: number
          user_id: string
        }[]
      }
      join_trip_by_code: { Args: { _code: string }; Returns: string }
      leave_trip: { Args: { _trip_id: string }; Returns: undefined }
      regenerate_invite_code: { Args: { _trip_id: string }; Returns: string }
      remove_trip_member: { Args: { _member_id: string }; Returns: undefined }
      update_expense_with_splits: {
        Args: {
          _amount_cents: number
          _base_amount_cents: number
          _category?: string
          _currency: string
          _description: string
          _expense_id: string
          _fx_rate: number
          _splits: Json
        }
        Returns: {
          amount_cents: number
          base_amount_cents: number
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string
          fx_rate: number
          id: string
          paid_by: string | null
          trip_id: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: '*'
          to: 'expenses'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_member_location: {
        Args: {
          _accuracy_m?: number
          _heading_deg?: number
          _lat: number
          _lng: number
          _trip_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      member_status: 'invited' | 'active' | 'removed'
      trip_role: 'owner' | 'member'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      member_status: ['invited', 'active', 'removed'],
      trip_role: ['owner', 'member'],
    },
  },
} as const
