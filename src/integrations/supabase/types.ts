export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Relationships: []
      }
      escala_calls_semana_itens: {
        Row: {
          call_nome: string
          created_at: string | null
          dia_semana: string
          escala_id: string
          gestor_id: string
          horario: string
          id: string
          observacao: string | null
          updated_at: string | null
        }
        Insert: {
          call_nome: string
          created_at?: string | null
          dia_semana: string
          escala_id: string
          gestor_id: string
          horario: string
          id?: string
          observacao?: string | null
          updated_at?: string | null
        }
        Update: {
          call_nome?: string
          created_at?: string | null
          dia_semana?: string
          escala_id?: string
          gestor_id?: string
          horario?: string
          id?: string
          observacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escala_calls_semana_itens_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_calls_semana_itens_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "gestores"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_final_semana_turno_gestores: {
        Row: {
          created_at: string | null
          gestor_id: string
          id: string
          turno_id: string
        }
        Insert: {
          created_at?: string | null
          gestor_id: string
          id?: string
          turno_id: string
        }
        Update: {
          created_at?: string | null
          gestor_id?: string
          id?: string
          turno_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_final_semana_turno_gestores_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "gestores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_final_semana_turno_gestores_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "escala_final_semana_turnos"
            referencedColumns: ["id"]
          }
        ]
      }
      inspection_items: {
        Row: {
          category: string
          created_at: string | null
          criterion: string
          id: string
          inspection_id: string
          observation: string | null
          quantidade: number
          status: string
        }
        Insert: {
          category: string
          created_at?: string | null
          criterion: string
          id?: string
          inspection_id: string
          observation?: string | null
          quantidade?: number
          status: string
        }
        Update: {
          category?: string
          created_at?: string | null
          criterion?: string
          id?: string
          inspection_id?: string
          observation?: string | null
          quantidade?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          }
        ]
      }
      escala_final_semana_turnos: {
        Row: {
          created_at: string | null
          dia: string
          escala_id: string
          horario: string
          id: string
          turno: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dia: string
          escala_id: string
          horario: string
          id?: string
          turno: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dia?: string
          escala_id?: string
          horario?: string
          id?: string
          turno?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escala_final_semana_turnos_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          }
        ]
      }
      escala_folgas_registros: {
        Row: {
          created_at: string | null
          data: string
          dia_semana: string
          escala_id: string
          gestor_id: string
          horario: string | null
          id: string
          observacao: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          dia_semana: string
          escala_id: string
          gestor_id: string
          horario?: string | null
          id?: string
          observacao?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          dia_semana?: string
          escala_id?: string
          gestor_id?: string
          horario?: string | null
          id?: string
          observacao?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escala_folgas_registros_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escala_folgas_registros_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "gestores"
            referencedColumns: ["id"]
          }
        ]
      }
      escala_tipos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          slug: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          slug: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      escalas: {
        Row: {
          ano_referencia: number
          created_at: string | null
          created_by: string | null
          id: string
          mes_referencia: number
          tipo_id: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ano_referencia: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          mes_referencia: number
          tipo_id: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ano_referencia?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          mes_referencia?: number
          tipo_id?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalas_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "escala_tipos"
            referencedColumns: ["id"]
          }
        ]
      }
      registros_fiscalizacao: {
        Row: {
          ano_referencia: number
          categoria: string
          created_at: string | null
          criado_por: string
          data_evento: string
          gestor_id: string
          id: string
          mes_referencia: number
          observacao: string | null
          quantidade: number
          semana_referencia: number
          tipo: string
        }
        Insert: {
          ano_referencia: number
          categoria: string
          created_at?: string | null
          criado_por: string
          data_evento: string
          gestor_id: string
          id?: string
          mes_referencia: number
          observacao?: string | null
          quantidade?: number
          semana_referencia: number
          tipo: string
        }
        Update: {
          ano_referencia?: number
          categoria?: string
          created_at?: string | null
          criado_por?: string
          data_evento?: string
          gestor_id?: string
          id?: string
          mes_referencia?: number
          observacao?: string | null
          quantidade?: number
          semana_referencia?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_fiscalizacao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_fiscalizacao_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "gestores"
            referencedColumns: ["id"]
          }
        ]
      }
      gestores: {
        Row: {
          access_telegram: boolean | null
          ativo: boolean | null
          created_at: string | null
          email: string | null
          grupos_calls: string[] | null
          id: string
          no_grupo_telegram: boolean | null
          nome: string
          username_telegram: string | null
          whatsapp: string | null
          setor: string | null
          setores: string[] | null
        }
        Insert: {
          access_telegram?: boolean | null
          ativo?: boolean | null
          created_at?: string | null
          email?: string | null
          grupos_calls?: string[] | null
          id?: string
          no_grupo_telegram?: boolean | null
          nome: string
          username_telegram?: string | null
          whatsapp?: string | null
          setor?: string | null
          setores?: string[] | null
        }
        Update: {
          access_telegram?: boolean | null
          ativo?: boolean | null
          created_at?: string | null
          email?: string | null
          grupos_calls?: string[] | null
          id?: string
          no_grupo_telegram?: boolean | null
          nome?: string
          username_telegram?: string | null
          whatsapp?: string | null
          setor?: string | null
          setores?: string[] | null
        }
        Relationships: []
      }
      inspections: {
        Row: {
          call_group: string[] | null
          cancellation_reason: string | null
          created_at: string | null
          date: string
          duration: string | null
          end_time: string | null
          evaluator_id: string
          feedback: string | null
          gestor_id: string
          id: string
          is_cancelled: boolean | null
          observation: string | null
          planned_start_time: string | null
          score: number
          semana_referencia: number | null
          mes_referencia: number | null
          ano_referencia: number | null
          type: string | null
          start_time: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          call_group?: string[] | null
          cancellation_reason?: string | null
          created_at?: string | null
          date: string
          duration?: string | null
          end_time?: string | null
          evaluator_id: string
          feedback?: string | null
          gestor_id: string
          id?: string
          is_cancelled?: boolean | null
          observation?: string | null
          planned_start_time?: string | null
          score: number
          semana_referencia?: number | null
          mes_referencia?: number | null
          ano_referencia?: number | null
          type?: string | null
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          call_group?: string[] | null
          cancellation_reason?: string | null
          created_at?: string | null
          date?: string
          duration?: string | null
          end_time?: string | null
          evaluator_id?: string
          feedback?: string | null
          gestor_id?: string
          id?: string
          is_cancelled?: boolean | null
          observation?: string | null
          planned_start_time?: string | null
          score?: number
          semana_referencia?: number | null
          mes_referencia?: number | null
          ano_referencia?: number | null
          type?: string | null
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "gestores"
            referencedColumns: ["id"]
          }
        ]
      }
      mensagens_records: {
        Row: {
          created_at: string | null
          data: string
          evaluator_id: string
          gestor_id: string
          id: string
          quantidade_mensagens: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          evaluator_id: string
          gestor_id: string
          id?: string
          quantidade_mensagens: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          evaluator_id?: string
          gestor_id?: string
          id?: string
          quantidade_mensagens?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_records_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_records_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "gestores"
            referencedColumns: ["id"]
          }
        ]
      }
      tokens_convite: {
        Row: {
          id: string
          token: string
          role_permitida: string
          ativo: boolean
          usado_em: string | null
          usado_por: string | null
          criado_em: string
          criado_por: string
        }
        Insert: {
          id?: string
          token: string
          role_permitida: string
          ativo?: boolean
          usado_em?: string | null
          usado_por?: string | null
          criado_em?: string
          criado_por: string
        }
        Update: {
          id?: string
          token?: string
          role_permitida?: string
          ativo?: boolean
          usado_em?: string | null
          usado_por?: string | null
          criado_em?: string
          criado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_convite_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_convite_usado_por_fkey"
            columns: ["usado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          access_calls: boolean
          access_dashboard: boolean
          access_rankings: boolean
          access_reports: boolean | null
          access_telegram: boolean
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          access_calls?: boolean
          access_dashboard?: boolean
          access_rankings?: boolean
          access_reports?: boolean | null
          access_telegram?: boolean
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          access_calls?: boolean
          access_dashboard?: boolean
          access_rankings?: boolean
          access_reports?: boolean | null
          access_telegram?: boolean
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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

type PublicSchema = Database["public"]

export type Tables<
  PublicTableNameOrOptions extends
  | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
    PublicSchema["Views"])
  ? (PublicSchema["Tables"] &
    PublicSchema["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
  | keyof PublicSchema["Tables"]
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
  | keyof PublicSchema["Tables"]
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
  | keyof PublicSchema["Enums"]
  | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
  ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
  ? PublicSchema["Enums"][PublicEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof PublicSchema["CompositeTypes"]
  | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
  ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never
