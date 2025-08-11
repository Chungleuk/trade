/*
  # RPC for safe status/outcome updates

  - Creates a SECURITY DEFINER function to update only status/outcome
  - Grants EXECUTE to anon so frontend can call without broad UPDATE policy
  - Optionally drops a prior broad public UPDATE policy if present
*/

-- Optional: Remove broad public UPDATE policy if present
DROP POLICY IF EXISTS "Allow public update for trading alerts" ON trading_alerts;

-- Create or replace RPC to update status/outcome
CREATE OR REPLACE FUNCTION public.update_trading_alert_status(
  p_id uuid,
  p_status text DEFAULT NULL,
  p_outcome text DEFAULT NULL
)
RETURNS SETOF public.trading_alerts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.trading_alerts AS t
  SET
    status = COALESCE(p_status, t.status),
    outcome = COALESCE(p_outcome, t.outcome),
    updated_at = now()
  WHERE t.id = p_id
  RETURNING t.*;
$$;

-- Limit acceptable values using a CHECK in table already; this function passes values through.

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.update_trading_alert_status(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_trading_alert_status(uuid, text, text) TO authenticated;


