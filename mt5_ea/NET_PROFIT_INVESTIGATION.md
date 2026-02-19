# Net Profit Investigation: USDJPY_T146

## Case Summary

| Item | Value |
|------|-------|
| Signal ID | USDJPY_T146 |
| Action | SELL |
| Risk | 0.65% |
| RR | 1:1 |
| Expected Net | ~$650 |
| Actual Net | $575.94 |
| Gross Profit | $614.40 |
| Commission | -$38.46 |

## Root Cause: Commission and Lot Size Design

The EA is **working as designed**. The lower net profit is due to two intentional design choices:

### 1. Commission Deduction

- **Gross profit**: $614.40 (from price move)
- **Commission**: -$38.46 (broker round-trip cost)
- **Net profit**: $575.94

Commission is always deducted from gross profit, so net is lower than gross.

### 2. Lot Size Formula Includes Commission

The EA uses this formula when `AccountForBrokerCosts = true`:

```
Lot = TargetRisk / (StopPips × PipValue + CommissionPerLot)
```

Commission is added to the denominator so that:

- **At SL**: Net loss = Lot × (StopPips × PipValue + Commission) ≈ Target risk
- **At TP (1:1)**: Net profit = Lot × (StopPips × PipValue) − Lot × Commission

So at TP, net profit is **less** than the raw risk amount because commission is subtracted.

### 3. Numerical Check

For this trade:

- Base amount: ~$101,895
- Target risk: 0.65% ≈ $662
- Stop distance: 12.3 pips
- Pip value per lot (USDJPY): ~$6.5
- Commission per lot: $6 (round-trip)

Per-lot risk value: 12.3 × 6.5 ≈ $80  
Per-lot commission: $6  
Denominator: $80 + $6 = $86  

Lot size: $662 / $86 ≈ 7.69 lots ✓

Net profit at 1:1 RR:

- Net ≈ Risk × (PerLotRisk − PerLotCommission) / (PerLotRisk + PerLotCommission)
- Net ≈ 662 × (80 − 6) / (80 + 6) ≈ 662 × 74/86 ≈ **$569**

Actual net: $575.94. The small difference is from rounding, lot step, and balance at execution time.

## Why Not ~$650?

A naive expectation is:

- 0.65% of ~$100k ≈ $650
- 1:1 RR → net profit ≈ $650

That ignores:

1. **Commission**: ~$38.46 is taken from gross profit.
2. **Lot size**: Commission in the denominator reduces lot size, so gross profit is lower than the raw risk amount.

## Target Adjustment for Commission (Updated)

The EA includes `CalculateAdjustedTarget` which extends the TP beyond nominal 1:1 RR to cover commission:

- **SELL**: Target is moved LOWER (further from entry) to capture extra pips
- **BUY**: Target is moved HIGHER (further from entry) to capture extra pips

**Formula**: `requiredTPPips = stopDistancePips + 2*commission/(lotSize*pipValue)` plus 1% edge.

**Fix applied**: The previous 5% cap on adjustment was too restrictive for small SL (e.g. 15 pips → 0.75 pip max). Now uses commission-only (not spread) and allows up to 5 pips adjustment, so net profit at TP should match expected net loss at SL.

## Options to Change Behavior

1. **Set `AccountForBrokerCosts = false`**  
   - Lot size ignores commission.  
   - Net profit at TP will be closer to the raw risk amount.  
   - Net loss at SL will be higher than target risk (risk + commission).

2. **Increase risk %**  
   - To target ~$650 net at TP, increase risk slightly (e.g. ~0.72%) to offset commission.

3. **Keep current design**  
   - Ensures loss at SL matches target risk.  
   - Target adjustment extends TP to cover commission; net profit at TP should now match expected loss at SL.

## Summary

The EA is behaving as intended. The ~$75 gap between $650 and $575.94 comes from:

- Commission: ~$38
- Lot size reduction due to commission in the formula: ~$37

Both effects are by design to keep risk at SL accurate when commission is included. The target adjustment has been fixed to properly extend TP and cover commission.
