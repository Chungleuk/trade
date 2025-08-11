import { supabase } from '../lib/supabase';
import { TradingAnalytics, SymbolPerformance, MonthlyPerformance, RiskProgression, AnalyticsFilters } from '../types/analytics';
import { TradingAlert } from '../types/alert';

export class AnalyticsService {
  static async getTradingAnalytics(filters?: AnalyticsFilters): Promise<TradingAnalytics> {
    try {
      // Build query with filters
      let query = supabase
        .from('trading_alerts')
        .select('*');

      if (filters?.dateRange.start) {
        query = query.gte('created_at', filters.dateRange.start.toISOString());
      }
      if (filters?.dateRange.end) {
        query = query.lte('created_at', filters.dateRange.end.toISOString());
      }
      if (filters?.symbols.length) {
        query = query.in('symbol', filters.symbols);
      }
      if (filters?.status.length) {
        query = query.in('status', filters.status);
      }

      const { data: alerts, error } = await query;
      
      if (error) {
        throw new Error(`Failed to fetch alerts: ${error.message}`);
      }

      return this.calculateAnalytics(alerts || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  }

  private static async calculateAnalytics(alerts: TradingAlert[]): Promise<TradingAnalytics> {
    const totalAlerts = alerts.length;
    const completedAlerts = alerts.filter(a => a.status === 'completed').length;
    const activeAlerts = alerts.filter(a => a.status === 'active').length;
    const stoppedAlerts = alerts.filter(a => a.status === 'stopped').length;

    const completedWithOutcome = alerts.filter(a => a.status === 'completed' && a.outcome);
    const totalWins = completedWithOutcome.filter(a => a.outcome === 'win').length;
    const totalLosses = completedWithOutcome.filter(a => a.outcome === 'loss').length;
    const winRate = completedWithOutcome.length > 0 ? (totalWins / completedWithOutcome.length) * 100 : 0;

    const riskValues = alerts.map(a => parseFloat(a.risk || '0')).filter(r => r > 0);
    const averageRisk = riskValues.length > 0 ? riskValues.reduce((sum, r) => sum + r, 0) / riskValues.length : 0;
    const totalRiskAmount = riskValues.reduce((sum, r) => sum + r, 0);

    // Calculate symbol performance (grouped by currency pairs)
    const symbolPerformance = this.calculateSymbolPerformance(alerts);
    
    // Calculate monthly performance
    const monthlyPerformance = this.calculateMonthlyPerformance(alerts);
    
    // Get risk progression from position_sizing_state
    const riskProgression = await this.calculateRiskProgression(alerts);

    // Find best and worst symbols (currency pairs)
    const bestSymbol = symbolPerformance.length > 0 
      ? symbolPerformance.reduce((best, current) => current.winRate > best.winRate ? current : best).symbol 
      : '';
    const worstSymbol = symbolPerformance.length > 0 
      ? symbolPerformance.reduce((worst, current) => current.winRate < worst.winRate ? current : worst).symbol 
      : '';

    return {
      totalAlerts,
      completedAlerts,
      activeAlerts,
      stoppedAlerts,
      winRate,
      totalWins,
      totalLosses,
      averageRisk,
      totalRiskAmount,
      profitLoss: 0, // Would need P&L data to calculate
      bestSymbol,
      worstSymbol,
      symbolPerformance,
      monthlyPerformance,
      riskProgression
    };
  }

  private static calculateSymbolPerformance(alerts: TradingAlert[]): SymbolPerformance[] {
    console.log('=== SYMBOL PERFORMANCE DEBUG ===');
    console.log('Total alerts received:', alerts.length);
    
    // Group alerts by symbol (currency pair)
    const symbolMap = new Map<string, { trades: TradingAlert[], wins: number, losses: number }>();

    alerts.forEach(alert => {
      // Normalize symbol to uppercase for consistent grouping
      const symbol = alert.symbol.toUpperCase();
      
      if (!symbolMap.has(symbol)) {
        symbolMap.set(symbol, { trades: [], wins: 0, losses: 0 });
      }
      
      const symbolData = symbolMap.get(symbol)!;
      symbolData.trades.push(alert);
      
      // Only count completed trades with outcomes for win/loss calculation
      if (alert.status === 'completed' && alert.outcome) {
        console.log(`Found completed alert with outcome: ${symbol} - ${alert.outcome}`);
        if (alert.outcome === 'win') symbolData.wins++;
        if (alert.outcome === 'loss') symbolData.losses++;
      }
    });

    // Convert to array and calculate performance metrics for each currency pair
    const result = Array.from(symbolMap.entries()).map(([symbol, data]) => {
      const completedTrades = data.trades.filter(t => t.status === 'completed' && t.outcome);
      const winRate = completedTrades.length > 0 ? (data.wins / completedTrades.length) * 100 : 0;
      
      // Calculate average risk for this currency pair
      const riskValues = data.trades.map(t => parseFloat(t.risk || '0')).filter(r => r > 0);
      const averageRisk = riskValues.length > 0 ? riskValues.reduce((sum, r) => sum + r, 0) / riskValues.length : 0;

      const performance = {
        symbol, // Currency pair (e.g., USDJPY, XAUUSD, EURUSD)
        totalTrades: data.trades.length, // Total alerts for this pair
        wins: data.wins, // Number of winning trades for this pair
        losses: data.losses, // Number of losing trades for this pair
        winRate, // Win rate percentage for this currency pair
        averageRisk, // Average risk percentage for this pair
        currentNode: 'Unknown' // Would need to fetch from position_sizing_state
      };
      
      console.log(`Symbol performance for ${symbol}:`, performance);
      return performance;
    }).sort((a, b) => b.winRate - a.winRate); // Sort by win rate descending
    
    console.log('Final symbol performance array:', result);
    return result;
  }

  private static calculateMonthlyPerformance(alerts: TradingAlert[]): MonthlyPerformance[] {
    const monthMap = new Map<string, { trades: TradingAlert[], wins: number, losses: number }>();

    alerts.forEach(alert => {
      const date = new Date(alert.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { trades: [], wins: 0, losses: 0 });
      }
      
      const monthData = monthMap.get(monthKey)!;
      monthData.trades.push(alert);
      
      if (alert.status === 'completed' && alert.outcome) {
        if (alert.outcome === 'win') monthData.wins++;
        if (alert.outcome === 'loss') monthData.losses++;
      }
    });

    return Array.from(monthMap.entries())
      .map(([month, data]) => {
        const completedTrades = data.trades.filter(t => t.status === 'completed' && t.outcome);
        const winRate = completedTrades.length > 0 ? (data.wins / completedTrades.length) * 100 : 0;

        return {
          month,
          totalTrades: data.trades.length,
          wins: data.wins,
          losses: data.losses,
          winRate,
          profitLoss: 0 // Would need P&L data to calculate
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private static async calculateRiskProgression(alerts: TradingAlert[]): Promise<RiskProgression[]> {
    try {
      const { data: positionStates, error } = await supabase
        .from('position_sizing_state')
        .select('*');

      if (error) {
        console.error('Error fetching position sizing states:', error);
        return [];
      }

      return (positionStates || []).map(state => {
        // Count completed trades for this symbol group
        const symbolTrades = alerts.filter(a => a.symbol.toUpperCase() === state.group_key);
        const tradesAtNode = symbolTrades.filter(t => 
          t.status === 'completed' && t.outcome
        ).length;

        return {
          symbol: state.group_key, // Currency pair (e.g., USDJPY, XAUUSD)
          node: state.current_node, // Current decision tree node
          risk: this.getRiskForNode(state.current_node), // Risk percentage for this node
          tradesAtNode, // Number of completed trades at this node
          lastUpdated: state.updated_at
        };
      });
    } catch (error) {
      console.error('Error calculating risk progression:', error);
      return [];
    }
  }

  private static getRiskForNode(node: string): number {
    const riskMap: Record<string, number> = {
      'Start': 0.65, '1-0': 0.58, '0-1': 0.73, '2-0': 0.44, '1-1': 0.73, '0-2': 0.73,
      '3-0': 0.25, '2-1': 0.62, '1-2': 0.83, '0-3': 0.62, '4-0': 0.08, '3-1': 0.41,
      '2-2': 0.83, '1-3': 0.83, '0-4': 0.41, '4-1': 0.17, '3-2': 0.66, '2-3': 0.99,
      '1-4': 0.66, '0-5': 0.17, '4-2': 0.33, '3-3': 0.99, '2-4': 0.99, '1-5': 0.33,
      '4-3': 0.66, '3-4': 1.33, '2-5': 0.66, '4-4': 1.33, '3-5': 1.33, '4-5': 2.65,
    };
    return riskMap[node] || 0.65;
  }
}
