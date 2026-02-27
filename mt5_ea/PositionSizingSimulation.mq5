//+------------------------------------------------------------------+
//| Position Sizing Simulation Script                                 |
//| Verifies lot size calculation across different scenarios         |
//| Run on any chart - uses typical pip values for simulation        |
//+------------------------------------------------------------------+
#property script_show_inputs
#property strict

input string ScenarioFilter = "";  // Leave empty for all scenarios, or "200k","slippage","xau" etc.

//+------------------------------------------------------------------+
//| Typical pip values per lot (USD account) - approximate           |
//+------------------------------------------------------------------+
double GetPipValueForSymbol(string symbol, double priceHint = 0) {
   string upper = symbol;
   StringToUpper(upper);
   
   if(upper == "XAUUSD" || upper == "XAGUSD") return 10.0;   // $10 per 0.10 move
   if(StringFind(upper, "JPY") >= 0) {
      if(priceHint <= 0) priceHint = 150.0;  // Default USDJPY
      return (100000.0 * 0.01) / priceHint;   // ~$6.67 at 150
   }
   // Standard forex (GBPUSD, EURUSD, etc.): quote USD = $10
   return 100000.0 * 0.0001;  // $10 per pip
}

double GetPipSize(string symbol) {
   string upper = symbol;
   StringToUpper(upper);
   if(upper == "XAUUSD" || upper == "XAGUSD") return 0.10;
   if(StringFind(upper, "JPY") >= 0) return 0.01;
   return 0.0001;
}

//+------------------------------------------------------------------+
//| Simulate single scenario (slippageBufferPips=0 for legacy behavior)|
//+------------------------------------------------------------------+
void RunScenario(string symbol, double initialFunding, double riskPercent, 
                 double slPips, double forexCommPerLot, double goldCommPerLot,
                 bool accountForCommission, bool grossMatchesRisk,
                 double slippagePips, double slippageBufferPips, string scenarioName) {
   
   bool isXAU = (symbol == "XAUUSD" || symbol == "XAGUSD");
   double pipValue = GetPipValueForSymbol(symbol);
   double commissionPerLot = isXAU ? goldCommPerLot : forexCommPerLot;
   
   double targetRisk = initialFunding * (riskPercent / 100.0);
   double effectiveStopPips = slPips + slippageBufferPips;  // EA uses this for lot sizing
   double perLotRiskValue = effectiveStopPips * pipValue;
   double perLotCommission = (accountForCommission && !grossMatchesRisk) ? commissionPerLot : 0.0;
   double denominator = perLotRiskValue + perLotCommission;
   double calculatedLot = (denominator > 0) ? (targetRisk / denominator) : 0;
   
   // Round to 0.01 (EA uses MathRound)
   double lotSize = MathRound(calculatedLot * 100) / 100.0;
   if(lotSize < 0.01) lotSize = 0.01;
   
   // Expected at ACTUAL SL (no slippage) - what happens when SL hits at exact price
   double grossRisk = lotSize * slPips * pipValue;
   double commission = lotSize * commissionPerLot;
   double netRiskAtSL = grossRisk + commission;
   
   // With market slippage (worse fill than SL price)
   double slippageLoss = lotSize * slippagePips * pipValue;
   double netRiskWithSlippage = netRiskAtSL + slippageLoss;
   
   double deviationPct = (targetRisk > 0) ? ((netRiskAtSL - targetRisk) / targetRisk) * 100.0 : 0;
   
   Print("╔══════════════════════════════════════════════════════════════════╗");
   Print("║ ", scenarioName);
   Print("╠══════════════════════════════════════════════════════════════════╣");
   Print("║ Symbol: ", symbol, " | Initial: $", DoubleToString(initialFunding, 0), 
         " | Risk: ", DoubleToString(riskPercent, 2), "% | SL: ", DoubleToString(slPips, 1), " pips");
   if(slippageBufferPips > 0) Print("║ Slippage buffer: +", DoubleToString(slippageBufferPips, 1), " pips → Effective: ", DoubleToString(effectiveStopPips, 1), " pips");
   Print("║ Commission: $", DoubleToString(commissionPerLot, 2), "/lot | In calc: ", accountForCommission ? "YES" : "NO");
   Print("╠══════════════════════════════════════════════════════════════════╣");
   Print("║ Target Risk:        $", DoubleToString(targetRisk, 2));
   Print("║ Lot Size:           ", DoubleToString(lotSize, 2));
   Print("║ Pip Value/lot:      $", DoubleToString(pipValue, 2), " (HARDCODED for std pairs)");
   Print("║ Gross at SL:        $", DoubleToString(grossRisk, 2));
   Print("║ Commission:         $", DoubleToString(commission, 2));
   Print("║ Net at SL:          $", DoubleToString(netRiskAtSL, 2), " (deviation: ", DoubleToString(deviationPct, 2), "%)");
   if(slippagePips > 0) {
      Print("║ Market slippage (", DoubleToString(slippagePips, 1), " pips): +$", DoubleToString(slippageLoss, 2));
      Print("║ Net WITH slippage: $", DoubleToString(netRiskWithSlippage, 2));
   }
   Print("╚══════════════════════════════════════════════════════════════════╝");
   Print("");
}

