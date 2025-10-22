# EA Target Adjustment Method for Broker Costs

## Overview
This document explains the **Target Adjustment Method** for compensating broker costs (commission and spread) in the TradingSignalEA. This is an alternative to reducing lot size.

## Two Methods Available

### Method 1: Reduce Lot Size (Original)
- **Settings**: `AccountForBrokerCosts = true`, `AdjustTargetForCosts = false`
- **Behavior**: Calculates a smaller lot size that accounts for broker costs
- **Effect**: Position size is reduced, target price stays the same
- **Total Risk**: Stop Loss Risk + Broker Costs = Target Risk

**Example (GBPUSD):**
- Target Risk: $650
- Stop Distance: 12 pips
- Without costs: 5.42 lots → $650 stop + $32 commission = $682 total (5% over)
- With costs: 4.85 lots → $582 stop + $68 commission = $650 total ✓

### Method 2: Adjust Target Price (NEW)
- **Settings**: `AccountForBrokerCosts = true`, `AdjustTargetForCosts = true`
- **Behavior**: Keeps the larger lot size, but extends the take profit target to compensate
- **Effect**: Position size stays larger, target price moves further away
- **Total Risk**: Still equals target risk, but compensated by extended profit target

**Example (GBPUSD):**
- Signal: SELL @ 1.3344, TP: 1.3332, SL: 1.3356 (12 pip target, 12 pip stop)
- Risk: 0.65% = $650 on $100,000 account
- Lot Size: 5.42 lots (not reduced)
- Broker Costs: $38 (spread + commission)
- **Adjusted TP**: 1.3332 → 1.33313 (approx 0.7 pips further)
  - Additional pips needed: $38 / (5.42 lots × $10/pip) = 0.7 pips
  - New target: 1.3332 - 0.0007 = 1.33313

**Why it works:**
- Stop Loss: 12 pips × 5.42 lots × $10/pip = $650.4
- Take Profit: 12.7 pips × 5.42 lots × $10/pip = $688.34
- After deducting $38 broker costs: $688.34 - $38 = $650.34 ✓
- **Net effect**: You still risk $650, but the profit target is extended to cover the costs

## Input Parameters

```mql5
input double ForexCommissionPerLot = 6.0;   // Commission per lot (round trip, USD)
input double GoldCommissionPerLot = 2.0;    // Commission per lot for XAUUSD (round trip, USD)
input bool AccountForBrokerCosts = true;    // Enable broker cost compensation
input bool AdjustTargetForCosts = false;    // Method: false = reduce lot, true = adjust target
```

## Calculation Details

### For Method 2 (Target Adjustment)

1. **Calculate Base Lot Size** (without cost reduction):
   ```
   Lot Size = Target Risk / (Stop Distance in Pips × Pip Value)
   ```

2. **Calculate Total Broker Costs**:
   ```
   Spread Cost = Spread in Pips × Pip Value × Lot Size
   Commission Cost = Commission per Lot × Lot Size
   Total Broker Costs = Spread Cost + Commission Cost
   ```

3. **Calculate Additional Pips Needed**:
   ```
   Additional Pips = Total Broker Costs / (Lot Size × Pip Value per Lot)
   ```

4. **Adjust Target Price**:
   ```
   For BUY:  Adjusted Target = Original Target + (Additional Pips × Pip Size)
   For SELL: Adjusted Target = Original Target - (Additional Pips × Pip Size)
   ```

### Example Calculation (GBPUSD SELL)

**Signal Input:**
- Symbol: GBPUSD
- Action: SELL
- Entry: 1.3344
- Target: 1.3332
- Stop: 1.3356
- Risk: 0.65%
- Account: $100,000 USD

**Step 1: Calculate Base Lot Size**
- Stop Distance: 1.3356 - 1.3344 = 0.0012 = 12 pips
- Target Risk: $100,000 × 0.65% = $650
- Pip Value: $10 per pip per lot (GBPUSD, standard)
- Base Lot Size: $650 / (12 pips × $10) = 5.42 lots

**Step 2: Calculate Broker Costs**
- Spread: 1.0 pips × $10 × 5.42 = $54.20
- Commission: $6/lot × 5.42 = $32.52
- Total: $54.20 + $32.52 = $86.72

**Step 3: Calculate Additional Pips**
- Additional Pips: $86.72 / (5.42 lots × $10/pip) = 1.6 pips

**Step 4: Adjust Target**
- Original Target: 1.3332
- For SELL (target below entry): 1.3332 - (1.6 × 0.0001) = 1.33304
- **Adjusted Target: 1.33304**

**Verification:**
- Stop Risk: 12 pips × 5.42 × $10 = $650.40
- Take Profit: 13.6 pips × 5.42 × $10 = $737.12
- After costs: $737.12 - $86.72 = $650.40 ✓

## Which Method to Use?

### Use Method 1 (Reduce Lot Size) When:
- You want to maintain the original profit target
- You're okay with slightly smaller position sizes
- Your risk-to-reward ratio is important to preserve
- You have tight margin requirements

### Use Method 2 (Adjust Target) When:
- You want larger position sizes for better profit potential
- You're okay with slightly extended profit targets
- Your signals have sufficient room before key levels
- You want to maximize the actual trade volume closer to the calculated risk

## Important Notes

1. **Stop Loss is Never Adjusted**: The stop loss always remains at the signal's specified level. Only the take profit target is extended.

2. **Risk Remains Constant**: Both methods ensure your total risk (including broker costs) equals your target risk percentage.

3. **Pip Size Definitions**:
   - **XAUUSD**: 1 pip = 0.10 (e.g., 2650.00 → 2650.10)
   - **JPY pairs**: 1 pip = 0.01 (e.g., 150.00 → 150.01)
   - **Standard pairs**: 1 pip = 0.0001 (e.g., 1.3344 → 1.3345)

4. **Commission Configuration**: Adjust the `ForexCommissionPerLot` and `GoldCommissionPerLot` parameters to match your broker's actual fees.

5. **Currency Conversion**: The EA automatically handles currency conversion for accounts not denominated in USD.

## Logging

When `AdjustTargetForCosts = true`, the EA logs:
```
========================================
TARGET ADJUSTMENT FOR BROKER COSTS
----------------------------------------
Original Target: 1.3332
Total Broker Costs: USD 86.72
Additional Pips Needed: 1.6
Adjusted Target: 1.33304
Target Adjustment: -0.00016 (1.6 pips)
========================================
```

## Testing Recommendation

Test both methods on a demo account to see which one better suits your trading style and broker conditions.

---

**Last Updated**: October 22, 2025
**EA Version**: 5.0+

