export interface TradingAlert {
  id: string;
  action: 'BUY' | 'SELL';
  symbol: string;
  timeframe: string;
  /** May be empty when journaling without a fill price */
  entry: string;
  target?: string;
  stop?: string;
  rr?: string;
  risk?: string;
  /** ISO 8601; if set on insert-only payloads, stored as `created_at` for manual backdating */
  createdAt?: string;
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