-- Reset position sizing to Start (0-0)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Reset GLOBAL mode (all pairs share one W-L sequence)
UPDATE public.position_sizing_state
SET current_node = 'Start'
WHERE group_key = 'GLOBAL';

-- OR reset ALL groups (GLOBAL + all per-pair states)
-- UPDATE public.position_sizing_state
-- SET current_node = 'Start';

-- OR reset a specific pair (if using per_pair mode)
-- UPDATE public.position_sizing_state
-- SET current_node = 'Start'
-- WHERE group_key = 'XAUUSD';  -- or 'USDJPY', 'GBPUSD', etc.

-- To see current state before resetting:
-- SELECT * FROM public.position_sizing_state ORDER BY group_key;
