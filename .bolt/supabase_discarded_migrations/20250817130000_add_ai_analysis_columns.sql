/*
  # Add AI Analysis columns to trading_alerts table

  1. Schema Changes
    - Add `ai_analysis` column to store AI analysis results as JSONB
    - Add `analysis_performed` boolean to track if AI analysis was completed
    - Add `analysis_timestamp` to track when analysis was performed
    - Add `analysis_status` to track analysis state (pending, completed, failed)

  2. Security
    - No RLS changes needed (inherits existing policies)
    - JSONB column allows flexible storage of analysis results

  3. Indexes
    - Add index on analysis_performed for efficient filtering
    - Add index on analysis_status for monitoring
*/

-- Add AI analysis columns to trading_alerts table
ALTER TABLE trading_alerts 
ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
ADD COLUMN IF NOT EXISTS analysis_performed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS analysis_timestamp timestamptz,
ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'completed', 'failed'));

-- Add indexes for AI analysis queries
CREATE INDEX IF NOT EXISTS idx_trading_alerts_analysis_performed ON trading_alerts (analysis_performed);
CREATE INDEX IF NOT EXISTS idx_trading_alerts_analysis_status ON trading_alerts (analysis_status);
CREATE INDEX IF NOT EXISTS idx_trading_alerts_analysis_timestamp ON trading_alerts (analysis_timestamp);

-- Add comment to document the new columns
COMMENT ON COLUMN trading_alerts.ai_analysis IS 'JSONB field storing AI analysis results including confidence, recommendation, and reasoning';
COMMENT ON COLUMN trading_alerts.analysis_performed IS 'Boolean flag indicating if AI analysis has been completed';
COMMENT ON COLUMN trading_alerts.analysis_timestamp IS 'Timestamp when AI analysis was performed';
COMMENT ON COLUMN trading_alerts.analysis_status IS 'Status of AI analysis: pending, completed, or failed';