// Overload for backward compatibility (no slippage buffer)
void RunScenario(string symbol, double initialFunding, double riskPercent, 
                 double slPips, double forexCommPerLot, double goldCommPerLot,
                 bool accountForCommission, bool grossMatchesRisk,
                 double slippagePips, string scenarioName) {
   RunScenario(symbol, initialFunding, riskPercent, slPips, forexCommPerLot, goldCommPerLot,
               accountForCommission, grossMatchesRisk, slippagePips, 0, scenarioName);
}

//+------------------------------------------------------------------+
//| Script entry point                                                |
//+------------------------------------------------------------------+
void OnStart() {
   Print("");
   Print("════════════════════════════════════════════════════════════════════");
   Print("  POSITION SIZING SIMULATION - TradingSignalEA Formula Verification");
   Print("════════════════════════════════════════════════════════════════════");
   Print("");
   
   string filter = ScenarioFilter;
   StringToUpper(filter);
   bool runAll = (StringLen(filter) == 0);
   
   // ═══ USER'S ACTUAL TRADE (26 Feb 2026) - OLD vs NEW comparison ═══
   if(runAll || StringFind(filter, "REAL") >= 0 || StringFind(filter, "FIX") >= 0) {
      Print("╔══════════════════════════════════════════════════════════════════╗");
      Print("║ REAL TRADE FIX - GBPUSD BUY 26 Feb 2026 (Ticket 103628840)       ║");
      Print("║ Entry: 1.35666 | SL: 1.35559 (10.7 pips) | Target: 1.35783       ║");
      Print("║ OLD: 6.13 lots → Net loss -$704.96 (overshoot!)                  ║");
      Print("╚══════════════════════════════════════════════════════════════════╝");
      Print("");
      RunScenario("GBPUSD", 100000, 0.65, 10.7, 5.0, 7.0, true, false, 0, 0, 
                  "REAL TRADE - NEW (hardcoded $10/pip, no buffer): Target ~$650");
      RunScenario("GBPUSD", 100000, 0.65, 10.7, 5.0, 7.0, true, false, 0, 0.5, 
                  "REAL TRADE - NEW (with 0.5 pip slippage buffer): Conservative");
      RunScenario("GBPUSD", 100000, 0.65, 10.7, 5.0, 7.0, true, false, 0.3, 0.5, 
                  "REAL TRADE - With 0.3 pip market slippage (actual fill 1.35556)");
      Print("  ^ OLD bug: 6.13 lots × (10.7+0.3) pips × $10 + 6.13×$5 ≈ $704 (actual loss)");
      Print("  ^ NEW fix: ~5.56 lots × 11 pips × $10 + commission ≈ $639 (within target)");
      Print("");
   }
   
   // Scenario 1: $100k, 0.65%, GBPUSD, 7.5 pips (tight SL) - FTMO baseline
   if(runAll || StringFind(filter, "100K") >= 0 || StringFind(filter, "BASELINE") >= 0) {
      RunScenario("GBPUSD", 100000, 0.65, 7.5, 5.0, 7.0, true, false, 0, 0, 
                  "SCENARIO 1: $100k FTMO - GBPUSD 7.5 pip SL (tight)");
   }
   
   // Scenario 2: $200k, 0.65%, GBPUSD, 7.5 pips
   if(runAll || StringFind(filter, "200K") >= 0) {
      RunScenario("GBPUSD", 200000, 0.65, 7.5, 5.0, 7.0, true, false, 0, 
                  "SCENARIO 2: $200k - GBPUSD 7.5 pip SL");
   }
   
   // Scenario 3: $100k, 0.65%, GBPUSD, 26.6 pips (wide SL)
   if(runAll || StringFind(filter, "WIDE") >= 0) {
      RunScenario("GBPUSD", 100000, 0.65, 26.6, 5.0, 7.0, true, false, 0, 
                  "SCENARIO 3: $100k - GBPUSD 26.6 pip SL (wide)");
   }
   
   // Scenario 4: $100k, 0.65%, XAUUSD, 50 pips
   if(runAll || StringFind(filter, "XAU") >= 0) {
      RunScenario("XAUUSD", 100000, 0.65, 50.0, 5.0, 7.0, true, false, 0, 
                  "SCENARIO 4: $100k - XAUUSD 50 pip SL");
   }
   
   // Scenario 5: $100k, 0.65%, USDJPY, 15 pips
   if(runAll || StringFind(filter, "JPY") >= 0) {
      RunScenario("USDJPY", 100000, 0.65, 15.0, 5.0, 7.0, true, false, 0, 
                  "SCENARIO 5: $100k - USDJPY 15 pip SL");
   }
   
   // Scenario 6: Slippage impact - 0.2 pip on Scenario 1
   if(runAll || StringFind(filter, "SLIP") >= 0) {
      RunScenario("GBPUSD", 100000, 0.65, 7.5, 5.0, 7.0, true, false, 0.2, 0, 
                  "SCENARIO 6: Slippage - 0.2 pip worse fill (no buffer)");
      RunScenario("GBPUSD", 100000, 0.65, 7.5, 5.0, 7.0, true, false, 0.2, 0.5, 
                  "SCENARIO 6b: Same + 0.5 pip buffer (absorbs slippage)");
   }
   
   // Scenario 7: WITHOUT commission in calc (bug simulation)
   if(runAll || StringFind(filter, "NOCOMM") >= 0) {
      RunScenario("GBPUSD", 100000, 0.65, 7.5, 5.0, 7.0, false, true, 0, 0, 
                  "SCENARIO 7: BUG - Commission NOT in calc (Gross=Risk)");
   }
   
   // Scenario 7b: MT5 tick value BUG - wrong pip value ($9.34 instead of $10)
   if(runAll || StringFind(filter, "BUG") >= 0 || StringFind(filter, "TICK") >= 0) {
      Print("╔══════════════════════════════════════════════════════════════════╗");
      Print("║ SCENARIO 7b: MT5 TICK VALUE BUG (caused -$704 loss)              ║");
      Print("║ If MT5 returns pipValue=$9.34 instead of $10 → over-sized lots   ║");
      Print("╚══════════════════════════════════════════════════════════════════╝");
      // Simulate wrong pip value: 650 / (10.7*9.34 + 5) = 650/105 = 6.19 lots
      double wrongPipVal = 9.34;
      double targetRisk = 650;
      double slPips = 10.7;
      double comm = 5.0;
      double wrongDenom = slPips * wrongPipVal + comm;
      double wrongLots = targetRisk / wrongDenom;
      double wrongNetLoss = wrongLots * slPips * 10.0 + wrongLots * comm;  // actual $10/pip at SL
      Print("  Wrong pip value $9.34 → Lots: ", DoubleToString(wrongLots, 2), " → Actual net loss: $", DoubleToString(wrongNetLoss, 2));
      Print("  Correct pip value $10  → Lots: ", DoubleToString(650/112, 2), " → Actual net loss: ~$650");
      Print("");
   }
   
   // Scenario 8: $50k account, 0.5% risk
   if(runAll || StringFind(filter, "50K") >= 0) {
      RunScenario("GBPUSD", 50000, 0.5, 10.0, 5.0, 7.0, true, false, 0, 
                  "SCENARIO 8: $50k - 0.5% risk, 10 pip SL");
   }
   
   // Scenario 9: Cap risk - $200k equity but cap to $100k initial
   if(runAll || StringFind(filter, "CAP") >= 0) {
      RunScenario("GBPUSD", 200000, 0.65, 7.5, 5.0, 7.0, true, false, 0, 
                  "SCENARIO 9: $200k base (no cap) - would risk $1300");
      Print("  ^ If CapRiskToInitialDeposit=true with $100k initial: capped to $650");
      Print("");
   }
   
   // Scenario 10: EURUSD for comparison
   if(runAll || StringFind(filter, "EUR") >= 0) {
      RunScenario("EURUSD", 100000, 0.65, 12.0, 5.0, 7.0, true, false, 0, 
                  "SCENARIO 10: $100k - EURUSD 12 pip SL");
   }
   
   Print("════════════════════════════════════════════════════════════════════");
   Print("  SIMULATION COMPLETE");
   Print("  Expected: Net at SL ≈ Target Risk when commission included");
   Print("  Slippage adds extra loss at market execution");
   Print("════════════════════════════════════════════════════════════════════");
}
