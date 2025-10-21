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
input string   ServerURL = "https://trading-backend-4v0f.onrender.com";  // Server URL (Render backend)
input double   RiskPercent = 1.0;                    // Risk percentage per trade
input bool     AutoExecute = true;                   // Auto-execute trades
input bool     UseStopLoss = true;                   // Use stop loss
input bool     UseTakeProfit = true;                 // Use take profit
input int      MagicNumber = 123456;                 // Magic number for trades
input int      PollInterval = 5000;                  // Poll interval in milliseconds
input string   APIKey = "";                          // API Key for authentication
input string   SecretKey = "";                       // Secret for HMAC
input bool     UseGETMethod = false;                 // Use GET instead of POST for signal polling

//--- Global variables
string lastSignalId = "";
datetime lastPollTime = 0;
datetime lastSuccessfulPoll = 0;
datetime lastHeartbeat = 0;
int consecutiveFailures = 0;
int maxConsecutiveFailures = 5;

//--- Signal tracking to prevent duplicates
string processedSignals[];  // Array to store processed signal IDs
int processedSignalsCount = 0;
string currentlyProcessingSignal = ""; // Track signal currently being processed

//--- Active positions tracking for smart polling
string activeSymbols[];     // Array to store symbols with active trades
int activeSymbolsCount = 0;

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

