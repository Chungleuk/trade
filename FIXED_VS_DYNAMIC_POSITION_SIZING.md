# Fixed vs Dynamic Position Sizing

## Overview
The EA supports two methods for calculating lot sizes based on account balance:
1. **Fixed Position Sizing** (Default, Recommended)
2. **Dynamic Position Sizing**

---

## Method 1: Fixed Position Sizing (RECOMMENDED) ✅

### Settings:
```mql5
input bool UseDynamicContractSize = false;  // Use fixed base
input double BaseAccountSize = 100000.0;    // Your starting capital
```

### How It Works:
- Uses a **fixed base account size** for all lot calculations
- Lot sizes remain **consistent** regardless of profit/loss
- Your risk per trade stays proportional to your **starting capital**

### Example:
**Initial Capital: $100,000**
**Risk: 0.83% per trade = $830**

| Current Balance | Risk Calculation | Lot Size (USDJPY) |
|----------------|------------------|-------------------|
| $100,000 (start) | $100,000 × 0.83% = $830 | 9.01 lots |
| $103,560 (profit) | $100,000 × 0.83% = $830 | 9.01 lots ✓ |
| $110,000 (profit) | $100,000 × 0.83% = $830 | 9.01 lots ✓ |
| $95,000 (loss) | $100,000 × 0.83% = $830 | 9.01 lots ✓ |

**Benefits:**
- ✅ Consistent position sizing
- ✅ No compounding during drawdowns
- ✅ Easier to track strategy performance
- ✅ Professional money management
- ✅ Prevents over-leveraging after wins
- ✅ Prevents under-sizing after losses

**When to Use:**
- ✅ Trading with a defined risk management plan
- ✅ Want consistent risk exposure
- ✅ Following a trading system with fixed risk %
- ✅ Most professional trading strategies

---

## Method 2: Dynamic Position Sizing

### Settings:
```mql5
input bool UseDynamicContractSize = true;   // Use current balance
input double BaseAccountSize = 100000.0;    // Ignored when dynamic
```

### How It Works:
- Uses **current account balance** for all lot calculations
- Lot sizes **grow with profits, shrink with losses**
- Your risk per trade changes with your account size (compounding)

### Example:
**Initial Capital: $100,000**
**Risk: 0.83% per trade**

| Current Balance | Risk Calculation | Lot Size (USDJPY) |
|----------------|------------------|-------------------|
| $100,000 (start) | $100,000 × 0.83% = $830 | 9.01 lots |
| $103,560 (profit) | $103,560 × 0.83% = $860 | 9.33 lots ⬆️ |
| $110,000 (profit) | $110,000 × 0.83% = $913 | 9.91 lots ⬆️ |
| $95,000 (loss) | $95,000 × 0.83% = $789 | 8.56 lots ⬇️ |

**Benefits:**
- ✅ Geometric growth during winning streaks
- ✅ Automatic position sizing adjustment

**Risks:**
- ⚠️ Larger losses during drawdowns (compounding effect)
- ⚠️ Can lead to over-leveraging after wins
- ⚠️ Smaller positions after losses (harder to recover)
- ⚠️ More volatility in position sizes

**When to Use:**
- Only if you specifically want compounding
- You understand the increased risk during drawdowns
- You're comfortable with variable position sizes

---

## Your Current Situation

### Problem:
- **Current Balance:** $103,560
- **Expected Lot Size:** 9.01 lots (based on $100k)
- **Actual Lot Size:** 2.01 lots
- **Settings:** `UseDynamicContractSize = false`, `BaseAccountSize = 10000.0`

### Why 2.01 lots?
The EA is using the old default `BaseAccountSize = 10000.0`:
```
Risk = $10,000 × 0.83% = $83
Lot Size = $83 / (14.06 pips × $6.552/pip) = 0.90 lots

Wait, that's still not 2.01 lots...
```

Actually, let me recalculate with $103,560 and see if there's an issue with the risk parsing:
```
If 2.01 lots:
2.01 = Risk / (14.06 × 6.552)
Risk = 2.01 × 92.12 = $185.16
$185.16 = Balance × (risk_percent / 100)

If risk = 0.83%:
Balance = $185.16 / 0.0083 = $22,310 ❌

If balance = $103,560:
risk_percent = $185.16 / $103,560 = 0.179% ✓
```

**The EA is using ~0.179% risk, not 0.83%!**

This suggests the risk is **NOT being parsed correctly** from your signal!

---

## Solution

### Step 1: Update EA Settings
Change from:
```mql5
input double BaseAccountSize = 10000.0;
```

To:
```mql5
input double BaseAccountSize = 100000.0;  // Your starting capital
```

### Step 2: Verify Risk Parsing
Check EA logs for:
```
TradingSignalEA: Using risk percentage from signal: 0.83%
```

If it shows:
```
TradingSignalEA: Using default risk percentage: 0.65%
```

Then the signal's risk field is not being parsed!

### Step 3: Check Signal Format
Your signal JSON should have:
```json
{
  "risk": "0.83%"  ✓ Correct
}
```

NOT:
```json
{
  "risk": "0.83"   ❌ Missing %
  "risk": " 0.83%" ❌ Extra space
  "risk": "83"     ❌ Wrong format
}
```

---

## Expected Results After Fix

With `BaseAccountSize = 100000.0` and risk parsing working:

**For USDJPY Signal:**
```
Entry: 152.64
Stop: 152.4994
Risk: 0.83%
Stop Distance: 14.06 pips
Pip Value: $6.552/pip/lot

Without Broker Costs:
Lot Size = ($100,000 × 0.83%) / (14.06 × $6.552)
         = $830 / $92.12
         = 9.01 lots ✓

With Broker Costs:
Lot Size = $830 / ($92.12 + $19.10)
         = $830 / $111.22
         = 7.46 lots ✓
```

---

## How to Configure

### In MT5:
1. Right-click on EA → Properties → Inputs tab
2. Set `UseDynamicContractSize` = **false** (for fixed sizing)
3. Set `BaseAccountSize` = **100000** (your starting capital)
4. Verify `RiskPercent` = **0.65** (only used if signal doesn't specify risk)

### Expected Log Output:
```
TradingSignalEA: Using FIXED base account size: USD 100000 (Actual balance: USD 103560)
TradingSignalEA: Using risk percentage from signal: 0.83%
TradingSignalEA: Target Risk Amount: USD 830
TradingSignalEA: Final Lot Size: 7.46
```

---

**Last Updated:** 2025-10-23
**Recommended:** Fixed Position Sizing (UseDynamicContractSize = false)

