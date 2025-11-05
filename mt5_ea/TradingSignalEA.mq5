//+------------------------------------------------------------------+
//| trading9.mq5 |
//| Copyright 2025, Your Company |
//| https://www.yourcompany.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, Your Company"
#property link "https://www.yourcompany.com"
#property version "1.06"
#property description "Expert Advisor with fixed JSON parsing and dynamic risk sizing"

//--- Input parameters
input string ServerURL = "https://trading-backend-4v0f.onrender.com";
input double RiskPercent = 0.65;
input bool AutoExecute = true;
input bool UseStopLoss = true;
input bool UseTakeProfit = true;
input int MagicNumber = 123456;
input int PollInterval = 1000;
input string APIKey = "";
input string SecretKey = "";
input bool UseGETMethod = false;
input int SignalExpirationMinutes = 5;
input bool DebugMode = true;
input int MaxTimeDriftMinutes = 60;
input bool UseServerTimeForExpiration = true;
input bool AutoShutdownEnabled = true;
input int HKShutdownHour = 4;
input int MaxRetryAttempts = 3;
input int DuplicateCheckWindow = 600;  // 10 minutes to prevent rapid re-execution of same symbol
input double BaseMaxSlippagePips = 3.0;
input double VolatileSymbolSlippageMultiplier = 1.5;
input bool AllowCriticalSignalOverride = true;
input double CriticalSignalMaxExtraPips = 1.0;
input bool UseDynamicContractSize = false;  // true = use current balance, false = use initial deposit
input bool UseManualBaseSize = false;  // true = use ManualBaseAccountSize, false = auto-detect initial deposit
input double ManualBaseAccountSize = 100000.0;  // Manual base size (only if UseManualBaseSize = true)
input double MaxContractSizeMultiplier = 5.0;
input int NetworkStabilizationDelay = 300;
input double ForexCommissionPerLot = 6.0;  // Commission per lot round trip for forex (USD)
input double GoldCommissionPerLot = 2.0;   // Commission per lot round trip for XAUUSD (USD)
input bool AccountForBrokerCosts = true;   // Include commission and spread in calculations
input bool AdjustTargetForCosts = true;    // Adjust TP to maintain 1:1 R:R after costs (RECOMMENDED)
input bool ForceOneToOneRR = true;         // Force 1:1 R:R by adjusting target to match stop distance

// Email notifications
input bool SendEmailNotifications = true;
input string EmailAddress = "leechungleuk@gmail.com";
input bool SendOnTradeOpen = true;
input bool SendOnTradeClose = true;
input bool SendOnSignalAck = false;
input bool SendOnConnectionStatus = true;
input bool SendOnErrors = true;

//--- Global variables
datetime lastPollTime = 0;
datetime lastSuccessfulPoll = 0;
datetime lastHeartbeat = 0;
int consecutiveFailures = 0;
int maxConsecutiveFailures = 3;
int tradeCheckInterval = 10;
datetime lastTradeCheck = 0;
int hkTimeCheckInterval = 300;
datetime lastHKTimeCheck = 0;
datetime lastNetworkIssue = 0;
double initialAccountBalance = 0;  // Stores the initial deposit/balance for fixed position sizing

string processedSignals[];
int processedSignalsCount = 0;
string currentlyProcessingSignal = "";
datetime signalProcessingStartTime = 0;
string globalSignalLock = "";
datetime globalSignalLockTime = 0;

string activeSymbols[];
int activeSymbolsCount = 0;

// Track last time a symbol was queued to enforce DuplicateCheckWindow
string recentSymbols[];
datetime recentSymbolsTimes[];
int recentSymbolsCount = 0;

struct SignalRetry {
   string signalId;
   int retryCount;
   datetime lastRetryTime;
};
SignalRetry signalRetries[];
int signalRetriesCount = 0;

enum ConnectionState {
   DISCONNECTED,
   CONNECTING,
   CONNECTED,
   RECONNECTING
};

ConnectionState connectionState = DISCONNECTED;

enum ENUM_SIGNAL_ORDER_TYPE {
   ORDER_TYPE_MARKET,
   ORDER_TYPE_LIMIT,
   ORDER_TYPE_STOP
};

struct TradingSignal {
   string id;
   string symbol;
   ENUM_ORDER_TYPE action;
   ENUM_SIGNAL_ORDER_TYPE order_type;
   double entry;
   double target;
   double stop;
   int timeframe;
   string source;
   datetime timestamp;
   datetime expire_time;
   datetime receive_time;
   double risk_percent;
   bool is_critical;
   
   TradingSignal() {
      id = "";
      symbol = "";
      action = ORDER_TYPE_BUY;
      order_type = ORDER_TYPE_MARKET;
      entry = 0.0;
      target = 0.0;
      stop = 0.0;
      timeframe = 15;
      source = "";
      timestamp = TimeGMT();
      expire_time = timestamp + (5 * 60);
      receive_time = TimeGMT();
      risk_percent = 0.65;
      is_critical = false;
   }
   
   TradingSignal(const TradingSignal& other) {
      id = other.id;
      symbol = other.symbol;
      action = other.action;
      order_type = other.order_type;
      entry = other.entry;
      target = other.target;
      stop = other.stop;
      timeframe = other.timeframe;
      source = other.source;
      timestamp = other.timestamp;
      expire_time = other.expire_time;
      receive_time = other.receive_time;
      risk_percent = other.risk_percent;
      is_critical = other.is_critical;
   }
};

class SignalQueue {
private:
   TradingSignal signals[];
   int queueSize;
   
public:
   SignalQueue() {
      queueSize = 0;
      ArrayResize(signals, 0);
   }
   
   void AddSignal(const TradingSignal& signal) {
      ArrayResize(signals, queueSize + 1);
      signals[queueSize] = signal;
      queueSize++;
      Print("TradingSignalEA: Signal added to queue. Queue size: ", queueSize);
   }
   
   bool ProcessNextSignal() {
      if(queueSize == 0) return false;
      
      TradingSignal signal = signals[0];
      
      for(int i = 0; i < queueSize - 1; i++) {
         signals[i] = signals[i + 1];
      }
      queueSize--;
      ArrayResize(signals, queueSize);
      
      return ProcessSignal(signal);
   }
   
   int GetQueueSize() const {
      return queueSize;
   }

   bool ContainsId(const string &id) const {
      for(int i = 0; i < queueSize; i++) {
         if(signals[i].id == id) return true;
      }
      return false;
   }
   
   void ClearQueue() {
      queueSize = 0;
      ArrayResize(signals, 0);
      Print("TradingSignalEA: Signal queue cleared");
   }
};

SignalQueue signalQueue;

class ErrorHandler {
public:
   static bool HandleWebRequestError(int httpCode, string operation) {
      switch(httpCode) {
         case -1: 
            Print("TradingSignalEA: Network error in ", operation, " - check internet connection");
            return false;
         case 0:
            Print("TradingSignalEA: No response in ", operation, " - check server availability");
            return true;
         case 401:
            Print("TradingSignalEA: Authentication failed in ", operation);
            return false;
         case 403:
            Print("TradingSignalEA: Access forbidden in ", operation);
            return false;
         case 404:
            Print("TradingSignalEA: Endpoint not found in ", operation);
            return false;
         case 500:
            Print("TradingSignalEA: Server error in ", operation, " - will retry");
            return true;
         case 502:
         case 503:
         case 504:
            Print("TradingSignalEA: Server unavailable in ", operation, " - will retry");
            return true;
         default:
            Print("TradingSignalEA: HTTP error ", httpCode, " in ", operation);
            return (httpCode >= 500);
      }
   }
   
   static void LogError(string operation, string details) {
      Print("TradingSignalEA: ERROR in ", operation, " - ", details);
   }
};

class ConnectionManager {
private:
   ConnectionState state;
   datetime lastHeartbeat;
   int heartbeatInterval;
   
public:
   ConnectionManager() {
      state = DISCONNECTED;
      lastHeartbeat = 0;
      heartbeatInterval = 15;
   }
   
   void SetState(ConnectionState newState) {
      if(state != newState) {
         Print("TradingSignalEA: Connection state changed from ", EnumToString(state), " to ", EnumToString(newState));
         state = newState;
      }
   }
   
   ConnectionState GetState() const {
      return state;
   }
   
   bool IsConnected() const {
      return (state == CONNECTED);
   }
   
   bool IsHealthy() const {
      return (state == CONNECTED && consecutiveFailures < maxConsecutiveFailures);
   }
   
   void UpdateConnectionHealth(bool success) {
      if(success) {
         consecutiveFailures = 0;
         lastSuccessfulPoll = TimeGMT();
         if(state == RECONNECTING) {
            SetState(CONNECTED);
         }
      } else {
         consecutiveFailures++;
         if(consecutiveFailures >= maxConsecutiveFailures && state == CONNECTED) {
            SetState(RECONNECTING);
            lastNetworkIssue = TimeGMT();
            Print("TradingSignalEA: Network health degraded - entering RECONNECTING state");
         }
      }
   }
   
   bool ShouldSendHeartbeat() {
      return (TimeGMT() - lastHeartbeat >= heartbeatInterval);
   }
   
   void UpdateHeartbeat() {
      lastHeartbeat = TimeGMT();
   }
   
   string GetStateString() const {
      switch(state) {
         case DISCONNECTED: return "Disconnected";
         case CONNECTING: return "Connecting";
         case CONNECTED: return "Connected";
         case RECONNECTING: return "Reconnecting";
         default: return "Unknown";
      }
   }
};