//--- Trade management variables
datetime lastTradeCheck = 0;
int tradeCheckInterval = 60; // seconds
datetime lastHKTimeCheck = 0;
int hkTimeCheckInterval = 300; // 5 minutes
bool autoShutdownEnabled = true;
int hkShutdownHour = 3; // 3:00 AM Hong Kong time

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
   
   // Set initial connection state to CONNECTED for testing
   connectionManager.SetState(CONNECTED);
   lastSuccessfulPoll = TimeLocal();
   
   // Test HTTP connection but don't fail if it doesn't work
   if(TestConnection()) {
      Print("TradingSignalEA: Server connection test successful");
      // Temporarily disable connection message to focus on polling
      // if(SendConnectionMessage()) {
      //    Print("TradingSignalEA: Connection message sent successfully");
      // }
   } else {
      Print("TradingSignalEA: Warning - Server connection test failed. Will retry on timer.");
   }
   
   // Start polling timer - use 1 second for faster response
   EventSetMillisecondTimer(1000);
   
   // Initialize active symbols based on existing positions
   UpdateActiveSymbols();
   Print("TradingSignalEA: Found ", activeSymbolsCount, " symbols with active positions");
   
   // TEMP: Test signal processing by creating a test signal
   // TestSignalProcessing();
   
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
   
   // Poll for new signals (with smart polling optimization)
   if(TimeLocal() - lastPollTime >= PollInterval/1000) {
      // Smart polling: Only poll for signals if we have capacity for new trades
      bool shouldPoll = true;
      
      // Don't poll if currently processing a signal
      if(currentlyProcessingSignal != "") {
         Print("TradingSignalEA: Currently processing signal ", currentlyProcessingSignal, " - skipping poll");
         shouldPoll = false;
      }
      
      // Check if current chart symbol already has an active trade
      if(IsSymbolActive(Symbol())) {
         Print("TradingSignalEA: Current symbol ", Symbol(), " has active trade - skipping poll");
         shouldPoll = false;
      }
      
      // Optional: Limit total number of concurrent trades
      if(PositionsTotal() >= 5) { // Max 5 concurrent positions
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
   
   // Check trade outcomes and update backend
   if(TimeLocal() - lastTradeCheck >= tradeCheckInterval) {
      CheckAndUpdateTradeOutcomes();
      // Update active symbols list based on current positions
      UpdateActiveSymbols();
      lastTradeCheck = TimeLocal();
   }
   
   // Check Hong Kong time for auto-shutdown
   if(TimeLocal() - lastHKTimeCheck >= hkTimeCheckInterval) {
      if(IsHKShutdownTime()) {
         Print("TradingSignalEA: Hong Kong shutdown time detected - closing all trades");
         AutoCloseAllTrades();
      }
      lastHKTimeCheck = TimeLocal();
   }
}

//+------------------------------------------------------------------+
//| Test signal processing (temporary function)                     |
//+------------------------------------------------------------------+
void TestSignalProcessing() {
   Print("TradingSignalEA: Testing signal processing...");
   
   // Create the T271 XAUUSD signal that we just sent
   TradingSignal testSignal;
   testSignal.id = "T271";
   testSignal.symbol = "XAUUSD";
   testSignal.action = ORDER_TYPE_SELL;
   testSignal.entry = 3335.595;
   testSignal.target = 3329.5854;
   testSignal.stop = 3341.6046;
   testSignal.timeframe = 15;
   testSignal.source = "TradingView";
   testSignal.timestamp = TimeLocal();
   
   Print("TradingSignalEA: Created test signal: ", testSignal.id, " ", testSignal.symbol, " ", 
         (testSignal.action == ORDER_TYPE_SELL ? "SELL" : "BUY"), " at ", testSignal.entry);
   
   // Test signal validation
   if(ValidateSignal(testSignal)) {
      Print("TradingSignalEA: Signal validation passed");
      
      // Test signal processing
      if(ProcessSignal(testSignal)) {
         Print("TradingSignalEA: Test signal processed successfully!");
      } else {
         Print("TradingSignalEA: Test signal processing failed");
      }
   } else {
      Print("TradingSignalEA: Test signal validation failed");
   }
}

//+------------------------------------------------------------------+
//| Test connection to server                                        |
//+------------------------------------------------------------------+
bool TestConnection() {
   string headers = ""; // No Content-Type header for GET requests
   uchar postData[];
   uchar response[];
   string responseHeaders;
   
   string testUrl = ServerURL + "/status";
   Print("TradingSignalEA: Testing connection to: ", testUrl);
   
   int result = WebRequest("GET", testUrl, headers, 10000, postData, response, responseHeaders);
   
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
//| Poll for new signals                                            |
//+------------------------------------------------------------------+
void PollForSignals() {
   Print("TradingSignalEA: Polling for signals (POST method)...");
   
   // 1. Get critical variables and validate them (log values for debugging)
   long account = AccountInfoInteger(ACCOUNT_LOGIN);
   string symbol = Symbol(); // Current chart symbol (e.g., XAUUSD)
   int timeframe = Period(); // Current chart timeframe (e.g., 15 for M15)
   
   // Log raw values to confirm they're valid
   Print("TradingSignalEA: Poll Variables - Account: ", account, ", Symbol: ", symbol, ", Timeframe: ", timeframe);
   
   // 2. Add fallbacks (in case variables are invalid)
   if(symbol == "" || symbol == "unknown") symbol = "XAUUSD"; // Fallback to XAUUSD
   if(timeframe <= 0) timeframe = 15; // Fallback to M15
   
   // 1. Build valid JSON body (use explicit UTF-8 encoding)
   string url = ServerURL + "/signals/pending";
   string postDataStr = StringFormat(
      "{\"terminal\":\"MT5\",\"account\":%d,\"symbol\":\"%s\",\"timeframe\":%d}",
      (int)account,
      symbol, // Remove EscapeJson (causes over-escaping)
      timeframe
   );
   
   // 2. Generate headers (now includes User-Agent, Accept, etc.)
   string headers = GenerateHeaders("POST");
   Print("TradingSignalEA: POST Headers:\n", headers);
   Print("TradingSignalEA: POST Body: ", postDataStr);
   
   // 3. Convert JSON to UTF-8 uchar array (critical fix for hidden characters)
   uchar postData[];
   int arraySize = StringToCharArray(postDataStr, postData, 0, StringLen(postDataStr), CP_UTF8);
   Print("TradingSignalEA: POST Body Size: ", arraySize, " bytes");
   
   // 4. Send WebRequest with UTF-8 encoding
   uchar response[];
   string responseHeaders;
   int result = WebRequest("POST", url, headers, 10000, postData, response, responseHeaders);
   
   // 5. Handle response (log full details)
   if(result == 200) {
      string responseStr = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
      Print("TradingSignalEA: Poll Success - Response: ", responseStr);
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
//| Alternative polling method using GET (for testing)              |
//+------------------------------------------------------------------+
void PollForSignalsGET() {
   Print("TradingSignalEA: Polling for signals (GET method)...");
   
   // 1. Prepare URL-encoded query parameters
   string account = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string symbol = UrlEncode(Symbol());
   string timeframe = IntegerToString(Period());
   
   // 2. Build simple query string that backend expects
   string queryString = "terminal=MT5&account=" + account;
   
   // 3. Build full URL
   string url = ServerURL + "/signals/pending?" + queryString;
   
   // 4. Generate headers (pass "GET" method)
   string headers = GenerateHeaders("GET");
   if(headers == "") {
      Print("TradingSignalEA: GET poll request aborted (invalid headers)");
      return;
   }
   
   // 5. Log request details for debugging
   Print("TradingSignalEA: GET Poll URL: ", url);
   Print("TradingSignalEA: GET Poll Headers: ", headers);
   
   // 6. Send GET request
   uchar emptyData[];
   uchar response[];
   string responseHeaders;
   int result = WebRequest("GET", url, headers, 10000, emptyData, response, responseHeaders);
   
   // 7. Handle response with detailed logging
   if(result == 200) {
      string responseStr = CharArrayToString(response);
      Print("TradingSignalEA: Received response (GET): ", responseStr);
      ProcessSignalsResponse(responseStr);
      connectionManager.UpdateConnectionHealth(true);
   } else {
      Print("TradingSignalEA: Failed to poll for signals (GET). HTTP code: ", result);
      // Log server's error response for debugging
      if(ArraySize(response) > 0) {
         string errorResponse = CharArrayToString(response);
         Print("TradingSignalEA: GET Error Response: ", errorResponse);
      }
      connectionManager.UpdateConnectionHealth(false);
   }
}

//+------------------------------------------------------------------+
//| URL-encode a string (required for GET query parameters)         |
//+------------------------------------------------------------------+
string UrlEncode(string str) {
   string encoded = "";
   string hexChars = "0123456789ABCDEF";
   
   for(int i = 0; i < StringLen(str); i++) {
      ushort ch = StringGetCharacter(str, i);
      
      // Keep safe characters (A-Z, a-z, 0-9, -, _, ., ~) as-is
      if((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') ||
         ch == '-' || ch == '_' || ch == '.' || ch == '~') {
         encoded += ShortToString(ch);
      } else {
         // Encode special characters (e.g., space → %20)
         encoded += "%" + StringSubstr(hexChars, ch >> 4, 1) + StringSubstr(hexChars, ch & 0x0F, 1);
      }
   }
   
   return encoded;
}

//+------------------------------------------------------------------+
//| Escape JSON string to prevent malformed JSON                    |
//+------------------------------------------------------------------+
string EscapeJson(string str) {
   // MQL5 StringReplace parameters: (string, string, string)
   StringReplace(str, "\\", "\\\\");  // Escape backslashes first
   StringReplace(str, "\"", "\\\"");  // Escape quotes
   StringReplace(str, "\n", "\\n");   // Escape newlines
   StringReplace(str, "\r", "\\r");   // Escape carriage returns
   StringReplace(str, "\t", "\\t");   // Escape tabs
   return str;
}

//+------------------------------------------------------------------+
//| Generate authentication headers                                  |
//+------------------------------------------------------------------+
// Generate headers with all required headers for Render backend
string GenerateHeaders(string httpMethod = "POST") {
   string headers = "";
   
   // 1. Required for all requests: Identify the client (MT5 EA)
   headers += "User-Agent: MT5-TradingSignalEA/1.00\r\n";
   
   // 2. Required for JSON APIs: Indicate acceptance of JSON responses
   headers += "Accept: application/json\r\n";
   
   // 3. Required for POST requests: Specify JSON body format
   if(httpMethod == "POST") {
      headers += "Content-Type: application/json\r\n";
   }
   
   // 4. Optional: Add CORS-compatible origin (fixes potential cross-origin issues)
   headers += "Origin: https://trading-backend-4v0f.onrender.com\r\n";
   
   // 5. Add authentication headers (if APIKey/SecretKey are set)
   if(APIKey != "" && SecretKey != "") {
      string timestamp = IntegerToString(TimeGMT() * 1000); // Use milliseconds
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
   // MQL5 doesn't have CryptoHMAC, use enhanced hash for now
   // In production, consider using external crypto library or server-side validation
   string combined = data + key + "MT5EA";
   int hash1 = StringHash(combined);
   int hash2 = StringHash(key + data);
   
   // Combine hashes and convert to hex for better distribution
   long combinedHash = ((long)hash1 << 16) ^ hash2;
   if(combinedHash < 0) combinedHash = -combinedHash;
   
   return StringFormat("%016X", combinedHash);
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
//| Update trade outcome to backend                                 |
//+------------------------------------------------------------------+
bool UpdateTradeOutcome(ulong ticket, string outcome) {
   string postData = StringFormat("{\"ticket\":%d,\"outcome\":\"%s\",\"symbol\":\"%s\",\"closePrice\":%.5f,\"closeTime\":\"%s\"}", 
                                 ticket, outcome, Symbol(), SymbolInfoDouble(Symbol(), SYMBOL_BID), TimeToString(TimeLocal()));
   
   uchar data[], response[];
   string headers = "Content-Type: application/json\r\n";
   string responseHeaders;
   
   StringToCharArray(postData, data);
   
   int result = WebRequest("POST", ServerURL + "/mt5/trade-outcome", headers, 10000, data, response, responseHeaders);
   
   if(result == 200) {
      Print("TradingSignalEA: Trade outcome updated successfully - Ticket: ", ticket, ", Outcome: ", outcome);
      return true;
   } else {
      Print("TradingSignalEA: Failed to update trade outcome - Ticket: ", ticket, ", Error: ", result);
      return false;
   }
}

//+------------------------------------------------------------------+
//| Check Hong Kong time for auto-shutdown                          |
//+------------------------------------------------------------------+
bool IsHKShutdownTime() {
   // Hong Kong time is UTC+8
   datetime utcTime = TimeGMT();
   datetime hkTime = utcTime + 8 * 3600; // Add 8 hours for HK time
   
   MqlDateTime hkDateTime;
   TimeToStruct(hkTime, hkDateTime);
   
   // Check if it's 3:00 AM Hong Kong time
   return (hkDateTime.hour == hkShutdownHour && hkDateTime.min < 5); // Within 5 minutes of 3:00 AM
}

//+------------------------------------------------------------------+
//| Auto-close all trades at HK shutdown time                       |
//+------------------------------------------------------------------+
void AutoCloseAllTrades() {
   if(!autoShutdownEnabled) return;
   
   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket)) {
         if(PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
            string symbol = PositionGetString(POSITION_SYMBOL);
            ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            
            // Close the position
            MqlTradeRequest request = {};
            MqlTradeResult result = {};
            
            request.action = TRADE_ACTION_DEAL;
            request.position = ticket;
            request.symbol = symbol;
            request.volume = PositionGetDouble(POSITION_VOLUME);
            request.type = (posType == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
            request.price = (posType == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
            request.deviation = 5;
            request.magic = MagicNumber;
            request.comment = "Auto-close at HK shutdown time";
            
            if(OrderSend(request, result)) {
               if(result.retcode == TRADE_RETCODE_DONE) {
                  Print("TradingSignalEA: Auto-closed trade at HK shutdown time - Ticket: ", ticket, ", Symbol: ", symbol);
                  // Update outcome as loss
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
//| Simple string hash function                                     |
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
            // Check for duplicate signal (multiple checks for safety)
            if(IsSignalAlreadyProcessed(signal.id)) {
               Print("TradingSignalEA: Duplicate signal detected: ", signal.id, " - skipping");
               return;
            }
            
            // Check if signal is currently being processed
            if(currentlyProcessingSignal == signal.id) {
               Print("TradingSignalEA: Signal ", signal.id, " is currently being processed - skipping");
               return;
            }
            
            // Check if position already exists for this symbol
            if(HasOpenPosition(signal.symbol)) {
               Print("TradingSignalEA: Position already exists for ", signal.symbol, " - skipping signal: ", signal.id);
               return;
            }
            
            // Check if symbol is already active (optimization)
            if(IsSymbolActive(signal.symbol)) {
               Print("TradingSignalEA: Symbol ", signal.symbol, " already has active trade - skipping signal: ", signal.id);
               return;
            }
            
            if(signal.id != "" && signal.id != lastSignalId) {
               lastSignalId = signal.id;
               // Set currently processing flag
               currentlyProcessingSignal = signal.id;
               // CRITICAL: Mark signal as processed IMMEDIATELY to prevent duplicates
               MarkSignalAsProcessed(signal.id);
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
   
   // Final duplicate check before execution
   if(IsSignalAlreadyProcessed(signal.id)) {
      Print("TradingSignalEA: Signal ", signal.id, " already processed during execution - aborting");
      currentlyProcessingSignal = ""; // Clear processing flag
      return false;
   }
   
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
         // Add symbol to active list to optimize polling
         AddActiveSymbol(signal.symbol);
         currentlyProcessingSignal = ""; // Clear processing flag
         return true;
      } else {
         Print("TradingSignalEA: Trade execution failed for signal: ", signal.id);
         SendSignalAck(signal.id, "failed", "Trade execution failed");
         currentlyProcessingSignal = ""; // Clear processing flag
         return false;
      }
   } else {
      Print("TradingSignalEA: Signal received (auto-execute disabled): ", signal.id);
      SendSignalAck(signal.id, "received", "Signal received, manual execution required");
      currentlyProcessingSignal = ""; // Clear processing flag
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
   string postDataStr = StringFormat(
      "{\"type\":\"mt5_connect\",\"account\":%d,\"terminal\":\"%s\",\"version\":\"5.0\"}",
      AccountInfoInteger(ACCOUNT_LOGIN),
      EscapeJson(TerminalInfoString(TERMINAL_NAME))
   );
   string headers = GenerateHeaders("POST");
   
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
   
   // Convert to UTF-8 uchar array
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
   string headers = GenerateHeaders("POST"); // Uses new headers (User-Agent, Accept, etc.)
   
   // Build valid JSON (avoid over-escaping; use simple string formatting)
   string postDataStr = StringFormat(
      "{\"type\":\"signal_ack\",\"signalId\":\"%s\",\"status\":\"%s\",\"message\":\"%s\",\"account\":%d}",
      signalId,
      status,
      message, // No need for EscapeJson (message has no special characters)
      (int)AccountInfoInteger(ACCOUNT_LOGIN)
   );
   
   // Convert to UTF-8 uchar array
   uchar postData[];
   StringToCharArray(postDataStr, postData, 0, StringLen(postDataStr), CP_UTF8);
   
   // Send request
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
//| Check and update trade outcomes                                  |
//+------------------------------------------------------------------+
void CheckAndUpdateTradeOutcomes() {
   // Check closed trades for outcomes
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--) {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket > 0) {
         if(HistoryDealGetInteger(dealTicket, DEAL_MAGIC) == MagicNumber) {
            // Check if this is a close deal (not an open deal)
            ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
            if(dealType == DEAL_TYPE_SELL || dealType == DEAL_TYPE_BUY) {
               // Find the corresponding position ticket
               ulong positionTicket = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
               
               // Check if we already processed this trade
               if(!IsTradeOutcomeProcessed(positionTicket)) {
                  // Calculate profit/loss
                  double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
                  string outcome = (profit > 0) ? "win" : "loss";
                  
                  // Update backend with outcome
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
         Print("TradingSignalEA: Signal ", signalId, " already processed - skipping");
         return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Mark signal as processed                                         |
//+------------------------------------------------------------------+
void MarkSignalAsProcessed(const string& signalId) {
   ArrayResize(processedSignals, processedSignalsCount + 1);
   processedSignals[processedSignalsCount] = signalId;
   processedSignalsCount++;
   Print("TradingSignalEA: Signal ", signalId, " marked as processed (Total processed: ", processedSignalsCount, ")");
   
   // Clean up old signals if array gets too large (keep last 100)
   if(processedSignalsCount > 100) {
      // Remove oldest signals
      for(int i = 0; i < 50; i++) {
         processedSignals[i] = processedSignals[i + 50];
      }
      processedSignalsCount = 50;
      ArrayResize(processedSignals, 50);
      Print("TradingSignalEA: Cleaned up old processed signals");
   }
}

//+------------------------------------------------------------------+
//| Check if position already exists for this symbol                 |
//+------------------------------------------------------------------+
bool HasOpenPosition(const string& symbol) {
   for(int i = 0; i < PositionsTotal(); i++) {
      if(PositionGetSymbol(i) == symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         Print("TradingSignalEA: Position already exists for ", symbol, " - skipping");
         return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Add symbol to active symbols list                               |
//+------------------------------------------------------------------+
void AddActiveSymbol(const string& symbol) {
   // Check if symbol already exists
   for(int i = 0; i < activeSymbolsCount; i++) {
      if(activeSymbols[i] == symbol) {
         return; // Already exists
      }
   }
   
   // Add new symbol
   ArrayResize(activeSymbols, activeSymbolsCount + 1);
   activeSymbols[activeSymbolsCount] = symbol;
   activeSymbolsCount++;
   Print("TradingSignalEA: Added ", symbol, " to active symbols list");
}

//+------------------------------------------------------------------+
//| Remove symbol from active symbols list                          |
//+------------------------------------------------------------------+
void RemoveActiveSymbol(const string& symbol) {
   for(int i = 0; i < activeSymbolsCount; i++) {
      if(activeSymbols[i] == symbol) {
         // Shift array elements
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
//| Check if symbol has active trade                                |
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
//| Update active symbols based on current positions                |
//+------------------------------------------------------------------+
void UpdateActiveSymbols() {
   // Clear current list
   activeSymbolsCount = 0;
   ArrayResize(activeSymbols, 0);
   
   // Add symbols with open positions
   for(int i = 0; i < PositionsTotal(); i++) {
      if(PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         string symbol = PositionGetSymbol(i);
         AddActiveSymbol(symbol);
      }
   }
}

//+------------------------------------------------------------------+
//| Check if trade outcome was already processed                     |
//+------------------------------------------------------------------+
bool IsTradeOutcomeProcessed(ulong ticket) {
   // Simple implementation - you can enhance this with file storage or global variables
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
