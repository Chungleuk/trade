# Lot Size Calculation Verification - All Currency Pairs

## Test Cases for $100,000 Account with 0.65% Risk = $650

---

## 1. XAUUSD (Gold)
**Signal Example:**
- Entry: 2650.00
- Stop: 2625.00
- Stop Distance: 25.0 (price units) = 250 pips (pip = 0.10)

**Current EA Logic:**
```mql5
pipSize = 0.10
contractSize = 100.0 oz
pipValuePerLot = 10.0 USD  // Fixed value
pipValueCurrency = "USD"
```

**Calculation:**
- Stop distance: 25.0 / 0.10 = 250 pips
- Pip value: $10 per pip per lot (CORRECT ✓)
- Lot size: $650 / (250 pips × $10/pip) = $650 / $2,500 = 0.26 lots ✓

**Verdict: CORRECT ✓**

---

## 2. USDJPY (USD/Japanese Yen)
**Signal Example:**
- Entry: 152.236
- Stop: 152.106
- Stop Distance: 0.130 = 13.0 pips (pip = 0.01)

**Current EA Logic:**
```mql5
pipSize = 0.01
contractSize = 100,000 USD
isJPY = true, baseCurrency = "USD", quoteCurrency = "JPY"
pipValuePerLot = (100,000 × 0.01) / 152.236 = 6.57 USD
pipValueCurrency = "USD" (baseCurrency because JPY is quote)
```

**Calculation:**
- Stop distance: 0.130 / 0.01 = 13.0 pips
- Pip value: 6.57 USD per pip per lot (CORRECT ✓)
- For USD account: No conversion needed ✓
- Lot size: $650 / (13.0 × $6.57) = $650 / $85.41 = 7.61 lots ✓

**Verdict: CORRECT ✓** (after our fix)

---

## 3. EURJPY (Euro/Japanese Yen)
**Signal Example:**
- Entry: 165.50
- Stop: 165.30
- Stop Distance: 0.20 = 20.0 pips (pip = 0.01)

**Current EA Logic:**
```mql5
pipSize = 0.01
contractSize = 100,000 EUR
isJPY = true, baseCurrency = "EUR", quoteCurrency = "JPY"
pipValuePerLot = (100,000 × 0.01) / 165.50 = 6.04 EUR per pip
pipValueCurrency = "EUR" (baseCurrency because JPY is quote)
```

**Calculation:**
- Stop distance: 20.0 pips
- Pip value: 6.04 EUR per pip per lot (CORRECT ✓)
- For USD account: Need to convert EUR to USD
  - If EURUSD = 1.10, then 6.04 EUR × 1.10 = 6.64 USD per pip ✓
- Lot size: $650 / (20.0 × $6.64) = $650 / $132.80 = 4.89 lots ✓

**Verdict: CORRECT ✓** (if EURUSD conversion works properly)

---

## 4. EURUSD (Euro/US Dollar)
**Signal Example:**
- Entry: 1.1000
- Stop: 1.0990
- Stop Distance: 0.0010 = 10.0 pips (pip = 0.0001)

**Current EA Logic:**
```mql5
pipSize = 0.0001
contractSize = 100,000 EUR
isJPY = false, baseCurrency = "EUR", quoteCurrency = "USD"
pipValuePerLot = 100,000 × 0.0001 = 10.0 USD per pip
pipValueCurrency = "USD" (quoteCurrency)
```

**Calculation:**
- Stop distance: 10.0 pips
- Pip value: 10.0 USD per pip per lot (CORRECT ✓)
- For USD account: No conversion needed ✓
- Lot size: $650 / (10.0 × $10.0) = $650 / $100 = 6.5 lots ✓

**Verdict: CORRECT ✓**

---

## 5. GBPUSD (British Pound/US Dollar)
**Signal Example:**
- Entry: 1.3344
- Stop: 1.3356
- Stop Distance: 0.0012 = 12.0 pips (pip = 0.0001)

**Current EA Logic:**
```mql5
pipSize = 0.0001
contractSize = 100,000 GBP
isJPY = false, baseCurrency = "GBP", quoteCurrency = "USD"
pipValuePerLot = 100,000 × 0.0001 = 10.0 USD per pip
pipValueCurrency = "USD" (quoteCurrency)
```

**Calculation:**
- Stop distance: 12.0 pips
- Pip value: 10.0 USD per pip per lot (CORRECT ✓)
- For USD account: No conversion needed ✓
- Lot size: $650 / (12.0 × $10.0) = $650 / $120 = 5.42 lots ✓

**Verdict: CORRECT ✓**

---

## 6. AUDUSD (Australian Dollar/US Dollar)
**Signal Example:**
- Entry: 0.6500
- Stop: 0.6485
- Stop Distance: 0.0015 = 15.0 pips (pip = 0.0001)

**Current EA Logic:**
```mql5
pipSize = 0.0001
contractSize = 100,000 AUD
isJPY = false, baseCurrency = "AUD", quoteCurrency = "USD"
pipValuePerLot = 100,000 × 0.0001 = 10.0 USD per pip
pipValueCurrency = "USD" (quoteCurrency)
```

**Calculation:**
- Stop distance: 15.0 pips
- Pip value: 10.0 USD per pip per lot (CORRECT ✓)
- For USD account: No conversion needed ✓
- Lot size: $650 / (15.0 × $10.0) = $650 / $150 = 4.33 lots ✓

**Verdict: CORRECT ✓**

---

