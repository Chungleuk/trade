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
  message?: string;
  rawMessage?: string; // Store the original TradingView message
  strategyName?: string; // Extract strategy name if available
}

export interface WebhookConfig {
  url: string;
  isActive: boolean;
  lastReceived?: string;
}