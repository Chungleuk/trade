# Currency Conversion Logic - Complete Explanation

## Overview
This document explains how the EA correctly calculates pip values and converts them to the account currency for ALL currency pairs.

---

## Step-by-Step Process

### 1. Calculate Pip Value in Native Currency

#### For XAUUSD (Gold):
```
Pip Size: 0.10
Contract Size: 100 oz
Pip Value: $10 per pip per lot (FIXED)
Currency: USD
```

#### For JPY Pairs (USDJPY, EURJPY, GBPJPY):
```
Pip Size: 0.01
Contract Size: 100,000 base currency
Formula: (ContractSize × PipSize) / CurrentPrice
Example USDJPY at 152.00:
  = (100,000 × 0.01) / 152.00
  = 1,000 JPY / 152.00
  = 6.58 USD per pip per lot
Currency: Base Currency (USD, EUR, GBP)
```

#### For Standard Pairs (EURUSD, GBPUSD, USDCHF, etc.):
```
Pip Size: 0.0001
Contract Size: 100,000 base currency
Formula: ContractSize × PipSize
Example EURUSD:
  = 100,000 × 0.0001
  = 10 USD per pip per lot
Currency: Quote Currency (USD, CHF, etc.)
```

---

### 2. Determine Pip Value Currency

| Pair Type | Example | Pip Value Currency |
|-----------|---------|-------------------|
| XAUUSD | Gold | USD (always) |
| JPY pairs | USDJPY | USD (base) |
| JPY pairs | EURJPY | EUR (base) |
| Standard | EURUSD | USD (quote) |
| Standard | GBPUSD | USD (quote) |
| Standard | USDCHF | CHF (quote) |
| Standard | EURGBP | GBP (quote) |

---

### 3. Convert to Account Currency (if needed)

#### No Conversion Needed:
- XAUUSD with USD account → Already in USD ✓
- USDJPY with USD account → Already in USD ✓
- EURUSD with USD account → Already in USD ✓
- GBPUSD with USD account → Already in USD ✓

#### Conversion Required:
- USDCHF with USD account → CHF → USD
- EURGBP with USD account → GBP → USD
- EURJPY with USD account → EUR → USD

---

## Conversion Methods

### Method 1: Direct Pair (MULTIPLY)
**When:** Conversion pair = `PipValueCurrency + AccountCurrency`
**Example:** Converting GBP to USD using GBPUSD
```
Pip Value: 10 GBP
GBPUSD Rate: 1.3000
Converted: 10 × 1.3000 = 13.0 USD ✓
```

### Method 2: Inverse Pair (DIVIDE)
**When:** Conversion pair = `AccountCurrency + PipValueCurrency`
**Example:** Converting CHF to USD using USDCHF
```
Pip Value: 10 CHF
USDCHF Rate: 0.8500 (meaning 1 USD = 0.85 CHF)
Converted: 10 / 0.8500 = 11.76 USD ✓
```

---

## Complete Examples

### Example 1: EURUSD (USD Account)
```
Symbol: EURUSD
Entry: 1.1000, Stop: 1.0990
Stop Distance: 10 pips
Risk: 0.65% of $100,000 = $650

Step 1: Calculate Pip Value
  = 100,000 × 0.0001
  = 10 USD per pip per lot
  Currency: USD (quote)

Step 2: Check Currency
  pipValueCurrency = "USD"
  accountCurrency = "USD"
  → No conversion needed ✓

Step 3: Calculate Lot Size
  = $650 / (10 pips × $10/pip)
  = $650 / $100
  = 6.5 lots ✓
```

### Example 2: USDJPY (USD Account)
```
Symbol: USDJPY
Entry: 152.236, Stop: 152.106
Stop Distance: 13 pips
Risk: 0.83% of $100,000 = $830

Step 1: Calculate Pip Value
  = (100,000 × 0.01) / 152.236
  = 1,000 / 152.236
  = 6.57 USD per pip per lot
  Currency: USD (base, because JPY is quote)

Step 2: Check Currency
  pipValueCurrency = "USD"
  accountCurrency = "USD"
  → No conversion needed ✓

Step 3: Calculate Lot Size
  = $830 / (13 pips × $6.57/pip)
  = $830 / $85.41
  = 9.72 lots ✓
```