## 7. NZDUSD (New Zealand Dollar/US Dollar)
**Signal Example:**
- Entry: 0.5900
- Stop: 0.5890
- Stop Distance: 0.0010 = 10.0 pips (pip = 0.0001)

**Current EA Logic:**
```mql5
pipSize = 0.0001
contractSize = 100,000 NZD
isJPY = false, baseCurrency = "NZD", quoteCurrency = "USD"
pipValuePerLot = 100,000 × 0.0001 = 10.0 USD per pip
pipValueCurrency = "USD" (quoteCurrency)
```

**Calculation:**
- Pip value: 10.0 USD per pip per lot (CORRECT ✓)
- For USD account: No conversion needed ✓
- Lot size: $650 / (10.0 × $10.0) = $650 / $100 = 6.5 lots ✓

**Verdict: CORRECT ✓**

---

## 8. USDCHF (US Dollar/Swiss Franc)
**Signal Example:**
- Entry: 0.8500
- Stop: 0.8515
- Stop Distance: 0.0015 = 15.0 pips (pip = 0.0001)

**Current EA Logic:**
```mql5
pipSize = 0.0001
contractSize = 100,000 USD
isJPY = false, baseCurrency = "USD", quoteCurrency = "CHF"
pipValuePerLot = 100,000 × 0.0001 = 10.0 CHF per pip
pipValueCurrency = "CHF" (quoteCurrency)
```

**Calculation:**
- Stop distance: 15.0 pips
- Pip value: 10.0 CHF per pip per lot
- **PROBLEM: Need to convert CHF to USD!**
- For USD account: Need USDCHF or CHFUSD pair
  - If USDCHF = 0.8500, then 10.0 CHF / 0.8500 = 11.76 USD per pip ✓
  - Or if CHFUSD exists: 10.0 CHF × rate
- Lot size: $650 / (15.0 × $11.76) = $650 / $176.40 = 3.68 lots ✓

**Verdict: CORRECT ✓** (if currency conversion works)

---

## 9. EURGBP (Euro/British Pound)
**Signal Example:**
- Entry: 0.8500
- Stop: 0.8485
- Stop Distance: 0.0015 = 15.0 pips (pip = 0.0001)

**Current EA Logic:**
```mql5
pipSize = 0.0001
contractSize = 100,000 EUR
isJPY = false, baseCurrency = "EUR", quoteCurrency = "GBP"
pipValuePerLot = 100,000 × 0.0001 = 10.0 GBP per pip
pipValueCurrency = "GBP" (quoteCurrency)
```

**Calculation:**
- Stop distance: 15.0 pips
- Pip value: 10.0 GBP per pip per lot
- **Need to convert GBP to USD!**
- For USD account: Need GBPUSD pair
  - If GBPUSD = 1.3000, then 10.0 GBP × 1.3000 = 13.0 USD per pip ✓
- Lot size: $650 / (15.0 × $13.0) = $650 / $195 = 3.33 lots ✓

**Verdict: CORRECT ✓** (if GBPUSD conversion works)

---

## 10. EURAUD (Euro/Australian Dollar)
**Signal Example:**
- Entry: 1.6500
- Stop: 1.6480
- Stop Distance: 0.0020 = 20.0 pips (pip = 0.0001)

**Current EA Logic:**
```mql5
pipSize = 0.0001
contractSize = 100,000 EUR
isJPY = false, baseCurrency = "EUR", quoteCurrency = "AUD"
pipValuePerLot = 100,000 × 0.0001 = 10.0 AUD per pip
pipValueCurrency = "AUD" (quoteCurrency)
```

**Calculation:**
- Stop distance: 20.0 pips
- Pip value: 10.0 AUD per pip per lot
- **Need to convert AUD to USD!**
- For USD account: Need AUDUSD pair
  - If AUDUSD = 0.6500, then 10.0 AUD × 0.6500 = 6.5 USD per pip ✓
- Lot size: $650 / (20.0 × $6.5) = $650 / $130 = 5.0 lots ✓

**Verdict: CORRECT ✓** (if AUDUSD conversion works)

---

## Summary

### ✓ CORRECT for USD Account:
1. **XAUUSD** - Fixed $10/pip, no conversion needed ✓
2. **USDJPY** - Calculates in USD (base), no conversion needed ✓
3. **EURUSD** - Quote is USD, no conversion needed ✓
4. **GBPUSD** - Quote is USD, no conversion needed ✓
5. **AUDUSD** - Quote is USD, no conversion needed ✓
6. **NZDUSD** - Quote is USD, no conversion needed ✓

### ✓ CORRECT (requires currency conversion):
7. **EURJPY** - Needs EURUSD conversion ✓
8. **USDCHF** - Needs USDCHF or CHFUSD conversion ✓
9. **EURGBP** - Needs GBPUSD conversion ✓
10. **EURAUD** - Needs AUDUSD conversion ✓

### Potential Issues:
- **Currency conversion must work correctly** for cross pairs
- The EA needs to find the conversion pair (e.g., GBPUSD, AUDUSD, etc.)
- If conversion pair not found, it assumes 1:1 (WRONG!)

### Critical Test:
For non-USD quote currencies (CHF, GBP, AUD, EUR, JPY when not USD base), verify:
1. The EA finds the correct conversion pair
2. It applies the conversion in the correct direction (multiply or divide)
3. The final pip value in USD is accurate

**RECOMMENDATION:** Test with USDCHF or EURGBP to ensure cross-pair conversions work!

