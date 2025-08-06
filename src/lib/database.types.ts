export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      trading_alerts: {
        Row: {
          id: string
          action: 'BUY' | 'SELL'
          symbol: string
          timeframe: string
          entry: string
          target: string | null
          stop: string | null
          rr: string | null
          risk: string | null
          alert_id: string
          message: string | null
          status: 'active' | 'completed' | 'stopped'
          outcome: 'win' | 'loss' | 'breakeven' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          action: 'BUY' | 'SELL'
          symbol: string
          timeframe: string
          entry: string
          target?: string | null
          stop?: string | null
          rr?: string | null
          risk?: string | null
          alert_id: string
          message?: string | null
          status?: 'active' | 'completed' | 'stopped'
          outcome?: 'win' | 'loss' | 'breakeven' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          action?: 'BUY' | 'SELL'
          symbol?: string
          timeframe?: string
          entry?: string
          target?: string | null
          stop?: string | null
          rr?: string | null
          risk?: string | null
          alert_id?: string
          message?: string | null
          status?: 'active' | 'completed' | 'stopped'
          outcome?: 'win' | 'loss' | 'breakeven' | null
          created_at?: string
          updated_at?: string
        }
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