//+------------------------------------------------------------------+
//|                                           TradingSignalEA.mq5 |
//|                                  Copyright 2024, Your Company |
//|                                             https://www.yourcompany.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, Your Company"
#property link      "https://www.yourcompany.com"
#property version   "1.00"
#property description "Expert Advisor for receiving and executing trading signals via HTTP"

//--- Input parameters
input string   ServerURL = "http://localhost:3001";  // Server URL
input double   RiskPercent = 1.0;                    // Risk percentage per trade
input bool     AutoExecute = true;                   // Auto-execute trades
input bool     UseStopLoss = true;                   // Use stop loss
input bool     UseTakeProfit = true;                 // Use take profit
input int      MagicNumber = 123456;                 // Magic number for trades
input int      PollInterval = 5000;                  // Poll interval in milliseconds
input string   APIKey = "";                          // API Key for authentication
input string   SecretKey = "";                       // Secret for HMAC

//--- Global variables
string lastSignalId = "";
datetime lastPollTime = 0;
datetime lastSuccessfulPoll = 0;
int consecutiveFailures = 0;
int maxConsecutiveFailures = 5;

//--- Connection state management
enum ConnectionState {
   DISCONNECTED,
   CONNECTING,
   CONNECTED,
   RECONNECTING
};

ConnectionState connectionState = DISCONNECTED;

//--- Signal structure
struct TradingSignal {
   string id;
   string symbol;
   ENUM_ORDER_TYPE action;
   double entry;
   double target;
   double stop;
   int timeframe;
   string source;
   datetime timestamp;
   
   // Copy constructor to avoid deprecation warnings
   TradingSignal() {
      id = "";
      symbol = "";
      action = ORDER_TYPE_BUY;
      entry = 0.0;
      target = 0.0;
      stop = 0.0;
      timeframe = 15;
      source = "";
      timestamp = TimeLocal();
   }
   
   TradingSignal(const TradingSignal& other) {
      id = other.id;
      symbol = other.symbol;
      action = other.action;
      entry = other.entry;
      target = other.target;
      stop = other.stop;
      timeframe = other.timeframe;
      source = other.source;
      timestamp = other.timestamp;
   }
};

//--- Signal queue for reliability
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
      signals[queueSize] = signal; // Now safe with copy constructor
      queueSize++;
      Print("TradingSignalEA: Signal added to queue. Queue size: ", queueSize);
   }
   
   bool ProcessNextSignal() {
      if(queueSize == 0) return false;
      
      TradingSignal signal = signals[0]; // Now safe with copy constructor
      
      // Remove processed signal from queue
      for(int i = 0; i < queueSize - 1; i++) {
         signals[i] = signals[i + 1]; // Now safe with copy constructor
      }
      queueSize--;
      ArrayResize(signals, queueSize);
      
      return ProcessSignal(signal);
   }
   
   int GetQueueSize() const {
      return queueSize;
   }
   
   void ClearQueue() {
      queueSize = 0;
      ArrayResize(signals, 0);
      Print("TradingSignalEA: Signal queue cleared");
   }
};

SignalQueue signalQueue;

//--- Error handling class
class ErrorHandler {
public:
   static bool HandleWebRequestError(int httpCode, string operation) {
      switch(httpCode) {
         case -1: 
            Print("TradingSignalEA: Network error in ", operation, " - check internet connection");
            return false;
         case 0:
            Print("TradingSignalEA: No response in ", operation, " - check server availability");
            return true; // Retry-able
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
            return true; // Retry-able
         case 502:
         case 503:
         case 504:
            Print("TradingSignalEA: Server unavailable in ", operation, " - will retry");
            return true; // Retry-able
         default:
            Print("TradingSignalEA: HTTP error ", httpCode, " in ", operation);
            return (httpCode >= 500); // Retry server errors
      }
   }
   
   static void LogError(string operation, string details) {
      Print("TradingSignalEA: ERROR in ", operation, " - ", details);
   }
};

