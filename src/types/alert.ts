import { AnalysisResult } from '../services/openaiAnalysisService';

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
  aiAnalysis?: AnalysisResult; // AI analysis results
  analysisPerformed?: boolean; // Whether AI analysis has been performed
  analysisTimestamp?: string; // When AI analysis was performed
}

export interface WebhookConfig {
  url: string;
  isActive: boolean;
  lastReceived?: string;
}