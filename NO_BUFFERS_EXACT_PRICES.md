# Exact Stop Loss & Adjusted Take Profit - No Buffers

## Overview
The EA now uses **EXACT prices from signals** with **NO safety buffers**, and automatically adjusts the Take Profit to maintain 1:1 Risk:Reward after broker costs.

---

## What Changed

### ❌ OLD BEHAVIOR (with buffers):
```
Signal Stop: 152.4994
Actual SL: 152.497 (2 points buffer removed)

Signal Target: 152.7806  
Actual TP: 152.779 (2 points buffer removed)
```

### ✅ NEW BEHAVIOR (exact prices + TP adjustment):
```
Signal Stop: 152.4994
Actual SL: 152.4994 ✓ EXACT

Signal Target: 152.7806
Broker Costs: ~$223 for 11.69 lots
Additional Pips: 0.004 (to cover costs)
Actual TP: 152.7846 ✓ EXTENDED to maintain 1:1 R:R
```

---

## How It Works

### Stop Loss:
- **NO BUFFER** - Uses exact signal value
- Example: Signal says 152.4994 → EA places 152.4994

### Take Profit:
- **ADJUSTED for broker costs** to maintain Risk:Reward
- Formula: `Adjusted TP = Signal Target + (Broker Costs / Pip Value)`

**Calculation:**
```
1. Calculate total broker costs for position
   - Spread cost: 2 pips × $6.552/pip × 11.69 lots = $153
   - Commission: $6/lot × 11.69 lots = $70
   - Total: $223

2. Convert costs to pips needed
   - Additional Pips = $223 / (11.69 × $6.552)
   - Additional Pips = $223 / $76.61 = 2.91 pips

3. Adjust target price
   - For BUY: Target + (2.91 × 0.01) = 152.7806 + 0.0291 = 152.8097
   - For SELL: Target - (2.91 × 0.01)
```

---

## Settings

### Required Configuration:
```mql5
input bool AccountForBrokerCosts = true;   // Must be ON
input bool AdjustTargetForCosts = true;    // Must be ON (default now)
input double ForexCommissionPerLot = 6.0;  // Your broker's commission
input double GoldCommissionPerLot = 2.0;   // Gold commission
```

---

## Example: USDJPY BUY Signal

### Signal Input:
```json
{
  "action": "BUY",
  "symbol": "USDJPY",
  "entry": "152.64",
  "target": "152.7806",
  "stop": "152.4994",
  "risk": "0.65%"
}
```

### EA Processing:

#### Step 1: Calculate Risk & Volume
```
Initial Deposit: $200,000
Risk: 0.65% = $1,300
Stop Distance: 14.06 pips
Pip Value: $6.552/pip/lot

Volume = $1,300 / (14.06 × $6.552) = 14.11 lots (no cost reduction!)
```

#### Step 2: Calculate Broker Costs
```
Spread: 2 pips × $6.552 × 14.11 = $185
Commission: $6 × 14.11 = $85
Total Costs: $270
```

#### Step 3: Adjust Take Profit
```
Additional Pips = $270 / (14.11 × $6.552) = 2.92 pips
Adjusted Target = 152.7806 + 0.0292 = 152.8098
```

#### Step 4: Place Order
```
Symbol: USDJPY
Action: BUY
Volume: 14.11 lots
Entry: 152.640 (market)
Stop Loss: 152.4994 ✓ EXACT
Take Profit: 152.8098 ✓ ADJUSTED
```

### Result:
```
If SL Hit:
Loss = 14.06 pips × 14.11 × $6.552 = $1,300 ✓

If TP Hit:
Gross Profit = (152.8098 - 152.64) × 14.11 × 1000 / 152.64
             = 16.98 pips × 14.11 × $6.552 = $1,570
Less Costs = $1,570 - $270 = $1,300 ✓

Risk:Reward = 1:1 ✓ (after costs)
```

---

## Why This Method?

### ✅ Benefits:
1. **Maintains 1:1 Risk:Reward** - Signal's R:R is preserved after costs
2. **Full position size** - No lot reduction due to costs
3. **Exact stop loss** - Maximum protection at intended level
4. **Automatic adjustment** - No manual TP calculation needed
5. **Professional** - Industry-standard approach

### Comparison:

| Method | Volume | SL | TP | Net R:R |
|--------|--------|----|----|---------|
| **Old (reduce lot)** | 11.69 lots | 152.497 (buffered) | 152.779 (buffered) | 1:0.66 |
| **New (adjust TP)** | 14.11 lots | 152.4994 (exact) | 152.8098 (adjusted) | 1:1.0 ✓ |

---

## Important Notes

### 1. Commission Settings
**Must match your broker's actual fees:**
```mql5
ForexCommissionPerLot = 6.0  // $6 round trip for forex
GoldCommissionPerLot = 2.0   // $2 round trip for gold
```

Check with your broker! Common values:
- IC Markets: $7/lot forex, $3/lot gold
- Pepperstone: $7/lot forex, $3/lot gold
- OANDA: $0 (included in spread)
- XM: $0 (included in spread)

### 2. Spread Variation
The EA uses **current spread** at trade time. If spread widens:
- More pips added to TP automatically
- Risk:Reward maintained

### 3. Stop Level Requirements
Some brokers have minimum distance from current price. If your exact SL/TP violates this, the order may be rejected. The EA will log the error.

### 4. Market Orders
For market orders, actual entry may differ slightly from signal entry due to:
- Slippage
- Spread
- Market movement

But SL/TP are still calculated correctly from the actual fill price.

---

## EA Log Output (Expected)

```
========================================
TradingSignalEA: USING INITIAL DEPOSIT: USD 200000 (Actual: USD 192000)
TradingSignalEA: Risk: 0.65% = USD 1300
========================================
TARGET ADJUSTMENT FOR BROKER COSTS
----------------------------------------
Original Target: 152.7806
Total Broker Costs: USD 270
Additional Pips Needed: 2.92
Adjusted Target: 152.8098
Target Adjustment: +0.0292 (2.92 pips)
========================================
Trade executed - Ticket: 123456
Symbol: USDJPY | Action: BUY
Entry: 152.640 | Volume: 14.11 lots
Stop Loss: 152.4994 (EXACT - no buffer)
Take Profit: 152.8098 (ADJUSTED for costs)
Risk: 0.65% | Max Loss: $1,300
========================================
```

---

## Troubleshooting

### "Order rejected - invalid stops"
**Cause:** Broker requires minimum distance from current price  
**Solution:** Check broker's stop level requirements, may need small buffer

### TP too far from entry
**Cause:** High commission settings or wide spread  
**Solution:** Verify commission values match your broker

### Different costs each trade
**Cause:** Spread varies with market conditions (normal)  
**Solution:** EA automatically adjusts TP for each trade

---

**Last Updated:** 2025-10-23  
**Default Settings:** AdjustTargetForCosts = true (maintains 1:1 R:R)  
**SL/TP Buffers:** REMOVED (uses exact prices)