//--- Connection manager
class ConnectionManager {
private:
   ConnectionState state;
   datetime lastHeartbeat;
   int heartbeatInterval;
   
public:
   ConnectionManager() {
      state = DISCONNECTED;
      lastHeartbeat = 0;
      heartbeatInterval = 30; // 30 seconds
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
         lastSuccessfulPoll = TimeLocal();
         if(state == RECONNECTING) {
            SetState(CONNECTED);
         }
      } else {
         consecutiveFailures++;
         if(consecutiveFailures >= maxConsecutiveFailures && state == CONNECTED) {
            SetState(RECONNECTING);
         }
      }
   }
   
   bool ShouldSendHeartbeat() {
      return (TimeLocal() - lastHeartbeat >= heartbeatInterval);
   }
   
   void UpdateHeartbeat() {
      lastHeartbeat = TimeLocal();
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
   
   // Set initial connection state
   connectionManager.SetState(CONNECTING);
   
   // Test HTTP connection
   if(!TestConnection()) {
      connectionManager.SetState(DISCONNECTED);
      Print("TradingSignalEA: Failed to connect to server. Check 'Allow WebRequest' in Tools > Options > Expert Advisors");
      return INIT_FAILED;
   }
   
   // Send connection message
   if(SendConnectionMessage()) {
      connectionManager.SetState(CONNECTED);
      lastSuccessfulPoll = TimeLocal();
   } else {
      connectionManager.SetState(DISCONNECTED);
      return INIT_FAILED;
   }
   
   // Start polling timer
   EventSetMillisecondTimer(PollInterval);
   
   Print("TradingSignalEA: Initialized successfully. Connection state: ", connectionManager.GetStateString());
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   Print("TradingSignalEA: Deinitializing...");
   
   // Stop timer
   EventKillTimer();
   
   // Send disconnect message
   SendDisconnectMessage();
   
   // Clear signal queue
   signalQueue.ClearQueue();
   
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
   // Update connection health
   connectionManager.UpdateConnectionHealth(TimeLocal() - lastSuccessfulPoll < 60);
   
   // Check if we should attempt to reconnect
   if(!connectionManager.IsHealthy()) {
      if(connectionManager.GetState() == RECONNECTING) {
         Print("TradingSignalEA: Attempting to reconnect...");
         if(TestConnection()) {
            connectionManager.SetState(CONNECTED);
            consecutiveFailures = 0;
            lastSuccessfulPoll = TimeLocal();
         }
      }
      return;
   }
   
   // Poll for new signals
   if(TimeLocal() - lastPollTime >= PollInterval/1000) {
      PollForSignals();
      lastPollTime = TimeLocal();
   }
   
   // Send heartbeat
   if(connectionManager.ShouldSendHeartbeat()) {
      SendHeartbeat();
      connectionManager.UpdateHeartbeat();
   }
   
   // Process queued signals
   if(signalQueue.GetQueueSize() > 0) {
      signalQueue.ProcessNextSignal();
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
   return (result == 200);
}

//+------------------------------------------------------------------+
//| Poll for new signals                                            |
//+------------------------------------------------------------------+
void PollForSignals() {
   if(!connectionManager.IsConnected()) {
      Print("TradingSignalEA: Skipping signal poll - not connected");
      return;
   }
   
   string url = ServerURL + "/signals/pending";
   string headers = GenerateHeaders();
   string postDataStr = "{\"terminal\":\"" + TerminalInfoString(TERMINAL_NAME) + "\",\"account\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\"}";
   
   // Convert string to uchar array
   uchar postData[];
   StringToCharArray(postDataStr, postData);
   
   uchar response[];
   string responseHeaders;
   int result = WebRequest("POST", url, headers, 10000, postData, response, responseHeaders);
   
   if(result == 200) {
      string responseStr = CharArrayToString(response);
      ProcessSignalsResponse(responseStr);
      connectionManager.UpdateConnectionHealth(true);
   } else {
      Print("TradingSignalEA: Failed to poll for signals. HTTP code: ", result);
      connectionManager.UpdateConnectionHealth(false);
      
      if(ErrorHandler::HandleWebRequestError(result, "Signal Poll")) {
         // Add to retry queue or handle retry logic
         Print("TradingSignalEA: Will retry signal poll on next timer");
      }
   }
}

//+------------------------------------------------------------------+
//| Generate authentication headers                                  |
//+------------------------------------------------------------------+
string GenerateHeaders() {
   string headers = "Content-Type: application/json\r\n";
   
   if(APIKey != "" && SecretKey != "") {
      string timestamp = IntegerToString(TimeLocal());
      string signature = GenerateHMAC(APIKey + timestamp, SecretKey);
      
      headers += "X-API-Key: " + APIKey + "\r\n";
      headers += "X-Timestamp: " + timestamp + "\r\n";
      headers += "X-Signature: " + signature + "\r\n";
   }
   
   return headers;
}

//+------------------------------------------------------------------+
//| Generate HMAC signature                                         |
//+------------------------------------------------------------------+
string GenerateHMAC(string data, string key) {
   // Simple hash for MQL5 (in production, use proper HMAC)
   string combined = data + key;
   return IntegerToHexString(StringHash(combined));
}

//+------------------------------------------------------------------+
//| Convert integer to hex string                                   |
//+------------------------------------------------------------------+
string IntegerToHexString(int value) {
   string hex = "";
   string hexChars = "0123456789ABCDEF";
   
   if(value == 0) return "0";
   
   while(value > 0) {
      hex = StringSubstr(hexChars, value % 16, 1) + hex;
      value = value / 16;
   }
   
   return hex;
}

//+------------------------------------------------------------------+
//| Simple string hash function                                     |
//+------------------------------------------------------------------+
int StringHash(string str) {
   int hash = 0;
   int len = StringLen(str);
   
   for(int i = 0; i < len; i++) {
      hash = ((hash << 5) - hash + StringGetCharacter(str, i)) & 0xFFFFFFFF;
   }
   
   return MathAbs(hash);
}

//+------------------------------------------------------------------+
//| Process signals response                                         |
//+------------------------------------------------------------------+
void ProcessSignalsResponse(const string response) {
   // Check if response contains signals
   if(StringFind(response, "\"signals\"") >= 0 || StringFind(response, "\"signal\"") >= 0) {
      // Extract signal data using improved parsing
      string signalData = ExtractSignalData(response);
      if(signalData != "") {
         TradingSignal signal;
         if(ParseSignalData(signalData, signal)) {
            if(signal.id != "" && signal.id != lastSignalId) {
               lastSignalId = signal.id;
               // Add to queue instead of processing immediately
               signalQueue.AddSignal(signal);
               Print("TradingSignalEA: Signal queued: ", signal.id, " for ", signal.symbol);
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Extract signal data from response                                |
//+------------------------------------------------------------------+
string ExtractSignalData(const string response) {
   // Look for signal data in various formats
   int startPos = StringFind(response, "\"signal\":");
   if(startPos >= 0) {
      int endPos = StringFind(response, "}", startPos);
      if(endPos >= 0) {
         return StringSubstr(response, startPos, endPos - startPos + 1);
      }
   }
   
   // Alternative format
   startPos = StringFind(response, "\"signals\":");
   if(startPos >= 0) {
      int endPos = StringFind(response, "]", startPos);
      if(endPos >= 0) {
         return StringSubstr(response, startPos, endPos - startPos + 1);
      }
   }
   
   return "";
}

//+------------------------------------------------------------------+
//| Parse signal data                                                |
//+------------------------------------------------------------------+
bool ParseSignalData(const string signalData, TradingSignal& signal) {
   // Initialize signal structure
   signal.id = "";
   signal.symbol = "";
   signal.action = ORDER_TYPE_BUY;
   signal.entry = 0.0;
   signal.target = 0.0;
   signal.stop = 0.0;
   signal.timeframe = 15;
   signal.source = "";
   signal.timestamp = TimeLocal();
   
   // Parse basic fields using improved JSON parsing
   signal.id = ExtractJsonValue(signalData, "id");
   signal.symbol = ExtractJsonValue(signalData, "symbol");
   
   string entryStr = ExtractJsonValue(signalData, "entry");
   string targetStr = ExtractJsonValue(signalData, "target");
   string stopStr = ExtractJsonValue(signalData, "stop");
   
   if(entryStr != "") signal.entry = StringToDouble(entryStr);
   if(targetStr != "") signal.target = StringToDouble(targetStr);
   if(stopStr != "") signal.stop = StringToDouble(stopStr);
   
   string action = ExtractJsonValue(signalData, "action");
   if(action == "BUY") {
      signal.action = ORDER_TYPE_BUY;
   } else if(action == "SELL") {
      signal.action = ORDER_TYPE_SELL;
   }
   
   string timeframeStr = ExtractJsonValue(signalData, "timeframe");
   if(timeframeStr != "") signal.timeframe = (int)StringToInteger(timeframeStr);
   
   signal.source = ExtractJsonValue(signalData, "source");
   
   return (signal.id != "" && signal.symbol != "");
}

//+------------------------------------------------------------------+
//| Improved JSON value extraction                                   |
//+------------------------------------------------------------------+
string ExtractJsonValue(const string json, const string key) {
   string searchPattern = "\"" + key + "\"";
   int keyPos = StringFind(json, searchPattern);
   if(keyPos < 0) return "";
   
   int colonPos = StringFind(json, ":", keyPos);
   if(colonPos < 0) return "";
   
   // Skip whitespace after colon
   int valueStart = colonPos + 1;
   while(valueStart < StringLen(json) && (StringGetCharacter(json, valueStart) == ' ' || StringGetCharacter(json, valueStart) == '\t')) {
      valueStart++;
   }
   
   // Handle quoted strings vs numbers
   if(StringGetCharacter(json, valueStart) == '"') {
      valueStart++;
      int valueEnd = StringFind(json, "\"", valueStart);
      if(valueEnd > valueStart) {
         return StringSubstr(json, valueStart, valueEnd - valueStart);
      }
   } else {
      // Handle numbers/booleans
      int valueEnd = valueStart;
      while(valueEnd < StringLen(json)) {
         ushort ch = StringGetCharacter(json, valueEnd);
         if(ch == ',' || ch == '}' || ch == ']' || ch == ' ' || ch == '\t' || ch == '\n') break;
         valueEnd++;
      }
      return StringSubstr(json, valueStart, valueEnd - valueStart);
   }
   return "";
}

//+------------------------------------------------------------------+
//| Process trading signal                                           |
//+------------------------------------------------------------------+
bool ProcessSignal(const TradingSignal& signal) {
   Print("TradingSignalEA: Processing signal: ", signal.id, " for ", signal.symbol);
   
   // Validate signal
   if(!ValidateSignal(signal)) {
      Print("TradingSignalEA: Signal validation failed");
      SendSignalAck(signal.id, "failed", "Signal validation failed");
      return false;
   }
   
   // Execute trade if auto-execute is enabled
   if(AutoExecute) {
      if(ExecuteTrade(signal)) {
         Print("TradingSignalEA: Trade executed successfully for signal: ", signal.id);
         SendSignalAck(signal.id, "executed", "Trade executed successfully");
         return true;
      } else {
         Print("TradingSignalEA: Trade execution failed for signal: ", signal.id);
         SendSignalAck(signal.id, "failed", "Trade execution failed");
         return false;
      }
   } else {
      Print("TradingSignalEA: Signal received (auto-execute disabled): ", signal.id);
      SendSignalAck(signal.id, "received", "Signal received, manual execution required");
      return true;
   }
}

//+------------------------------------------------------------------+
//| Validate signal                                                  |
//+------------------------------------------------------------------+
bool ValidateSignal(const TradingSignal& signal) {
   // Check if symbol exists
   if(!SymbolSelect(signal.symbol, true)) {
      Print("TradingSignalEA: Symbol not found: ", signal.symbol);
      return false;
   }
   
   // Check if prices are valid
   if(signal.entry <= 0) {
      Print("TradingSignalEA: Invalid entry price: ", signal.entry);
      return false;
   }
   
   if(signal.target > 0 && signal.target <= 0) {
      Print("TradingSignalEA: Invalid target price: ", signal.target);
      return false;
   }
   
   if(signal.stop > 0 && signal.stop <= 0) {
      Print("TradingSignalEA: Invalid stop loss: ", signal.stop);
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Execute trade                                                    |
//+------------------------------------------------------------------+
bool ExecuteTrade(const TradingSignal& signal) {
   // Calculate position size based on risk
   double lotSize = CalculateLotSize(signal);
   if(lotSize <= 0) {
      Print("TradingSignalEA: Invalid lot size calculated: ", lotSize);
      return false;
   }
   
   // Prepare trade request
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_DEAL;
   request.symbol = signal.symbol;
   request.volume = lotSize;
   request.type = signal.action;
   request.price = signal.entry;
   request.deviation = 10;
   request.magic = MagicNumber;
   request.comment = "Signal: " + signal.id;
   
   // Set stop loss and take profit
   if(UseStopLoss && signal.stop > 0) {
      request.sl = signal.stop;
   }
   
   if(UseTakeProfit && signal.target > 0) {
      request.tp = signal.target;
   }
   
   // Execute trade
   if(!OrderSend(request, result)) {
      Print("TradingSignalEA: OrderSend failed with error: ", GetLastError());
      return false;
   }
   
   if(result.retcode != TRADE_RETCODE_DONE) {
      Print("TradingSignalEA: Order execution failed with code: ", result.retcode);
      return false;
   }
   
   Print("TradingSignalEA: Trade executed successfully. Ticket: ", result.order);
   return true;
}

//+------------------------------------------------------------------+
//| Calculate lot size                                               |
//+------------------------------------------------------------------+
double CalculateLotSize(const TradingSignal& signal) {
   // Get account balance
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   if(balance <= 0) return 0;
   
   // Calculate risk amount
   double riskAmount = balance * (RiskPercent / 100.0);
   
   // Get symbol info
   double tickSize = SymbolInfoDouble(signal.symbol, SYMBOL_TRADE_TICK_SIZE);
   double tickValue = SymbolInfoDouble(signal.symbol, SYMBOL_TRADE_TICK_VALUE);
   
   if(tickSize <= 0 || tickValue <= 0) return 0;
   
   // Calculate stop loss distance in ticks
   double stopDistance = 0;
   if(signal.stop > 0) {
      if(signal.action == ORDER_TYPE_BUY) {
         stopDistance = (signal.entry - signal.stop) / tickSize;
      } else {
         stopDistance = (signal.stop - signal.entry) / tickSize;
      }
   } else {
      // Use default stop loss if not provided
      stopDistance = 50; // 50 ticks default
   }
   
   if(stopDistance <= 0) return 0;
   
   // Calculate lot size
   double lotSize = riskAmount / (stopDistance * tickValue);
   
   // Normalize lot size
   double minLot = SymbolInfoDouble(signal.symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(signal.symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(signal.symbol, SYMBOL_VOLUME_STEP);
   
   lotSize = MathMax(minLot, MathMin(maxLot, lotSize));
   lotSize = MathRound(lotSize / lotStep) * lotStep;
   
   return lotSize;
}

//+------------------------------------------------------------------+
//| Communication functions                                           |
//+------------------------------------------------------------------+
bool SendConnectionMessage() {
   string url = ServerURL + "/mt5/connect";
   string headers = GenerateHeaders();
   string postDataStr = "{\"type\":\"mt5_connect\",\"account\":\"" + 
                        IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",\"terminal\":\"" + 
                        TerminalInfoString(TERMINAL_NAME) + "\",\"version\":\"5.0\"}";
   
   uchar postData[];
   StringToCharArray(postDataStr, postData);
   
   uchar response[];
   string responseHeaders;
   int result = WebRequest("POST", url, headers, 10000, postData, response, responseHeaders);
   
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
   string headers = GenerateHeaders();
   string postDataStr = "{\"type\":\"mt5_disconnect\",\"account\":\"" + 
                        IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\"}";
   
   uchar postData[];
   StringToCharArray(postDataStr, postData);
   
   uchar response[];
   string responseHeaders;
   WebRequest("POST", url, headers, 5000, postData, response, responseHeaders);
}

void SendHeartbeat() {
   string url = ServerURL + "/mt5/heartbeat";
   string headers = GenerateHeaders();
   string postDataStr = "{\"type\":\"mt5_heartbeat\",\"account\":\"" + 
                        IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",\"timestamp\":\"" + 
                        TimeToString(TimeLocal()) + "\",\"queue_size\":" + IntegerToString(signalQueue.GetQueueSize()) + "}";
   
   uchar postData[];
   StringToCharArray(postDataStr, postData);
   
   uchar response[];
   string responseHeaders;
   int result = WebRequest("POST", url, headers, 5000, postData, response, responseHeaders);
   
   if(result != 200) {
      Print("TradingSignalEA: Heartbeat failed. HTTP code: ", result);
      ErrorHandler::HandleWebRequestError(result, "Heartbeat");
   }
}

void SendSignalAck(const string signalId, const string status, const string message) {
   string url = ServerURL + "/signals/ack";
   string headers = GenerateHeaders();
   string postDataStr = "{\"type\":\"signal_ack\",\"signalId\":\"" + signalId + 
                        "\",\"status\":\"" + status + "\",\"message\":\"" + message + 
                        "\",\"account\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\"}";
   
   uchar postData[];
   StringToCharArray(postDataStr, postData);
   
   uchar response[];
   string responseHeaders;
   int result = WebRequest("POST", url, headers, 5000, postData, response, responseHeaders);
   
   if(result != 200) {
      Print("TradingSignalEA: Signal acknowledgment failed. HTTP code: ", result);
      ErrorHandler::HandleWebRequestError(result, "Signal Acknowledgment");
   }
}

//+------------------------------------------------------------------+
