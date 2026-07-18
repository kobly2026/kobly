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
      access_logs: {
        Row: {
          created_at: string
          id: string
          ip_conexao: unknown
          local: string | null
          nome: string | null
          profile_id: string | null
          tipo_log: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_conexao?: unknown
          local?: string | null
          nome?: string | null
          profile_id?: string | null
          tipo_log?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_conexao?: unknown
          local?: string | null
          nome?: string | null
          profile_id?: string | null
          tipo_log?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      active_sessions: {
        Row: {
          created_at: string
          dispositivo: string | null
          id: string
          ip_conexao: unknown
          last_seen_at: string
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispositivo?: string | null
          id?: string
          ip_conexao?: unknown
          last_seen_at?: string
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispositivo?: string | null
          id?: string
          ip_conexao?: unknown
          last_seen_at?: string
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_suggestions: {
        Row: {
          campaign_stats_id: string | null
          created_at: string
          dashboard_stats_id: string | null
          escopo: string | null
          id: string
          organization_id: string | null
          sugestao: string | null
          updated_at: string
        }
        Insert: {
          campaign_stats_id?: string | null
          created_at?: string
          dashboard_stats_id?: string | null
          escopo?: string | null
          id?: string
          organization_id?: string | null
          sugestao?: string | null
          updated_at?: string
        }
        Update: {
          campaign_stats_id?: string | null
          created_at?: string
          dashboard_stats_id?: string | null
          escopo?: string | null
          id?: string
          organization_id?: string | null
          sugestao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_campaign_stats_id_fkey"
            columns: ["campaign_stats_id"]
            isOneToOne: false
            referencedRelation: "campaign_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_dashboard_stats_id_fkey"
            columns: ["dashboard_stats_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          auth_id: string
          created_at: string
          id: number
          task: string | null
        }
        Insert: {
          auth_id: string
          created_at?: string
          id?: never
          task?: string | null
        }
        Update: {
          auth_id?: string
          created_at?: string
          id?: never
          task?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          cor: string
          created_at: string
          id: string
          link_loja: string | null
          logo_url: string | null
          modo: string
          nome: string | null
          ordem: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          link_loja?: string | null
          logo_url?: string | null
          modo?: string
          nome?: string | null
          ordem?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          link_loja?: string | null
          logo_url?: string | null
          modo?: string
          nome?: string | null
          ordem?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_send_recipients: {
        Row: {
          attempts: number
          bulk_send_id: string
          created_at: string
          destino: string | null
          id: string
          last_error: string | null
          lead_id: string
          organization_id: string
          run_at: string
          sent_at: string | null
          sg_message_id: string | null
          status: string
        }
        Insert: {
          attempts?: number
          bulk_send_id: string
          created_at?: string
          destino?: string | null
          id?: string
          last_error?: string | null
          lead_id: string
          organization_id: string
          run_at?: string
          sent_at?: string | null
          sg_message_id?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          bulk_send_id?: string
          created_at?: string
          destino?: string | null
          id?: string
          last_error?: string | null
          lead_id?: string
          organization_id?: string
          run_at?: string
          sent_at?: string | null
          sg_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_send_recipients_bulk_send_id_fkey"
            columns: ["bulk_send_id"]
            isOneToOne: false
            referencedRelation: "bulk_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_send_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_send_recipients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_sends: {
        Row: {
          canal: Database["public"]["Enums"]["tipo_envio"]
          created_at: string
          created_by: string | null
          dedup_key: string | null
          email_id: string | null
          enviados: number
          falhados: number
          filtro: Json
          id: string
          organization_id: string
          pulados: number
          rate_por_min: number
          sms_message_id: string | null
          status: string
          total: number
          updated_at: string
          uso_estornado: number
          uso_reservado: number
          whatsapp_message_id: string | null
        }
        Insert: {
          canal: Database["public"]["Enums"]["tipo_envio"]
          created_at?: string
          created_by?: string | null
          dedup_key?: string | null
          email_id?: string | null
          enviados?: number
          falhados?: number
          filtro?: Json
          id?: string
          organization_id: string
          pulados?: number
          rate_por_min?: number
          sms_message_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          uso_estornado?: number
          uso_reservado?: number
          whatsapp_message_id?: string | null
        }
        Update: {
          canal?: Database["public"]["Enums"]["tipo_envio"]
          created_at?: string
          created_by?: string | null
          dedup_key?: string | null
          email_id?: string | null
          enviados?: number
          falhados?: number
          filtro?: Json
          id?: string
          organization_id?: string
          pulados?: number
          rate_por_min?: number
          sms_message_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          uso_estornado?: number
          uso_reservado?: number
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_sends_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_sends_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_sends_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_sends_sms_message_id_fkey"
            columns: ["sms_message_id"]
            isOneToOne: false
            referencedRelation: "sms_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_sends_whatsapp_message_id_fkey"
            columns: ["whatsapp_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_flows: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_flows_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_flows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_stats: {
        Row: {
          campaign_id: string | null
          created_at: string
          ctr: number
          emails_enviados: number
          gerando_sugestao: boolean
          id: string
          organization_id: string | null
          sms_enviados: number
          status_criticidade: Database["public"]["Enums"]["status_criticidade"]
          taxa_abertura: number
          ultimo_calculo: string | null
          updated_at: string
          valor_criticidade: number
          vendas_recuperadas: number
          whatsapp_enviados: number
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          ctr?: number
          emails_enviados?: number
          gerando_sugestao?: boolean
          id?: string
          organization_id?: string | null
          sms_enviados?: number
          status_criticidade?: Database["public"]["Enums"]["status_criticidade"]
          taxa_abertura?: number
          ultimo_calculo?: string | null
          updated_at?: string
          valor_criticidade?: number
          vendas_recuperadas?: number
          whatsapp_enviados?: number
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          ctr?: number
          emails_enviados?: number
          gerando_sugestao?: boolean
          id?: string
          organization_id?: string | null
          sms_enviados?: number
          status_criticidade?: Database["public"]["Enums"]["status_criticidade"]
          taxa_abertura?: number
          ultimo_calculo?: string | null
          updated_at?: string
          valor_criticidade?: number
          vendas_recuperadas?: number
          whatsapp_enviados?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brand_id: string | null
          created_at: string
          created_by: string | null
          criador_id: string | null
          id: string
          legacy_id: string | null
          nome: string
          organization_id: string
          postback_token_id: string | null
          status_campanha: Database["public"]["Enums"]["status_campanha"]
          template_id: string | null
          updated_at: string
          usa_template: boolean
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          criador_id?: string | null
          id?: string
          legacy_id?: string | null
          nome: string
          organization_id: string
          postback_token_id?: string | null
          status_campanha?: Database["public"]["Enums"]["status_campanha"]
          template_id?: string | null
          updated_at?: string
          usa_template?: boolean
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          criador_id?: string | null
          id?: string
          legacy_id?: string | null
          nome?: string
          organization_id?: string
          postback_token_id?: string | null
          status_campanha?: Database["public"]["Enums"]["status_campanha"]
          template_id?: string | null
          updated_at?: string
          usa_template?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_criador_id_fkey"
            columns: ["criador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_postback_token_id_fkey"
            columns: ["postback_token_id"]
            isOneToOne: false
            referencedRelation: "postback_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_stats: {
        Row: {
          created_at: string
          ctr_todas: number
          gerando_sugestao: boolean
          id: string
          organization_id: string | null
          profile_id: string | null
          taxa_abertura_todas: number
          total_campanhas_ativas: number
          total_contas_gerenciadas: number
          ultimo_calculo: string | null
          updated_at: string
          vendas_recuperadas_todas: number
        }
        Insert: {
          created_at?: string
          ctr_todas?: number
          gerando_sugestao?: boolean
          id?: string
          organization_id?: string | null
          profile_id?: string | null
          taxa_abertura_todas?: number
          total_campanhas_ativas?: number
          total_contas_gerenciadas?: number
          ultimo_calculo?: string | null
          updated_at?: string
          vendas_recuperadas_todas?: number
        }
        Update: {
          created_at?: string
          ctr_todas?: number
          gerando_sugestao?: boolean
          id?: string
          organization_id?: string | null
          profile_id?: string | null
          taxa_abertura_todas?: number
          total_campanhas_ativas?: number
          total_contas_gerenciadas?: number
          ultimo_calculo?: string | null
          updated_at?: string
          vendas_recuperadas_todas?: number
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_stats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_dns_records: {
        Row: {
          created_at: string
          domain_id: string
          host: string
          id: string
          record_role: string | null
          status: Database["public"]["Enums"]["dns_record_status"]
          tipo: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          created_at?: string
          domain_id: string
          host: string
          id?: string
          record_role?: string | null
          status?: Database["public"]["Enums"]["dns_record_status"]
          tipo: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          created_at?: string
          domain_id?: string
          host?: string
          id?: string
          record_role?: string | null
          status?: Database["public"]["Enums"]["dns_record_status"]
          tipo?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_dns_records_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          created_by: string | null
          from_email: string | null
          id: string
          id_resend: string | null
          id_sendgrid: string | null
          legacy_id: string | null
          organization_id: string
          status: string
          updated_at: string
          url: string
          validado: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_email?: string | null
          id?: string
          id_resend?: string | null
          id_sendgrid?: string | null
          legacy_id?: string | null
          organization_id: string
          status?: string
          updated_at?: string
          url: string
          validado?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_email?: string | null
          id?: string
          id_resend?: string | null
          id_sendgrid?: string | null
          legacy_id?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
          url?: string
          validado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "domains_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          campaign_id: string | null
          channel: string
          created_at: string
          email: string | null
          event: string | null
          id: string
          ip: unknown
          lead_metric_id: string | null
          organization_id: string | null
          reason: string | null
          response: string | null
          sg_event_id: string | null
          sg_message_id: string | null
          status: string | null
          timestamp: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel?: string
          created_at?: string
          email?: string | null
          event?: string | null
          id?: string
          ip?: unknown
          lead_metric_id?: string | null
          organization_id?: string | null
          reason?: string | null
          response?: string | null
          sg_event_id?: string | null
          sg_message_id?: string | null
          status?: string | null
          timestamp?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel?: string
          created_at?: string
          email?: string | null
          event?: string | null
          id?: string
          ip?: unknown
          lead_metric_id?: string | null
          organization_id?: string | null
          reason?: string | null
          response?: string | null
          sg_event_id?: string | null
          sg_message_id?: string | null
          status?: string | null
          timestamp?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_lead_metric_id_fkey"
            columns: ["lead_metric_id"]
            isOneToOne: false
            referencedRelation: "lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          assunto: string | null
          corpo_html: string | null
          created_at: string
          created_by: string | null
          dominio_id: string | null
          id: string
          legacy_id: string | null
          organization_id: string
          remetente: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          assunto?: string | null
          corpo_html?: string | null
          created_at?: string
          created_by?: string | null
          dominio_id?: string | null
          id?: string
          legacy_id?: string | null
          organization_id: string
          remetente?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          assunto?: string | null
          corpo_html?: string | null
          created_at?: string
          created_by?: string | null
          dominio_id?: string | null
          id?: string
          legacy_id?: string | null
          organization_id?: string
          remetente?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_dominio_id_fkey"
            columns: ["dominio_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          contexto: Json | null
          created_at: string
          id: string
          organization_id: string | null
          tipo_erro: string | null
        }
        Insert: {
          contexto?: Json | null
          created_at?: string
          id?: string
          organization_id?: string | null
          tipo_erro?: string | null
        }
        Update: {
          contexto?: Json | null
          created_at?: string
          id?: string
          organization_id?: string | null
          tipo_erro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      faq: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          ordem: number
          pergunta: string
          resposta: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          pergunta: string
          resposta: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          pergunta?: string
          resposta?: string
          updated_at?: string
        }
        Relationships: []
      }
      flow_meta_tags: {
        Row: {
          created_at: string
          flow_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          flow_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          flow_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_meta_tags_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "campaign_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_meta_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_steps: {
        Row: {
          atraso: number
          condicao: string | null
          created_at: string
          email_id: string | null
          flow_id: string
          fluxo_alvo_id: string | null
          id: string
          legacy_id: string | null
          nome: string | null
          organization_id: string | null
          parent_step_id: string | null
          posicao: number
          ramo: string | null
          sms_message_id: string | null
          tipo_card: Database["public"]["Enums"]["tipo_card_fluxo"]
          tipo_evento: Database["public"]["Enums"]["tipo_evento"] | null
          updated_at: string
          webhook_id: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          atraso?: number
          condicao?: string | null
          created_at?: string
          email_id?: string | null
          flow_id: string
          fluxo_alvo_id?: string | null
          id?: string
          legacy_id?: string | null
          nome?: string | null
          organization_id?: string | null
          parent_step_id?: string | null
          posicao?: number
          ramo?: string | null
          sms_message_id?: string | null
          tipo_card: Database["public"]["Enums"]["tipo_card_fluxo"]
          tipo_evento?: Database["public"]["Enums"]["tipo_evento"] | null
          updated_at?: string
          webhook_id?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          atraso?: number
          condicao?: string | null
          created_at?: string
          email_id?: string | null
          flow_id?: string
          fluxo_alvo_id?: string | null
          id?: string
          legacy_id?: string | null
          nome?: string | null
          organization_id?: string | null
          parent_step_id?: string | null
          posicao?: number
          ramo?: string | null
          sms_message_id?: string | null
          tipo_card?: Database["public"]["Enums"]["tipo_card_fluxo"]
          tipo_evento?: Database["public"]["Enums"]["tipo_evento"] | null
          updated_at?: string
          webhook_id?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_steps_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "campaign_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_steps_fluxo_alvo_id_fkey"
            columns: ["fluxo_alvo_id"]
            isOneToOne: false
            referencedRelation: "campaign_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_steps_parent_step_id_fkey"
            columns: ["parent_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_steps_sms_message_id_fkey"
            columns: ["sms_message_id"]
            isOneToOne: false
            referencedRelation: "sms_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_steps_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_steps_whatsapp_message_id_fkey"
            columns: ["whatsapp_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_metrics: {
        Row: {
          aberturas: number
          cliques: number
          codigo_sendgrid: string | null
          created_at: string
          enviados: number
          etapa_email_origem_id: string | null
          id: string
          lead_id: string | null
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          aberturas?: number
          cliques?: number
          codigo_sendgrid?: string | null
          created_at?: string
          enviados?: number
          etapa_email_origem_id?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          aberturas?: number
          cliques?: number
          codigo_sendgrid?: string | null
          created_at?: string
          enviados?: number
          etapa_email_origem_id?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_metrics_etapa_email_origem_id_fkey"
            columns: ["etapa_email_origem_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_metrics_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          created_at: string
          lead_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          lead_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          endereco: string | null
          id: string
          legacy_id: string | null
          link_recuperacao: string | null
          metodo_pagamento: string | null
          nome: string | null
          organization_id: string
          pix_gerado: boolean
          produto: string | null
          sobrenome: string | null
          telefone: string | null
          ultimo_evento: Database["public"]["Enums"]["tipo_evento"] | null
          updated_at: string
          valor_compra: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          legacy_id?: string | null
          link_recuperacao?: string | null
          metodo_pagamento?: string | null
          nome?: string | null
          organization_id: string
          pix_gerado?: boolean
          produto?: string | null
          sobrenome?: string | null
          telefone?: string | null
          ultimo_evento?: Database["public"]["Enums"]["tipo_evento"] | null
          updated_at?: string
          valor_compra?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          legacy_id?: string | null
          link_recuperacao?: string | null
          metodo_pagamento?: string | null
          nome?: string | null
          organization_id?: string
          pix_gerado?: boolean
          produto?: string | null
          sobrenome?: string | null
          telefone?: string | null
          ultimo_evento?: Database["public"]["Enums"]["tipo_evento"] | null
          updated_at?: string
          valor_compra?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_branding: {
        Row: {
          cor: string | null
          link_loja: string | null
          logo_url: string | null
          modo: string
          nome: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          link_loja?: string | null
          logo_url?: string | null
          modo?: string
          nome?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          link_loja?: string | null
          logo_url?: string | null
          modo?: string
          nome?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          profile_id: string
          role: Database["public"]["Enums"]["tipo_user_geral"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          profile_id: string
          role?: Database["public"]["Enums"]["tipo_user_geral"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["tipo_user_geral"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          campanhas_ativas_count: number
          created_at: string
          created_by: string | null
          criticidade: Database["public"]["Enums"]["status_criticidade"]
          id: string
          leads_count: number
          legacy_id: string | null
          nome: string
          plano_ativado_em: string | null
          plano_expira_em: string | null
          plano_id: string | null
          plano_status: string | null
          segmento: string | null
          sender_local: string | null
          updated_at: string
          user_fundador_id: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          campanhas_ativas_count?: number
          created_at?: string
          created_by?: string | null
          criticidade?: Database["public"]["Enums"]["status_criticidade"]
          id?: string
          leads_count?: number
          legacy_id?: string | null
          nome: string
          plano_ativado_em?: string | null
          plano_expira_em?: string | null
          plano_id?: string | null
          plano_status?: string | null
          segmento?: string | null
          sender_local?: string | null
          updated_at?: string
          user_fundador_id?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          campanhas_ativas_count?: number
          created_at?: string
          created_by?: string | null
          criticidade?: Database["public"]["Enums"]["status_criticidade"]
          id?: string
          leads_count?: number
          legacy_id?: string | null
          nome?: string
          plano_ativado_em?: string | null
          plano_expira_em?: string | null
          plano_id?: string | null
          plano_status?: string | null
          segmento?: string | null
          sender_local?: string | null
          updated_at?: string
          user_fundador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_user_fundador_id_fkey"
            columns: ["user_fundador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          deleted: boolean
          descricao: string | null
          id: string
          legacy_id: string | null
          limite_campanhas: number | null
          limite_execucoes: number | null
          nome: string
          status: Database["public"]["Enums"]["status_planos"]
          updated_at: string
          valor_anual: number | null
          valor_mensal: number | null
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          descricao?: string | null
          id?: string
          legacy_id?: string | null
          limite_campanhas?: number | null
          limite_execucoes?: number | null
          nome: string
          status?: Database["public"]["Enums"]["status_planos"]
          updated_at?: string
          valor_anual?: number | null
          valor_mensal?: number | null
        }
        Update: {
          created_at?: string
          deleted?: boolean
          descricao?: string | null
          id?: string
          legacy_id?: string | null
          limite_campanhas?: number | null
          limite_execucoes?: number | null
          nome?: string
          status?: Database["public"]["Enums"]["status_planos"]
          updated_at?: string
          valor_anual?: number | null
          valor_mensal?: number | null
        }
        Relationships: []
      }
      postback_tokens: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string | null
          organization_id: string
          token: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string | null
          organization_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string | null
          organization_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "postback_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_id: string | null
          celular: string | null
          created_at: string
          created_by: string | null
          curadoria: string[]
          email: string
          gestor_responsavel_id: string | null
          id: string
          imagem_perfil: string | null
          ip_conexao: unknown
          legacy_id: string | null
          local: string | null
          nome: string
          organization_id: string | null
          perfil_completo: boolean
          status_user: Database["public"]["Enums"]["status_user"]
          tipo_user_geral: Database["public"]["Enums"]["tipo_user_geral"]
          ultimo_login: string | null
          updated_at: string
          whatsapp_teste: string | null
        }
        Insert: {
          auth_id?: string | null
          celular?: string | null
          created_at?: string
          created_by?: string | null
          curadoria?: string[]
          email: string
          gestor_responsavel_id?: string | null
          id?: string
          imagem_perfil?: string | null
          ip_conexao?: unknown
          legacy_id?: string | null
          local?: string | null
          nome: string
          organization_id?: string | null
          perfil_completo?: boolean
          status_user?: Database["public"]["Enums"]["status_user"]
          tipo_user_geral?: Database["public"]["Enums"]["tipo_user_geral"]
          ultimo_login?: string | null
          updated_at?: string
          whatsapp_teste?: string | null
        }
        Update: {
          auth_id?: string | null
          celular?: string | null
          created_at?: string
          created_by?: string | null
          curadoria?: string[]
          email?: string
          gestor_responsavel_id?: string | null
          id?: string
          imagem_perfil?: string | null
          ip_conexao?: unknown
          legacy_id?: string | null
          local?: string | null
          nome?: string
          organization_id?: string | null
          perfil_completo?: boolean
          status_user?: Database["public"]["Enums"]["status_user"]
          tipo_user_geral?: Database["public"]["Enums"]["tipo_user_geral"]
          ultimo_login?: string | null
          updated_at?: string
          whatsapp_teste?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_gestor_responsavel_id_fkey"
            columns: ["gestor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_steps: {
        Row: {
          attempts: number
          created_at: string
          id: string
          id_agendamento: string | null
          last_error: string | null
          lead_id: string | null
          organization_id: string | null
          run_at: string
          status_agendamento: Database["public"]["Enums"]["status_agendamento"]
          step_id: string | null
          updated_at: string
          webhook_event_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          id_agendamento?: string | null
          last_error?: string | null
          lead_id?: string | null
          organization_id?: string | null
          run_at?: string
          status_agendamento?: Database["public"]["Enums"]["status_agendamento"]
          step_id?: string | null
          updated_at?: string
          webhook_event_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          id_agendamento?: string | null
          last_error?: string | null
          lead_id?: string | null
          organization_id?: string | null
          run_at?: string
          status_agendamento?: Database["public"]["Enums"]["status_agendamento"]
          step_id?: string | null
          updated_at?: string
          webhook_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_steps_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_steps_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_steps_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          corpo_texto: string | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          corpo_texto?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          corpo_texto?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      step_add_tags: {
        Row: {
          created_at: string
          step_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          step_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          step_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_add_tags_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_add_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      step_remove_tags: {
        Row: {
          created_at: string
          step_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          step_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          step_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_remove_tags_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_remove_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      step_trigger_tags: {
        Row: {
          created_at: string
          step_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          step_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          step_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_trigger_tags_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_trigger_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          assigned_to: string | null
          assunto: string | null
          cliente_id: string | null
          cliente_last_read_at: string | null
          created_at: string
          id: string
          legacy_id: string | null
          organization_id: string | null
          origem: string
          prioridade_chamado: Database["public"]["Enums"]["prioridade_chamado"]
          status_chamado: Database["public"]["Enums"]["status_chamado"]
          support_last_read_at: string | null
          tipo_chamado: Database["public"]["Enums"]["tipo_chamado"] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          assunto?: string | null
          cliente_id?: string | null
          cliente_last_read_at?: string | null
          created_at?: string
          id?: string
          legacy_id?: string | null
          organization_id?: string | null
          origem?: string
          prioridade_chamado?: Database["public"]["Enums"]["prioridade_chamado"]
          status_chamado?: Database["public"]["Enums"]["status_chamado"]
          support_last_read_at?: string | null
          tipo_chamado?: Database["public"]["Enums"]["tipo_chamado"] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          assunto?: string | null
          cliente_id?: string | null
          cliente_last_read_at?: string | null
          created_at?: string
          id?: string
          legacy_id?: string | null
          organization_id?: string | null
          origem?: string
          prioridade_chamado?: Database["public"]["Enums"]["prioridade_chamado"]
          status_chamado?: Database["public"]["Enums"]["status_chamado"]
          support_last_read_at?: string | null
          tipo_chamado?: Database["public"]["Enums"]["tipo_chamado"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_conversations_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          arquivos: Json
          autor: Database["public"]["Enums"]["autor_mensagem"]
          conversation_id: string
          created_at: string
          id: string
          mensagem: string | null
          nome: string | null
          profile_id: string | null
        }
        Insert: {
          arquivos?: Json
          autor: Database["public"]["Enums"]["autor_mensagem"]
          conversation_id: string
          created_at?: string
          id?: string
          mensagem?: string | null
          nome?: string | null
          profile_id?: string | null
        }
        Update: {
          arquivos?: Json
          autor?: Database["public"]["Enums"]["autor_mensagem"]
          conversation_id?: string
          created_at?: string
          id?: string
          mensagem?: string | null
          nome?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          legacy_id: string | null
          nome: string
          organization_id: string
          tipo_evento: Database["public"]["Enums"]["tipo_evento"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          legacy_id?: string | null
          nome: string
          organization_id: string
          tipo_evento?: Database["public"]["Enums"]["tipo_evento"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          legacy_id?: string | null
          nome?: string
          organization_id?: string
          tipo_evento?: Database["public"]["Enums"]["tipo_evento"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          blank: boolean
          created_at: string
          descricao: string | null
          gatilho: Database["public"]["Enums"]["tipo_evento"] | null
          icone: string | null
          id: string
          is_global: boolean
          legacy_id: string | null
          nome: string
          organization_id: string | null
          tipo_template: Database["public"]["Enums"]["tipo_template"]
          updated_at: string
        }
        Insert: {
          blank?: boolean
          created_at?: string
          descricao?: string | null
          gatilho?: Database["public"]["Enums"]["tipo_evento"] | null
          icone?: string | null
          id?: string
          is_global?: boolean
          legacy_id?: string | null
          nome: string
          organization_id?: string | null
          tipo_template: Database["public"]["Enums"]["tipo_template"]
          updated_at?: string
        }
        Update: {
          blank?: boolean
          created_at?: string
          descricao?: string | null
          gatilho?: Database["public"]["Enums"]["tipo_evento"] | null
          icone?: string | null
          id?: string
          is_global?: boolean
          legacy_id?: string | null
          nome?: string
          organization_id?: string | null
          tipo_template?: Database["public"]["Enums"]["tipo_template"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string
          created_by: string | null
          data: string | null
          forma_pagamento: string | null
          id: string
          id_transacao: string | null
          legacy_id: string | null
          organization_id: string | null
          plano_id: string | null
          profile_id: string | null
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          updated_at: string
          valor_pago: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string | null
          forma_pagamento?: string | null
          id?: string
          id_transacao?: string | null
          legacy_id?: string | null
          organization_id?: string | null
          plano_id?: string | null
          profile_id?: string | null
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          updated_at?: string
          valor_pago?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string | null
          forma_pagamento?: string | null
          id?: string
          id_transacao?: string | null
          legacy_id?: string | null
          organization_id?: string | null
          plano_id?: string | null
          profile_id?: string | null
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          updated_at?: string
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          created_at: string
          id: string
          numero_campanhas: number
          numero_execucoes: number
          organization_id: string | null
          periodo_inicio: string | null
          plano_id: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          numero_campanhas?: number
          numero_execucoes?: number
          organization_id?: string | null
          periodo_inicio?: string | null
          plano_id?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          numero_campanhas?: number
          numero_execucoes?: number
          organization_id?: string | null
          periodo_inicio?: string | null
          plano_id?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_counters_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_counters_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_event_types: {
        Row: {
          created_at: string
          tipo_evento: Database["public"]["Enums"]["tipo_evento"]
          webhook_id: string
        }
        Insert: {
          created_at?: string
          tipo_evento: Database["public"]["Enums"]["tipo_evento"]
          webhook_id: string
        }
        Update: {
          created_at?: string
          tipo_evento?: Database["public"]["Enums"]["tipo_evento"]
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_event_types_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          campaign_id: string | null
          checkout_url: string | null
          created_at: string
          email: string | null
          endereco_comprador: string | null
          id: string
          id_webhook: string | null
          lead_id: string | null
          metodo_pagamento: string | null
          nome_comprador: string | null
          organization_id: string | null
          payload: Json | null
          pix_gerado: boolean
          produto: string | null
          provider: string | null
          sobrenome_comprador: string | null
          telefone: string | null
          tipo_evento: Database["public"]["Enums"]["tipo_evento"] | null
          valor_produto: number | null
          webhook_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          checkout_url?: string | null
          created_at?: string
          email?: string | null
          endereco_comprador?: string | null
          id?: string
          id_webhook?: string | null
          lead_id?: string | null
          metodo_pagamento?: string | null
          nome_comprador?: string | null
          organization_id?: string | null
          payload?: Json | null
          pix_gerado?: boolean
          produto?: string | null
          provider?: string | null
          sobrenome_comprador?: string | null
          telefone?: string | null
          tipo_evento?: Database["public"]["Enums"]["tipo_evento"] | null
          valor_produto?: number | null
          webhook_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          checkout_url?: string | null
          created_at?: string
          email?: string | null
          endereco_comprador?: string | null
          id?: string
          id_webhook?: string | null
          lead_id?: string | null
          metodo_pagamento?: string | null
          nome_comprador?: string | null
          organization_id?: string | null
          payload?: Json | null
          pix_gerado?: boolean
          produto?: string | null
          provider?: string | null
          sobrenome_comprador?: string | null
          telefone?: string | null
          tipo_evento?: Database["public"]["Enums"]["tipo_evento"] | null
          valor_produto?: number | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          desabilitado: boolean
          descricao: string | null
          id: string
          legacy_id: string | null
          nome: string | null
          organization_id: string
          payload: string | null
          provider: string
          secret: string | null
          signing_secret: string | null
          testado: boolean
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          desabilitado?: boolean
          descricao?: string | null
          id?: string
          legacy_id?: string | null
          nome?: string | null
          organization_id: string
          payload?: string | null
          provider?: string
          secret?: string | null
          signing_secret?: string | null
          testado?: boolean
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          desabilitado?: boolean
          descricao?: string | null
          id?: string
          legacy_id?: string | null
          nome?: string | null
          organization_id?: string
          payload?: string | null
          provider?: string
          secret?: string | null
          signing_secret?: string | null
          testado?: boolean
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          botoes: Json
          corpo_texto: string | null
          created_at: string
          created_by: string | null
          id: string
          legacy_id: string | null
          media_url: string | null
          organization_id: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          botoes?: Json
          corpo_texto?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legacy_id?: string | null
          media_url?: string | null
          organization_id: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          botoes?: Json
          corpo_texto?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legacy_id?: string | null
          media_url?: string | null
          organization_id?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      asaas_activate_plan: {
        Args: {
          p_expira?: string
          p_org: string
          p_payment_id: string
          p_plano: string
          p_subscription?: string
          p_value: number
        }
        Returns: undefined
      }
      asaas_mark_overdue: { Args: { p_org: string }; Returns: undefined }
      bulk_count_audience: {
        Args: {
          p_canal: Database["public"]["Enums"]["tipo_envio"]
          p_filter: Json
          p_org: string
        }
        Returns: number
      }
      bulk_enqueue_recipients: {
        Args: { p_bulk_send_id: string; p_filter: Json }
        Returns: number
      }
      bulk_release_usage: {
        Args: { p_n: number; p_org: string }
        Returns: undefined
      }
      bulk_reserve_usage: {
        Args: { p_n: number; p_org: string }
        Returns: boolean
      }
      bulk_settle_usage: { Args: { p_bulk: string }; Returns: undefined }
      classify_criticidade: {
        Args: { enviados: number; valor: number }
        Returns: Database["public"]["Enums"]["status_criticidade"]
      }
      create_managed_org: {
        Args: { p_nome: string; p_plano_id?: string; p_segmento: string }
        Returns: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          campanhas_ativas_count: number
          created_at: string
          created_by: string | null
          criticidade: Database["public"]["Enums"]["status_criticidade"]
          id: string
          leads_count: number
          legacy_id: string | null
          nome: string
          plano_ativado_em: string | null
          plano_expira_em: string | null
          plano_id: string | null
          plano_status: string | null
          segmento: string | null
          sender_local: string | null
          updated_at: string
          user_fundador_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_own_org: {
        Args: { p_nome: string; p_segmento?: string }
        Returns: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          campanhas_ativas_count: number
          created_at: string
          created_by: string | null
          criticidade: Database["public"]["Enums"]["status_criticidade"]
          id: string
          leads_count: number
          legacy_id: string | null
          nome: string
          plano_ativado_em: string | null
          plano_expira_em: string | null
          plano_id: string | null
          plano_status: string | null
          segmento: string | null
          sender_local: string | null
          updated_at: string
          user_fundador_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_postback_token: {
        Args: { p_nome?: string; p_org_id: string }
        Returns: {
          ativo: boolean
          created_at: string
          id: string
          nome: string | null
          organization_id: string
          token: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "postback_tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_support_conversation: {
        Args: {
          p_assunto: string
          p_mensagem?: string
          p_origem?: string
          p_prioridade?: Database["public"]["Enums"]["prioridade_chamado"]
          p_tipo?: Database["public"]["Enums"]["tipo_chamado"]
          p_transcript?: Json
        }
        Returns: string
      }
      current_profile_id: { Args: never; Returns: string }
      current_role_geral: {
        Args: never
        Returns: Database["public"]["Enums"]["tipo_user_geral"]
      }
      get_secret: { Args: { p_name: string }; Returns: string }
      has_org_access: { Args: { org: string }; Returns: boolean }
      increment_vendas_recuperadas: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_gestor: { Args: never; Returns: boolean }
      is_support: { Args: never; Returns: boolean }
      kobly_slugify: { Args: { txt: string }; Returns: string }
      leads_count_by_org: {
        Args: never
        Returns: {
          organization_id: string
          total: number
        }[]
      }
      leads_page: {
        Args: {
          p_evento?: string
          p_limit?: number
          p_offset?: number
          p_org?: string
          p_search?: string
          p_stage?: string
        }
        Returns: {
          aberturas: number
          cliques: number
          created_at: string
          email: string
          enviados: number
          id: string
          metodo_pagamento: string
          nome: string
          organization_id: string
          produto: string
          sobrenome: string
          stage: string
          tag_ids: string[]
          telefone: string
          total_count: number
          ultimo_evento: string
          valor_compra: number
        }[]
      }
      my_org_ids: { Args: never; Returns: string[] }
      pipeline_counts: {
        Args: { p_org?: string }
        Returns: {
          stage: string
          total: number
          valor: number
        }[]
      }
      reset_usage_cycles: { Args: never; Returns: number }
      validate_postback_token: { Args: { p_token: string }; Returns: string }
    }
    Enums: {
      autor_mensagem: "cliente" | "suporte" | "sistema"
      dns_record_status: "pendente" | "verificado"
      metodo_https: "GET" | "POST" | "DELETE" | "PATCH"
      prioridade_chamado: "Alta" | "Média" | "Baixa"
      status_agendamento:
        | "Iniciado"
        | "Em andamento"
        | "Encerrado por Meta"
        | "Finalizado"
      status_campanha:
        | "Ativa"
        | "Pausada"
        | "Finalizada"
        | "Inativa"
        | "Pendente"
        | "Rascunho"
      status_chamado: "Em andamento" | "Resolvida"
      status_criticidade:
        | "Crítico"
        | "Mediano"
        | "Bom"
        | "Excelente"
        | "Não Iniciado"
      status_pagamento: "Pago" | "Pendente" | "Pagamento recusado"
      status_planos: "Ativo" | "Inativo"
      status_user: "Ativo" | "Desabilitado" | "Pendente"
      tipo_card_fluxo:
        | "Gatilho"
        | "Adicionar Tag"
        | "Remover Tag"
        | "Envio de e-mail"
        | "Acionar Fluxo"
        | "Envio de WhatsApp"
        | "Condição"
        | "Envio de SMS"
      tipo_chamado:
        | "Dúvidas"
        | "Integração com a Plataforma"
        | "Pagamento"
        | "Erros"
      tipo_envio: "email" | "SMS" | "Whatsapp"
      tipo_evento:
        | "Abandono de carrinho"
        | "Boleto Gerado"
        | "Compra cancelada"
        | "Depósito Solicitado"
        | "Pix Gerado"
        | "Chargeback"
        | "Cancelamento de Assinatura"
        | "Compra Reembolsada"
        | "Compra Aprovada"
        | "Compra Recusada"
      tipo_template:
        | "Criar em Branco"
        | "Vender Curso"
        | "Abandono de Carrinho"
        | "Envio de oportunidade p/ Kobly CRM"
        | "Marcar Leads eCommerce como oportunidades"
        | "Marcar Leads eCommerce como vendas"
        | "Pré-inscrição de curso"
        | "Indique e Ganhe"
        | "Pós-venda"
        | "Cupom de Desconto"
        | "Resposta automática"
        | "Nutrição de Leads"
      tipo_user_geral: "Gestor" | "Cliente" | "Suporte" | "Administrador"
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
      autor_mensagem: ["cliente", "suporte", "sistema"],
      dns_record_status: ["pendente", "verificado"],
      metodo_https: ["GET", "POST", "DELETE", "PATCH"],
      prioridade_chamado: ["Alta", "Média", "Baixa"],
      status_agendamento: [
        "Iniciado",
        "Em andamento",
        "Encerrado por Meta",
        "Finalizado",
      ],
      status_campanha: [
        "Ativa",
        "Pausada",
        "Finalizada",
        "Inativa",
        "Pendente",
        "Rascunho",
      ],
      status_chamado: ["Em andamento", "Resolvida"],
      status_criticidade: [
        "Crítico",
        "Mediano",
        "Bom",
        "Excelente",
        "Não Iniciado",
      ],
      status_pagamento: ["Pago", "Pendente", "Pagamento recusado"],
      status_planos: ["Ativo", "Inativo"],
      status_user: ["Ativo", "Desabilitado", "Pendente"],
      tipo_card_fluxo: [
        "Gatilho",
        "Adicionar Tag",
        "Remover Tag",
        "Envio de e-mail",
        "Acionar Fluxo",
        "Envio de WhatsApp",
        "Condição",
        "Envio de SMS",
      ],
      tipo_chamado: [
        "Dúvidas",
        "Integração com a Plataforma",
        "Pagamento",
        "Erros",
      ],
      tipo_envio: ["email", "SMS", "Whatsapp"],
      tipo_evento: [
        "Abandono de carrinho",
        "Boleto Gerado",
        "Compra cancelada",
        "Depósito Solicitado",
        "Pix Gerado",
        "Chargeback",
        "Cancelamento de Assinatura",
        "Compra Reembolsada",
        "Compra Aprovada",
        "Compra Recusada",
      ],
      tipo_template: [
        "Criar em Branco",
        "Vender Curso",
        "Abandono de Carrinho",
        "Envio de oportunidade p/ Kobly CRM",
        "Marcar Leads eCommerce como oportunidades",
        "Marcar Leads eCommerce como vendas",
        "Pré-inscrição de curso",
        "Indique e Ganhe",
        "Pós-venda",
        "Cupom de Desconto",
        "Resposta automática",
        "Nutrição de Leads",
      ],
      tipo_user_geral: ["Gestor", "Cliente", "Suporte", "Administrador"],
    },
  },
} as const
