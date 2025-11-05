import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export class SupabaseService {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.warn('Supabase credentials not configured, using fallback');
      this.client = null;
      return;
    }

    this.client = createClient(supabaseUrl, supabaseKey);
    logger.info('Supabase client initialized');
  }

  /**
   * Save alert to Supabase
   */
  async saveAlert(alertData) {
    if (!this.client) {
      logger.warn('Supabase not available, skipping alert save');
      return null;
    }

    try {
      const { data, error } = await this.client
        .from('trading_alerts')
        .insert({
          action: alertData.action,
          symbol: alertData.symbol,
          entry: alertData.entry,
          target: alertData.target,
          stop: alertData.stop,
          timeframe: alertData.timeframe || '15',
          risk: alertData.risk,
          rr: alertData.rr,
          raw_message: alertData.rawMessage || JSON.stringify(alertData),
          source: 'tradingview',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('✅ Alert saved to Supabase', { id: data.id });
      return data;
    } catch (error) {
      logger.error('❌ Failed to save alert to Supabase:', error);
      throw error;
    }
  }


  /**
   * Check if Supabase is available
   */
  isAvailable() {
    return this.client !== null;
  }
}

