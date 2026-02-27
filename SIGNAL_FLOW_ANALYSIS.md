# Signal Flow Analysis: TradingView → Execution

## End-to-End Flow

```
TradingView (Pine Script) 
    → alert() fires 
    → Webhook POST to Supabase Edge Function
    → Saves to Supabase trading_alerts (status: active)
    → Render server (server.js) reads from same Supabase
    → MT5 EA polls Render /signals/pending every 1 sec
    → EA parses, validates, executes
    → EA sends /signals/ack (executed|failed|expired|rejected)
    → Render updates trading_alerts status
```

---

## Flaws Fixed

| # | Flaw | Fix |
|---|------|-----|
| 1 | Server didn't return `rr` in signals | Added `rr: signal.rr \|\| '1'` to response |
| 2 | Server ignored `expired` and `rejected` acks | Now accepts `executed`, `failed`, `expired`, `rejected` → marks as `stopped` (except executed→completed) |

---

## Potential Issues & Recommendations

### 1. **Render Cold Start** (Critical for free tier)
- **Issue:** Render free tier spins down after ~15 min. First request can take 30–60 seconds.
- **Impact:** EA gets HTTP timeout (-1) when polling; signals may be missed.
- **Fix:** Use UptimeRobot to ping `https://trading-backend-4v0f.onrender.com/health` every 5 min.

### 2. **Supabase Credentials on Render**
- **Issue:** `server.js` uses `SUPABASE_SERVICE_ROLE_KEY` from env. Default `'your_service_role_key_here'` is invalid.
- **Check:** Render Dashboard → Environment → Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.
- **Verify:** `SUPABASE_URL` = `https://xdjthqpnsyrlulqldlpi.supabase.co`

### 3. **Symbol Name Mismatch**
- **Issue:** TradingView sends `XAUUSD`, `GBPJPY`. Some brokers use `XAUUSD.a`, `GOLD`, `GBPJPYm`.
- **Impact:** `SymbolSelect(signal.symbol, true)` may fail → signal rejected.
- **Fix:** Add symbol mapping in EA (e.g., `XAUUSD` → `XAUUSD.a` for your broker) or ensure TradingView uses broker symbol names.

### 4. **WebRequest URL Allowlist**
- **Issue:** MT5 requires URLs to be allowlisted for WebRequest.
- **Check:** MT5 → Tools → Options → Expert Advisors → "Allow WebRequest for listed URL" → Add `https://trading-backend-4v0f.onrender.com`

### 5. **Poll Interval vs Signal Expiration**
- **Current:** PollInterval = 1000ms (1 sec), SignalExpirationMinutes = 10.
- **Note:** If Render is cold, first poll can timeout. EA will retry on next tick. Signal stays "active" until ack'd or expired.

### 6. **Duplicate Signals**
- **Protection:** `DuplicateCheckWindow` (300s), `IsSignalAlreadyProcessed`, `HasOpenPosition`, `IsSymbolActive`.
- **Note:** If EA restarts, processed list is cleared. Same signal could be re-executed if still "active" in DB. Consider idempotency (e.g., check if position with same magic/comment exists).

### 7. **HTF Filter Rejection**
- **Flow:** When `EnableSignalFilter` is true and HTF confirmation fails, EA sends ack "rejected".
- **Fixed:** Server now marks as `stopped` so it won't be returned on future polls.

### 8. **Two Data Sources**
- **Webhook:** Supabase Edge Function (user's choice).
- **Signals:** Render server reads from Supabase.
- **Consistency:** Both use same Supabase `trading_alerts` table. ✅

---

## Checklist Before Going Live

- [ ] Deploy updated Supabase webhook: `supabase functions deploy webhook`
- [ ] Deploy updated server.js to Render (or ensure Render has latest)
- [ ] Set Render env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] UptimeRobot pings Render `/health` every 5 min
- [ ] MT5 WebRequest allowlist includes Render URL
- [ ] Verify broker symbol names match TradingView (XAUUSD, GBPJPY, etc.)
- [ ] Test: Send manual webhook → check EA receives and executes

---

## Quick Test Commands

```bash
# 1. Send test signal (to Supabase - use your webhook URL)
curl -X POST "https://xdjthqpnsyrlulqldlpi.supabase.co/functions/v1/webhook" \
  -H "Content-Type: application/json" \
  -d '{"action":"BUY","symbol":"XAUUSD","entry":"2650.5","target":"2658","stop":"2643","id":"TEST-1","rr":"1","risk":"1%","timeframe":"15"}'

# 2. Fetch pending (Render - verify signals appear)
curl "https://trading-backend-4v0f.onrender.com/signals/pending"

# 3. Ack (mark as executed)
curl -X POST "https://trading-backend-4v0f.onrender.com/signals/ack" \
  -H "Content-Type: application/json" \
  -d '{"signalId":"TEST-1","status":"executed"}'
```
