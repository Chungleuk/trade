import { supabase } from '../lib/supabase';
import { TradingAlert } from '../types/alert';
import { Database } from '../lib/database.types';
import { AlertParsingService } from './alertParsingService';

type AlertRow = Database['public']['Tables']['trading_alerts']['Row'];
type AlertInsert = Database['public']['Tables']['trading_alerts']['Insert'];
type AlertUpdate = Database['public']['Tables']['trading_alerts']['Update'];

// Convert database row to TradingAlert type
const mapRowToAlert = (row: AlertRow): TradingAlert => ({
  id: row.id,
  action: row.action,
  symbol: row.symbol,
  timeframe: row.timeframe,
  entry: row.entry,
  target: row.target || undefined,
  stop: row.stop || undefined,
  rr: row.rr || undefined,
  risk: row.risk || undefined,
  timestamp: row.created_at,
  status: row.status,
  outcome: row.outcome || undefined,
  message: row.message || undefined,
  rawMessage: row.message || undefined, // Store raw message for reference
});

// Convert TradingAlert to database insert format
const mapAlertToInsert = (alert: Omit<TradingAlert, 'timestamp'>): AlertInsert => ({
  action: alert.action,
  symbol: alert.symbol,
  timeframe: alert.timeframe,
  entry: alert.entry,
  target: alert.target || null,
  stop: alert.stop || null,
  rr: alert.rr || null,
  risk: alert.risk || null,
  alert_id: alert.id, // Keep this for backward compatibility
  message: alert.rawMessage || alert.message || null,
  status: alert.status || 'active',
  outcome: alert.outcome || null,
});

export class AlertService {
  // Fetch all alerts with optional filtering
  static async getAlerts(options?: {
    limit?: number;
    offset?: number;
    symbol?: string;
    action?: 'BUY' | 'SELL';
    status?: 'active' | 'completed' | 'stopped';
  }): Promise<{ data: TradingAlert[]; error: string | null }> {
    try {
      let query = supabase
        .from('trading_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      if (options?.symbol) {
        query = query.eq('symbol', options.symbol);
      }

      if (options?.action) {
        query = query.eq('action', options.action);
      }

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching alerts:', error);
        return { data: [], error: error.message };
      }

      const alerts = data?.map(mapRowToAlert) || [];
      return { data: alerts, error: null };
    } catch (error) {
      console.error('Error in getAlerts:', error);
      return { data: [], error: 'Failed to fetch alerts' };
    }
  }

  // Create a new alert
  static async createAlert(alert: Omit<TradingAlert, 'timestamp'>): Promise<{ data: TradingAlert | null; error: string | null }> {
    try {
      const insertData = mapAlertToInsert(alert);
      
      const { data, error } = await supabase
        .from('trading_alerts')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating alert:', error);
        return { data: null, error: error.message };
      }

      const createdAlert = mapRowToAlert(data);
      return { data: createdAlert, error: null };
    } catch (error) {
      console.error('Error in createAlert:', error);
      return { data: null, error: 'Failed to create alert' };
    }
  }

  // Create alert from raw webhook data
  static async createAlertFromWebhook(rawData: any): Promise<{ data: TradingAlert | null; error: string | null }> {
    try {
      const parsedAlert = AlertParsingService.parseAlert(rawData);
      
      if (!parsedAlert) {
        return { data: null, error: 'Unable to parse alert data' };
      }

      if (!AlertParsingService.validateAlert(parsedAlert)) {
        return { data: null, error: 'Alert data is missing required fields' };
      }

      return await this.createAlert(parsedAlert);
    } catch (error) {
      console.error('Error creating alert from webhook:', error);
      return { data: null, error: 'Failed to process webhook data' };
    }
  }

  // Update an existing alert
  static async updateAlert(alertId: string, updates: Partial<AlertUpdate>): Promise<{ data: TradingAlert | null; error: string | null }> {
    try {
      console.log('=== UPDATE ALERT DEBUG ===');
      console.log('Alert ID to update:', alertId);
      console.log('Updates to apply:', updates);
      console.log('Alert ID type:', typeof alertId);
      console.log('Alert ID length:', alertId.length);
      
      // First, let's check if the alert exists
      const { data: existingAlert, error: fetchError } = await supabase
        .from('trading_alerts')
        .select('*')
        .eq('id', alertId)
        .single();

      console.log('Existing alert check:', { existingAlert, fetchError });

      if (fetchError) {
        console.error('Alert not found during existence check:', fetchError);
        return { data: null, error: `Alert not found: ${fetchError.message}` };
      }

      if (!existingAlert) {
        console.error('No alert found with ID:', alertId);
        return { data: null, error: 'Alert not found' };
      }

      // Now perform the update
      const { data, error } = await supabase
        .from('trading_alerts')
        .update(updates)
        .eq('id', alertId)
        .select()
        .single();

      console.log('Update result:', { data, error });

      if (error) {
        console.error('Error updating alert:', error);
        return { data: null, error: error.message };
      }

      if (!data) {
        console.error('Update returned no data for ID:', alertId);
        return { data: null, error: 'Update failed - no data returned' };
      }

      const updatedAlert = mapRowToAlert(data);
      console.log('Alert updated successfully:', updatedAlert);
      return { data: updatedAlert, error: null };
    } catch (error) {
      console.error('Error in updateAlert:', error);
      return { data: null, error: 'Failed to update alert' };
    }
  }

  // Delete an alert
  static async deleteAlert(alertId: string): Promise<{ error: string | null }> {
    try {
      console.log('Attempting to delete alert:', alertId);
      
      const { error } = await supabase
        .from('trading_alerts')
        .delete()
        .eq('id', alertId);

      if (error) {
        console.error('Error deleting alert:', error);
        return { error: error.message };
      }

      console.log('Alert deleted successfully:', alertId);
      return { error: null };
    } catch (error) {
      console.error('Error in deleteAlert:', error);
      return { error: 'Failed to delete alert' };
    }
  }

  // Get alert statistics
  static async getAlertStats(): Promise<{
    data: {
      total: number;
      active: number;
      completed: number;
      stopped: number;
      buyCount: number;
      sellCount: number;
    } | null;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('trading_alerts')
        .select('action, status');

      if (error) {
        console.error('Error fetching alert stats:', error);
        return { data: null, error: error.message };
      }

      const stats = {
        total: data.length,
        active: data.filter(alert => alert.status === 'active').length,
        completed: data.filter(alert => alert.status === 'completed').length,
        stopped: data.filter(alert => alert.status === 'stopped').length,
        buyCount: data.filter(alert => alert.action === 'BUY').length,
        sellCount: data.filter(alert => alert.action === 'SELL').length,
      };

      return { data: stats, error: null };
    } catch (error) {
      console.error('Error in getAlertStats:', error);
      return { data: null, error: 'Failed to fetch alert statistics' };
    }
  }

  // Subscribe to real-time alert changes
  static subscribeToAlerts(callback: (alert: TradingAlert) => void) {
    const subscription = supabase
      .channel('trading_alerts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trading_alerts',
        },
        (payload) => {
          const newAlert = mapRowToAlert(payload.new as AlertRow);
          callback(newAlert);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'trading_alerts',
        },
        (payload) => {
          console.log('Alert deleted via real-time:', payload.old);
        }
      )
      .subscribe();

    return subscription;
  }

  // Unsubscribe from real-time changes
  static unsubscribeFromAlerts(subscription: any) {
    supabase.removeChannel(subscription);
  }
}