# RSI Calculation Analysis: TradingView vs MT5 EA

## 🔍 RSI Calculation Comparison

### TradingView (Pine Script)

```pinescript
// From trading__xauusd copy.txt (line 207)
rsiLength = input.int(14, "RSI Length", minval=2, maxval=50, group=G_RISK)
rsiValue = ta.rsi(close, rsiLength)
```

**Details:**
- **Function**: `ta.rsi(close, rsiLength)`
- **Period**: 14 (default)
- **Price Source**: Close prices
- **Timeframe**: Chart timeframe (15M for these strategies)
- **Calculation Method**: Wilder's Smoothing (standard RSI formula)
- **Update Frequency**: Every bar close (on confirmed bars)

**RSI Exit Logic:**
```pinescript
// Long exit: RSI crosses below overbought level
longExitRSI = useRsiExit and isBuyTrade and ta.crossunder(rsiValue, rsiOverbought)

// Short exit: RSI crosses above oversold level  
shortExitRSI = useRsiExit and not isBuyTrade and ta.crossover(rsiValue, rsiOversold)
```

---

### MT5 EA

```cpp
// From TradingSignalEA_revised.mq5 (line 4596-4625)
double CalculateRsi(const string symbol, int timeframe = PERIOD_CURRENT) {
   int handle = iRSI(symbol, timeframe, RsiLength, PRICE_CLOSE);
   // ... copy buffer and return rsiBuffer[0]
}
```

**Details:**
- **Function**: `iRSI(symbol, timeframe, RsiLength, PRICE_CLOSE)`
- **Period**: 14 (default, from `RsiLength` input)
- **Price Source**: Close prices (`PRICE_CLOSE`)
- **Timeframe**: `PERIOD_CURRENT` ⚠️ **POTENTIAL ISSUE**
- **Calculation Method**: MT5's built-in RSI (uses Wilder's Smoothing)
- **Update Frequency**: Every 5 seconds (from `RsiExitCheckInterval`)

**RSI Exit Logic:**
```cpp
// Long exit: RSI crosses below overbought level
if(previousRsi >= rsiOverbought && currentRsi < rsiOverbought) {
   shouldExit = true;
}

// Short exit: RSI crosses above oversold level
if(previousRsi <= rsiOversold && currentRsi > rsiOversold) {
   shouldExit = true;
}
```

---

## ⚠️ **CRITICAL DIFFERENCES**

### 1. **Timeframe Mismatch** ⚠️ **MAJOR ISSUE**

| Component | TradingView | MT5 EA |
|-----------|-------------|--------|
| **Signal Timeframe** | 15M (hardcoded in strategy) | 15M (from signal JSON) |
| **RSI Calculation Timeframe** | 15M (chart timeframe) | **PERIOD_CURRENT** (chart timeframe) |

**Problem:**
- If MT5 chart is on **different timeframe** (e.g., H1, M5), RSI values will **differ**
- This causes **different exit timing** between TradingView simulation and MT5 execution
- Example: If chart is H1, EA calculates RSI on H1, but signal was generated on 15M

**Impact:**
- RSI exit may trigger at **different times** or **not trigger at all**
- TradingView stats become **less reliable** for predicting MT5 behavior

**Solution Needed:**
```cpp
// Should use signal's timeframe instead of PERIOD_CURRENT
double currentRsi = CalculateRsi(symbol, ConvertTimeframeToPeriod(signal.timeframe));
```

---

### 2. **Update Frequency**

| Component | TradingView | MT5 EA |
|-----------|-------------|--------|
| **Update Frequency** | Every bar close (15M = every 15 minutes) | Every 5 seconds |
| **Crossover Detection** | On bar close (confirmed) | Real-time (may detect mid-bar) |

**Impact:**
- MT5 EA checks **more frequently** (every 5 seconds vs every 15 minutes)
- MT5 may detect crossover **earlier** than TradingView simulation
- This can cause **earlier exits** in MT5 vs TradingView

**Note:** This is actually **beneficial** - MT5 can exit faster when RSI conditions are met.

---

### 3. **RSI Formula**

Both use **Wilder's Smoothing** (standard RSI formula):
- **TradingView**: `ta.rsi()` uses Wilder's smoothing
- **MT5**: `iRSI()` uses Wilder's smoothing

**Formula (both):**
```
RS = Average Gain / Average Loss (over 14 periods)
RSI = 100 - (100 / (1 + RS))
```

**Result:** ✅ **Identical calculation** - no difference here

---

### 4. **Crossover Detection**

| Component | TradingView | MT5 EA |
|-----------|-------------|--------|
| **Method** | `ta.crossunder()` / `ta.crossover()` | Manual comparison (`previousRsi >= level && currentRsi < level`) |
| **Timing** | On bar close | Every 5 seconds |

**TradingView Logic:**
```pinescript
ta.crossunder(rsiValue, rsiOverbought)  // Returns true when RSI crosses below level
```

