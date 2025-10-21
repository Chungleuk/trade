//+------------------------------------------------------------------+
//|                                           TradingSignalEA_Simple.mq5 |
//|                                  Copyright 2024, Your Company |
//|                                             https://www.yourcompany.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Company"
#property link      "https://www.yourcompany.com"
#property version   "1.00"
#property description "Ultra simple test EA"

//--- Input parameters
input string   TestMessage = "Hello World";  // Test message

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
   Print("=== ULTRA SIMPLE EA STARTING ===");
   Print("Test Message: ", TestMessage);
   Print("Current Time: ", TimeToString(TimeLocal()));
   Print("Symbol: ", Symbol());
   Print("Timeframe: ", EnumToString(Period()));
   Print("=== ULTRA SIMPLE EA READY ===");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   Print("Ultra Simple EA: Deinitializing...");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick() {
   static datetime lastTickTime = 0;
   if(TimeLocal() - lastTickTime >= 3) { // Every 3 seconds
      Print("Ultra Simple EA: Tick received at ", TimeToString(TimeLocal()));
      lastTickTime = TimeLocal();
   }
}

