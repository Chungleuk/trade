/*
  # Add AI Analysis fields to trading alerts

  1. Schema Changes
    - Add AI analysis fields to `trading_alerts` table
    - Store analysis results for each alert
    - Add indexes for performance on analysis queries

  2. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add AI analysis columns to trading_alerts table
ALTER TABLE trading_alerts 
ADD COLUMN ai_analysis JSONB;

-- Add index for AI analysis queries
CREATE INDEX idx_trading_alerts_ai_analysis ON trading_alerts USING GIN (ai_analysis);

-- Add column to track if analysis was performed
ALTER TABLE trading_alerts 
ADD COLUMN analysis_performed BOOLEAN DEFAULT FALSE;

-- Add index for analysis performed queries
CREATE INDEX idx_trading_alerts_analysis_performed ON trading_alerts (analysis_performed);

-- Add column to track analysis timestamp
ALTER TABLE trading_alerts 
ADD COLUMN analysis_timestamp TIMESTAMP WITH TIME ZONE;

-- Add index for analysis timestamp queries
CREATE INDEX idx_trading_alerts_analysis_timestamp ON trading_alerts (analysis_timestamp);

-- Add comment to document the new columns
COMMENT ON COLUMN trading_alerts.ai_analysis IS 'Stores AI analysis results including confidence, recommendation, and detailed analysis';
COMMENT ON COLUMN trading_alerts.analysis_performed IS 'Boolean flag indicating if AI analysis has been performed';
COMMENT ON COLUMN trading_alerts.analysis_timestamp IS 'Timestamp when AI analysis was performed';