### Example 3: USDCHF (USD Account)
```
Symbol: USDCHF
Entry: 0.8500, Stop: 0.8515
Stop Distance: 15 pips
Risk: 0.65% of $100,000 = $650

Step 1: Calculate Pip Value
  = 100,000 × 0.0001
  = 10 CHF per pip per lot
  Currency: CHF (quote)

Step 2: Convert CHF to USD
  pipValueCurrency = "CHF"
  accountCurrency = "USD"
  → Need conversion!
  
  Try: CHFUSD (not available on most brokers)
  Try: USDCHF = 0.8500 ✓
  
  Conversion: 10 CHF / 0.8500 = 11.76 USD per pip ✓

Step 3: Calculate Lot Size
  = $650 / (15 pips × $11.76/pip)
  = $650 / $176.40
  = 3.68 lots ✓
```

### Example 4: EURGBP (USD Account)
```
Symbol: EURGBP
Entry: 0.8500, Stop: 0.8485
Stop Distance: 15 pips
Risk: 0.65% of $100,000 = $650

Step 1: Calculate Pip Value
  = 100,000 × 0.0001
  = 10 GBP per pip per lot
  Currency: GBP (quote)

Step 2: Convert GBP to USD
  pipValueCurrency = "GBP"
  accountCurrency = "USD"
  → Need conversion!
  
  Try: GBPUSD = 1.3000 ✓
  
  Conversion: 10 GBP × 1.3000 = 13.0 USD per pip ✓

Step 3: Calculate Lot Size
  = $650 / (15 pips × $13.0/pip)
  = $650 / $195
  = 3.33 lots ✓
```

### Example 5: EURJPY (USD Account)
```
Symbol: EURJPY
Entry: 165.50, Stop: 165.30
Stop Distance: 20 pips
Risk: 0.65% of $100,000 = $650

Step 1: Calculate Pip Value
  = (100,000 × 0.01) / 165.50
  = 1,000 / 165.50
  = 6.04 EUR per pip per lot
  Currency: EUR (base, because JPY is quote)

Step 2: Convert EUR to USD
  pipValueCurrency = "EUR"
  accountCurrency = "USD"
  → Need conversion!
  
  Try: EURUSD = 1.1000 ✓
  
  Conversion: 6.04 EUR × 1.1000 = 6.64 USD per pip ✓

Step 3: Calculate Lot Size
  = $650 / (20 pips × $6.64/pip)
  = $650 / $132.80
  = 4.89 lots ✓
```

---

## Error Handling

### Conversion Pair Not Found
If neither conversion pair exists:
```
ERROR - Cannot find conversion rate!
Tried: CHFUSD (not available)
Tried: USDCHF (not available)
WARNING: Using 1:1 conversion (INACCURATE!)
This will cause INCORRECT lot size calculation!
```

**Solution:** Ensure your broker provides the necessary conversion pairs in their symbol list.

---

## Testing Checklist

✅ **USD Quote (No Conversion):**
- [ ] EURUSD
- [ ] GBPUSD
- [ ] AUDUSD
- [ ] NZDUSD

✅ **JPY Pairs (USD Account):**
- [ ] USDJPY
- [ ] EURJPY
- [ ] GBPJPY

✅ **Cross Pairs (Requires Conversion):**
- [ ] USDCHF (needs USDCHF)
- [ ] EURGBP (needs GBPUSD)
- [ ] EURAUD (needs AUDUSD)
- [ ] GBPJPY (needs GBPUSD)

✅ **Gold:**
- [ ] XAUUSD

---

## Common Issues and Fixes

### Issue 1: Lot Size Too High (5× error)
**Cause:** Double currency conversion for JPY pairs
**Fix:** ✅ Check pipValueCurrency is set to base currency for JPY pairs

### Issue 2: Lot Size Slightly Off (<10% error)
**Cause:** Broker costs not accounted for
**Fix:** ✅ Enable AccountForBrokerCosts

### Issue 3: Lot Size Completely Wrong for Cross Pairs
**Cause:** Conversion pair not found, using 1:1
**Fix:** ✅ Check EA logs for "Cannot find conversion rate" warning
**Solution:** Contact broker or add manual conversion rates

---

**Last Updated:** 2025-10-23
**Version:** 2.0 (Complete Rewrite)

