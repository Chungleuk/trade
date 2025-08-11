/*
  # Fix delete permissions for trading alerts

  1. Security Updates
    - Add policy to allow public delete operations for trading alerts
    - This enables the frontend to properly delete alerts using the anon key

  2. Changes
    - Create policy for DELETE operations on trading_alerts table
    - Allow public access for delete operations
*/

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Allow public delete for trading alerts" ON trading_alerts;

-- Create policy to allow public delete operations
CREATE POLICY "Allow public delete for trading alerts"
  ON trading_alerts
  FOR DELETE
  TO public
  USING (true);