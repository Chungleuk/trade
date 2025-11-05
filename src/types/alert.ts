export interface TradingAlert {
  id: string;
  action: 'BUY' | 'SELL';
  symbol: string;
  timeframe: string;
  entry: string;
  target?: string;
  stop?: string;
  rr?: string;
  risk?: string;
  timestamp: string;
  status?: 'active' | 'completed' | 'stopped';
  outcome?: 'win' | 'loss';
  message?: string;
  rawMessage?: string; // Store the original TradingView message
  strategyName?: string; // Extract strategy name if available
  // AI analysis fields removed - no longer used
  aiAnalysis?: any; // Legacy field - kept for backward compatibility with existing data
  analysisPerformed?: boolean; // Legacy field - kept for backward compatibility
  analysisTimestamp?: string; // Legacy field - kept for backward compatibility
}

export interface WebhookConfig {
  url: string;
  isActive: boolean;
  lastReceived?: string;
}