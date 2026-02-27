# Position Sizing Simulation

## Purpose
Verifies the TradingSignalEA lot size formula across different scenarios: funding amounts, pairs, stop distances, slippage buffer, and commission handling. Validates the **hardcoded pip value** fix and **slippage buffer** that prevent loss overshoot (e.g. -$704 instead of ~$650).

## How to Run

### Option A: Python (no MT5 required)
```bash
python mt5_ea/simulate_lot_sizing.py
```

### Option B: MQL5 Script (in MT5)
1. Open MetaTrader 5
2. Open any chart (e.g., GBPUSD)
3. Navigator → Expert Advisors → Scripts → `PositionSizingSimulation`
4. Drag onto chart
5. Leave `ScenarioFilter` empty for all scenarios, or enter e.g. `REAL`, `FIX`, `200k`, `xau` to run specific ones
6. Check the **Experts** tab for output

## Key Scenarios

| Filter | Scenario | Key Check |
|--------|----------|-----------|
| `REAL` or `FIX` | **User's actual trade** (GBPUSD 10.7 pips) | OLD: 6.13 lots → -$704. NEW: 5.80 lots → ~$650 |
| `REAL` | With 0.5 pip slippage buffer | 5.56 lots → Net ~$623 at SL, ~$639 with 0.3 pip slippage |
| `BUG` or `TICK` | MT5 tick value bug | Wrong pip $9.34 → 6.19 lots → -$694. Correct $10 → 5.80 lots |
| (default) | FTMO baseline | $100k, 0.65%, 7.5 pips → Net ~$650 |
| `XAU` | XAUUSD 50 pips | Gold pip value $10, Net ~$649 |
| `JPY` | USDJPY 15 pips | JPY pip value ~$6.67 |
| `SLIP` | Slippage impact | With/without 0.5 pip buffer |

## Expected Results

- **Net at SL** should match **Target Risk** within ~1–2% (rounding) when commission included
- **With slippage buffer**: Net at SL < Target (conservative, ~4% under)
- **With market slippage**: Adds extra loss; buffer helps absorb it
- **Real trade fix**: 5.80 lots (no buffer) or 5.56 lots (0.5 buffer) instead of 6.13 lots