ConnectionManager connectionManager;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
   Print("TradingSignalEA: Initializing...");
   
   if(!IsTradingEnabled()) {
      Print("TradingSignalEA: FATAL - Trading is disabled. Fix settings and restart.");
      return INIT_FAILED;
   }

   // Capture initial account balance for fixed position sizing
   initialAccountBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: INITIAL ACCOUNT BALANCE CAPTURED");
   Print("TradingSignalEA: Initial Balance: ", AccountInfoString(ACCOUNT_CURRENCY), " ", initialAccountBalance);
   Print("TradingSignalEA: This will be used for FIXED position sizing");
   Print("TradingSignalEA: Risk calculations will ALWAYS use this amount");
   Print("TradingSignalEA: Current balance changes will NOT affect position sizing");
   Print("TradingSignalEA: ========================================");

   connectionManager.SetState(CONNECTED);
   lastSuccessfulPoll = TimeGMT();
   
   if(TestConnection()) {
      Print("TradingSignalEA: Server connection test successful");
    SendConnectionStatusEmail("CONNECTED", "EA initialized successfully");
   } else {
      Print("TradingSignalEA: Warning - Server connection test failed. Will retry on timer.");
    SendConnectionStatusEmail("CONNECTION ISSUE", "Initial connection test failed");
   }
   
   EventSetMillisecondTimer(100);
   UpdateActiveSymbols();
   Print("TradingSignalEA: Found ", activeSymbolsCount, " symbols with active positions");
   Print("TradingSignalEA: Initialized successfully. Connection state: ", connectionManager.GetStateString());
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   Print("TradingSignalEA: Deinitializing...");
   EventKillTimer();
   SendDisconnectMessage();
   signalQueue.ClearQueue();
  string reasonStr = "";
  switch(reason) {
    case REASON_PROGRAM: reasonStr = "EA removed from chart"; break;
    case REASON_RECOMPILE: reasonStr = "EA recompiled"; break;
    case REASON_CHARTCHANGE: reasonStr = "Chart symbol/timeframe changed"; break;
    case REASON_CHARTCLOSE: reasonStr = "Chart closed"; break;
    case REASON_PARAMETERS: reasonStr = "Input parameters changed"; break;
    case REASON_ACCOUNT: reasonStr = "Account changed"; break;
    case REASON_TEMPLATE: reasonStr = "Template applied"; break;
    case REASON_INITFAILED: reasonStr = "EA initialization failed"; break;
    case REASON_CLOSE: reasonStr = "Terminal closed"; break;
    default: reasonStr = "Unknown reason"; break;
  }
  SendConnectionStatusEmail("DISCONNECTED", StringFormat("Reason: %s", reasonStr));
   Print("TradingSignalEA: Deinitialized");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick() {
   // Using high-frequency timer instead
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer() {
   CheckNetworkHealth();
   if(IsNetworkUnstable()) {
      return;
   }

   connectionManager.UpdateConnectionHealth(TimeGMT() - lastSuccessfulPoll < 60);

   if(!connectionManager.IsHealthy()) {
      if(connectionManager.GetState() == RECONNECTING) {
         Print("TradingSignalEA: Attempting to reconnect...");
         if(TestConnection()) {
            connectionManager.SetState(CONNECTED);
            consecutiveFailures = 0;
            lastSuccessfulPoll = TimeGMT();
            lastNetworkIssue = 0;
         }
      }
      return;
   }
   
   if(currentlyProcessingSignal != "" && (TimeGMT() - signalProcessingStartTime) > 10) {
      Print("TradingSignalEA: Signal processing timeout for signal: ", currentlyProcessingSignal);
      currentlyProcessingSignal = "";
      signalProcessingStartTime = 0;
   }

   if(TimeGMT() - lastPollTime >= PollInterval/1000) {
      bool shouldPoll = true;
      
      if(currentlyProcessingSignal != "") {
         Print("TradingSignalEA: Currently processing signal ", currentlyProcessingSignal, " - skipping poll");
         shouldPoll = false;
      }
      
      if(IsSymbolActive(Symbol())) {
         Print("TradingSignalEA: Current symbol ", Symbol(), " has active trade - skipping poll");
         shouldPoll = false;
      }
      
      if(PositionsTotal() >= 5) {
         Print("TradingSignalEA: Maximum concurrent positions reached - skipping poll");
         shouldPoll = false;
      }
      
      if(shouldPoll) {
         if(UseGETMethod) {
            PollForSignalsGET();
         } else {
            PollForSignals();
         }
      }
      lastPollTime = TimeGMT();
   }
   
   if(connectionManager.ShouldSendHeartbeat()) {
      SendHeartbeat();
      connectionManager.UpdateHeartbeat();
   }
   
   if(signalQueue.GetQueueSize() > 0) {
      signalQueue.ProcessNextSignal();
   }
   
   if(TimeGMT() - lastTradeCheck >= tradeCheckInterval) {
      CheckAndUpdateTradeOutcomes();
      UpdateActiveSymbols();
      lastTradeCheck = TimeGMT();
   }
   
   if(TimeGMT() - lastHKTimeCheck >= hkTimeCheckInterval) {
      if(IsHKShutdownTime()) {
         Print("TradingSignalEA: Hong Kong shutdown time (4:00 AM) detected - closing all trades");
         AutoCloseAllTrades();
      }
      lastHKTimeCheck = TimeGMT();
   }

   CheckExpiredSignals();
   CheckSignalRetries();
}

//+------------------------------------------------------------------+
//| Check if network is unstable                                     |
//+------------------------------------------------------------------+
bool IsNetworkUnstable() {
   if(TimeGMT() - lastNetworkIssue < NetworkStabilizationDelay) {
      Print("TradingSignalEA: Network unstable - pausing trading for ", 
            (NetworkStabilizationDelay - (TimeGMT() - lastNetworkIssue)), "s");
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Check network health                                             |
//+------------------------------------------------------------------+
void CheckNetworkHealth() {
   static datetime lastScanDetected = 0;
   if(TimeGMT() - lastScanDetected < 60) {
      lastNetworkIssue = TimeGMT();
      Print("TradingSignalEA: Network scanning detected - marking instability");
   }
}

//+------------------------------------------------------------------+
//| Check for expired signals in the queue                           |
//+------------------------------------------------------------------+
void CheckExpiredSignals() {
   // Clean up expired signals to keep queue efficient
}

//+------------------------------------------------------------------+
//| Check for signals that need retrying                             |
//+------------------------------------------------------------------+
void CheckSignalRetries() {
   for(int i = signalRetriesCount-1; i >= 0; i--) {
      if((TimeGMT() - signalRetries[i].lastRetryTime) > 5 &&
         signalRetries[i].retryCount < MaxRetryAttempts) {
         Print("TradingSignalEA: Retrying signal ", signalRetries[i].signalId,
               " (attempt ", signalRetries[i].retryCount + 1, "/", MaxRetryAttempts, ")");

         string signalIdToRetry = signalRetries[i].signalId;
         RemoveSignalFromRetryListByIndex(i);
         RemoveSignalFromProcessedList(signalIdToRetry);
      }
   }
}

//+------------------------------------------------------------------+
//| Remove signal from retry list by index                           |
//+------------------------------------------------------------------+
void RemoveSignalFromRetryListByIndex(int index) {
   if(index < 0 || index >= signalRetriesCount) {
      Print("TradingSignalEA: Invalid index in RemoveSignalFromRetryListByIndex: ", index);
      return;
   }

   for(int j = index; j < signalRetriesCount - 1; j++) {
      signalRetries[j] = signalRetries[j + 1];
   }
   signalRetriesCount--;
   ArrayResize(signalRetries, signalRetriesCount);
}

//+------------------------------------------------------------------+
//| Test connection to server                                        |
//+------------------------------------------------------------------+
bool TestConnection() {
   string headers = "";
   uchar postData[];
   uchar response[];
   string responseHeaders;
   
   string testUrl = ServerURL + "/status";
   Print("TradingSignalEA: Testing connection to: ", testUrl);
   
   int result = WebRequest("GET", testUrl, headers, 5000, postData, response, responseHeaders);
   
   if(result == 200) {
      string responseStr = CharArrayToString(response);
      Print("TradingSignalEA: Connection test successful. Response: ", responseStr);
      return true;
   } else {
      Print("TradingSignalEA: Connection test failed. HTTP code: ", result);
      if(ArraySize(response) > 0) {
         string errorResponse = CharArrayToString(response);
         Print("TradingSignalEA: Connection Test Error Response: ", errorResponse);
      }
      return false;
   }
}

//+------------------------------------------------------------------+
//| Poll for new signals                                             |
//+------------------------------------------------------------------+
void PollForSignals() {
   Print("TradingSignalEA: Polling for signals (POST method)...");
   
   long account = AccountInfoInteger(ACCOUNT_LOGIN);
   string symbol = Symbol();
   int timeframe = Period();
   
   Print("TradingSignalEA: Poll Variables - Account: ", account, ", Symbol: ", symbol, ", Timeframe: ", timeframe);
   
   if(symbol == "" || symbol == "unknown") symbol = "XAUUSD";
   if(timeframe <= 0) timeframe = 15;
   
   string url = ServerURL + "/signals/pending";
   string postDataStr = StringFormat(
      "{\"terminal\":\"MT5\",\"account\":%d,\"symbol\":\"%s\",\"timeframe\":%d}",
      (int)account,
      symbol,
      timeframe
   );
   
   string headers = GenerateHeaders("POST");
   if(DebugMode) {
   Print("TradingSignalEA: POST Headers:\n", headers);
   Print("TradingSignalEA: POST Body: ", postDataStr);
   }
   
   uchar postData[];
   int arraySize = StringToCharArray(postDataStr, postData, 0, StringLen(postDataStr), CP_UTF8);
   if(DebugMode) Print("TradingSignalEA: POST Body Size: ", arraySize, " bytes");
   
   uchar response[];
   string responseHeaders;
   int result = WebRequest("POST", url, headers, 5000, postData, response, responseHeaders);
   
   if(result == 200) {
      string responseStr = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
      if(DebugMode) Print("TradingSignalEA: Poll Success - Response: ", responseStr);
      ProcessSignalsResponse(responseStr);
      connectionManager.UpdateConnectionHealth(true);
   } else {
      Print("TradingSignalEA: Poll Failed - HTTP Code: ", result);
      if(ArraySize(response) > 0) {
         string errorResponse = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
         Print("TradingSignalEA: Poll Error Response: ", errorResponse);
      }
      connectionManager.UpdateConnectionHealth(false);
   }
}

//+------------------------------------------------------------------+
//| Process signals response - FIXED VERSION                        |
//+------------------------------------------------------------------+
void ProcessSignalsResponse(const string response) {
   if(DebugMode) Print("TradingSignalEA: Raw response: ", response);
   
   // Look for signals array in the response
   int signalsStart = StringFind(response, "\"signals\":[");
   if(signalsStart >= 0) {
      signalsStart += 11; // Move past "\"signals\":["
      int signalsEnd = StringFind(response, "]", signalsStart);
      if(signalsEnd > signalsStart) {
         string signalsArray = StringSubstr(response, signalsStart, signalsEnd - signalsStart);
         if(DebugMode) Print("TradingSignalEA: Signals array: ", signalsArray);
         
         // Process each signal in the array
         int pos = 0;
         while(pos >= 0 && pos < StringLen(signalsArray)) {
            int signalStart = StringFind(signalsArray, "{", pos);
            if(signalStart < 0) break;
            
            int signalEnd = StringFind(signalsArray, "}", signalStart);
            if(signalEnd < 0) break;
            
            string signalStr = StringSubstr(signalsArray, signalStart, signalEnd - signalStart + 1);
            if(DebugMode) Print("TradingSignalEA: Processing signal: ", signalStr);
            
            TradingSignal signal;
            if(ParseSignalData(signalStr, signal)) {
               ProcessSingleSignal(signal);
            }
            
            pos = signalEnd + 1;
         }
      }
   } else {
      // Try to find single signal
      int signalStart = StringFind(response, "{\"id\"");
      if(signalStart >= 0) {
         int signalEnd = StringFind(response, "}", signalStart);
         if(signalEnd > signalStart) {
            string signalStr = StringSubstr(response, signalStart, signalEnd - signalStart + 1);
            if(DebugMode) Print("TradingSignalEA: Processing single signal: ", signalStr);
            
            TradingSignal signal;
            if(ParseSignalData(signalStr, signal)) {
               ProcessSingleSignal(signal);
            }
         }
   } else {
         Print("TradingSignalEA: No signals found in response");
      }
   }
}

//+------------------------------------------------------------------+
//| Parse signal data - FIXED VERSION                               |
//+------------------------------------------------------------------+
bool ParseSignalData(const string signalData, TradingSignal& signal) {
   // Initialize with defaults
   signal.id = "";
   signal.symbol = "";
   signal.action = ORDER_TYPE_BUY;
   signal.entry = 0.0;
   signal.target = 0.0;
   signal.stop = 0.0;
   signal.timeframe = 15;
   signal.risk_percent = RiskPercent;
   signal.is_critical = false;

   if(DebugMode) Print("TradingSignalEA: Parsing signal data: ", signalData);

   // Extract all fields with improved parsing
   signal.id = ExtractJsonValue(signalData, "id");
   signal.symbol = ExtractJsonValue(signalData, "symbol");
   
   string actionStr = ExtractJsonValue(signalData, "action");
   if(actionStr == "BUY") {
      signal.action = ORDER_TYPE_BUY;
   } else if(actionStr == "SELL") {
      signal.action = ORDER_TYPE_SELL;
      } else {
      Print("TradingSignalEA: WARNING - Unknown action: ", actionStr);
   }

   // Parse numeric values
   string entryStr = ExtractJsonValue(signalData, "entry");
   string targetStr = ExtractJsonValue(signalData, "target"); 
   string stopStr = ExtractJsonValue(signalData, "stop");
   string timeframeStr = ExtractJsonValue(signalData, "timeframe");
   string riskStr = ExtractJsonValue(signalData, "risk");
   string timestampStr = ExtractJsonValue(signalData, "timestamp");
   if(timestampStr == "") timestampStr = ExtractJsonValue(signalData, "time");

   if(entryStr != "") {
      signal.entry = StringToDouble(entryStr);
      if(DebugMode) Print("TradingSignalEA: Parsed entry: ", signal.entry, " from: ", entryStr);
   }
   
   if(targetStr != "") {
      signal.target = StringToDouble(targetStr);
      if(DebugMode) Print("TradingSignalEA: Parsed target: ", signal.target, " from: ", targetStr);
   }
   
   if(stopStr != "") {
      signal.stop = StringToDouble(stopStr);
      if(DebugMode) Print("TradingSignalEA: Parsed stop: ", signal.stop, " from: ", stopStr);
   }
   
   if(timeframeStr != "") {
      signal.timeframe = (int)StringToInteger(timeframeStr);
   }

   // Parse risk percentage (remove % sign if present)
   if(riskStr != "") {
      // Remove % symbol if present (e.g., "0.65%" -> "0.65")
      StringReplace(riskStr, "%", "");
      StringReplace(riskStr, " ", ""); // Remove any spaces
      signal.risk_percent = StringToDouble(riskStr);
      
      if(signal.risk_percent <= 0) {
         Print("TradingSignalEA: WARNING - Invalid risk from signal: '", riskStr, "', using default");
         signal.risk_percent = RiskPercent;
      } else {
         Print("TradingSignalEA: Using risk percentage from signal: ", signal.risk_percent, "%");
      }
   } else {
      signal.risk_percent = RiskPercent;
      Print("TradingSignalEA: Using default risk percentage: ", signal.risk_percent, "%");
   }

   // Parse timestamp
   if(timestampStr != "") {
      StringReplace(timestampStr, "T", " ");
      StringReplace(timestampStr, "Z", "");
      int dotPos = StringFind(timestampStr, ".");
      if(dotPos > 0) {
         timestampStr = StringSubstr(timestampStr, 0, dotPos);
      }
      
      signal.timestamp = StringToTime(timestampStr);
      if(signal.timestamp <= 0) {
         Print("TradingSignalEA: WARNING - Failed to parse timestamp: ", timestampStr);
         signal.timestamp = TimeGMT();
      }
   } else {
      signal.timestamp = TimeGMT();
   }
   
   signal.expire_time = signal.timestamp + (SignalExpirationMinutes * 60);
   signal.receive_time = TimeGMT();

   // Debug output
   if(DebugMode) {
      Print("TradingSignalEA: Successfully parsed signal - ",
            "ID: ", signal.id, ", ",
            "Symbol: ", signal.symbol, ", ", 
            "Action: ", EnumToString(signal.action), ", ",
            "Entry: ", signal.entry, ", ",
            "Target: ", signal.target, ", ",
            "Stop: ", signal.stop, ", ",
            "Risk: ", signal.risk_percent, "%");
   }

   // Validate required fields
   if(signal.id == "" || signal.symbol == "" || signal.entry <= 0) {
      Print("TradingSignalEA: ERROR - Invalid signal data: ",
            "ID=", signal.id, " ",
            "Symbol=", signal.symbol, " ",
            "Entry=", signal.entry);
      return false;
   }

      return true;
}

//+------------------------------------------------------------------+
//| Improved JSON value extraction - FIXED VERSION                  |
//+------------------------------------------------------------------+
string ExtractJsonValue(const string json, const string key) {
   string searchPattern = "\"" + key + "\"";
   int keyPos = StringFind(json, searchPattern);
   
   if(keyPos < 0) {
      if(DebugMode) Print("TradingSignalEA: Key not found: ", key);
      return "";
   }

   int colonPos = StringFind(json, ":", keyPos);
   if(colonPos < 0) {
      if(DebugMode) Print("TradingSignalEA: Colon not found after key: ", key);
      return "";
   }

   // Find the start of the value
   int valueStart = colonPos + 1;
   while(valueStart < StringLen(json) && 
         (StringGetCharacter(json, valueStart) == ' ' || 
          StringGetCharacter(json, valueStart) == '\t' ||
          StringGetCharacter(json, valueStart) == '\n' ||
          StringGetCharacter(json, valueStart) == '\r')) {
      valueStart++;
   }

   if(valueStart >= StringLen(json)) {
      if(DebugMode) Print("TradingSignalEA: Value start beyond string length for key: ", key);
      return "";
   }

   // Check if value is quoted
   if(StringGetCharacter(json, valueStart) == '"') {
      valueStart++; // Skip opening quote
      int valueEnd = StringFind(json, "\"", valueStart);
      if(valueEnd > valueStart) {
         string result = StringSubstr(json, valueStart, valueEnd - valueStart);
         if(DebugMode) Print("TradingSignalEA: Extracted quoted value for ", key, ": ", result);
         return result;
      }
               } else {
      // Value is not quoted - extract until comma, bracket, or brace
      int valueEnd = valueStart;
      while(valueEnd < StringLen(json)) {
         ushort ch = StringGetCharacter(json, valueEnd);
         if(ch == ',' || ch == '}' || ch == ']' || ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r') {
            break;
         }
         valueEnd++;
      }
      string result = StringSubstr(json, valueStart, valueEnd - valueStart);
      if(DebugMode) Print("TradingSignalEA: Extracted unquoted value for ", key, ": ", result);
      return result;
   }

   if(DebugMode) Print("TradingSignalEA: Failed to extract value for key: ", key);
   return "";
}

//+------------------------------------------------------------------+
//| Process single signal with proper risk handling                  |
//+------------------------------------------------------------------+
void ProcessSingleSignal(const TradingSignal &signal) {
   datetime currentTime = TimeGMT();
   int timeDiff = (int)(currentTime - signal.timestamp);
   
   if(DebugMode) {
      Print("TradingSignalEA: Time check - Signal time: ", signal.timestamp,
            ", Current GMT: ", currentTime,
            ", Difference: ", timeDiff, " seconds (", timeDiff/60, " minutes)");
   }

   if(timeDiff > MaxTimeDriftMinutes * 60) {
      Print("TradingSignalEA: Signal ", signal.id, " is too old (", timeDiff/60,
            " minutes). Max allowed: ", MaxTimeDriftMinutes, " minutes. Skipping.");
      SendSignalAck(signal.id, "expired", "Signal too old");
      return;
   }

            if(IsSignalAlreadyProcessed(signal.id)) {
               Print("TradingSignalEA: Duplicate signal detected: ", signal.id, " - skipping");
               return;
            }
            
            if(currentlyProcessingSignal == signal.id) {
               Print("TradingSignalEA: Signal ", signal.id, " is currently being processed - skipping");
               return;
            }
            
            if(HasOpenPosition(signal.symbol)) {
               Print("TradingSignalEA: Position already exists for ", signal.symbol, " - skipping signal: ", signal.id);
               return;
            }
            
            if(IsSymbolActive(signal.symbol)) {
               Print("TradingSignalEA: Symbol ", signal.symbol, " already has active trade - skipping signal: ", signal.id);
               return;
            }

            // Enforce DuplicateCheckWindow per symbol (skip if same symbol recently queued)
            for(int i = 0; i < recentSymbolsCount; i++) {
               if(recentSymbols[i] == signal.symbol) {
                  int delta = (int)(TimeGMT() - recentSymbolsTimes[i]);
                  if(delta < DuplicateCheckWindow) {
                     Print("TradingSignalEA: DuplicateCheckWindow active for ", signal.symbol, 
                           " - last queued ", delta, "s ago (window: ", DuplicateCheckWindow, "s). Skipping.");
                     return;
                  }
               }
            }
            
   if(signal.id != "") {
      // GLOBAL SIGNAL LOCK - prevents any signal processing during execution
      if(globalSignalLock != "") {
         int lockAge = (int)(TimeGMT() - globalSignalLockTime);
         if(lockAge < 10) {
            Print("TradingSignalEA: Global signal lock active (", globalSignalLock, ") - skipping ", signal.id);
            return;
         } else {
            Print("TradingSignalEA: WARNING - Stale global lock detected, clearing");
            globalSignalLock = "";
         }
      }
      
      // Extra duplicate guards
      if(signalQueue.ContainsId(signal.id)) {
         Print("TradingSignalEA: Signal ", signal.id, " already queued - skipping");
         return;
      }
      
      // Acquire global lock
      globalSignalLock = signal.id;
      globalSignalLockTime = TimeGMT();
      
      // Mark as processed BEFORE adding to queue to prevent duplicates
      MarkSignalAsProcessed(signal.id);
      currentlyProcessingSignal = signal.id;
      signalProcessingStartTime = TimeGMT();
      // Pre-lock symbol to prevent duplicate execution while queued
      AddActiveSymbol(signal.symbol);
      // Record last queued time for symbol
      bool updated = false;
      for(int i = 0; i < recentSymbolsCount; i++) {
         if(recentSymbols[i] == signal.symbol) {
            recentSymbolsTimes[i] = TimeGMT();
            updated = true;
            break;
         }
      }
      if(!updated) {
         ArrayResize(recentSymbols, recentSymbolsCount + 1);
         ArrayResize(recentSymbolsTimes, recentSymbolsCount + 1);
         recentSymbols[recentSymbolsCount] = signal.symbol;
         recentSymbolsTimes[recentSymbolsCount] = TimeGMT();
         recentSymbolsCount++;
      }
      signalQueue.AddSignal(signal);
      Print("TradingSignalEA: Signal queued: ", signal.id, " for ", signal.symbol,
            " with ", signal.risk_percent, "% risk");
   }
}

//+------------------------------------------------------------------+
//| Process trading signal                                           |
//+------------------------------------------------------------------+
bool ProcessSignal(const TradingSignal& signal) {
   Print("TradingSignalEA: Processing signal: ", signal.id, " for ", signal.symbol,
         " with ", signal.risk_percent, "% risk");

   if(!IsTradingEnabled()) {
      Print("TradingSignalEA: Cannot process signal - trading is disabled");
      SendSignalAck(signal.id, "failed", "Trading disabled");
      SendErrorEmail("Trading Disabled", "Cannot execute trades - check MT5 settings");
      currentlyProcessingSignal = "";
      signalProcessingStartTime = 0;
      globalSignalLock = "";
      globalSignalLockTime = 0;
      return false;
   }

   datetime currentTime = TimeGMT();
   bool isExpired = currentTime > signal.expire_time;

   int timeSinceExpiration = (int)(currentTime - signal.expire_time);
   bool isWithinGracePeriod = timeSinceExpiration <= 30;

   if(isExpired && !isWithinGracePeriod) {
      Print("TradingSignalEA: Signal expired: ", signal.id,
            " Expire time: ", signal.expire_time,
            " Current GMT: ", currentTime);
      SendSignalAck(signal.id, "expired", "Signal expired before execution");
      currentlyProcessingSignal = "";
      signalProcessingStartTime = 0;
      globalSignalLock = "";
      globalSignalLockTime = 0;
      return false;
   } else if(isExpired && isWithinGracePeriod) {
      Print("TradingSignalEA: Signal ", signal.id, " is expired but within grace period - attempting execution");
   }
   
   if(!ValidateSignal(signal)) {
      Print("TradingSignalEA: Signal validation failed");
      SendSignalAck(signal.id, "failed", "Signal validation failed");
      AddSignalToRetryList(signal.id);
      RemoveActiveSymbol(signal.symbol);
      currentlyProcessingSignal = "";
      signalProcessingStartTime = 0;
      globalSignalLock = "";
      globalSignalLockTime = 0;
      return false;
   }
   
   if(AutoExecute) {
      if(ExecuteTrade(signal)) {
         Print("TradingSignalEA: Trade executed successfully for signal: ", signal.id);
         SendSignalAck(signal.id, "executed", "Trade executed successfully");
         AddActiveSymbol(signal.symbol);
         currentlyProcessingSignal = "";
         signalProcessingStartTime = 0;
      return true;
   } else {
         Print("TradingSignalEA: Trade execution failed for signal: ", signal.id);
         SendSignalAck(signal.id, "failed", "Trade execution failed");
         AddSignalToRetryList(signal.id);
         RemoveActiveSymbol(signal.symbol);
         currentlyProcessingSignal = "";
         signalProcessingStartTime = 0;
         globalSignalLock = "";
         globalSignalLockTime = 0;
      return false;
      }
   } else {
      Print("TradingSignalEA: Signal received (auto-execute disabled): ", signal.id);
      SendSignalAck(signal.id, "received", "Manual execution required");
      RemoveActiveSymbol(signal.symbol);
      currentlyProcessingSignal = "";
      signalProcessingStartTime = 0;
      globalSignalLock = "";
      globalSignalLockTime = 0;
      return true;
   }
}

//+------------------------------------------------------------------+
//| Check if trading is enabled                                      |
//+------------------------------------------------------------------+
bool IsTradingEnabled() {
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) {
      Print("TradingSignalEA: ERROR - Enable 'Allow automated trading' in Tools → Options → Expert Advisors");
      return false;
   }
   
   if(AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) != 1) {
      Print("TradingSignalEA: ERROR - Trading is disabled for this account (check with broker)");
      return false;
   }
   
   if(!AutoExecute) {
      Print("TradingSignalEA: ERROR - AutoExecute is disabled in input parameters");
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Validate signal                                                  |
//+------------------------------------------------------------------+
bool ValidateSignal(const TradingSignal& signal) {
   if(!SymbolSelect(signal.symbol, true)) {
      Print("TradingSignalEA: Symbol not found: ", signal.symbol);
      return false;
   }
   
   if(signal.entry <= 0) {
      Print("TradingSignalEA: Invalid entry price: ", signal.entry);
      return false;
   }
   
   if(signal.target != 0 && signal.target <= 0) {
      Print("TradingSignalEA: Invalid target price: ", signal.target);
      return false;
   }
   
   if(signal.stop != 0 && signal.stop <= 0) {
      Print("TradingSignalEA: Invalid stop loss: ", signal.stop);
      return false;
   }

   if(signal.risk_percent <= 0 || signal.risk_percent > 100) {
      Print("TradingSignalEA: Invalid risk percentage: ", signal.risk_percent);
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Calculate lot size based on signal-specific risk percentage      |
//| CORRECTED VERSION - Proper 1:1 R:R with accurate cost handling   |
//+------------------------------------------------------------------+
double CalculateLotSize(const TradingSignal& signal) {
   double actualBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   string accountCurrency = AccountInfoString(ACCOUNT_CURRENCY);
   
   if(actualBalance <= 0) {
      Print("TradingSignalEA: ERROR - Invalid balance: ", actualBalance);
    SendErrorEmail("Invalid Account Balance", StringFormat("Balance: %.2f - account may be unavailable", actualBalance));
      return 0;
   }

   // Determine which balance to use for risk calculation
   double balance = actualBalance;
   
   if(!UseDynamicContractSize) {
      // Use fixed sizing (not dynamic) - ALWAYS use initial deposit for consistent risk
      if(UseManualBaseSize) {
         // Manual mode: use configured ManualBaseAccountSize
         balance = ManualBaseAccountSize;
         Print("TradingSignalEA: Using MANUAL base account size: ", accountCurrency, " ", balance, 
               " (Actual balance: ", accountCurrency, " ", actualBalance, ")");
      } else {
         // Auto mode: ALWAYS use initial account balance captured at EA start
         if(initialAccountBalance > 0) {
            balance = initialAccountBalance;
            Print("TradingSignalEA: Using INITIAL DEPOSIT: ", accountCurrency, " ", balance, 
                  " (Actual balance: ", accountCurrency, " ", actualBalance, ")");
         } else {
            // Fallback if initial balance not captured (shouldn't happen)
            balance = actualBalance;
            Print("TradingSignalEA: WARNING - Initial balance not captured, using current balance: ", 
                  accountCurrency, " ", balance);
         }
      }
   } else {
      // Use current account balance (dynamic sizing) - ONLY if explicitly enabled
      Print("TradingSignalEA: Using DYNAMIC account balance: ", accountCurrency, " ", balance);
      Print("TradingSignalEA: WARNING - Dynamic sizing enabled, risk will change with account balance!");
   }

   // Calculate target risk amount in account currency
   double targetRiskAmount = balance * (signal.risk_percent / 100.0);
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: RISK CALCULATION FOR ", signal.symbol);
   Print("TradingSignalEA: Account Balance (for calculation): ", accountCurrency, " ", balance);
   Print("TradingSignalEA: Risk Percentage: ", signal.risk_percent, "%");
   Print("TradingSignalEA: Target Risk Amount: ", accountCurrency, " ", targetRiskAmount);

   // Identify symbol type
   bool isXAUUSD = (signal.symbol == "XAUUSD" || signal.symbol == "XAGUSD");
   bool isJPY = (StringFind(signal.symbol, "JPY") >= 0);
   string baseCurrency = StringSubstr(signal.symbol, 0, 3);
   string quoteCurrency = StringSubstr(signal.symbol, 3, 3);
   
   Print("TradingSignalEA: Base Currency: ", baseCurrency, ", Quote Currency: ", quoteCurrency);

   // Calculate stop loss distance in PIPS
   double stopDistancePips = 0;
   double pipSize = 0;
   
   if(signal.stop <= 0) {
      Print("TradingSignalEA: ERROR - No stop loss defined");
      return 0;
   }
   
   // Calculate price difference using SIGNAL prices (not execution prices)
   // This ensures consistent risk calculation regardless of execution slippage
   double priceDiff = (signal.action == ORDER_TYPE_BUY) 
       ? (signal.entry - signal.stop) 
       : (signal.stop - signal.entry);
   
   if(priceDiff <= 0) {
      Print("TradingSignalEA: ERROR - Invalid stop loss (stop on wrong side of entry)");
      return 0;
   }
   
   // Define pip size based on symbol type
   if(isXAUUSD) {
      pipSize = 0.10;  // For Gold: 1 pip = 0.10 (most brokers use 2 decimals)
   } else if(isJPY) {
      pipSize = 0.01;  // For JPY pairs: 1 pip = 0.01 (e.g., 150.50 -> 150.51)
   } else {
      pipSize = 0.0001;  // For standard pairs: 1 pip = 0.0001 (e.g., 1.1000 -> 1.1001)
   }
   
   stopDistancePips = priceDiff / pipSize;
   
   if(stopDistancePips <= 0) {
      Print("TradingSignalEA: ERROR - Invalid stop distance: ", stopDistancePips, " pips");
      return 0;
   }
   
   Print("TradingSignalEA: Entry: ", signal.entry, ", Stop: ", signal.stop);
   Print("TradingSignalEA: Price Difference: ", priceDiff);
   Print("TradingSignalEA: Pip Size: ", pipSize);
   Print("TradingSignalEA: Stop Distance: ", stopDistancePips, " pips");
   Print("TradingSignalEA: NOTE: Lot size calculated using SIGNAL prices, not execution prices");

   // Calculate pip value in account currency using MT5's built-in functions
   double pipValueInAccountCurrency = 0;
   double tickValue = SymbolInfoDouble(signal.symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(signal.symbol, SYMBOL_TRADE_TICK_SIZE);
   double point = SymbolInfoDouble(signal.symbol, SYMBOL_POINT);
   
   Print("TradingSignalEA: Symbol Info - Tick Value: ", tickValue, ", Tick Size: ", tickSize, ", Point: ", point);
   
   if(tickValue > 0 && tickSize > 0) {
      // Use MT5's built-in tick value for accurate calculation
      // For JPY pairs: tick value is already in account currency per tick
      // Convert to pip value: (tick value / tick size) * pip size
      pipValueInAccountCurrency = (tickValue / tickSize) * pipSize;
      Print("TradingSignalEA: Using MT5 tick value - Pip value per lot: ", pipValueInAccountCurrency);
   } else {
      // Fallback to manual calculation if tick values not available
      Print("TradingSignalEA: Tick values not available, using fallback calculation");
      
      if(isXAUUSD) {
         // XAUUSD: 1 lot = 100 oz, 1 pip (0.10) = $10 per lot
         pipValueInAccountCurrency = 10.0;  // $10 per pip for 1 lot XAUUSD
         Print("TradingSignalEA: XAUUSD Fallback - Pip value per lot: $", pipValueInAccountCurrency);
      } else if(isJPY) {
         // JPY pairs: pip value calculation using current price
         double currentPrice = SymbolInfoDouble(signal.symbol, SYMBOL_BID);
         if(currentPrice <= 0) {
            Print("TradingSignalEA: ERROR - Invalid current price for ", signal.symbol);
            return 0;
         }
         
         if(baseCurrency != "JPY") {
            // JPY is quote currency (e.g., USDJPY, EURJPY)
            // Pip value in base currency = (100,000 * 0.01) / current_price
            pipValueInAccountCurrency = (100000.0 * pipSize) / currentPrice;
         } else {
            // JPY is base currency (e.g., JPYUSD - rare)
            pipValueInAccountCurrency = 100000.0 * pipSize;
         }
         
         Print("TradingSignalEA: JPY Pair Fallback - Current price: ", currentPrice);
         Print("TradingSignalEA: JPY Pair Fallback - Base: ", baseCurrency, ", Quote: ", quoteCurrency);
         Print("TradingSignalEA: JPY Pair Fallback - Pip value per lot: ", pipValueInAccountCurrency);
      } else {
         // Standard forex pairs: pip value = contract size * pip size
         pipValueInAccountCurrency = 100000.0 * pipSize;
         Print("TradingSignalEA: Standard Pair Fallback - Pip value per lot: ", pipValueInAccountCurrency);
      }
   }
   
   if(pipValueInAccountCurrency <= 0) {
      Print("TradingSignalEA: ERROR - Invalid pip value: ", pipValueInAccountCurrency);
      return 0;
   }

   // Convert pip value to account currency if needed
   string pipValueCurrency;
   
   if(isXAUUSD) {
      pipValueCurrency = "USD";
   } else if(isJPY && baseCurrency != "JPY") {
      pipValueCurrency = baseCurrency;
   } else {
      pipValueCurrency = quoteCurrency;
   }
   
   Print("TradingSignalEA: Pip value before conversion: ", pipValueInAccountCurrency, " ", pipValueCurrency);
   Print("TradingSignalEA: Account currency: ", accountCurrency);
   
   // Convert to account currency if needed
   if(accountCurrency != pipValueCurrency) {
      string conversionPair1 = pipValueCurrency + accountCurrency;
      string conversionPair2 = accountCurrency + pipValueCurrency;
      double conversionRate = 0;
      bool conversionDone = false;
      
      Print("TradingSignalEA: Need to convert ", pipValueCurrency, " to ", accountCurrency);
      
      // Try first format: pipValueCurrency + accountCurrency (e.g., GBPUSD)
      if(SymbolSelect(conversionPair1, true)) {
         conversionRate = SymbolInfoDouble(conversionPair1, SYMBOL_BID);
         if(conversionRate > 0) {
            pipValueInAccountCurrency = pipValueInAccountCurrency * conversionRate;
            Print("TradingSignalEA: ✓ Found ", conversionPair1, " = ", conversionRate);
            conversionDone = true;
         }
      }
      
      // Try second format: accountCurrency + pipValueCurrency (e.g., USDCHF)
      if(!conversionDone && SymbolSelect(conversionPair2, true)) {
         conversionRate = SymbolInfoDouble(conversionPair2, SYMBOL_BID);
         if(conversionRate > 0) {
            pipValueInAccountCurrency = pipValueInAccountCurrency / conversionRate;
            Print("TradingSignalEA: ✓ Found ", conversionPair2, " = ", conversionRate);
            conversionDone = true;
         }
      }
      
      if(!conversionDone) {
         Print("TradingSignalEA: WARNING: Cannot convert ", pipValueCurrency, " to ", accountCurrency, " - using 1:1");
      }
   } else {
      Print("TradingSignalEA: ✓ No conversion needed - pip value already in ", accountCurrency);
   }
   
   Print("TradingSignalEA: Final pip value in ", accountCurrency, ": ", pipValueInAccountCurrency);

  // Calculate per-lot commission (ONLY commission, not spread - spread is paid on both sides)
  double commissionPerLotInAccountCcy = 0.0;
  if(AccountForBrokerCosts) {
     commissionPerLotInAccountCcy = isXAUUSD ? GoldCommissionPerLot : ForexCommissionPerLot; // round-trip

     // Convert commission to account currency if needed
     if(accountCurrency != "USD") {
        string conv1 = "USD" + accountCurrency;
        string conv2 = accountCurrency + "USD";
        if(SymbolSelect(conv1, true)) {
           double rate = SymbolInfoDouble(conv1, SYMBOL_BID);
           if(rate > 0) commissionPerLotInAccountCcy *= rate;
        } else if(SymbolSelect(conv2, true)) {
           double rate = SymbolInfoDouble(conv2, SYMBOL_BID);
           if(rate > 0) commissionPerLotInAccountCcy /= rate;
        }
     }
  }

  double perLotRiskValue = stopDistancePips * pipValueInAccountCurrency;
  
  // CORRECTED: Only include commission in denominator (spread applies to both win/loss)
  // This ensures net profit/loss at TP/SL matches the target risk amount
  double perLotCommission = AccountForBrokerCosts ? commissionPerLotInAccountCcy : 0.0;

  // Calculate lot size: Risk = (StopPips × PipValue + Commission) × Lot
  // Lot = Risk / (StopPips × PipValue + Commission)
  double denominator = perLotRiskValue + perLotCommission;
  double calculatedLotSize = (denominator > 0.0) ? (targetRiskAmount / denominator) : 0.0;
   
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: LOT SIZE CALCULATION BREAKDOWN");
   Print("TradingSignalEA: ----------------------------------------");
   Print("TradingSignalEA: Target Risk Amount: ", accountCurrency, " ", targetRiskAmount);
   Print("TradingSignalEA: Stop Distance: ", stopDistancePips, " pips");
   Print("TradingSignalEA: Pip Value per Lot: ", accountCurrency, " ", pipValueInAccountCurrency);
  Print("TradingSignalEA: Risk per Lot (pips×pipValue): ", accountCurrency, " ", perLotRiskValue);
  if(AccountForBrokerCosts) {
     Print("TradingSignalEA: Commission per Lot: ", accountCurrency, " ", perLotCommission);
     Print("TradingSignalEA: Denominator (risk + commission): ", accountCurrency, " ", denominator);
  }
   Print("TradingSignalEA: Calculated Lot Size (before constraints): ", calculatedLotSize);
   Print("TradingSignalEA: Formula: ", targetRiskAmount, " ÷ (", stopDistancePips, " × ", pipValueInAccountCurrency, ") = ", calculatedLotSize);
   Print("TradingSignalEA: ========================================");

   // Apply broker constraints
   double minLot = SymbolInfoDouble(signal.symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(signal.symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(signal.symbol, SYMBOL_VOLUME_STEP);
   
   if(minLot <= 0) minLot = 0.01;
   if(maxLot <= 0) maxLot = 100.0;
   if(lotStep <= 0) lotStep = 0.01;
   
   // Round to lot step
   double finalLotSize = MathFloor(calculatedLotSize / lotStep) * lotStep;
   
   // Apply min/max constraints
   if(finalLotSize < minLot) {
      Print("TradingSignalEA: WARNING - Calculated lot (", finalLotSize, ") below minimum (", minLot, "), using minimum");
      finalLotSize = minLot;
   }
   if(finalLotSize > maxLot) {
      Print("TradingSignalEA: WARNING - Calculated lot (", finalLotSize, ") above maximum (", maxLot, "), using maximum");
      finalLotSize = maxLot;
   }

   // Calculate actual risk with final lot size
   double actualRiskAmount = finalLotSize * stopDistancePips * pipValueInAccountCurrency;
   double riskDeviation = ((actualRiskAmount - targetRiskAmount) / targetRiskAmount) * 100.0;
   
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: FINAL RISK SUMMARY");
   Print("TradingSignalEA: ----------------------------------------");
   Print("TradingSignalEA: Final Lot Size: ", finalLotSize);
   Print("TradingSignalEA: Stop Distance: ", stopDistancePips, " pips");
   Print("TradingSignalEA: Pip Value: ", accountCurrency, " ", pipValueInAccountCurrency);
   Print("TradingSignalEA: Actual Risk: ", accountCurrency, " ", actualRiskAmount);
   Print("TradingSignalEA: Target Risk: ", accountCurrency, " ", targetRiskAmount);
   Print("TradingSignalEA: Risk Deviation: ", riskDeviation, "%");
   Print("TradingSignalEA: ========================================");
   
   // Warn if risk deviation is significant
   if(MathAbs(riskDeviation) > 15.0) {
      Print("TradingSignalEA: WARNING - Risk deviation exceeds 15% (", riskDeviation, "%)");
      Print("TradingSignalEA: This may be due to broker lot size constraints");
   }
   
   return finalLotSize;
}

//+------------------------------------------------------------------+
//| Calculate 1:1 R:R adjusted target based on actual execution price |
//| Uses actual execution price to ensure accurate TP/SL ratio        |
//+------------------------------------------------------------------+
double CalculateOneToOneTarget(const TradingSignal& signal, double actualEntryPrice) {
   if(!ForceOneToOneRR) {
      // Even if not forcing 1:1, calculate based on actual entry for accuracy
      double pipSize = 0;
      bool isXAUUSD = (signal.symbol == "XAUUSD" || signal.symbol == "XAGUSD");
      bool isJPY = (StringFind(signal.symbol, "JPY") >= 0);
      if(isXAUUSD) pipSize = 0.10;
      else if(isJPY) pipSize = 0.01;
      else pipSize = 0.0001;
      
      // Calculate stop distance from actual entry
      double stopDistancePips = 0;
      if(signal.action == ORDER_TYPE_BUY) {
         stopDistancePips = (actualEntryPrice - signal.stop) / pipSize;
      } else {
         stopDistancePips = (signal.stop - actualEntryPrice) / pipSize;
      }
      
      // Calculate target distance to match stop distance
      double targetDistancePips = stopDistancePips;
      if(signal.action == ORDER_TYPE_BUY) {
         return actualEntryPrice + (targetDistancePips * pipSize);
      } else {
         return actualEntryPrice - (targetDistancePips * pipSize);
      }
   }
   
   // Calculate stop distance in pips
   double stopDistancePips = 0;
   double pipSize = 0;
   
   // Identify symbol type
   bool isXAUUSD = (signal.symbol == "XAUUSD" || signal.symbol == "XAGUSD");
   bool isJPY = (StringFind(signal.symbol, "JPY") >= 0);
   
   // Define pip size based on symbol type
   if(isXAUUSD) {
      pipSize = 0.10;  // For Gold
   } else if(isJPY) {
      pipSize = 0.01;  // For JPY pairs
   } else {
      pipSize = 0.0001;  // For standard pairs
   }
   
   // Calculate stop distance using ACTUAL execution price (not signal entry)
   double stopDistanceFromActual = 0;
   if(signal.action == ORDER_TYPE_BUY) {
      stopDistanceFromActual = actualEntryPrice - signal.stop;
   } else {
      stopDistanceFromActual = signal.stop - actualEntryPrice;
   }
   
   stopDistancePips = stopDistanceFromActual / pipSize;
   
   // Calculate target distance to match stop distance (1:1 R:R)
   double targetDistancePips = stopDistancePips;
   
   // Calculate adjusted target price based on ACTUAL entry
   double adjustedTarget = 0;
   if(signal.action == ORDER_TYPE_BUY) {
      // For BUY: target is above actual entry
      adjustedTarget = actualEntryPrice + (targetDistancePips * pipSize);
   } else {
      // For SELL: target is below actual entry
      adjustedTarget = actualEntryPrice - (targetDistancePips * pipSize);
   }
   
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: 1:1 R:R TARGET ADJUSTMENT");
   Print("TradingSignalEA: ----------------------------------------");
   Print("TradingSignalEA: Signal Entry: ", signal.entry);
   Print("TradingSignalEA: Actual Entry: ", actualEntryPrice);
   Print("TradingSignalEA: Stop Loss: ", signal.stop);
   Print("TradingSignalEA: Stop Distance: ", stopDistancePips, " pips");
   Print("TradingSignalEA: Target Distance: ", targetDistancePips, " pips");
   Print("TradingSignalEA: Adjusted Target: ", adjustedTarget);
   Print("TradingSignalEA: ========================================");
   
   return adjustedTarget;
}

//+------------------------------------------------------------------+
//| Calculate adjusted target price to compensate for broker costs   |
//| CORRECTED VERSION - Ensure TP slightly larger than SL for net 1:1 |
//+------------------------------------------------------------------+
double CalculateAdjustedTarget(const TradingSignal& signal, double lotSize, double actualEntryPrice) {
   // First, ensure 1:1 R:R if enabled (using actual entry price)
   double baseTarget = CalculateOneToOneTarget(signal, actualEntryPrice);
   
   if(!AdjustTargetForCosts || !AccountForBrokerCosts) {
      return baseTarget;  // Return 1:1 R:R target without cost adjustment
   }
   
   string accountCurrency = AccountInfoString(ACCOUNT_CURRENCY);
   
   // Identify symbol type
   bool isXAUUSD = (signal.symbol == "XAUUSD" || signal.symbol == "XAGUSD");
   bool isJPY = (StringFind(signal.symbol, "JPY") >= 0);
   
   // Define pip size based on symbol type
   double pipSize = 0;
   if(isXAUUSD) {
      pipSize = 0.10;  // For Gold
   } else if(isJPY) {
      pipSize = 0.01;  // For JPY pairs
   } else {
      pipSize = 0.0001;  // For standard pairs
   }
   
   // Calculate stop distance using ACTUAL execution price (not signal entry)
   double stopDistanceFromActual = 0;
   if(signal.action == ORDER_TYPE_BUY) {
      stopDistanceFromActual = actualEntryPrice - signal.stop;
   } else {
      stopDistanceFromActual = signal.stop - actualEntryPrice;
   }
   double stopDistancePips = stopDistanceFromActual / pipSize;
   
   // Calculate pip value per lot in account currency using MT5's built-in functions
   double pipValueInAccountCurrency = 0;
   double tickValue = SymbolInfoDouble(signal.symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(signal.symbol, SYMBOL_TRADE_TICK_SIZE);
   
   if(tickValue > 0 && tickSize > 0) {
      // Use MT5's built-in tick value for accurate calculation
      pipValueInAccountCurrency = (tickValue / tickSize) * pipSize;
      Print("TradingSignalEA: Target Adjustment - Using MT5 tick value: ", pipValueInAccountCurrency);
   } else {
      // Fallback to manual calculation
      string baseCurrency = StringSubstr(signal.symbol, 0, 3);
      string quoteCurrency = StringSubstr(signal.symbol, 3, 3);
      
      if(isXAUUSD) {
         pipValueInAccountCurrency = 10.0;  // $10 per pip for XAUUSD
      } else if(isJPY) {
         double currentPrice = SymbolInfoDouble(signal.symbol, SYMBOL_BID);
         if(currentPrice > 0) {
            if(baseCurrency != "JPY") {
               pipValueInAccountCurrency = (100000.0 * pipSize) / currentPrice;
            } else {
               pipValueInAccountCurrency = 100000.0 * pipSize;
            }
         }
      } else {
         pipValueInAccountCurrency = 100000.0 * pipSize;
      }
      Print("TradingSignalEA: Target Adjustment - Using fallback calculation: ", pipValueInAccountCurrency);
   }
   
   // Convert to account currency if needed
   string pipValueCurrency;
   string baseCurrency = StringSubstr(signal.symbol, 0, 3);
   string quoteCurrency = StringSubstr(signal.symbol, 3, 3);
   
   if(isXAUUSD) {
      pipValueCurrency = "USD";
   } else if(isJPY && baseCurrency != "JPY") {
      pipValueCurrency = baseCurrency;
   } else {
      pipValueCurrency = quoteCurrency;
   }
   
   if(accountCurrency != pipValueCurrency) {
      string conversionPair1 = pipValueCurrency + accountCurrency;
      string conversionPair2 = accountCurrency + pipValueCurrency;
      bool conversionDone = false;
      
      if(SymbolSelect(conversionPair1, true)) {
         double rate = SymbolInfoDouble(conversionPair1, SYMBOL_BID);
         if(rate > 0) {
            pipValueInAccountCurrency = pipValueInAccountCurrency * rate;
            conversionDone = true;
         }
      }
      
      if(!conversionDone && SymbolSelect(conversionPair2, true)) {
         double rate = SymbolInfoDouble(conversionPair2, SYMBOL_BID);
         if(rate > 0) {
            pipValueInAccountCurrency = pipValueInAccountCurrency / rate;
            conversionDone = true;
         }
      }
   }
   
   // Calculate broker costs per lot
   long spreadPointsLong = SymbolInfoInteger(signal.symbol, SYMBOL_SPREAD);
   double spreadPoints = (double)spreadPointsLong;
   double spreadInPips = spreadPoints * (pipSize / SymbolInfoDouble(signal.symbol, SYMBOL_POINT));
   
   double commissionPerLot = isXAUUSD ? GoldCommissionPerLot : ForexCommissionPerLot;
   
   // Convert commission to account currency if needed
   if(accountCurrency != "USD") {
      string conversionPair1 = "USD" + accountCurrency;
      string conversionPair2 = accountCurrency + "USD";
      
      if(SymbolSelect(conversionPair1, true)) {
         double rate = SymbolInfoDouble(conversionPair1, SYMBOL_BID);
         if(rate > 0) commissionPerLot *= rate;
      } else if(SymbolSelect(conversionPair2, true)) {
         double rate = SymbolInfoDouble(conversionPair2, SYMBOL_BID);
         if(rate > 0) commissionPerLot /= rate;
      }
   }
   
   double spreadCostPerLot = spreadInPips * pipValueInAccountCurrency;
   double totalCostPerLot = spreadCostPerLot + commissionPerLot;
   
   // Calculate total broker costs for the position
   double totalBrokerCosts = lotSize * totalCostPerLot;
   
   // Calculate how many pips to add to target to compensate for broker costs
   // This ensures net profit at TP equals the risk amount at SL (after costs)
   double costPipsToAdd = totalBrokerCosts / (lotSize * pipValueInAccountCurrency);
   
   // Limit adjustment to reasonable range (5-15% of stop distance, max 10 pips)
   double maxAdjustmentPercent = 0.15;  // Max 15% of stop distance
   double maxAdjustmentPips = MathMax(stopDistancePips * maxAdjustmentPercent, MathMin(10.0, stopDistancePips * 0.10));
   
   if(costPipsToAdd > maxAdjustmentPips) {
      Print("TradingSignalEA: WARNING - Cost adjustment (", costPipsToAdd, " pips) exceeds max (", maxAdjustmentPips, " pips), limiting");
      costPipsToAdd = maxAdjustmentPips;
   }
   
   // Ensure TP is at least slightly larger than SL (minimum 2% more to cover costs)
   double minTPPips = stopDistancePips * 1.02;  // At least 2% more
   double targetPipsWithCost = stopDistancePips + costPipsToAdd;
   double finalTargetPips = MathMax(minTPPips, targetPipsWithCost);
   
   // Calculate final target price based on actual entry
   double adjustedTarget = 0;
   if(signal.action == ORDER_TYPE_BUY) {
      // For BUY: target is above actual entry
      adjustedTarget = actualEntryPrice + (finalTargetPips * pipSize);
   } else {
      // For SELL: target is below actual entry
      adjustedTarget = actualEntryPrice - (finalTargetPips * pipSize);
   }
   
   // Calculate actual TP/SL ratio
   double actualTPPips = finalTargetPips;
   double actualSLPips = stopDistancePips;
   double tpSlRatio = actualTPPips / actualSLPips;
   
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: TARGET ADJUSTMENT FOR BROKER COSTS");
   Print("TradingSignalEA: ----------------------------------------");
   Print("TradingSignalEA: Actual Entry Price: ", actualEntryPrice);
   Print("TradingSignalEA: Stop Loss: ", signal.stop);
   Print("TradingSignalEA: Stop Distance: ", actualSLPips, " pips");
   Print("TradingSignalEA: Total Broker Costs: ", accountCurrency, " ", totalBrokerCosts);
   Print("TradingSignalEA: Cost Pips to Add: ", costPipsToAdd);
   Print("TradingSignalEA: Final Target Pips: ", actualTPPips, " pips");
   Print("TradingSignalEA: TP/SL Ratio: ", DoubleToString(tpSlRatio, 3));
   Print("TradingSignalEA: Final Adjusted Target: ", adjustedTarget);
   Print("TradingSignalEA: Expected Net Profit (at TP): ", accountCurrency, " ", 
         (lotSize * actualTPPips * pipValueInAccountCurrency) - totalBrokerCosts);
   Print("TradingSignalEA: Expected Net Loss (at SL): ", accountCurrency, " ", 
         (lotSize * actualSLPips * pipValueInAccountCurrency) + totalBrokerCosts);
   Print("TradingSignalEA: ========================================");
   
   return adjustedTarget;
}

//+------------------------------------------------------------------+
//| Get symbol-specific maximum slippage                             |
//+------------------------------------------------------------------+
double GetSymbolMaxSlippage(string symbol) {
   if(symbol == "XAUUSD" || symbol == "XAGUSD") {
      return BaseMaxSlippagePips * VolatileSymbolSlippageMultiplier;
   }
   else if(StringFind(symbol, "JPY") >= 0) {
      return BaseMaxSlippagePips * 1.2;
   }
   else if(StringFind(symbol, "GBP") >= 0 || StringFind(symbol, "CAD") >= 0) {
      return BaseMaxSlippagePips * 1.3;
   }
   else {
      return BaseMaxSlippagePips;
   }
}

//+------------------------------------------------------------------+
//| Execute trade (optimized for volatility)                         |
//+------------------------------------------------------------------+
bool ExecuteTrade(const TradingSignal& signal) {
   if(!IsTradingEnabled()) {
      Print("TradingSignalEA: Cannot execute - trading is disabled");
      return false;
   }

   double lotSize = CalculateLotSize(signal);
   if(lotSize <= 0) {
      Print("TradingSignalEA: Invalid lot size calculated: ", lotSize);
      return false;
   }
   
   double currentPrice = (signal.action == ORDER_TYPE_BUY) 
      ? SymbolInfoDouble(signal.symbol, SYMBOL_ASK) 
      : SymbolInfoDouble(signal.symbol, SYMBOL_BID);

   double point = SymbolInfoDouble(signal.symbol, SYMBOL_POINT);
   double volatilityThreshold = (signal.symbol == "XAUUSD") ? (point * 100) : (point * 50);
   double priceDiff = MathAbs(currentPrice - signal.entry);
   
   if(priceDiff > volatilityThreshold) {
      Print("TradingSignalEA: Price moved too far (", priceDiff/point, " points) from entry - avoiding bad fill");
      return false;
   }

   double maxSlippage = GetSymbolMaxSlippage(signal.symbol);
   if(signal.symbol == "XAUUSD") {
      maxSlippage += 2.0;
      Print("TradingSignalEA: XAUUSD volatility detected - max slippage: ", maxSlippage, " pips");
   }

   MqlTradeRequest request = {};
   request.action = TRADE_ACTION_DEAL;
   request.symbol = signal.symbol;
   request.volume = lotSize;
   request.type = signal.action;
   request.price = currentPrice;
   request.deviation = (uint)(maxSlippage * 10);
   request.magic = MagicNumber;
   request.comment = "Signal: " + signal.id + " | Risk: " + DoubleToString(signal.risk_percent, 2) + "%";
   
  if(UseStopLoss && signal.stop > 0) {
      // Use EXACT stop loss from signal - NO BUFFER
      request.sl = signal.stop;
   }
  if(UseTakeProfit && signal.stop > 0) {
     // Calculate target based on ACTUAL execution price (not signal entry)
     // This ensures TP/SL ratio is accurate regardless of slippage
     double finalTarget = CalculateAdjustedTarget(signal, lotSize, currentPrice);
     request.tp = finalTarget;
  }
   
   MqlTradeResult result = {};
  if(!OrderSend(request, result)) {
      int errorCode = GetLastError();
      Print("TradingSignalEA: Order failed - Error Code: ", errorCode, 
            " | Symbol: ", signal.symbol, " | Price: ", currentPrice);
    // Email on execution failure
    SendTradeExecutionEmail(signal, result, false);
    SendErrorEmail("Trade Execution Failed", 
                   StringFormat("LastError: %d\nSymbol: %s\nPrice: %.5f", errorCode, signal.symbol, currentPrice));
      return false;
   }
   
   if(result.retcode != TRADE_RETCODE_DONE) {
      Print("TradingSignalEA: Execution failed - Code: ", result.retcode, 
            " | Expected Price: ", currentPrice, " | Actual Price: ", result.price);
    // Email on execution failure
    SendTradeExecutionEmail(signal, result, false);
    SendErrorEmail("Trade Execution Failed", 
                   StringFormat("Execution Code: %d\nExpected: %.5f\nActual: %.5f", result.retcode, currentPrice, result.price));
      return false;
   }
   
  // Email on execution success
  SendTradeExecutionEmail(signal, result, true);

   Print("TradingSignalEA: Trade executed - Ticket: ", result.order,
         " | Symbol: ", signal.symbol, " | Price: ", result.price, " | Lot: ", lotSize,
         " | Risk: ", signal.risk_percent, "%");
   
   // Release global signal lock after successful execution
   globalSignalLock = "";
   globalSignalLockTime = 0;
   
   return true;
}

//+------------------------------------------------------------------+
//| Communication functions                                          |
//+------------------------------------------------------------------+
bool SendConnectionMessage() {
   string url = ServerURL + "/mt5/connect";
   string postDataStr = StringFormat(
      "{\"type\":\"mt5_connect\",\"account\":%d,\"terminal\":\"%s\",\"version\":\"5.0\"}",
      AccountInfoInteger(ACCOUNT_LOGIN),
      TerminalInfoString(TERMINAL_NAME)
   );
   string headers = GenerateHeaders("POST");
   
   uchar postData[];
   StringToCharArray(postDataStr, postData);
   
   uchar response[];
   string responseHeaders;
   int result = WebRequest("POST", url, headers, 5000, postData, response, responseHeaders);
   
   if(result == 200) {
      Print("TradingSignalEA: Connection message sent successfully");
      return true;
   } else {
      Print("TradingSignalEA: Failed to send connection message. HTTP code: ", result);
      ErrorHandler::HandleWebRequestError(result, "Connection");
      return false;
   }
}

void SendDisconnectMessage() {
   string url = ServerURL + "/mt5/disconnect";
   string postDataStr = StringFormat(
      "{\"type\":\"mt5_disconnect\",\"account\":%d}",
      AccountInfoInteger(ACCOUNT_LOGIN)
   );
   string headers = GenerateHeaders("POST");
   
   uchar postData[];
   StringToCharArray(postDataStr, postData);
   
   uchar response[];
   string responseHeaders;
   WebRequest("POST", url, headers, 5000, postData, response, responseHeaders);
}

void SendHeartbeat() {
   string url = ServerURL + "/mt5/heartbeat";
   string postDataStr = StringFormat(
      "{\"terminal\":\"MT5\",\"account\":%d}",
      (int)AccountInfoInteger(ACCOUNT_LOGIN)
   );
   string headers = GenerateHeaders("POST");
   
   uchar postData[];
   StringToCharArray(postDataStr, postData, 0, StringLen(postDataStr), CP_UTF8);
   
   uchar response[];
   string responseHeaders;
   int result = WebRequest("POST", url, headers, 5000, postData, response, responseHeaders);
   
   if(result == 200) {
      Print("TradingSignalEA: Heartbeat successful");
      connectionManager.UpdateConnectionHealth(true);
   } else {
      Print("TradingSignalEA: Heartbeat failed. HTTP code: ", result);
      if(ArraySize(response) > 0) {
         string errorResponse = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
         Print("TradingSignalEA: Heartbeat Error Response: ", errorResponse);
      }
      connectionManager.UpdateConnectionHealth(false);
   }
}

void SendSignalAck(const string signalId, const string status, const string message) {
   Print("TradingSignalEA: Sending signal ack - ID: ", signalId, ", Status: ", status);
   
   string url = ServerURL + "/signals/ack";
   string headers = GenerateHeaders("POST");
   
   string postDataStr = StringFormat(
      "{\"type\":\"signal_ack\",\"signalId\":\"%s\",\"status\":\"%s\",\"message\":\"%s\",\"account\":%d}",
      signalId,
      status,
      message,
      (int)AccountInfoInteger(ACCOUNT_LOGIN)
   );
   
   uchar postData[];
   StringToCharArray(postDataStr, postData, 0, StringLen(postDataStr), CP_UTF8);
   
   uchar response[];
   string responseHeaders;
   int result = WebRequest("POST", url, headers, 5000, postData, response, responseHeaders);
   
   if(result == 200) {
      Print("TradingSignalEA: Signal ack sent successfully - ID: ", signalId);
   } else {
      Print("TradingSignalEA: Signal ack failed - HTTP Code: ", result);
      if(ArraySize(response) > 0) {
         string errorResponse = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
         Print("TradingSignalEA: Ack Error Response: ", errorResponse);
      }
   }
}

//+------------------------------------------------------------------+
//| URL-encode a string                                              |
//+------------------------------------------------------------------+
string UrlEncode(string str) {
   string encoded = "";
   string hexChars = "0123456789ABCDEF";

   for(int i = 0; i < StringLen(str); i++) {
      ushort ch = StringGetCharacter(str, i);

      if((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') ||
         ch == '-' || ch == '_' || ch == '.' || ch == '~') {
         encoded += ShortToString(ch);
      } else {
         encoded += "%" + StringSubstr(hexChars, ch >> 4, 1) + StringSubstr(hexChars, ch & 0x0F, 1);
      }
   }

   return encoded;
}

//+------------------------------------------------------------------+
//| Generate authentication headers                                  |
//+------------------------------------------------------------------+
string GenerateHeaders(string httpMethod = "POST") {
   string headers = "";

   headers += "User-Agent: MT5-TradingSignalEA/1.06\r\n";
   headers += "Accept: application/json\r\n";

   if(httpMethod == "POST") {
      headers += "Content-Type: application/json\r\n";
   }

   headers += "Origin: https://trading-backend-4v0f.onrender.com\r\n";

   if(APIKey != "" && SecretKey != "") {
      string timestamp = IntegerToString(TimeGMT() * 1000);
      string signature = GenerateHMAC(APIKey + timestamp, SecretKey);

      headers += "X-API-Key: " + APIKey + "\r\n";
      headers += "X-Timestamp: " + timestamp + "\r\n";
      headers += "X-Signature: " + signature + "\r\n";
   }

   return headers;
}

//+------------------------------------------------------------------+
//| Generate HMAC signature                                          |
//+------------------------------------------------------------------+
string GenerateHMAC(string data, string key) {
   string combined = data + key + "MT5EA";
   int hash1 = StringHash(combined);
   int hash2 = StringHash(key + data);

   long combinedHash = ((long)hash1 << 16) ^ hash2;
   if(combinedHash < 0) combinedHash = -combinedHash;

   return StringFormat("%016X", combinedHash);
}

//+------------------------------------------------------------------+
//| Simple string hash function                                      |
//+------------------------------------------------------------------+
int StringHash(string str) {
   int hash = 0;
   int len = StringLen(str);

   for(int i = 0; i < len; i++) {
      hash = ((hash << 5) - hash + StringGetCharacter(str, i)) & 0x7FFFFFFF;
   }

   return MathAbs(hash);
}

//+------------------------------------------------------------------+
//| Alternative polling method using GET                             |
//+------------------------------------------------------------------+
void PollForSignalsGET() {
   Print("TradingSignalEA: Polling for signals (GET method)...");

   string account = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string symbol = UrlEncode(Symbol());
   string timeframe = IntegerToString(Period());

   string queryString = "terminal=MT5&account=" + account;
   string url = ServerURL + "/signals/pending?" + queryString;

   string headers = GenerateHeaders("GET");
   if(headers == "") {
      Print("TradingSignalEA: GET poll request aborted (invalid headers)");
      return;
   }

   if(DebugMode) {
      Print("TradingSignalEA: GET Poll URL: ", url);
      Print("TradingSignalEA: GET Poll Headers: ", headers);
   }

   uchar emptyData[];
   uchar response[];
   string responseHeaders;
   int result = WebRequest("GET", url, headers, 5000, emptyData, response, responseHeaders);

   if(result == 200) {
      string responseStr = CharArrayToString(response);
      if(DebugMode) Print("TradingSignalEA: Received response (GET): ", responseStr);
      ProcessSignalsResponse(responseStr);
      connectionManager.UpdateConnectionHealth(true);
   } else {
      Print("TradingSignalEA: Failed to poll for signals (GET). HTTP code: ", result);
      if(ArraySize(response) > 0) {
         string errorResponse = CharArrayToString(response);
         Print("TradingSignalEA: GET Error Response: ", errorResponse);
      }
      connectionManager.UpdateConnectionHealth(false);
   }
}

//+------------------------------------------------------------------+
//| Check Hong Kong time for auto-shutdown                           |
//+------------------------------------------------------------------+
bool IsHKShutdownTime() {
   datetime utcTime = TimeGMT();
   datetime hkTime = utcTime + 8 * 3600;

   MqlDateTime hkDateTime;
   TimeToStruct(hkTime, hkDateTime);

   return (hkDateTime.hour == HKShutdownHour && hkDateTime.min < 5);
}

//+------------------------------------------------------------------+
//| Auto-close all trades at HK shutdown time                        |
//+------------------------------------------------------------------+
void AutoCloseAllTrades() {
   if(!AutoShutdownEnabled) return;

   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket)) {
         if(PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
            string symbol = PositionGetString(POSITION_SYMBOL);
            ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

            MqlTradeRequest request = {};
            MqlTradeResult result = {};

            request.action = TRADE_ACTION_DEAL;
            request.position = ticket;
            request.symbol = symbol;
            request.volume = PositionGetDouble(POSITION_VOLUME);
            request.type = (posType == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
            request.price = (posType == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
            request.deviation = 10;
            request.magic = MagicNumber;
            request.comment = "Auto-close at HK shutdown time (4:00 AM)";

            if(OrderSend(request, result)) {
               if(result.retcode == TRADE_RETCODE_DONE) {
                  Print("TradingSignalEA: Auto-closed trade at HK shutdown time - Ticket: ", ticket, ", Symbol: ", symbol);
                  UpdateTradeOutcome(ticket, "loss");
               } else {
                  Print("TradingSignalEA: Failed to auto-close trade - Ticket: ", ticket, ", Error: ", result.retcode);
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Update trade outcome to backend                                  |
//+------------------------------------------------------------------+
bool UpdateTradeOutcome(ulong ticket, string outcome) {
   string postData = StringFormat("{\"ticket\":%d,\"outcome\":\"%s\",\"symbol\":\"%s\",\"closePrice\":%.5f,\"closeTime\":\"%s\"}",
                                 ticket, outcome, Symbol(), SymbolInfoDouble(Symbol(), SYMBOL_BID), TimeToString(TimeGMT()));

   uchar data[], response[];
   string headers = "Content-Type: application/json\r\n";
   string responseHeaders;

   StringToCharArray(postData, data);

   int result = WebRequest("POST", ServerURL + "/mt5/trade-outcome", headers, 5000, data, response, responseHeaders);

   if(result == 200) {
      Print("TradingSignalEA: Trade outcome updated successfully - Ticket: ", ticket, ", Outcome: ", outcome);
    // Send trade close email
    double profit = 0.0;
    for(int i = HistoryDealsTotal() - 1; i >= 0; i--) {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket > 0 && HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID) == ticket) {
        profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
        break;
      }
    }
    SendTradeCloseEmail(ticket, Symbol(), profit, outcome);
    return true;
   } else {
      Print("TradingSignalEA: Failed to update trade outcome - Ticket: ", ticket, ", Error: ", result);
      return false;
   }
}

//+------------------------------------------------------------------+
//| Check and update trade outcomes                                  |
//+------------------------------------------------------------------+
void CheckAndUpdateTradeOutcomes() {
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--) {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket > 0) {
         if(HistoryDealGetInteger(dealTicket, DEAL_MAGIC) == MagicNumber) {
            ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
            if(dealType == DEAL_TYPE_SELL || dealType == DEAL_TYPE_BUY) {
               ulong positionTicket = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
               
               if(!IsTradeOutcomeProcessed(positionTicket)) {
                  double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
                  string outcome = (profit > 0) ? "win" : "loss";
                  
                  if(UpdateTradeOutcome(positionTicket, outcome)) {
                     MarkTradeOutcomeProcessed(positionTicket);
                     Print("TradingSignalEA: Trade outcome updated - Ticket: ", positionTicket, ", Outcome: ", outcome, ", Profit: ", profit);
                  }
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Check if signal was already processed                            |
//+------------------------------------------------------------------+
bool IsSignalAlreadyProcessed(const string& signalId) {
   for(int i = 0; i < processedSignalsCount; i++) {
      if(processedSignals[i] == signalId) {
         return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Mark signal as processed                                         |
//+------------------------------------------------------------------+
void MarkSignalAsProcessed(const string& signalId) {
   if(!IsSignalAlreadyProcessed(signalId)) {
   ArrayResize(processedSignals, processedSignalsCount + 1);
   processedSignals[processedSignalsCount] = signalId;
   processedSignalsCount++;
   Print("TradingSignalEA: Signal ", signalId, " marked as processed (Total processed: ", processedSignalsCount, ")");
   
   if(processedSignalsCount > 100) {
      for(int i = 0; i < 50; i++) {
         processedSignals[i] = processedSignals[i + 50];
      }
      processedSignalsCount = 50;
      ArrayResize(processedSignals, 50);
      Print("TradingSignalEA: Cleaned up old processed signals");
      }
   }
}

//+------------------------------------------------------------------+
//| Remove signal from processed list                                |
//+------------------------------------------------------------------+
void RemoveSignalFromProcessedList(const string& signalId) {
   if(signalId == "") {
      Print("TradingSignalEA: Attempted to remove empty signal ID from processed list");
      return;
   }

   for(int i = 0; i < processedSignalsCount; i++) {
      if(processedSignals[i] == signalId) {
         for(int j = i; j < processedSignalsCount - 1; j++) {
            processedSignals[j] = processedSignals[j + 1];
         }
         processedSignalsCount--;
         ArrayResize(processedSignals, processedSignalsCount);
         Print("TradingSignalEA: Signal ", signalId, " removed from processed list");
         return;
      }
   }
   Print("TradingSignalEA: Signal ", signalId, " not found in processed list");
}

//+------------------------------------------------------------------+
//| Add signal to retry list                                         |
//+------------------------------------------------------------------+
void AddSignalToRetryList(const string& signalId) {
   if(signalId == "") {
      Print("TradingSignalEA: Cannot add empty signal ID to retry list");
      return;
   }

   for(int i = 0; i < signalRetriesCount; i++) {
      if(signalRetries[i].signalId == signalId) {
         signalRetries[i].retryCount++;
         signalRetries[i].lastRetryTime = TimeGMT();
         Print("TradingSignalEA: Signal ", signalId, " retry count increased to ", signalRetries[i].retryCount);
         return;
      }
   }

   ArrayResize(signalRetries, signalRetriesCount + 1);
   signalRetries[signalRetriesCount].signalId = signalId;
   signalRetries[signalRetriesCount].retryCount = 1;
   signalRetries[signalRetriesCount].lastRetryTime = TimeGMT();
   signalRetriesCount++;
   Print("TradingSignalEA: Signal ", signalId, " added to retry list");
}

//+------------------------------------------------------------------+
//| Remove signal from retry list                                    |
//+------------------------------------------------------------------+
void RemoveSignalFromRetryList(const string& signalId) {
   if(signalId == "") {
      Print("TradingSignalEA: Attempted to remove empty signal ID from retry list");
      return;
   }

   for(int i = 0; i < signalRetriesCount; i++) {
      if(signalRetries[i].signalId == signalId) {
         for(int j = i; j < signalRetriesCount - 1; j++) {
            signalRetries[j] = signalRetries[j + 1];
         }
         signalRetriesCount--;
         ArrayResize(signalRetries, signalRetriesCount);
         Print("TradingSignalEA: Signal ", signalId, " removed from retry list");
         return;
      }
   }
   Print("TradingSignalEA: Signal ", signalId, " not found in retry list");
}

//+------------------------------------------------------------------+
//| Check if position already exists for this symbol                 |
//+------------------------------------------------------------------+
bool HasOpenPosition(const string& symbol) {
  for(int i = 0; i < PositionsTotal(); i++) {
     ulong ticket = PositionGetTicket(i);
     if(ticket > 0 && PositionSelectByTicket(ticket)) {
        string posSymbol = PositionGetString(POSITION_SYMBOL);
        long posMagic = PositionGetInteger(POSITION_MAGIC);
        if(posSymbol == symbol && posMagic == MagicNumber) {
           return true;
        }
     }
  }
  return false;
}

//+------------------------------------------------------------------+
//| Add symbol to active symbols list                                |
//+------------------------------------------------------------------+
void AddActiveSymbol(const string& symbol) {
   for(int i = 0; i < activeSymbolsCount; i++) {
      if(activeSymbols[i] == symbol) {
         return;
      }
   }
   
   ArrayResize(activeSymbols, activeSymbolsCount + 1);
   activeSymbols[activeSymbolsCount] = symbol;
   activeSymbolsCount++;
   Print("TradingSignalEA: Added ", symbol, " to active symbols list");
}

//+------------------------------------------------------------------+
//| Remove symbol from active symbols list                           |
//+------------------------------------------------------------------+
void RemoveActiveSymbol(const string& symbol) {
   for(int i = 0; i < activeSymbolsCount; i++) {
      if(activeSymbols[i] == symbol) {
         for(int j = i; j < activeSymbolsCount - 1; j++) {
            activeSymbols[j] = activeSymbols[j + 1];
         }
         activeSymbolsCount--;
         ArrayResize(activeSymbols, activeSymbolsCount);
         Print("TradingSignalEA: Removed ", symbol, " from active symbols list");
         return;
      }
   }
}

//+------------------------------------------------------------------+
//| Check if symbol has active trade                                 |
//+------------------------------------------------------------------+
bool IsSymbolActive(const string& symbol) {
   for(int i = 0; i < activeSymbolsCount; i++) {
      if(activeSymbols[i] == symbol) {
         return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Update active symbols based on current positions                 |
//+------------------------------------------------------------------+
void UpdateActiveSymbols() {
   activeSymbolsCount = 0;
   ArrayResize(activeSymbols, 0);
   
  for(int i = 0; i < PositionsTotal(); i++) {
     ulong ticket = PositionGetTicket(i);
     if(ticket > 0 && PositionSelectByTicket(ticket)) {
        if(PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
           string symbol = PositionGetString(POSITION_SYMBOL);
           AddActiveSymbol(symbol);
        }
     }
  }
}

//+------------------------------------------------------------------+
//| Check if trade outcome was already processed                     |
//+------------------------------------------------------------------+
bool IsTradeOutcomeProcessed(ulong ticket) {
   static ulong processedTickets[];
   for(int i = 0; i < ArraySize(processedTickets); i++) {
      if(processedTickets[i] == ticket) return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Mark trade outcome as processed                                  |
//+------------------------------------------------------------------+
void MarkTradeOutcomeProcessed(ulong ticket) {
   static ulong processedTickets[];
   int size = ArraySize(processedTickets);
   ArrayResize(processedTickets, size + 1);
   processedTickets[size] = ticket;
}
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//| Email notification functions                                     |
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//| Send email notification with error handling                      |
//+------------------------------------------------------------------+
void SendTradeEmail(string subject, string body) {
  if(!SendEmailNotifications || EmailAddress == "") return;
  if(!SendMail(subject, body)) {
    Print("TradingSignalEA: Failed to send email notification");
  } else {
    Print("TradingSignalEA: Email notification sent to ", EmailAddress);
  }
}

//+------------------------------------------------------------------+
//| Format and send trade execution email                            |
//+------------------------------------------------------------------+
void SendTradeExecutionEmail(const TradingSignal& signal, const MqlTradeResult& result, bool success) {
  if(!SendOnTradeOpen) return;
  string actionStr = (signal.action == ORDER_TYPE_BUY) ? "BUY" : "SELL";
  string statusStr = success ? "EXECUTED" : "FAILED";
  string subject = StringFormat("MT5 Trade %s - %s %s (ID: %s)", statusStr, actionStr, signal.symbol, signal.id);

  double stopPips = 0.0;
  double pipSizeLocal = 0.0;
  bool isXAUUSDLocal = (signal.symbol == "XAUUSD" || signal.symbol == "XAGUSD");
  bool isJPYLocal = (StringFind(signal.symbol, "JPY") >= 0);
  if(isXAUUSDLocal) pipSizeLocal = 0.10; else if(isJPYLocal) pipSizeLocal = 0.01; else pipSizeLocal = 0.0001;
  double priceDiffLocal = (signal.action == ORDER_TYPE_BUY) ? (signal.entry - signal.stop) : (signal.stop - signal.entry);
  if(pipSizeLocal > 0) stopPips = priceDiffLocal / pipSizeLocal;

  string body = StringFormat(
    "Signal ID: %s\n"
    "Symbol: %s\n"
    "Action: %s\n"
    "Entry: %.5f\n"
    "Stop: %.5f\n"
    "Target: %.5f\n"
    "Lot: %.2f\n"
    "Risk: %.2f%%\n"
    "Stop Distance: %.1f pips\n"
    "Status: %s\n"
    "Ticket: %d\n"
    "Exec Price: %.5f\n"
    "Time: %s\n"
    "Comment: %s\n"
    "Account: %d",
    signal.id,
    signal.symbol,
    actionStr,
    signal.entry,
    signal.stop,
    signal.target,
    result.volume,
    signal.risk_percent,
    stopPips,
    statusStr,
    result.order,
    result.price,
    TimeToString(TimeGMT()),
    result.comment,
    AccountInfoInteger(ACCOUNT_LOGIN)
  );

  SendTradeEmail(subject, body);
}

//+------------------------------------------------------------------+
//| Format and send trade close email                                |
//+------------------------------------------------------------------+
void SendTradeCloseEmail(ulong ticket, string symbol, double profit, string outcome) {
  if(!SendOnTradeClose) return;
  string outcomeTag = (outcome == "win") ? "WIN" : "LOSS";
  string subject = StringFormat("MT5 Trade CLOSED - %s %s (Ticket: %d)", outcomeTag, symbol, ticket);
  string body = StringFormat(
    "Ticket: %d\n"
    "Symbol: %s\n"
    "Outcome: %s\n"
    "Profit: $%.2f\n"
    "Close Time: %s\n"
    "Balance: $%.2f\n"
    "Equity: $%.2f\n"
    "Account: %d",
    ticket,
    symbol,
    outcomeTag,
    profit,
    TimeToString(TimeGMT()),
    AccountInfoDouble(ACCOUNT_BALANCE),
    AccountInfoDouble(ACCOUNT_EQUITY),
    AccountInfoInteger(ACCOUNT_LOGIN)
  );
  SendTradeEmail(subject, body);
}

//+------------------------------------------------------------------+
//| Send connection status email                                     |
//+------------------------------------------------------------------+
void SendConnectionStatusEmail(string status, string details = "") {
  if(!SendOnConnectionStatus) return;
  string subject = StringFormat("MT5 Connection %s - Account %d", status, AccountInfoInteger(ACCOUNT_LOGIN));
  string body = StringFormat(
    "Status: %s\n"
    "Time: %s\n"
    "Account: %d\n"
    "Terminal: %s\n"
    "Server: %s\n\n"
    "%s",
    status,
    TimeToString(TimeGMT()),
    AccountInfoInteger(ACCOUNT_LOGIN),
    TerminalInfoString(TERMINAL_NAME),
    AccountInfoString(ACCOUNT_SERVER),
    details
  );
  SendTradeEmail(subject, body);
}

//+------------------------------------------------------------------+
//| Send error notification email                                    |
//+------------------------------------------------------------------+
void SendErrorEmail(string errorType, string errorDetails) {
  if(!SendOnErrors) return;
  string subject = StringFormat("MT5 ERROR - %s (Account: %d)", errorType, AccountInfoInteger(ACCOUNT_LOGIN));
  string body = StringFormat(
    "Error: %s\n"
    "Time: %s\n"
    "Account: %d\n\n"
    "%s",
    errorType,
    TimeToString(TimeGMT()),
    AccountInfoInteger(ACCOUNT_LOGIN),
    errorDetails
  );
  SendTradeEmail(subject, body);
}