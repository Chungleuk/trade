# How to Reset Position Sizing to Start (0-0)

There are two ways to reset the position sizing state back to `Start` (0-0):

## Method 1: SQL in Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run one of these queries:

### Reset GLOBAL mode (all pairs share one W-L sequence):
```sql
UPDATE public.position_sizing_state
SET current_node = 'Start'
WHERE group_key = 'GLOBAL';
```

### Reset ALL groups (GLOBAL + all per-pair states):
```sql
UPDATE public.position_sizing_state
SET current_node = 'Start';
```

### Reset a specific pair (if using per_pair mode):
```sql
UPDATE public.position_sizing_state
SET current_node = 'Start'
WHERE group_key = 'XAUUSD';  -- or 'USDJPY', 'GBPUSD', etc.
```

### Check current state before resetting:
```sql
SELECT * FROM public.position_sizing_state ORDER BY group_key;
```

---

## Method 2: Backend API Endpoint

### Reset a specific group:
```bash
curl -X POST https://your-backend-url.onrender.com/position-sizing/reset \
  -H "Content-Type: application/json" \
  -d '{"groupKey": "GLOBAL"}'
```

### Reset ALL groups:
```bash
curl -X POST https://your-backend-url.onrender.com/position-sizing/reset \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Example responses:

**Single group reset:**
```json
{
  "status": "success",
  "message": "Position sizing reset for GLOBAL",
  "groupKey": "GLOBAL",
  "node": "Start"
}
```

**All groups reset:**
```json
{
  "status": "success",
  "message": "All position sizing states reset to Start",
  "resetCount": 5
}
```

---

## Notes

- **GLOBAL mode**: Only one row exists with `group_key = 'GLOBAL'`
- **Per-pair mode**: Multiple rows exist (one per symbol: `XAUUSD`, `USDJPY`, etc.)
- Resetting sets `current_node` to `'Start'`, which corresponds to **0.65% risk**
- The `updated_at` timestamp will be automatically updated by the database trigger
