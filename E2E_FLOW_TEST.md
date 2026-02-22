# End-to-End Flow: Signal → Trade → Result

## Overview

1. **Signal generated** (TradingView / external) → POST `/webhook`
2. **Server** stores alert in Supabase `trading_alerts` (status `active`)
3. **EA** polls GET or POST `/signals/pending` → receives `{ signals: [...] }`
4. **EA** parses each signal, validates, calculates lot size, executes trade (SL/TP set)
5. **EA** sends POST `/signals/ack` with `{ signalId, status: "executed"|"failed" }`
6. **Server** updates alert to `completed` or `stopped`
7. **On trade close** (TP/SL): EA detects in history → POST `/mt5/trade-outcome` → sends close email

---

## 1. Webhook (signal ingestion)

- **Endpoint:** `POST /webhook`
- **Body (example):**  
  `{ "action": "BUY", "symbol": "XAUUSD", "entry": "2650.5", "target": "2658", "stop": "2643", "id": "T1", "rr": "1", "risk": "0.65%", "timeframe": "15" }`
- **Required:** `action`, `symbol`, `entry` (numeric). Optional: `target`, `stop`, `risk`, `id`, `timeframe`, `rr`.
- **Server:** Saves to `trading_alerts` with `risk` from body or default `"0.65"`, returns `{ success: true, alert: {...}, risk }`.
- **Flaw check:** ✅ Risk is passed through; no W-L state.

---

## 2. Fetch pending signals (EA polling)

- **Endpoints:** `GET /signals/pending` or `POST /signals/pending` (same response).
- **GET:** Query params optional (e.g. `?terminal=MT5&account=123&symbol=XAUUSD&timeframe=15`). Server ignores them and returns all active.
- **Response:** `{ signals: [ { id, symbol, action, entry, target, stop, timeframe, risk, timestamp } ], message, timestamp, queue_size }`
- **EA:** Uses `"signals":[` to find array; parses each `{...}` with `ParseSignalData` → `id`, `symbol`, `action`, `entry`, `target`, `stop`, `risk` (→ `risk_percent`), `rr` (→ `rr_ratio`), `timestamp`.
- **Flaw check:** ✅ GET added so both EA polling methods work.

---

## 3. EA validation and execution

- **Validation:** `ValidateSignal()` — symbol exists, entry > 0, target/stop valid, **stop > 0** (required), risk 0–100%.
- **Lot size:** `CalculateLotSize(signal)` — base amount from fixed/dynamic setting, `targetRiskAmount = baseAmount * (risk_percent/100)`, `GrossProfitMatchesRisk = false` → denominator includes commission; lot rounded to broker step.
- **TP adjustment:** `CalculateAdjustedTarget()` — when `AdjustTargetForCosts` and `AccountForBrokerCosts`, adds `2 * commissionPerLot / pipValue` pips so net profit at TP ≈ net loss at SL.
- **Order:** `OrderSend` with SL = `signal.stop`, TP = adjusted target (or signal target if no adjustment).
- **Flaw check:** ✅ Stop validation fixed (reject `stop <= 0`). No W-L; risk from signal or EA default.

---

## 4. Signal acknowledgment

- **Endpoint:** `POST /signals/ack`
- **Body:** `{ signalId: "<alert_id>", status: "executed"|"failed" }`
- **Server:** Updates `trading_alerts` where `alert_id = signalId` to status `completed` or `stopped`.
- **EA:** Called after execute success/failure so same signal is not retried as pending.
- **Flaw check:** ✅ No dependency on W-L.

---

## 5. Trade close and outcome

- **Detection:** `CheckAndUpdateTradeOutcomes()` — scans history for `DEAL_ENTRY_OUT` with position ID belonging to EA (magic); computes outcome from P/L (net profit + commission).
- **Endpoint:** `POST /mt5/trade-outcome`
- **Body:** `{ ticket, outcome: "win"|"loss", symbol, closePrice, closeTime, hk_shutdown: true|false }`
- **Server:** Logs outcome; no state update (W-L removed).
- **EA:** Sends close email via `SendTradeCloseEmailDetailed()` regardless of HTTP result.
- **Flaw check:** ✅ Outcome is still sent; server response is consistent.

---

## 6. Quick manual test (server running)

```bash
# 1. Send a signal
curl -s -X POST http://localhost:3001/webhook -H "Content-Type: application/json" -d "{\"action\":\"BUY\",\"symbol\":\"XAUUSD\",\"entry\":2650.5,\"target\":2658,\"stop\":2643,\"id\":\"E2E-T1\",\"rr\":\"1\",\"risk\":\"0.65%\",\"timeframe\":\"15\"}"

# 2. Fetch pending (GET)
curl -s "http://localhost:3001/signals/pending"

# 3. Fetch pending (POST)
curl -s -X POST http://localhost:3001/signals/pending -H "Content-Type: application/json" -d "{}"

# 4. Ack executed
curl -s -X POST http://localhost:3001/signals/ack -H "Content-Type: application/json" -d "{\"signalId\":\"E2E-T1\",\"status\":\"executed\"}"

# 5. Trade outcome (simulated)
curl -s -X POST http://localhost:3001/mt5/trade-outcome -H "Content-Type: application/json" -d "{\"ticket\":99999,\"outcome\":\"loss\",\"symbol\":\"XAUUSD\",\"closePrice\":2643,\"closeTime\":\"2025.02.21 12:00:00\"}"
```

---

## 7. Flaws fixed in this pass

| Item | Fix |
|------|-----|
| GET `/signals/pending` | Added so EA with `UseGETMethod = true` works. |
| Stop validation | Reject `signal.stop <= 0` (invalid or missing SL). |
| W-L removed | Server and EA no longer use W-L; risk from signal or EA default only. |

---

## 8. EA checklist (no W-L)

- Risk: from signal `risk` or input `RiskPercent`.
- Lot: `targetRiskAmount / (stopPips * pipValue + commissionPerLot)` when `GrossProfitMatchesRisk = false`.
- TP: widened by `2 * commissionPerLot / pipValue` pips when `AdjustTargetForCosts = true`.
- Max positions: `MaxConcurrentPositions` only.
- Trade close: outcome sent to `/mt5/trade-outcome`; email sent; no state update.
