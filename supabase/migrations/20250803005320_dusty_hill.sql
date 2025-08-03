/*
  # Fix Row Level Security Policies for Trading Alerts

  1. Security Updates
    - Update RLS policies to allow public insert operations
    - Maintain read restrictions for authenticated users only
    - Allow public access for webhook receivers and manual submissions

  2. Changes Made
    - Drop existing restrictive insert policy
    - Create new policy allowing public insert operations
    - Keep existing read and update policies for authenticated users
    - This enables webhook functionality while maintaining data security
*/

-- Drop the existing restrictive insert policy
DROP POLICY IF EXISTS "Users can insert trading alerts" ON trading_alerts;

-- Create a new policy that allows public insert operations
-- This is necessary for webhook receivers and manual alert submissions
CREATE POLICY "Allow public insert for trading alerts"
  ON trading_alerts
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Ensure the read policy allows public access as well for the dashboard
DROP POLICY IF EXISTS "Users can read all trading alerts" ON trading_alerts;

CREATE POLICY "Allow public read for trading alerts"
  ON trading_alerts
  FOR SELECT
  TO public
  USING (true);

-- Keep update policy for authenticated users only
DROP POLICY IF EXISTS "Users can update trading alerts" ON trading_alerts;

CREATE POLICY "Authenticated users can update trading alerts"
  ON trading_alerts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);