/*
  # Create trading alerts table

  1. New Tables
    - `trading_alerts`
      - `id` (uuid, primary key)
      - `action` (text, BUY or SELL)
      - `symbol` (text, trading pair symbol)
      - `timeframe` (text, chart timeframe)
      - `entry` (text, entry price)
      - `target` (text, target price, optional)
      - `stop` (text, stop loss price, optional)
      - `rr` (text, risk reward ratio, optional)
      - `risk` (text, risk percentage, optional)
      - `alert_id` (text, external alert ID)
      - `message` (text, additional message, optional)
      - `status` (text, alert status)
      - `created_at` (timestamptz, creation timestamp)
      - `updated_at` (timestamptz, last update timestamp)

  2. Security
    - Enable RLS on `trading_alerts` table
    - Add policy for authenticated users to read all alerts
    - Add policy for authenticated users to insert new alerts
    - Add policy for authenticated users to update their own alerts

  3. Indexes
    - Index on created_at for efficient sorting
    - Index on symbol for filtering
    - Index on action for filtering
*/

CREATE TABLE IF NOT EXISTS trading_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('BUY', 'SELL')),
  symbol text NOT NULL,
  timeframe text NOT NULL,
  entry text NOT NULL,
  target text,
  stop text,
  rr text,
  risk text,
  alert_id text NOT NULL,
  message text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE trading_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can read all trading alerts"
  ON trading_alerts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert trading alerts"
  ON trading_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update trading alerts"
  ON trading_alerts
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trading_alerts_created_at ON trading_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trading_alerts_symbol ON trading_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_trading_alerts_action ON trading_alerts(action);
CREATE INDEX IF NOT EXISTS idx_trading_alerts_status ON trading_alerts(status);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_trading_alerts_updated_at
  BEFORE UPDATE ON trading_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();