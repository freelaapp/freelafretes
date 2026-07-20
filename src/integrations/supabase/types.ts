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
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_freight_cancellations: {
        Row: {
          admin_id: string
          created_at: string
          freight_id: string
          id: string
          reason: string
          refund_amount_cents: number
          refund_type: Database["public"]["Enums"]["refund_type"]
        }
        Insert: {
          admin_id: string
          created_at?: string
          freight_id: string
          id?: string
          reason: string
          refund_amount_cents?: number
          refund_type?: Database["public"]["Enums"]["refund_type"]
        }
        Update: {
          admin_id?: string
          created_at?: string
          freight_id?: string
          id?: string
          reason?: string
          refund_amount_cents?: number
          refund_type?: Database["public"]["Enums"]["refund_type"]
        }
        Relationships: [
          {
            foreignKeyName: "admin_freight_cancellations_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_freight_cancellations_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_freight_cancellations_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights_public"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      antt_floor_rates: {
        Row: {
          cargo_category: string
          created_at: string
          id: string
          load_unload_cents: number
          notes: string | null
          rate_per_km_cents: number
          valid_from: string
          valid_to: string | null
          vehicle_axles: number
        }
        Insert: {
          cargo_category: string
          created_at?: string
          id?: string
          load_unload_cents?: number
          notes?: string | null
          rate_per_km_cents: number
          valid_from?: string
          valid_to?: string | null
          vehicle_axles: number
        }
        Update: {
          cargo_category?: string
          created_at?: string
          id?: string
          load_unload_cents?: number
          notes?: string | null
          rate_per_km_cents?: number
          valid_from?: string
          valid_to?: string | null
          vehicle_axles?: number
        }
        Relationships: []
      }
      br_cities: {
        Row: {
          city: string
          city_normalized: string
          created_at: string
          id: string
          lat: number
          lng: number
          uf: string
        }
        Insert: {
          city: string
          city_normalized: string
          created_at?: string
          id?: string
          lat: number
          lng: number
          uf: string
        }
        Update: {
          city?: string
          city_normalized?: string
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          uf?: string
        }
        Relationships: []
      }
      candidacies: {
        Row: {
          created_at: string
          freight_id: string
          id: string
          message: string | null
          proposed_amount_in_cents: number | null
          provider_id: string
          status: Database["public"]["Enums"]["candidacy_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          freight_id: string
          id?: string
          message?: string | null
          proposed_amount_in_cents?: number | null
          provider_id: string
          status?: Database["public"]["Enums"]["candidacy_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          freight_id?: string
          id?: string
          message?: string | null
          proposed_amount_in_cents?: number | null
          provider_id?: string
          status?: Database["public"]["Enums"]["candidacy_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidacies_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidacies_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: false
            referencedRelation: "freights_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidacies_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidacies_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_profile: {
        Row: {
          certificado_apelido: string | null
          cnpj: string
          created_at: string
          endereco: Json
          id: string
          ie: string | null
          razao_social: string
          rntrc: string | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          certificado_apelido?: string | null
          cnpj: string
          created_at?: string
          endereco?: Json
          id?: string
          ie?: string | null
          razao_social: string
          rntrc?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          certificado_apelido?: string | null
          cnpj?: string
          created_at?: string
          endereco?: Json
          id?: string
          ie?: string | null
          razao_social?: string
          rntrc?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          checked_in_at: string | null
          code: string
          created_at: string
          id: string
          job_id: string
          validated_at: string | null
        }
        Insert: {
          checked_in_at?: string | null
          code: string
          created_at?: string
          id?: string
          job_id: string
          validated_at?: string | null
        }
        Update: {
          checked_in_at?: string | null
          code?: string
          created_at?: string
          id?: string
          job_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      check_outs: {
        Row: {
          checked_out_at: string | null
          code: string
          created_at: string
          id: string
          job_id: string
          validated_at: string | null
        }
        Insert: {
          checked_out_at?: string | null
          code: string
          created_at?: string
          id?: string
          job_id: string
          validated_at?: string | null
        }
        Update: {
          checked_out_at?: string | null
          code?: string
          created_at?: string
          id?: string
          job_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_outs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_acceptances: {
        Row: {
          accepted_at: string
          contract_type: string
          id: string
          ip: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          contract_type: string
          id?: string
          ip?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          contract_type?: string
          id?: string
          ip?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      contractors: {
        Row: {
          city: string | null
          cnpj: string
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone: string
          corporate_reason: string
          cpf: string
          created_at: string
          id: string
          is_active: boolean
          is_company_partner: boolean
          monthly_freight_volume: string
          segment: string
          uf: string | null
          updated_at: string
          user_id: string
          validated_at: string | null
          validation_notes: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        Insert: {
          city?: string | null
          cnpj: string
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone: string
          corporate_reason: string
          cpf: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_company_partner?: boolean
          monthly_freight_volume: string
          segment: string
          uf?: string | null
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validation_notes?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Update: {
          city?: string | null
          cnpj?: string
          company_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          corporate_reason?: string
          cpf?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_company_partner?: boolean
          monthly_freight_volume?: string
          segment?: string
          uf?: string | null
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validation_notes?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Relationships: []
      }
      driver_payouts: {
        Row: {
          created_at: string
          gross_cents: number
          id: string
          inss_cents: number
          job_id: string
          net_cents: number
          paid_at: string | null
          provider_id: string
          sest_senat_cents: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gross_cents: number
          id?: string
          inss_cents?: number
          job_id: string
          net_cents: number
          paid_at?: string | null
          provider_id: string
          sest_senat_cents?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gross_cents?: number
          id?: string
          inss_cents?: number
          job_id?: string
          net_cents?: number
          paid_at?: string | null
          provider_id?: string
          sest_senat_cents?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          author_id: string
          comment: string | null
          created_at: string
          hidden: boolean
          hidden_reason: string | null
          id: string
          job_id: string
          rating: number
          role: Database["public"]["Enums"]["feedback_role"]
        }
        Insert: {
          author_id: string
          comment?: string | null
          created_at?: string
          hidden?: boolean
          hidden_reason?: string | null
          id?: string
          job_id: string
          rating: number
          role: Database["public"]["Enums"]["feedback_role"]
        }
        Update: {
          author_id?: string
          comment?: string | null
          created_at?: string
          hidden?: boolean
          hidden_reason?: string | null
          id?: string
          job_id?: string
          rating?: number
          role?: Database["public"]["Enums"]["feedback_role"]
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_documents: {
        Row: {
          access_key: string | null
          created_at: string
          doc_number: string | null
          doc_type: string
          event_type: string | null
          id: string
          issued_at: string | null
          job_id: string
          parent_doc_id: string | null
          payload: Json
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          access_key?: string | null
          created_at?: string
          doc_number?: string | null
          doc_type: string
          event_type?: string | null
          id?: string
          issued_at?: string | null
          job_id: string
          parent_doc_id?: string | null
          payload?: Json
          provider?: string
          status?: string
          updated_at?: string
        }
        Update: {
          access_key?: string | null
          created_at?: string
          doc_number?: string | null
          doc_type?: string
          event_type?: string | null
          id?: string
          issued_at?: string | null
          job_id?: string
          parent_doc_id?: string | null
          payload?: Json
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_documents_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_documents_parent_doc_id_fkey"
            columns: ["parent_doc_id"]
            isOneToOne: false
            referencedRelation: "freight_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      freights: {
        Row: {
          agreed_amount_in_cents: number | null
          base_amount_in_cents: number
          body_types: string[]
          cargo_type: string
          cargo_volume_m3: number | null
          cargo_weight_kg: number
          contractor_id: string
          created_at: string
          delivery_expected_at: string | null
          description: string | null
          destination_address: string | null
          destination_cep: string | null
          destination_city: string
          destination_lat: number | null
          destination_lng: number | null
          destination_uf: string
          distance_km: number
          driver_payout_cents: number | null
          freight_mode: string
          freight_value_cents: number | null
          id: string
          mode_override: boolean
          mode_suggested: string | null
          nfe_key: string | null
          nfe_summary: Json | null
          origin_address: string | null
          origin_cep: string | null
          origin_city: string
          origin_lat: number | null
          origin_lng: number | null
          origin_uf: string
          payment: number
          pickup_at: string
          platform_margin_cents: number | null
          pricing_breakdown: Json | null
          pricing_factors: Json | null
          status: Database["public"]["Enums"]["freight_status"]
          suggested_amount_in_cents: number | null
          title: string
          toll_included: boolean
          updated_at: string
          vehicle_types: string[]
        }
        Insert: {
          agreed_amount_in_cents?: number | null
          base_amount_in_cents: number
          body_types?: string[]
          cargo_type: string
          cargo_volume_m3?: number | null
          cargo_weight_kg: number
          contractor_id: string
          created_at?: string
          delivery_expected_at?: string | null
          description?: string | null
          destination_address?: string | null
          destination_cep?: string | null
          destination_city: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_uf: string
          distance_km: number
          driver_payout_cents?: number | null
          freight_mode?: string
          freight_value_cents?: number | null
          id?: string
          mode_override?: boolean
          mode_suggested?: string | null
          nfe_key?: string | null
          nfe_summary?: Json | null
          origin_address?: string | null
          origin_cep?: string | null
          origin_city: string
          origin_lat?: number | null
          origin_lng?: number | null
          origin_uf: string
          payment: number
          pickup_at: string
          platform_margin_cents?: number | null
          pricing_breakdown?: Json | null
          pricing_factors?: Json | null
          status?: Database["public"]["Enums"]["freight_status"]
          suggested_amount_in_cents?: number | null
          title: string
          toll_included?: boolean
          updated_at?: string
          vehicle_types?: string[]
        }
        Update: {
          agreed_amount_in_cents?: number | null
          base_amount_in_cents?: number
          body_types?: string[]
          cargo_type?: string
          cargo_volume_m3?: number | null
          cargo_weight_kg?: number
          contractor_id?: string
          created_at?: string
          delivery_expected_at?: string | null
          description?: string | null
          destination_address?: string | null
          destination_cep?: string | null
          destination_city?: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_uf?: string
          distance_km?: number
          driver_payout_cents?: number | null
          freight_mode?: string
          freight_value_cents?: number | null
          id?: string
          mode_override?: boolean
          mode_suggested?: string | null
          nfe_key?: string | null
          nfe_summary?: Json | null
          origin_address?: string | null
          origin_cep?: string | null
          origin_city?: string
          origin_lat?: number | null
          origin_lng?: number | null
          origin_uf?: string
          payment?: number
          pickup_at?: string
          platform_margin_cents?: number | null
          pricing_breakdown?: Json | null
          pricing_factors?: Json | null
          status?: Database["public"]["Enums"]["freight_status"]
          suggested_amount_in_cents?: number | null
          title?: string
          toll_included?: boolean
          updated_at?: string
          vehicle_types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "freights_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          icms_cents: number
          id: string
          issued_at: string
          job_id: string
          pdf_ready: boolean
          shipper_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          icms_cents?: number
          id?: string
          issued_at?: string
          job_id: string
          pdf_ready?: boolean
          shipper_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          icms_cents?: number
          id?: string
          issued_at?: string
          job_id?: string
          pdf_ready?: boolean
          shipper_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          ack_notes: string | null
          agreed_amount_in_cents: number
          contractor_id: string
          created_at: string
          dispute_notes: string | null
          disputed: boolean
          driver_ack_at: string | null
          ended_at: string | null
          force_completed_by: string | null
          force_completed_reason: string | null
          freight_id: string
          id: string
          provider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          ack_notes?: string | null
          agreed_amount_in_cents: number
          contractor_id: string
          created_at?: string
          dispute_notes?: string | null
          disputed?: boolean
          driver_ack_at?: string | null
          ended_at?: string | null
          force_completed_by?: string | null
          force_completed_reason?: string | null
          freight_id: string
          id?: string
          provider_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          ack_notes?: string | null
          agreed_amount_in_cents?: number
          contractor_id?: string
          created_at?: string
          dispute_notes?: string | null
          disputed?: boolean
          driver_ack_at?: string | null
          ended_at?: string | null
          force_completed_by?: string | null
          force_completed_reason?: string | null
          freight_id?: string
          id?: string
          provider_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: true
            referencedRelation: "freights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_freight_id_fkey"
            columns: ["freight_id"]
            isOneToOne: true
            referencedRelation: "freights_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_in_cents: number
          created_at: string
          held_at: string | null
          id: string
          job_id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string | null
          refund_reason: string | null
          refunded_at: string | null
          released_at: string | null
          service_fee_in_cents: number
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_in_cents: number
          created_at?: string
          held_at?: string | null
          id?: string
          job_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          released_at?: string | null
          service_fee_in_cents: number
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_in_cents?: number
          created_at?: string
          held_at?: string | null
          id?: string
          job_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          released_at?: string | null
          service_fee_in_cents?: number
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          carrier_margin_percent: number
          created_at: string
          id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          carrier_margin_percent?: number
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          carrier_margin_percent?: number
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      pricing_cargo_factors: {
        Row: {
          cargo_type: string
          factor: number
          updated_at: string
        }
        Insert: {
          cargo_type: string
          factor: number
          updated_at?: string
        }
        Update: {
          cargo_type?: string
          factor?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          id: number
          settings: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          settings: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pricing_settings_history: {
        Row: {
          after: Json | null
          before: Json | null
          changed_at: string
          changed_by: string | null
          entity: string
          entity_key: string | null
          id: string
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          entity: string
          entity_key?: string | null
          id?: string
        }
        Update: {
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          entity?: string
          entity_key?: string | null
          id?: string
        }
        Relationships: []
      }
      pricing_vehicle_costs: {
        Row: {
          axles: number | null
          capacidade_kg: number
          capacidade_m3: number | null
          ckm_cents_por_km: number
          frete_minimo_cents: number
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          axles?: number | null
          capacidade_kg: number
          capacidade_m3?: number | null
          ckm_cents_por_km: number
          frete_minimo_cents: number
          updated_at?: string
          vehicle_type: string
        }
        Update: {
          axles?: number | null
          capacidade_kg?: number
          capacidade_m3?: number | null
          ckm_cents_por_km?: number
          frete_minimo_cents?: number
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          address_proof_url: string | null
          avatar_url: string | null
          ban_reason: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_code: string | null
          base_lat: number | null
          base_lng: number | null
          birthdate: string
          city: string
          cnh_back_url: string | null
          cnh_category: string
          cnh_document_url: string | null
          cnh_expires_at: string
          cnh_number: string
          cpf: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_banned: boolean
          phone: string
          pix_key: string | null
          pix_key_type: string | null
          search_radius_km: number
          selfie_url: string | null
          uf: string
          updated_at: string
          user_id: string
          validated_at: string | null
          validation_notes: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        Insert: {
          address_proof_url?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          base_lat?: number | null
          base_lng?: number | null
          birthdate: string
          city: string
          cnh_back_url?: string | null
          cnh_category: string
          cnh_document_url?: string | null
          cnh_expires_at: string
          cnh_number: string
          cpf: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          is_banned?: boolean
          phone: string
          pix_key?: string | null
          pix_key_type?: string | null
          search_radius_km?: number
          selfie_url?: string | null
          uf: string
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validation_notes?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Update: {
          address_proof_url?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_code?: string | null
          base_lat?: number | null
          base_lng?: number | null
          birthdate?: string
          city?: string
          cnh_back_url?: string | null
          cnh_category?: string
          cnh_document_url?: string | null
          cnh_expires_at?: string
          cnh_number?: string
          cpf?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_banned?: boolean
          phone?: string
          pix_key?: string | null
          pix_key_type?: string | null
          search_radius_km?: number
          selfie_url?: string | null
          uf?: string
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validation_notes?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Relationships: []
      }
      trip_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          incident_kind: string | null
          job_id: string
          notes: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          incident_kind?: string | null
          job_id: string
          notes?: string | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          incident_kind?: string | null
          job_id?: string
          notes?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          body_type: string
          capacity_kg: number
          created_at: string
          id: string
          is_active: boolean
          plate: string
          provider_id: string
          vehicle_type: string
        }
        Insert: {
          body_type: string
          capacity_kg: number
          created_at?: string
          id?: string
          is_active?: boolean
          plate: string
          provider_id: string
          vehicle_type: string
        }
        Update: {
          body_type?: string
          capacity_kg?: number
          created_at?: string
          id?: string
          is_active?: boolean
          plate?: string
          provider_id?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      freights_public: {
        Row: {
          body_types: string[] | null
          cargo_type: string | null
          cargo_volume_m3: number | null
          cargo_weight_kg: number | null
          created_at: string | null
          delivery_expected_at: string | null
          destination_city: string | null
          destination_uf: string | null
          distance_km: number | null
          freight_mode: string | null
          id: string | null
          origin_city: string | null
          origin_uf: string | null
          pickup_at: string | null
          status: Database["public"]["Enums"]["freight_status"] | null
          title: string | null
          vehicle_types: string[] | null
        }
        Insert: {
          body_types?: string[] | null
          cargo_type?: string | null
          cargo_volume_m3?: number | null
          cargo_weight_kg?: number | null
          created_at?: string | null
          delivery_expected_at?: string | null
          destination_city?: string | null
          destination_uf?: string | null
          distance_km?: number | null
          freight_mode?: string | null
          id?: string | null
          origin_city?: string | null
          origin_uf?: string | null
          pickup_at?: string | null
          status?: Database["public"]["Enums"]["freight_status"] | null
          title?: string | null
          vehicle_types?: string[] | null
        }
        Update: {
          body_types?: string[] | null
          cargo_type?: string | null
          cargo_volume_m3?: number | null
          cargo_weight_kg?: number | null
          created_at?: string | null
          delivery_expected_at?: string | null
          destination_city?: string | null
          destination_uf?: string | null
          distance_km?: number | null
          freight_mode?: string | null
          id?: string | null
          origin_city?: string | null
          origin_uf?: string | null
          pickup_at?: string | null
          status?: Database["public"]["Enums"]["freight_status"] | null
          title?: string | null
          vehicle_types?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      normalize_city_name: { Args: { t: string }; Returns: string }
    }
    Enums: {
      admin_role: "ADMIN" | "SUPER_ADMIN"
      candidacy_status:
        | "PENDING"
        | "ACCEPTED"
        | "REJECTED"
        | "CANCELLED_BY_CONTRACTOR"
        | "WITHDRAWN"
      feedback_role: "PROVIDER" | "CONTRACTOR"
      freight_status:
        | "OPEN"
        | "CLOSED"
        | "CANCELLED"
        | "CANCELLED_BY_CONTRACTOR"
      job_status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
      payment_method: "PIX"
      payment_status: "PENDING" | "COMPLETED" | "REFUNDED" | "RELEASED" | "HELD"
      refund_type: "FULL" | "PARTIAL" | "NONE"
      user_role: "contractor" | "provider"
      validation_status: "PENDING_VALIDATION" | "APPROVED" | "REJECTED"
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
    Enums: {
      admin_role: ["ADMIN", "SUPER_ADMIN"],
      candidacy_status: [
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "CANCELLED_BY_CONTRACTOR",
        "WITHDRAWN",
      ],
      feedback_role: ["PROVIDER", "CONTRACTOR"],
      freight_status: [
        "OPEN",
        "CLOSED",
        "CANCELLED",
        "CANCELLED_BY_CONTRACTOR",
      ],
      job_status: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      payment_method: ["PIX"],
      payment_status: ["PENDING", "COMPLETED", "REFUNDED", "RELEASED", "HELD"],
      refund_type: ["FULL", "PARTIAL", "NONE"],
      user_role: ["contractor", "provider"],
      validation_status: ["PENDING_VALIDATION", "APPROVED", "REJECTED"],
    },
  },
} as const
