#!/usr/bin/env python3
"""
Position Sizing Simulation - Validates TradingSignalEA lot calculation
Run without MT5: python simulate_lot_sizing.py
"""

def get_pip_value(symbol: str, price_hint: float = 0) -> float:
    """Pip value per lot in USD (hardcoded for standard pairs)."""
    symbol = symbol.upper()
    if symbol in ("XAUUSD", "XAGUSD"):
        return 10.0
    if "JPY" in symbol:
        price = price_hint if price_hint > 0 else 150.0
        return (100_000 * 0.01) / price  # ~6.67 at 150
    return 10.0  # Standard forex: $10/pip/lot


def simulate(
    symbol: str,
    initial_funding: float,
    risk_pct: float,
    sl_pips: float,
    forex_comm: float = 5.0,
    gold_comm: float = 7.0,
    account_for_comm: bool = True,
    slippage_buffer_pips: float = 0.0,
    market_slippage_pips: float = 0.0,
) -> dict:
    """Simulate EA lot sizing. Returns dict with all values."""
    is_xau = symbol.upper() in ("XAUUSD", "XAGUSD")
    pip_value = get_pip_value(symbol)
    comm_per_lot = gold_comm if is_xau else forex_comm

    target_risk = initial_funding * (risk_pct / 100.0)
    effective_stop = sl_pips + slippage_buffer_pips
    per_lot_risk = effective_stop * pip_value
    per_lot_comm = comm_per_lot if account_for_comm else 0.0
    denominator = per_lot_risk + per_lot_comm
    calculated_lot = target_risk / denominator if denominator > 0 else 0

    lot_size = round(calculated_lot * 100) / 100.0
    lot_size = max(0.01, lot_size)

    gross_risk = lot_size * sl_pips * pip_value
    commission = lot_size * comm_per_lot
    net_at_sl = gross_risk + commission
    slippage_loss = lot_size * market_slippage_pips * pip_value
    net_with_slippage = net_at_sl + slippage_loss
    deviation_pct = ((net_at_sl - target_risk) / target_risk * 100) if target_risk > 0 else 0

    return {
        "symbol": symbol,
        "target_risk": target_risk,
        "lot_size": lot_size,
        "pip_value": pip_value,
        "effective_stop_pips": effective_stop,
        "gross_at_sl": gross_risk,
        "commission": commission,
        "net_at_sl": net_at_sl,
        "deviation_pct": deviation_pct,
        "slippage_loss": slippage_loss,
        "net_with_slippage": net_with_slippage,
    }


def run_scenario(name: str, **kwargs) -> None:
    r = simulate(**kwargs)
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")
    print(f"  Symbol: {r['symbol']} | SL: {kwargs['sl_pips']} pips | Buffer: {kwargs.get('slippage_buffer_pips', 0)} pips")
    print(f"  Target Risk:    ${r['target_risk']:.2f}")
    print(f"  Lot Size:       {r['lot_size']:.2f}")
    print(f"  Pip Value/lot:  ${r['pip_value']:.2f}")
    print(f"  Gross at SL:    ${r['gross_at_sl']:.2f}")
    print(f"  Commission:     ${r['commission']:.2f}")
    print(f"  Net at SL:      ${r['net_at_sl']:.2f} (deviation: {r['deviation_pct']:.2f}%)")
    if r["slippage_loss"] > 0:
        print(f"  + Slippage:     ${r['slippage_loss']:.2f}")
        print(f"  Net w/ slippage: ${r['net_with_slippage']:.2f}")
    print(f"{'='*60}")


def main():
    print("\n" + "="*60)
    print("  POSITION SIZING SIMULATION - TradingSignalEA Validation")
    print("="*60)

    # User's actual trade (26 Feb 2026)
    print("\n>>> REAL TRADE FIX - GBPUSD BUY 26 Feb 2026")
    print("    Entry: 1.35666 | SL: 1.35559 (10.7 pips) | OLD: 6.13 lots -> -$704")
    run_scenario(
        "NEW (hardcoded $10/pip, no buffer)",
        symbol="GBPUSD", initial_funding=100_000, risk_pct=0.65,
        sl_pips=10.7, slippage_buffer_pips=0,
    )
    run_scenario(
        "NEW (with 0.5 pip slippage buffer)",
        symbol="GBPUSD", initial_funding=100_000, risk_pct=0.65,
        sl_pips=10.7, slippage_buffer_pips=0.5,
    )
    run_scenario(
        "With 0.3 pip market slippage (actual fill 1.35556)",
        symbol="GBPUSD", initial_funding=100_000, risk_pct=0.65,
        sl_pips=10.7, slippage_buffer_pips=0.5, market_slippage_pips=0.3,
    )

    # MT5 tick value BUG simulation
    print("\n>>> MT5 TICK VALUE BUG (caused -$704 loss)")
    wrong = simulate(symbol="GBPUSD", initial_funding=100_000, risk_pct=0.65,
                     sl_pips=10.7, slippage_buffer_pips=0)
    # Wrong pip value ~9.34: 650/(10.7*9.34+5) ≈ 6.19 lots
    wrong_pip = 9.34
    wrong_denom = 10.7 * wrong_pip + 5
    wrong_lots = 650 / wrong_denom
    wrong_net = wrong_lots * 10.7 * 10 + wrong_lots * 5  # actual $10/pip
    print(f"  Wrong pip $9.34 -> Lots: {wrong_lots:.2f} -> Net loss: ${wrong_net:.2f}")
    print(f"  Correct pip $10  -> Lots: {wrong['lot_size']:.2f} -> Net loss: ~${wrong['net_at_sl']:.2f}")

    # Other scenarios
    print("\n>>> SCENARIO: $100k FTMO - GBPUSD 7.5 pip SL")
    run_scenario("Baseline", symbol="GBPUSD", initial_funding=100_000, risk_pct=0.65,
                 sl_pips=7.5)

    print("\n>>> SCENARIO: XAUUSD 50 pip SL")
    run_scenario("Gold", symbol="XAUUSD", initial_funding=100_000, risk_pct=0.65,
                 sl_pips=50.0)

    print("\n>>> SCENARIO: USDJPY 15 pip SL (pip value ~$6.67 at 150)")
    run_scenario("JPY", symbol="USDJPY", initial_funding=100_000, risk_pct=0.65,
                 sl_pips=15.0)

    print("\n>>> SCENARIO: $50k account, 0.5% risk")
    run_scenario("Small account", symbol="GBPUSD", initial_funding=50_000, risk_pct=0.5,
                 sl_pips=10.0)

    print("\n" + "="*60)
    print("  EXPECTED: Net at SL ~ Target Risk (deviation < 5%)")
    print("  With slippage buffer: Net at SL < Target (conservative)")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