**MT5 EA Logic:**
```cpp
if(previousRsi >= rsiOverbought && currentRsi < rsiOverbought) {
   // Crossed below
}
```

**Result:** ✅ **Equivalent logic** - both detect crossover correctly

---

## 📊 **Summary Table**

| Aspect | TradingView | MT5 EA | Match? |
|--------|-------------|--------|--------|
| **RSI Period** | 14 | 14 | ✅ Yes |
| **Price Source** | Close | Close | ✅ Yes |
| **Formula** | Wilder's | Wilder's | ✅ Yes |
| **Timeframe** | 15M | **PERIOD_CURRENT** ⚠️ | ❌ **NO** |
| **Update Frequency** | Every 15 min | Every 5 sec | ⚠️ Different |
| **Crossover Logic** | Equivalent | Equivalent | ✅ Yes |

---

## 🐛 **Identified Issues**

### Issue #1: Timeframe Mismatch (CRITICAL)

**Current Code:**
```cpp
double currentRsi = CalculateRsi(symbol);  // Uses PERIOD_CURRENT
```

**Problem:**
- If MT5 chart is on H1, RSI is calculated on H1
- But signal was generated on 15M timeframe
- RSI values will be **completely different**

**Example:**
- TradingView: RSI(15M) = 72 (overbought)
- MT5 Chart H1: RSI(H1) = 45 (neutral)
- Result: Exit condition **never triggers** in MT5

**Fix Needed:**
```cpp
// Get signal's timeframe
int signalTimeframe = GetSignalTimeframeForPosition(ticket);  // Need to store this

// Convert to MT5 period
int mt5Period = ConvertTimeframeToMT5Period(signalTimeframe);  // 15 -> PERIOD_M15

// Calculate RSI on correct timeframe
double currentRsi = CalculateRsi(symbol, mt5Period);
```

---

### Issue #2: Signal Timeframe Not Stored

**Current Code:**
- Signal timeframe is parsed from JSON (`signal.timeframe`)
- But it's **not stored** with the position
- When checking RSI exit, EA doesn't know which timeframe to use

**Fix Needed:**
- Store signal timeframe in position comment or custom variable
- Use stored timeframe for RSI calculation

---

## ✅ **What Works Correctly**

1. **RSI Formula**: Both use Wilder's smoothing - identical
2. **RSI Period**: Both use 14 periods - identical
3. **Price Source**: Both use close prices - identical
4. **Crossover Logic**: Both detect crossovers correctly - equivalent
5. **Exit Conditions**: Both check same conditions - equivalent

---

## 🔧 **Recommended Fixes**

### Fix #1: Use Signal Timeframe for RSI

```cpp
// Store timeframe in position comment or use custom variable
// When checking RSI exit, extract timeframe from position

int GetPositionTimeframe(ulong ticket) {
   // Option 1: Store in comment (e.g., "XAUUSD_T137_15M")
   // Option 2: Use custom variable (requires storing in global array)
   // Option 3: Parse from signal ID if it contains timeframe info
   
   // For now, assume 15M (M15) as default
   return PERIOD_M15;
}

// In CheckRsiExitConditions():
int positionTimeframe = GetPositionTimeframe(ticket);
double currentRsi = CalculateRsi(symbol, positionTimeframe);
```

### Fix #2: Store Signal Timeframe with Position

```cpp
// When opening position, store timeframe in comment:
string comment = StringFormat("%s_%dM", signal.id, signal.timeframe);
request.comment = comment;

// When checking RSI exit, extract timeframe:
int ExtractTimeframeFromComment(string comment) {
   // Parse "XAUUSD_T137_15M" -> 15 -> PERIOD_M15
   // Implementation needed
}
```

---

## 📈 **Impact on Statistics**

### Why TradingView Stats May Not Match MT5 Results:

1. **Timeframe Mismatch** (if chart is not 15M):
   - Different RSI values → Different exit timing
   - May exit earlier/later or not at all

2. **Update Frequency**:
   - MT5 checks every 5 seconds
   - TradingView checks every 15 minutes
   - MT5 may exit **earlier** when RSI crosses

3. **Real vs Simulated**:
   - TradingView: Simulated execution
   - MT5: Real market execution
   - Slippage, spreads affect actual exit price

---

## 🎯 **Conclusion**

**RSI Calculation:**
- ✅ Formula: **Identical** (Wilder's smoothing)
- ✅ Period: **Identical** (14)
- ✅ Price Source: **Identical** (Close)
- ❌ **Timeframe: DIFFERENT** (15M vs PERIOD_CURRENT) ⚠️

**Main Issue:**
- **Timeframe mismatch** can cause different RSI values
- This leads to **different exit timing** between TradingView and MT5
- TradingView statistics become **less reliable** for predicting MT5 behavior

**Recommendation:**
- **Fix the timeframe issue** to ensure RSI is calculated on the same timeframe as the signal
- This will make TradingView statistics **more accurate** for MT5 execution






