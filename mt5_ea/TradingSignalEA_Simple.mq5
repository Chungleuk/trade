//+------------------------------------------------------------------+
//|                                           TradingSignalEA_Simple.mq5 |
//|                                  Copyright 2024, Your Company |
//|                                             https://www.yourcompany.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Company"
#property link      "https://www.yourcompany.com"
#property version   "1.00"
#property description "Simple Expert Advisor for testing basic functionality"

//--- Input parameters
input string   ServerURL = "https://trading-backend-4v0f.onrender.com";  // Server URL
input int      MagicNumber = 123456;                 // Magic number for trades
input int      PollInterval = 5000;                  // Poll interval in milliseconds

//--- Global variables
datetime lastPollTime = 0;
bool isConnected = false;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
   Print("TradingSignalEA: Initializing...");
   
   // Test basic connection
   if(!TestConnection()) {
      Print("TradingSignalEA: Failed to connect to server. Check 'Allow WebRequest' in Tools > Options > Expert Advisors");
      return INIT_FAILED;
   }
   
   // Start polling timer
   EventSetMillisecondTimer(PollInterval);
   
   Print("TradingSignalEA: Initialized successfully");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   Print("TradingSignalEA: Deinitializing...");
   
   // Stop timer
   EventKillTimer();
   
   Print("TradingSignalEA: Deinitialized");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick() {
   // This function is called on every tick
   // We'll use timer for polling instead
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer() {
   // Simple polling every 5 seconds
   if(TimeLocal() - lastPollTime >= PollInterval/1000) {
      Print("TradingSignalEA: Timer tick - checking connection");
      TestConnection();
      lastPollTime = TimeLocal();
   }
}

//+------------------------------------------------------------------+
//| Test connection to server                                        |
//+------------------------------------------------------------------+
bool TestConnection() {
   string headers = "Content-Type: application/json\r\n";
   uchar postData[];
   uchar response[];
   string responseHeaders;
   
   int result = WebRequest("GET", ServerURL + "/status", headers, 10000, postData, response, responseHeaders);
   
   if(result == 200) {
      Print("TradingSignalEA: Connection test successful");
      isConnected = true;
      return true;
   } else {
      Print("TradingSignalEA: Connection test failed. HTTP code: ", result);
      isConnected = false;
      return false;
   }
}

//+------------------------------------------------------------------+

