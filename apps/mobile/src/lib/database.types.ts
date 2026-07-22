export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  private: {
    Tables: {
      calendar_feed_tokens: {
        Row: {
          created_at: string
          id: string
          revoked_at: string | null
          token_hash: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          revoked_at?: string | null
          token_hash: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: []
      }
      places_cache: {
        Row: {
          fetched_at: string
          payload: Json
          query_hash: string
        }
        Insert: {
          fetched_at?: string
          payload: Json
          query_hash: string
        }
        Update: {
          fetched_at?: string
          payload?: Json
          query_hash?: string
        }
        Relationships: []
      }
      processed_inbound_webhooks: {
        Row: {
          provider_email_id: string
          received_at: string
        }
        Insert: {
          provider_email_id: string
          received_at?: string
        }
        Update: {
          provider_email_id?: string
          received_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      trip_inbox_addresses: {
        Row: {
          auto_validate: boolean
          created_at: string
          id: string
          revoked_at: string | null
          slug_normalized: string
          trip_id: string
        }
        Insert: {
          auto_validate?: boolean
          created_at?: string
          id?: string
          revoked_at?: string | null
          slug_normalized: string
          trip_id: string
        }
        Update: {
          auto_validate?: boolean
          created_at?: string
          id?: string
          revoked_at?: string | null
          slug_normalized?: string
          trip_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      humanize_email_name: { Args: { _email: string }; Returns: string }
      is_trip_member: { Args: { _trip_id: string }; Returns: boolean }
      notify: {
        Args: {
          _actor: string
          _payload?: Json
          _recipients: string[]
          _trip_id: string
          _type: string
        }
        Returns: undefined
      }
      send_packing_reminders: { Args: never; Returns: undefined }
      shares_active_trip: { Args: { _other: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _spike_payloads: {
        Row: {
          body: Json | null
          headers: Json | null
          id: number
          received_at: string
        }
        Insert: {
          body?: Json | null
          headers?: Json | null
          id?: never
          received_at?: string
        }
        Update: {
          body?: Json | null
          headers?: Json | null
          id?: never
          received_at?: string
        }
        Relationships: []
      }
      expense_item_assignments: {
        Row: {
          id: string
          item_id: string
          member_id: string
          share: number
        }
        Insert: {
          id?: string
          item_id: string
          member_id: string
          share?: number
        }
        Update: {
          id?: string
          item_id?: string
          member_id?: string
          share?: number
        }
        Relationships: [
          {
            foreignKeyName: 'expense_item_assignments_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'expense_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expense_item_assignments_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'trip_members'
            referencedColumns: ['id']
          },
        ]
      }
      expense_items: {
        Row: {
          amount_cents: number
          created_at: string
          expense_id: string
          id: string
          label: string
          position: number
        }
        Insert: {
          amount_cents: number
          created_at?: string
          expense_id: string
          id?: string
          label: string
          position?: number
        }
        Update: {
          amount_cents?: number
          created_at?: string
          expense_id?: string
          id?: string
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: 'expense_items_expense_id_fkey'
            columns: ['expense_id']
            isOneToOne: false
            referencedRelation: 'expenses'
            referencedColumns: ['id']
          },
        ]
      }
      expense_payers: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          member_id: string
          paid_cents: number
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          member_id: string
          paid_cents: number
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          member_id?: string
          paid_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: 'expense_payers_expense_id_fkey'
            columns: ['expense_id']
            isOneToOne: false
            referencedRelation: 'expenses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expense_payers_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'trip_members'
            referencedColumns: ['id']
          },
        ]
      }
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
          subcategory: string | null
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
          subcategory?: string | null
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
          subcategory?: string | null
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
      import_proposals: {
        Row: {
          created_at: string
          events: Json | null
          expires_at: string | null
          id: string
          provider_email_id: string | null
          received_at: string | null
          rejected_at: string | null
          rejected_by: string | null
          sender_email: string | null
          source: string
          status: string
          subject: string | null
          trip_id: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          events?: Json | null
          expires_at?: string | null
          id?: string
          provider_email_id?: string | null
          received_at?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          sender_email?: string | null
          source: string
          status: string
          subject?: string | null
          trip_id: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          events?: Json | null
          expires_at?: string | null
          id?: string
          provider_email_id?: string | null
          received_at?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          sender_email?: string | null
          source?: string
          status?: string
          subject?: string | null
          trip_id?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'import_proposals_rejected_by_fkey'
            columns: ['rejected_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_proposals_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_proposals_validated_by_fkey'
            columns: ['validated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
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
      notification_preferences: {
        Row: {
          expenses_enabled: boolean
          members_enabled: boolean
          packing_enabled: boolean
          push_enabled: boolean
          settlements_enabled: boolean
          timeline_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          expenses_enabled?: boolean
          members_enabled?: boolean
          packing_enabled?: boolean
          push_enabled?: boolean
          settlements_enabled?: boolean
          timeline_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          expenses_enabled?: boolean
          members_enabled?: boolean
          packing_enabled?: boolean
          push_enabled?: boolean
          settlements_enabled?: boolean
          timeline_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_preferences_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          recipient_id: string
          trip_id: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_id: string
          trip_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_id?: string
          trip_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_recipient_id_fkey'
            columns: ['recipient_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      packing_items: {
        Row: {
          assigned_member: string | null
          category: string
          created_at: string
          expense_id: string | null
          id: string
          label: string
          owner_id: string
          packed: boolean
          quantity: number
          scope: string
          trip_id: string
        }
        Insert: {
          assigned_member?: string | null
          category: string
          created_at?: string
          expense_id?: string | null
          id?: string
          label: string
          owner_id: string
          packed?: boolean
          quantity?: number
          scope: string
          trip_id: string
        }
        Update: {
          assigned_member?: string | null
          category?: string
          created_at?: string
          expense_id?: string | null
          id?: string
          label?: string
          owner_id?: string
          packed?: boolean
          quantity?: number
          scope?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'packing_items_assigned_member_fkey'
            columns: ['assigned_member']
            isOneToOne: false
            referencedRelation: 'trip_members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'packing_items_expense_id_fkey'
            columns: ['expense_id']
            isOneToOne: false
            referencedRelation: 'expenses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'packing_items_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'packing_items_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
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
      push_tokens: {
        Row: {
          created_at: string
          locale: string | null
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          locale?: string | null
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          locale?: string | null
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      trip_events: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          end_location: Json | null
          ends_at: string | null
          gate_location: Json | null
          id: string
          lat: number | null
          lng: number | null
          location: unknown
          location_name: string | null
          notes: string | null
          participants: string[] | null
          place_id: string | null
          starts_at: string | null
          subcategory: string | null
          title: string
          trip_id: string
          type: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          end_location?: Json | null
          ends_at?: string | null
          gate_location?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          location_name?: string | null
          notes?: string | null
          participants?: string[] | null
          place_id?: string | null
          starts_at?: string | null
          subcategory?: string | null
          title: string
          trip_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          end_location?: Json | null
          ends_at?: string | null
          gate_location?: Json | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: unknown
          location_name?: string | null
          notes?: string | null
          participants?: string[] | null
          place_id?: string | null
          starts_at?: string | null
          subcategory?: string | null
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
      trip_settlements: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          from_member: string
          id: string
          paid_at: string
          status: Database['public']['Enums']['settlement_status']
          to_member: string
          trip_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          currency?: string
          from_member: string
          id?: string
          paid_at?: string
          status?: Database['public']['Enums']['settlement_status']
          to_member: string
          trip_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          from_member?: string
          id?: string
          paid_at?: string
          status?: Database['public']['Enums']['settlement_status']
          to_member?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trip_settlements_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_settlements_from_member_fkey'
            columns: ['from_member']
            isOneToOne: false
            referencedRelation: 'trip_members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_settlements_to_member_fkey'
            columns: ['to_member']
            isOneToOne: false
            referencedRelation: 'trip_members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_settlements_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      trips: {
        Row: {
          budget_level: string | null
          budget_total_cents: number | null
          cover_photo_author: string | null
          cover_photo_author_url: string | null
          cover_photo_url: string | null
          created_at: string
          currency: string
          destination: string | null
          dietary: string[]
          end_date: string | null
          id: string
          interests: string[]
          invite_code: string
          latitude: number | null
          longitude: number | null
          owner_id: string
          pace: string | null
          start_date: string | null
          title: string
          trip_type: string | null
          updated_at: string
        }
        Insert: {
          budget_level?: string | null
          budget_total_cents?: number | null
          cover_photo_author?: string | null
          cover_photo_author_url?: string | null
          cover_photo_url?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          dietary?: string[]
          end_date?: string | null
          id?: string
          interests?: string[]
          invite_code?: string
          latitude?: number | null
          longitude?: number | null
          owner_id: string
          pace?: string | null
          start_date?: string | null
          title: string
          trip_type?: string | null
          updated_at?: string
        }
        Update: {
          budget_level?: string | null
          budget_total_cents?: number | null
          cover_photo_author?: string | null
          cover_photo_author_url?: string | null
          cover_photo_url?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          dietary?: string[]
          end_date?: string | null
          id?: string
          interests?: string[]
          invite_code?: string
          latitude?: number | null
          longitude?: number | null
          owner_id?: string
          pace?: string | null
          start_date?: string | null
          title?: string
          trip_type?: string | null
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
      assign_packing_item: {
        Args: { _item_id: string; _member_id?: string }
        Returns: undefined
      }
      check_rate_limit: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      claim_inbound_webhook: {
        Args: { _provider_email_id: string }
        Returns: boolean
      }
      claim_packing_item: { Args: { _item_id: string }; Returns: undefined }
      clear_member_location: { Args: { _trip_id: string }; Returns: undefined }
      create_calendar_feed_token: {
        Args: { _trip_id: string }
        Returns: string
      }
      create_expense_with_items: {
        Args: {
          _amount_cents: number
          _assignments: Json
          _base_amount_cents: number
          _category?: string
          _currency: string
          _description: string
          _fx_rate: number
          _items: Json
          _subcategory?: string
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
          subcategory: string | null
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
      create_expense_with_splits: {
        Args: {
          _amount_cents: number
          _base_amount_cents: number
          _category?: string
          _currency: string
          _description: string
          _fx_rate: number
          _paid_by?: string
          _payers?: Json
          _splits: Json
          _subcategory?: string
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
          subcategory: string | null
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
      create_share_proposal: {
        Args: { _events: Json; _subject: string; _trip_id: string }
        Returns: string
      }
      create_trip_inbox_address: { Args: { _trip_id: string }; Returns: string }
      delete_my_account: { Args: { _user_id: string }; Returns: boolean }
      expense_packing_item: {
        Args: { _amount_cents: number; _item_id: string; _member_ids: string[] }
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
          subcategory: string | null
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
      get_my_trip_balances: {
        Args: never
        Returns: {
          balance_cents: number
          trip_id: string
        }[]
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
      get_trip_inbox_address: {
        Args: { _trip_id: string }
        Returns: {
          address: string
          auto_validate: boolean
        }[]
      }
      join_trip_by_code: { Args: { _code: string }; Returns: string }
      leave_trip: { Args: { _trip_id: string }; Returns: undefined }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: { Args: { _id: string }; Returns: undefined }
      nudge_packing_item: { Args: { _item_id: string }; Returns: undefined }
      record_settlement: {
        Args: {
          _amount_cents: number
          _from_member: string
          _to_member: string
          _trip_id: string
        }
        Returns: {
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          from_member: string
          id: string
          paid_at: string
          status: Database['public']['Enums']['settlement_status']
          to_member: string
          trip_id: string
        }
        SetofOptions: {
          from: '*'
          to: 'trip_settlements'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      regenerate_invite_code: { Args: { _trip_id: string }; Returns: string }
      register_push_token: {
        Args: { _locale?: string; _platform: string; _token: string }
        Returns: undefined
      }
      reject_import_proposal: {
        Args: { _proposal_id: string }
        Returns: undefined
      }
      remove_trip_member: { Args: { _member_id: string }; Returns: undefined }
      resolve_calendar_feed: {
        Args: { _limit?: number; _token: string; _window_seconds?: number }
        Returns: {
          rate_limited: boolean
          trip_id: string
        }[]
      }
      resolve_trip_inbox: {
        Args: { _limit?: number; _recipient: string; _window_seconds?: number }
        Returns: {
          auto_validate: boolean
          rate_limited: boolean
          trip_id: string
        }[]
      }
      reverse_settlement: {
        Args: { _id: string }
        Returns: {
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          from_member: string
          id: string
          paid_at: string
          status: Database['public']['Enums']['settlement_status']
          to_member: string
          trip_id: string
        }
        SetofOptions: {
          from: '*'
          to: 'trip_settlements'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_calendar_feed_token: {
        Args: { _trip_id: string }
        Returns: undefined
      }
      revoke_trip_inbox_address: {
        Args: { _trip_id: string }
        Returns: undefined
      }
      set_trip_inbox_autovalidate: {
        Args: { _on: boolean; _trip_id: string }
        Returns: undefined
      }
      soft_delete_expense: { Args: { _expense_id: string }; Returns: undefined }
      trip_member_names: {
        Args: { _trip_id: string }
        Returns: {
          display_name: string
          id: string
          user_id: string
        }[]
      }
      update_expense_with_splits: {
        Args: {
          _amount_cents: number
          _base_amount_cents: number
          _category?: string
          _currency: string
          _description: string
          _expense_id: string
          _fx_rate: number
          _paid_by?: string
          _payers?: Json
          _splits: Json
          _subcategory?: string
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
          subcategory: string | null
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
      upsert_expense_with_items: {
        Args: {
          _amount_cents: number
          _assignments: Json
          _base_amount_cents: number
          _category?: string
          _currency: string
          _description: string
          _expense_id: string
          _fx_rate: number
          _items: Json
          _subcategory?: string
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
          subcategory: string | null
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
      validate_import_proposal: {
        Args: { _events: Json; _proposal_id: string }
        Returns: undefined
      }
    }
    Enums: {
      member_status: 'invited' | 'active' | 'removed'
      settlement_status: 'active' | 'reversed'
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
  private: {
    Enums: {},
  },
  public: {
    Enums: {
      member_status: ['invited', 'active', 'removed'],
      settlement_status: ['active', 'reversed'],
      trip_role: ['owner', 'member'],
    },
  },
} as const
