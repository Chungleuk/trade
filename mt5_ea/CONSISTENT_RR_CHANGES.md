# Consistent 1:1 RR Configuration

## Date: 2026-01-14

## Changes Made for Consistent 1:1 Risk:Reward

### Problem:
- Turtle confirmation setting was NOT working (removed from filters during optimization)
- Turtle opposite breakout exits caused early exits with inconsistent RR
- Duration exits caused early exits with inconsistent RR
- User requested consistent 1:1 RR at target/stop only

---

## Solution: Disabled Early Exits

### 1. ✅ Duration Exit - DISABLED

**Changed:**
```pinescript
// OLD:
maxTradeDuration = 40 bars

// NEW:
maxTradeDuration = 1000 bars  // Effectively disabled
```

**Files:** All three (XAUUSD, GBPUSD, USDJPY)

**Impact:** Trades will only exit at target or stop, not after time limit.

---

### 2. ✅ Turtle Opposite Breakout Exit - DISABLED

**Changed:**
```pinescript
// OLD:
useOppositeBreakoutExit = true

// NEW:
useOppositeBreakoutExit = false
```

**Files:** XAUUSD, USDJPY (GBPUSD doesn't have this setting)

**Impact:** Trades will not exit early on opposite Donchian breakout.

---

### 3. ✅ Turtle Confirmation - Clarified as DISABLED

**Changed tooltip:**
```pinescript
useTurtleConfirmation = false
// Updated tooltip: "DISABLED - Not used in entry filters"
```

**Why:** Turtle confirmation was already removed from filter conditions during filter optimization. The setting no longer has any effect on entries.

---

## Exit Logic Now:

### Only 2 Exit Reasons:
1. **TARGET** - Take profit hit = WIN (exact 1:1 RR)
2. **STOP** - Stop loss hit = LOSS (exact 1:1 RR)

### Removed Exit Reasons:
- ❌ **TURTLE** - Opposite breakout (disabled)
- ❌ **EXPIRED** - Duration timeout (disabled)

---

## Expected Impact:

### Before Changes:
- Exits: TARGET, STOP, TURTLE, EXPIRED
- RR: Inconsistent (TURTLE and EXPIRED exit at market price)
- Winrate: Variable (early exits sometimes helped, sometimes hurt)
- Results: "WIN EXPIRED", "LOSS TURTLE", etc.

### After Changes:
- Exits: TARGET, STOP only
- RR: Consistent 1:1 exactly as configured
- Winrate: May decrease slightly (no early win locks, no early loss cuts)
- Results: "WIN TARGET", "LOSS STOP" only
- Average loss: Exactly -R
- Average win: Exactly +R (1:1)

---

## Monitoring Recommendations:

### Key Metrics:
- **Average Win:** Should be very close to 1R (entry-to-target distance)
- **Average Loss:** Should be very close to -1R (entry-to-stop distance)
- **RR Ratio:** Should be consistently 1.00 (not 0.8 or 1.2)
- **Winrate:** Need 50%+ for profitability at 1:1 RR

### If Winrate < 50%:
Consider re-enabling either:
- Turtle opposite breakout exit (helps cut losses early)
- Duration exit (prevents holding losing trades too long)

But note: Re-enabling will make RR inconsistent again.

---

## Files Modified:

1. **mt5_ea/trading__xauusd copy.txt** ✅
   - `maxTradeDuration = 1000`
   - `useOppositeBreakoutExit = false`
   - Updated tooltips

2. **mt5_ea/trading__gbpusd.txt** ✅
   - `maxTradeDuration = 1000`
   - (No opposite breakout setting in this file)

3. **mt5_ea/trading__usdjpy.txt** ✅
   - `maxTradeDuration = 1000`
   - `useOppositeBreakoutExit = false`

---

## User Settings:

You can still manually enable these if needed:
- Turtle confirmation: Has NO effect (removed from filters)
- Opposite breakout exit: Currently disabled (change to `true` to enable)
- Max trade duration: Set to 1000 bars (change to 40 for time-based exits)

For consistent 1:1 RR: **Keep current settings as they are now!**






