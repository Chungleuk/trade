import { supabase } from '../lib/supabase';
import { TradingAlert } from '../types/alert';
import { Database } from '../lib/database.types';
import { AlertParsingService } from './alertParsingService';
import { getPositionSizingMode, resolveSizingGroupKey } from '../lib/positionSizingMode';
import { getCurrentNode, getGroupKeyForSymbol, getRiskPercentForNode, syncPositionSizingStateFromAlerts } from './positionSizingService';

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
  aiAnalysis: row.ai_analysis || undefined,
  analysisPerformed: row.analysis_performed || false,
  analysisTimestamp: row.analysis_timestamp || undefined,
});

// Convert TradingAlert to database insert format
const mapAlertToInsert = (alert: Omit<TradingAlert, 'timestamp'>): AlertInsert => ({
  action: alert.action,
  symbol: alert.symbol,
  timeframe: alert.timeframe,
  entry: alert.entry ?? '',
  target: alert.target || null,
  stop: alert.stop || null,
  rr: alert.rr || null,
  risk: alert.risk || null,
  alert_id: alert.id, // Keep this for backward compatibility
  /** Prefer user-facing message (e.g. “Manual signal”) over raw paste / JSON. */
  message: alert.message || alert.rawMessage || null,
  status: alert.status || 'active',
  outcome: alert.outcome || null,
  ...(alert.createdAt ? { created_at: alert.createdAt } : {}),
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
      // Group key: GLOBAL (default) or per-symbol — see dashboard “Risk ladder” toggle
      let riskPercent = '0.65';
      try {
        const groupKey = resolveSizingGroupKey(alert.symbol, getPositionSizingMode());
        const node = await getCurrentNode(groupKey);
        riskPercent = getRiskPercentForNode(node).toFixed(2);
      } catch {
        console.warn('Failed to read position sizing state, using default 0.65%');
      }

      const insertData = mapAlertToInsert({ ...alert, risk: riskPercent, outcome: undefined });
      
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
      const { data: existingAlerts, error: fetchError } = await supabase
        .from('trading_alerts')
        .select('*')
        .eq('id', alertId);

      console.log('Existing alert check:', { existingAlerts, fetchError });

      if (fetchError) {
        console.error('Alert not found during existence check:', fetchError);
        return { data: null, error: `Alert not found: ${fetchError.message}` };
      }

      if (!existingAlerts || existingAlerts.length === 0) {
        console.error('No alert found with ID:', alertId);
        return { data: null, error: 'Alert not found' };
      }

      if (existingAlerts.length > 1) {
        console.error('Multiple alerts found with same ID:', alertId);
        return { data: null, error: 'Multiple alerts found with same ID' };
      }

      // Prefer RPC for controlled updates if only status/outcome are being changed
      const onlyStatus = Object.keys(updates).length === 1 && 'status' in updates;
      const onlyOutcome = Object.keys(updates).length === 1 && 'outcome' in updates;
      const statusAndOrOutcome =
        (onlyStatus || onlyOutcome) ||
        (Object.keys(updates).length === 2 && 'status' in updates && 'outcome' in updates);

      if (statusAndOrOutcome) {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('update_trading_alert_status', {
            p_id: alertId,
            p_status: (updates as any).status ?? null,
            p_outcome: (updates as any).outcome ?? null,
          });

        if (rpcError) {
          console.error('RPC update error:', rpcError);
        } else if (rpcData && Array.isArray(rpcData) && rpcData.length === 1) {
          const updatedAlert = mapRowToAlert(rpcData[0] as AlertRow);
          console.log('Alert updated successfully via RPC:', updatedAlert);
          return { data: updatedAlert, error: null };
        }
        // If RPC failed or returned nothing, fall through to standard UPDATE
      }

      // Fallback: standard UPDATE; some PostgREST setups may not return a row on UPDATE
      const { data: updateRows, error } = await supabase
        .from('trading_alerts')
        .update(updates)
        .eq('id', alertId)
        .select();

      console.log('Update result:', { updateRows, error });

      if (error) {
        console.error('Error updating alert:', error);
        return { data: null, error: error.message };
      }

      // If exactly one row returned, verify updated fields and return it
      if (Array.isArray(updateRows) && updateRows.length === 1) {
        const row = updateRows[0] as AlertRow;
        // Verify that requested fields were applied
        const expectedStatus = (updates as Partial<AlertRow>).status;
        const expectedOutcome = (updates as Partial<AlertRow>).outcome;
        const statusOk = expectedStatus ? row.status === expectedStatus : true;
        const outcomeOk = expectedOutcome ? row.outcome === expectedOutcome : true;

        if (!statusOk || !outcomeOk) {
          console.error('Update did not apply as expected. Row:', row, 'Expected:', {
            status: expectedStatus,
            outcome: expectedOutcome,
          });
          return { data: null, error: 'Update did not apply (permission or constraint issue)' };
        }

        const updatedAlert = mapRowToAlert(row);
        console.log('Alert updated successfully:', updatedAlert);
        return { data: updatedAlert, error: null };
      }

      // Fallback: fetch the row after update if none returned
      const { data: fetchedRow, error: fetchUpdatedError } = await supabase
        .from('trading_alerts')
        .select('*')
        .eq('id', alertId)
        .maybeSingle();

      if (fetchUpdatedError) {
        console.error('Fallback fetch after update failed:', fetchUpdatedError);
        return { data: null, error: 'Update failed - unable to fetch updated alert' };
      }

      if (fetchedRow) {
        const row = fetchedRow as AlertRow;
        const expectedStatus = (updates as Partial<AlertRow>).status;
        const expectedOutcome = (updates as Partial<AlertRow>).outcome;
        const statusOk = expectedStatus ? row.status === expectedStatus : true;
        const outcomeOk = expectedOutcome ? row.outcome === expectedOutcome : true;

        if (!statusOk || !outcomeOk) {
          console.error('Update not reflected in DB after fallback fetch. Row:', row, 'Expected:', {
            status: expectedStatus,
            outcome: expectedOutcome,
          });
          return { data: null, error: 'Update did not apply (permission or constraint issue)' };
        }

        const mapped = mapRowToAlert(row);
        console.log('Alert updated (verified via fetch):', mapped);
        return { data: mapped, error: null };
      }

      console.error('Update returned no data for ID and fallback verification failed:', alertId);
      return { data: null, error: 'Update failed - no data returned' };
    } catch (error) {
      console.error('Error in updateAlert:', error);
      return { data: null, error: 'Failed to update alert' };
    }
  }

  // Delete an alert
  static async deleteAlert(alertId: string): Promise<{ error: string | null }> {
    try {
      console.log('Attempting to delete alert:', alertId);

      const { data: row } = await supabase
        .from('trading_alerts')
        .select('symbol')
        .eq('id', alertId)
        .maybeSingle();

      const { error } = await supabase.from('trading_alerts').delete().eq('id', alertId);

      if (error) {
        console.error('Error deleting alert:', error);
        return { error: error.message };
      }

      console.log('Alert deleted successfully:', alertId);

      const mode = getPositionSizingMode();
      try {
        if (mode === 'global') {
          await syncPositionSizingStateFromAlerts({ mode: 'global' });
        } else if (row?.symbol) {
          await syncPositionSizingStateFromAlerts({
            mode: 'per_pair',
            symbolUpper: getGroupKeyForSymbol(row.symbol),
          });
        }
      } catch (syncErr) {
        console.warn('Position sizing sync after delete failed:', syncErr);
      }

      return { error: null };
    } catch (error) {
      console.error('Error in deleteAlert:', error);
      return { error: 'Failed to delete alert' };
    }
  }

  // Delete all alerts by symbol/group
  static async deleteAlertsBySymbol(symbol: string): Promise<{ deletedCount: number; error: string | null }> {
    try {
      console.log('Attempting to delete all alerts for symbol:', symbol);
      
      // First, get count of alerts to be deleted
      const { data: alertsToDelete, error: fetchError } = await supabase
        .from('trading_alerts')
        .select('id')
        .eq('symbol', symbol.toUpperCase());

      if (fetchError) {
        console.error('Error fetching alerts to delete:', fetchError);
        return { deletedCount: 0, error: fetchError.message };
      }

      const count = alertsToDelete?.length || 0;
      
      if (count === 0) {
        console.log('No alerts found for symbol:', symbol);
        return { deletedCount: 0, error: null };
      }

      // Delete all alerts for this symbol
      const { error } = await supabase
        .from('trading_alerts')
        .delete()
        .eq('symbol', symbol.toUpperCase());

      if (error) {
        console.error('Error deleting alerts by symbol:', error);
        return { deletedCount: 0, error: error.message };
      }

      console.log(`Successfully deleted ${count} alert(s) for symbol:`, symbol);

      const mode = getPositionSizingMode();
      try {
        if (mode === 'global') {
          await syncPositionSizingStateFromAlerts({ mode: 'global' });
        } else {
          await syncPositionSizingStateFromAlerts({
            mode: 'per_pair',
            symbolUpper: symbol.toUpperCase(),
          });
        }
      } catch (syncErr) {
        console.warn('Position sizing sync after bulk delete failed:', syncErr);
      }

      return { deletedCount: count, error: null };
    } catch (error) {
      console.error('Error in deleteAlertsBySymbol:', error);
      return { deletedCount: 0, error: 'Failed to delete alerts by symbol' };
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