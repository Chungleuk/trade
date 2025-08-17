export interface TradingAnalytics {
  totalAlerts: number;
  completedAlerts: number;
  activeAlerts: number;
  stoppedAlerts: number;
  winRate: number;
  totalWins: number;
  totalLosses: number;
  averageRisk: number;
  totalRiskAmount: number;
  profitLoss: number;
  bestSymbol: string;
  worstSymbol: string;
  symbolPerformance: SymbolPerformance[];
  monthlyPerformance: MonthlyPerformance[];
  riskProgression: RiskProgression[];
}

export interface SymbolPerformance {
  symbol: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  averageRisk: number;
  currentNode: string;
}

export interface MonthlyPerformance {
  month: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitLoss: number;
}

export interface RiskProgression {
  symbol: string;
  node: string;
  risk: number;
  tradesAtNode: number;
  lastUpdated: string;
}

export interface AnalyticsFilters {
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  symbols: string[];
  status: ('active' | 'completed' | 'stopped')[];
}





