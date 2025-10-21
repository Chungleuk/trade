# EA Lot Size Calculation Verification

## Test Parameters
- **Account Balance**: $100,000 USD
- **Risk Percentage**: 0.65%
- **Target Risk Amount**: $650 per trade

## Expected Calculations by Symbol

### 1. EURUSD
**Signal Example:**
```json
{"action":"SELL","symbol":"EURUSD","entry":"1.1608","stop":"1.1621","risk":"0.65%"}
```

**Calculation:**
- Entry: 1.1608
- Stop: 1.1621
- Price Difference: 0.0013 (13 pips)
- Pip Size: 0.0001
- Stop Distance: 13 pips
- Contract Size: 100,000
- Pip Value per Lot: 100,000 × 0.0001 = $10 USD per pip
- **Lot Size**: $650 / (13 pips × $10) = 650 / 130 = **5.00 lots**
- **Actual Risk**: 5.00 × 13 × $10 = **$650** ✓

---

### 2. GBPUSD
**Signal Example:**
```json
{"action":"BUY","symbol":"GBPUSD","entry":"1.3000","stop":"1.2985","risk":"0.65%"}
```

**Calculation:**
- Entry: 1.3000
- Stop: 1.2985
- Price Difference: 0.0015 (15 pips)
- Pip Size: 0.0001
- Stop Distance: 15 pips
- Pip Value per Lot: $10 USD per pip
- **Lot Size**: $650 / (15 × $10) = 650 / 150 = **4.33 lots**
- **Actual Risk**: 4.33 × 15 × $10 = **$649.50** ✓

---

### 3. AUDUSD
**Signal Example:**
```json
{"action":"SELL","symbol":"AUDUSD","entry":"0.6500","stop":"0.6515","risk":"0.65%"}
```

**Calculation:**
- Entry: 0.6500
- Stop: 0.6515
- Price Difference: 0.0015 (15 pips)
- Pip Size: 0.0001
- Stop Distance: 15 pips
- Pip Value per Lot: $10 USD per pip
- **Lot Size**: $650 / (15 × $10) = 650 / 150 = **4.33 lots**
- **Actual Risk**: 4.33 × 15 × $10 = **$649.50** ✓

---

### 4. NZDUSD
**Signal Example:**
```json
{"action":"BUY","symbol":"NZDUSD","entry":"0.5900","stop":"0.5885","risk":"0.65%"}
```

**Calculation:**
- Entry: 0.5900
- Stop: 0.5885
- Price Difference: 0.0015 (15 pips)
- Pip Size: 0.0001
- Stop Distance: 15 pips
- Pip Value per Lot: $10 USD per pip
- **Lot Size**: $650 / (15 × $10) = 650 / 150 = **4.33 lots**
- **Actual Risk**: 4.33 × 15 × $10 = **$649.50** ✓

---

### 5. USDCHF
**Signal Example:**
```json
{"action":"BUY","symbol":"USDCHF","entry":"0.8800","stop":"0.8785","risk":"0.65%"}
```

**Calculation:**
- Entry: 0.8800
- Stop: 0.8785
- Price Difference: 0.0015 (15 pips)
- Pip Size: 0.0001
- Stop Distance: 15 pips
- Contract Size: 100,000
- Quote Currency: CHF
- Pip Value per Lot: 100,000 × 0.0001 = 10 CHF per pip

**Currency Conversion Required:**
- Need USDCHF rate = 0.8800
- Pip Value in USD: 10 CHF / 0.8800 = $11.36 USD per pip

- **Lot Size**: $650 / (15 × $11.36) = 650 / 170.4 = **3.81 lots**
- **Actual Risk**: 3.81 × 15 × $11.36 = **$649.62** ✓

---

### 6. USDJPY
**Signal Example:**
```json
{"action":"SELL","symbol":"USDJPY","entry":"150.50","stop":"150.65","risk":"0.65%"}
```

**Calculation:**
- Entry: 150.50
- Stop: 150.65
- Price Difference: 0.15 (15 pips)
- Pip Size: 0.01
- Stop Distance: 15 pips
- Contract Size: 100,000
- Current Price: ~150.50
- Pip Value per Lot: (100,000 × 0.01) / 150.50 = $6.64 USD per pip

- **Lot Size**: $650 / (15 × $6.64) = 650 / 99.6 = **6.53 lots**
- **Actual Risk**: 6.53 × 15 × $6.64 = **$650.82** ✓

---

### 7. XAUUSD (Gold)
**Signal Example:**
```json
{"action":"BUY","symbol":"XAUUSD","entry":"2650.00","stop":"2640.00","risk":"0.65%"}
```

**Calculation:**
- Entry: 2650.00
- Stop: 2640.00
- Price Difference: 10.00 (100 pips if using 0.10 as pip)
- Pip Size: 0.10 (traditional pip for gold)
- Stop Distance: 100 pips
- Contract Size: 100 oz
- Pip Value per Lot: $10 USD per pip (1 lot = 100 oz, 0.10 move = $10)

- **Lot Size**: $650 / (100 × $10) = 650 / 1000 = **0.65 lots**
- **Actual Risk**: 0.65 × 100 × $10 = **$650** ✓

---

## Summary Table

| Symbol  | Entry    | Stop     | Pips | Pip Value | Lot Size | Risk Amount |
|---------|----------|----------|------|-----------|----------|-------------|
| EURUSD  | 1.1608   | 1.1621   | 13   | $10.00    | 5.00     | $650.00     |
| GBPUSD  | 1.3000   | 1.2985   | 15   | $10.00    | 4.33     | $649.50     |
| AUDUSD  | 0.6500   | 0.6515   | 15   | $10.00    | 4.33     | $649.50     |
| NZDUSD  | 0.5900   | 0.5885   | 15   | $10.00    | 4.33     | $649.50     |
| USDCHF  | 0.8800   | 0.8785   | 15   | $11.36    | 3.81     | $649.62     |
| USDJPY  | 150.50   | 150.65   | 15   | $6.64     | 6.53     | $650.82     |
| XAUUSD  | 2650.00  | 2640.00  | 100  | $10.00    | 0.65     | $650.00     |

## Key Points

1. **All calculations target $650 risk (0.65% of $100,000)**
2. **Pip values vary by symbol type:**
   - Major pairs (USD quoted): $10/pip per lot
   - JPY pairs: ~$6-7/pip per lot (depends on current price)
   - CHF pairs: ~$11/pip per lot (requires conversion)
   - XAUUSD: $10/pip per lot (pip = 0.10)

3. **The EA now correctly:**
   - Parses "0.65%" format from signals
   - Calculates pip sizes for different symbol types
   - Converts to account currency when needed
   - Applies broker lot constraints
   - Verifies actual risk vs target risk
   - Rejects trades with >50% risk deviation

## Testing Recommendations

1. Test with demo account first
2. Verify broker's pip definitions (some use 5-digit quotes)
3. Check actual fills match calculations
4. Monitor EA logs for risk calculations
5. Verify currency conversion rates are correct

## Safety Features

- ✅ Rejects trades if stop is on wrong side of entry
- ✅ Warns if risk deviation > 15%
- ✅ Rejects if actual risk > 150% of target
- ✅ Applies broker min/max lot constraints
- ✅ Comprehensive logging for debugging

