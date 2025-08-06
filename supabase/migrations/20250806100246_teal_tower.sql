/*
  # Add outcome column to trading alerts

  1. Schema Changes
    - Add `outcome` column to `trading_alerts` table
    - Allow values: 'win', 'loss', 'breakeven', or NULL
    - Add check constraint to ensure valid values
    - Add index for performance on outcome queries

  2. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add outcome column to trading_alerts table
ALTER TABLE trading_alerts 
ADD COLUMN outcome text;

-- Add check constraint to ensure valid outcome values
ALTER TABLE trading_alerts 
ADD CONSTRAINT trading_alerts_outcome_check 
CHECK (outcome IS NULL OR outcome = ANY (ARRAY['win'::text, 'loss'::text, 'breakeven'::text]));

-- Add index for outcome queries
CREATE INDEX idx_trading_alerts_outcome ON trading_alerts (outcome);