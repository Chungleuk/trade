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
input double RiskPercent = 0.65;  // 💰⭐ Risk percentage per trade (e.g., 0.65 = 0.65%)
input bool AutoExecute = true;
input bool UseStopLoss = true;
input bool UseTakeProfit = true;
input int MagicNumber = 123456;
input int PollInterval = 1000;
input string APIKey = "";
input string SecretKey = "";
input bool UseGETMethod = false;
input int SignalExpirationMinutes = 10;
input bool DebugMode = true;
input int MaxTimeDriftMinutes = 60;
input bool UseServerTimeForExpiration = true;
input bool AutoShutdownEnabled = true;
input int HKShutdownHour = 3;  // Close all trades at this Hong Kong time (default: 3 AM)
input int MaxRetryAttempts = 3;
input int MaxConcurrentPositions = 3;  // Maximum number of positions open at the same time
input int DuplicateCheckWindow = 300;  // 5 minutes to prevent rapid re-execution of same symbol (relaxed from 10 minutes)

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ RISK PROTECTION SETTINGS ⭐
// ═══════════════════════════════════════════════════════════════════════════════
input bool EnableDailyLossLimit = true;  // 🛡️⭐ Enable maximum daily loss protection
input double MaxDailyLossPercent = 5.0;  // 🛡️⭐ Maximum daily loss as % of account (e.g., 5.0 = 5%)
input bool EnableMaxDrawdownProtection = true;  // 🛡️⭐ Enable maximum drawdown protection
input double MaxDrawdownPercent = 10.0;  // 🛡️⭐ Maximum drawdown as % from peak equity (e.g., 10.0 = 10%)
input double MinMarginLevelPercent = 200.0;  // 🛡️⭐ Minimum margin level required to open new positions (e.g., 200 = 200%)
input double MaxLotSize = 10.0;  // 🛡️⭐ Maximum lot size per trade (safety cap for loss protection, 0 = no limit)
input bool MaxLotSizeOnlyOnDrawdown = true;  // 🛡️⭐ Apply lot size cap only during drawdowns (if false, cap applies to all trades)
input bool CheckSymbolCorrelation = true;  // 🛡️⭐ Prevent opening highly correlated positions (e.g., GBPUSD + GBPJPY)
input double BaseMaxSlippagePips = 3.0;
input double VolatileSymbolSlippageMultiplier = 1.5;
input bool AllowCriticalSignalOverride = true;
input double CriticalSignalMaxExtraPips = 1.0;

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 POSITION SIZING SETTINGS ⭐
// ═══════════════════════════════════════════════════════════════════════════════
//
// SIMPLE EXPLANATION:
// ──────────────────────────────────────────────────────────────────────────────
// Position sizing determines how big your trades are based on your account size.
//
// EXAMPLE with 0.65% risk:
//   Account: $100,000 → Risk = $650 per trade
//   Account: $110,000 → Risk = $715 per trade (if dynamic) OR $650 (if fixed)
//
// TWO MODES:
//   1. FIXED SIZE (default): Trade size stays the same regardless of wins/losses
//   2. DYNAMIC SIZE: Trade size increases when winning, decreases when losing
//
// ──────────────────────────────────────────────────────────────────────────────
//
// HOW POSITION SIZE CHANGES WITH ACCOUNT PERFORMANCE:
// false = FIXED SIZE: Position size stays the same (uses your starting balance)
// true = DYNAMIC SIZE: Position size increases when winning, decreases when losing (uses current equity)
input bool UseDynamicContractSize = true;   // 💰⭐ Position Size Mode: false = FIXED (same size always), true = DYNAMIC (adjusts with wins/losses)

// HOW TO SET THE BASE AMOUNT FOR RISK CALCULATION:
// ──────────────────────────────────────────────────────────────────────────────
// The "base amount" is what your risk percentage is calculated from.
//
// EXAMPLE: Risk 0.65% of $100,000 = $650 per trade
//
// TWO OPTIONS:
//   1. AUTO (default): Uses your actual account balance when EA starts
//   2. MANUAL: Use a custom amount you specify (useful for testing or special cases)
//
// ──────────────────────────────────────────────────────────────────────────────
// false = AUTO: Uses your account balance when EA starts
// true = MANUAL: Uses the CustomBaseAmount value you set below
input bool UseManualBaseSize = false;  // 💰⭐ Base Amount Mode: false = AUTO (use actual account), true = MANUAL (use custom amount below)

// CUSTOM BASE AMOUNT (only used if UseManualBaseSize = true above):
// ──────────────────────────────────────────────────────────────────────────────
// Set this to pretend you have a different account size for risk calculations.
//
// EXAMPLE:
//   Your account: $100,000
//   Set this to: $200,000
//   Result: Positions sized as if you have $200,000 (larger positions!)
//
// WARNING: Setting this higher than your actual account can cause over-leverage!
// ──────────────────────────────────────────────────────────────────────────────
input double ManualBaseAccountSize = 200000.0;  // 💰 Custom Base Amount: Pretend account size for risk calculations (only used if UseManualBaseSize = true)

input double MaxContractSizeMultiplier = 2.0;  // ⚠️ WARNING: Maximum multiplier for position size (default: 2.0, was 5.0 - reduced for safety)
input int NetworkStabilizationDelay = 300;
input double ForexCommissionPerLot = 6.0;  // Commission per lot round trip for forex (USD)
input double GoldCommissionPerLot = 2.0;   // Commission per lot round trip for XAUUSD (USD)
input bool AccountForBrokerCosts = true;   // Include commission and spread in calculations
input bool GrossProfitMatchesRisk = true;  // Lot size so GROSS profit/loss = risk amount (net = gross ± commission)
input bool AdjustTargetForCosts = true;    // Adjust TP to maintain 1:1 R:R after costs (RECOMMENDED)
input bool ForceOneToOneRR = true;         // Force 1:1 R:R by adjusting target to match stop distance

// Multi-symbol trading support
input bool EnableMultiSymbolTrading = true;  // Enable trading multiple symbols (GBPUSD, XAUUSD, USDJPY, GBPJPY)
input string TradingSymbols = "GBPUSD,XAUUSD,USDJPY,GBPJPY";  // Comma-separated list of symbols to trade (e.g., "GBPUSD,XAUUSD,USDJPY,GBPJPY")
input bool UseChartSymbolForPolling = false;  // If true, only poll for chart symbol. If false, poll for all TradingSymbols

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 HTF FILTER SETTINGS - IMPORTANT ⭐
// ═══════════════════════════════════════════════════════════════════════════════
input bool EnableSignalFilter = true;           // 🔍⭐ IMPORTANT: Enable higher timeframe filtering
input int FilterHTFTimeframe = 30;              // 🔍 Higher timeframe for confirmation (30 = M30, 60 = H1, 240 = H4, etc.)
input double HTFTrendTolerance = 0.0;           // 🔍 Custom tolerance (0 = auto per symbol)
input bool AllowNeutralHTFMarkets = true;       // 🔍⭐ RELAXED: Allow trades even if HTF is neutral/ranging (more lenient) - DEFAULT: ENABLED
input double HTFRangingMarketTolerance = 1.0;   // 🔍⭐ RELAXED: Multiplier for ranging market detection (1.0 = very relaxed, 0.9 = relaxed, 0.7 = balanced) - DEFAULT: 1.0
input int GlobalLockTimeoutSeconds = 10;        // Timeout for global signal lock (seconds, 0 = disable)

// Email notifications
input bool SendEmailNotifications = true;
input string EmailAddress = "leechungleuk@gmail.com";
input bool SendOnTradeOpen = true;
input bool SendOnTradeClose = true;
input bool SendOnSignalAck = false;
input bool SendOnConnectionStatus = true;
input bool SendOnErrors = true;
input bool SendDailyHealthCheck = true;  // Send daily health check email (once per day)
input int HealthCheckHour = 9;  // Hour (UTC) to send daily health check (0-23)

// Log management
input bool EnableVerboseLogging = true;  // Set to false to reduce log file size
input int LogCleanupCheckInterval = 3600;  // Check log size every N seconds (default: 1 hour)

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
datetime lastLogCleanupCheck = 0;  // Track last log cleanup check time
datetime lastHealthCheckEmail = 0;  // Track last health check email time

// Risk protection tracking
datetime lastDailyResetTime = 0;  // Track last daily reset for loss tracking
double dailyStartBalance = 0;  // Balance at start of day
double dailyStartEquity = 0;  // Equity at start of day
double peakEquity = 0;  // Peak equity for drawdown calculation

string processedSignals[];
int processedSignalsCount = 0;
string rejectionEmailSent[];
int rejectionEmailSentCount = 0;
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

// Track trade close emails sent to prevent duplicates
ulong tradeCloseEmailsSent[];
int tradeCloseEmailsSentCount = 0;

void CleanupRecentSymbols() {
   if(DuplicateCheckWindow <= 0 || recentSymbolsCount == 0)
      return;

   datetime cutoff = TimeGMT() - DuplicateCheckWindow;
   int writeIndex = 0;

   for(int i = 0; i < recentSymbolsCount; i++) {
      if(recentSymbolsTimes[i] >= cutoff) {
         if(writeIndex != i) {
            recentSymbols[writeIndex] = recentSymbols[i];
            recentSymbolsTimes[writeIndex] = recentSymbolsTimes[i];
         }
         writeIndex++;
      }
   }

   recentSymbolsCount = writeIndex;
   ArrayResize(recentSymbols, writeIndex);
   ArrayResize(recentSymbolsTimes, writeIndex);
}

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
   double rr_ratio;  // Risk:Reward ratio from signal (e.g., 1.0 = 1:1)
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
      rr_ratio = 1.0;  // Default to 1:1
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
      rr_ratio = other.rr_ratio;
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
   
   // Initialize risk protection tracking
   ResetDailyRiskTracking();
   Print("TradingSignalEA: Risk Protection - Daily Start Balance: ", dailyStartBalance, " | Peak Equity: ", peakEquity);
   
   Print("TradingSignalEA: ========================================");
   if(UseDynamicContractSize) {
      Print("TradingSignalEA: DYNAMIC POSITION SIZING ENABLED");
      Print("TradingSignalEA: Risk will be calculated from CURRENT EQUITY");
      Print("TradingSignalEA: Position size will adjust with account performance");
      Print("TradingSignalEA: After wins: position size increases");
      Print("TradingSignalEA: After losses: position size decreases");
      Print("TradingSignalEA: Current Equity: ", AccountInfoString(ACCOUNT_CURRENCY), " ", AccountInfoDouble(ACCOUNT_EQUITY));
   } else {
      Print("TradingSignalEA: FIXED POSITION SIZING ENABLED");
      Print("TradingSignalEA: Initial Balance: ", AccountInfoString(ACCOUNT_CURRENCY), " ", initialAccountBalance);
      Print("TradingSignalEA: Risk calculations will ALWAYS use this fixed amount");
      Print("TradingSignalEA: Current balance/equity changes will NOT affect position sizing");
   }
   Print("TradingSignalEA: ========================================");

   connectionManager.SetState(CONNECTED);
   lastSuccessfulPoll = TimeGMT();
   
   // Send position sizing settings email
   SendPositionSizingSettingsEmail();
   
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
   
   // Initialize filter
   if(EnableSignalFilter) {
      Print("TradingSignalEA: Filter enabled - Higher timeframe filter initialized");
   }
   
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
//| Trade transaction handler - fires immediately when trades close |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result) {
   
   // Only process deal add events
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   
   // Get deal ticket
   ulong dealTicket = trans.deal;
   if(dealTicket == 0) {
      if(DebugMode) Print("TradingSignalEA: OnTradeTransaction - dealTicket is 0");
      return;
   }
   
   // Get deal entry type - CRITICAL: Only process OUT deals (position closes)
   ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
   
   // If this is an IN deal, check if the position is now closed (might be a closing event)
   if(dealEntry == DEAL_ENTRY_IN) {
      ulong positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      if(positionId > 0) {
         // Check if this position is now closed (was open before but not anymore)
         bool wasOpen = false;
         for(int i = 0; i < PositionsTotal(); i++) {
            ulong ticket = PositionGetTicket(i);
            if(ticket > 0 && PositionSelectByTicket(ticket)) {
               if(PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
                  ulong posId = PositionGetInteger(POSITION_IDENTIFIER);
                  if(posId == positionId) {
                     wasOpen = true;
                     break;
                  }
               }
            }
         }
         
         // If position was open but is now closed, look for the closing deal
         if(!wasOpen && !IsTradeOutcomeProcessed(positionId)) {
            Print("TradingSignalEA: OnTradeTransaction - Position ", positionId, " appears to be closed, searching for closing deal");
            
            // Search for the closing deal in history
            if(HistorySelect(0, TimeCurrent())) {
               for(int i = HistoryDealsTotal() - 1; i >= 0; i--) {
                  ulong histDeal = HistoryDealGetTicket(i);
                  if(histDeal > 0) {
                     ulong histPosId = HistoryDealGetInteger(histDeal, DEAL_POSITION_ID);
                     ENUM_DEAL_ENTRY histEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(histDeal, DEAL_ENTRY);
                     
                     if(histPosId == positionId && histEntry == DEAL_ENTRY_OUT) {
                        // Found closing deal - process it
                        Print("TradingSignalEA: OnTradeTransaction - Found closing deal ", histDeal, " for position ", positionId);
                        // Recursively call ourselves with the closing deal (but we'll process it below)
                        dealTicket = histDeal;
                        dealEntry = DEAL_ENTRY_OUT;
                        break;
                     }
                  }
               }
            }
         }
      }
      
      // If we didn't find a closing deal, this is just an opening deal - skip it
      if(dealEntry != DEAL_ENTRY_OUT) {
         if(DebugMode) Print("TradingSignalEA: OnTradeTransaction - Deal entry is IN (opening), skipping");
         return;
      }
   } else if(dealEntry != DEAL_ENTRY_OUT) {
      if(DebugMode) Print("TradingSignalEA: OnTradeTransaction - Deal entry is not OUT: ", EnumToString(dealEntry));
      return; // This is not a closing deal
   }
   
   // Get deal type
   ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   
   // Verify this is a position close deal
   if(dealType != DEAL_TYPE_SELL && dealType != DEAL_TYPE_BUY) {
      if(DebugMode) Print("TradingSignalEA: OnTradeTransaction - Deal type is not BUY/SELL: ", EnumToString(dealType));
      return;
   }
   
   // Get position identifier
   ulong positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   
   if(positionId == 0) {
      Print("TradingSignalEA: ERROR - OnTradeTransaction - Position ID is 0 for deal: ", dealTicket);
      return;
   }
   
   // Check if this deal belongs to our EA (by magic number)
   // First check deal magic, then fallback to position magic if deal magic is 0
   long dealMagic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
   bool belongsToEA = false;
   
   if(dealMagic == MagicNumber) {
      belongsToEA = true;
   } else if(dealMagic == 0) {
      // Deal magic is 0, check position magic as fallback
      // Find the opening deal (DEAL_ENTRY_IN) for this position - it should have the magic number
      string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      Print("TradingSignalEA: OnTradeTransaction - Deal magic is 0, searching for opening deal. Position ID: ", positionId, ", Symbol: ", symbol);
      
      // Select all history deals and search for the opening deal of this position
      datetime fromDate = 0; // Search from beginning
      datetime toDate = TimeCurrent();
      
      if(HistorySelect(fromDate, toDate)) {
         int totalDeals = HistoryDealsTotal();
         Print("TradingSignalEA: OnTradeTransaction - Searching through ", totalDeals, " history deals");
         
         for(int i = totalDeals - 1; i >= 0; i--) {
            ulong histDeal = HistoryDealGetTicket(i);
            if(histDeal > 0) {
               ulong histPosId = HistoryDealGetInteger(histDeal, DEAL_POSITION_ID);
               
               // Check if this deal belongs to the same position
               if(histPosId == positionId) {
                  ENUM_DEAL_ENTRY histDealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(histDeal, DEAL_ENTRY);
                  long histMagic = HistoryDealGetInteger(histDeal, DEAL_MAGIC);
                  string histSymbol = HistoryDealGetString(histDeal, DEAL_SYMBOL);
                  
                  // Check opening deal (DEAL_ENTRY_IN) - it should have the magic number
                  if(histDealEntry == DEAL_ENTRY_IN) {
                     if(histMagic == MagicNumber) {
                        belongsToEA = true;
                        Print("TradingSignalEA: OnTradeTransaction - Found opening deal with matching magic: ", histMagic, " (Deal: ", histDeal, ")");
                        break;
                     } else {
                        Print("TradingSignalEA: OnTradeTransaction - Opening deal found but magic mismatch: ", histMagic, " vs ", MagicNumber, " (Deal: ", histDeal, ")");
                     }
                  }
                  // Also check if any deal for this position has our magic number
                  else if(histMagic == MagicNumber) {
                     belongsToEA = true;
                     Print("TradingSignalEA: OnTradeTransaction - Found deal with matching magic for position: ", histMagic, " (Deal: ", histDeal, ", Entry: ", EnumToString(histDealEntry), ")");
                     break;
                  }
               }
            }
         }
      } else {
         Print("TradingSignalEA: OnTradeTransaction - ERROR - Failed to select history deals");
      }
      
      if(!belongsToEA) {
         Print("TradingSignalEA: OnTradeTransaction - WARNING - Deal magic is 0 and no matching opening deal found for Position ID: ", positionId);
      }
   }
   
   if(!belongsToEA) {
      Print("TradingSignalEA: OnTradeTransaction - Deal magic mismatch: ", 
            dealMagic, " vs ", MagicNumber, " (Position ID: ", positionId, ")");
      return;
   }
   
   // Check if we already processed this trade closure
   if(IsTradeOutcomeProcessed(positionId)) {
      if(DebugMode) Print("TradingSignalEA: OnTradeTransaction - Trade already processed: ", positionId);
      return;
   }
   
   // Get trade details from deal
   string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
   double swap = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
   double commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   double netProfit = profit + swap + commission;
   
   string outcome = (netProfit > 0) ? "win" : "loss";
   
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: TRADE CLOSED DETECTED via OnTradeTransaction");
   Print("TradingSignalEA: Deal Ticket: ", dealTicket);
   Print("TradingSignalEA: Position ID: ", positionId);
   Print("TradingSignalEA: Symbol: ", symbol);
   Print("TradingSignalEA: Deal Type: ", EnumToString(dealType));
   Print("TradingSignalEA: Deal Entry: ", EnumToString(dealEntry));
   Print("TradingSignalEA: Profit: $", profit);
   Print("TradingSignalEA: Swap: $", swap);
   Print("TradingSignalEA: Commission: $", commission);
   Print("TradingSignalEA: Net Profit: $", netProfit);
   Print("TradingSignalEA: Outcome: ", outcome);
   Print("TradingSignalEA: ========================================");
   
   // Update trade outcome and send email
   // Email is now sent inside UpdateTradeOutcomeWithSymbol regardless of web request result
   Print("TradingSignalEA: Calling UpdateTradeOutcomeWithSymbol for position ", positionId);
   UpdateTradeOutcomeWithSymbol(positionId, symbol, outcome);
   
   // Mark as processed after email is sent (to prevent duplicate emails)
   // Web request success/failure is separate from email notification
   MarkTradeOutcomeProcessed(positionId);
   Print("TradingSignalEA: Trade closure processed - Email should have been sent (check logs above for email status)");
   
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

   // Check log file size periodically
   if(LogCleanupCheckInterval > 0 && (TimeGMT() - lastLogCleanupCheck) >= LogCleanupCheckInterval) {
      CheckAndWarnLogFileSize();
      lastLogCleanupCheck = TimeGMT();
   }

   if(TimeGMT() - lastPollTime >= PollInterval/1000) {
      bool shouldPoll = true;
      
      if(currentlyProcessingSignal != "") {
         if(EnableVerboseLogging) Print("TradingSignalEA: Currently processing signal ", currentlyProcessingSignal, " - skipping poll");
         shouldPoll = false;
      }
      
      if(IsSymbolActive(Symbol())) {
         if(EnableVerboseLogging) Print("TradingSignalEA: Current symbol ", Symbol(), " has active trade - skipping poll");
         shouldPoll = false;
      }
      
      if(PositionsTotal() >= MaxConcurrentPositions) {
         if(EnableVerboseLogging) Print("TradingSignalEA: Maximum concurrent positions reached (", MaxConcurrentPositions, ") - skipping poll");
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
      
      // Update peak equity for drawdown tracking
      double currentEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      if(currentEquity > peakEquity) {
         peakEquity = currentEquity;
      }
      
      lastTradeCheck = TimeGMT();
   }
   
   if(TimeGMT() - lastHKTimeCheck >= hkTimeCheckInterval) {
      if(IsHKShutdownTime()) {
         Print("TradingSignalEA: Hong Kong shutdown time (", HKShutdownHour, ":00 AM) detected - closing all trades");
         AutoCloseAllTrades();
      }
      lastHKTimeCheck = TimeGMT();
   }
   
   // Daily health check email (once per day at specified hour)
   if(SendDailyHealthCheck) {
      CheckAndSendDailyHealthCheck();
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
   string testUrl = ServerURL + "/status";
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: Testing connection to: ", testUrl);
   Print("TradingSignalEA: Server URL: ", ServerURL);
   
   // Use proper headers like other requests
   string headers = GenerateHeaders("GET");
   if(headers == "") {
      Print("TradingSignalEA: ERROR - Failed to generate headers for connection test");
      return false;
   }
   
   uchar emptyData[];
   uchar response[];
   string responseHeaders;
   
   // Increased timeout to 10 seconds for initial connection test
   int result = WebRequest("GET", testUrl, headers, 10000, emptyData, response, responseHeaders);
   
   if(result == 200) {
      string responseStr = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
      Print("TradingSignalEA: Connection test successful. Response: ", responseStr);
      Print("TradingSignalEA: ========================================");
      return true;
   } else {
      Print("TradingSignalEA: ========================================");
      Print("TradingSignalEA: Connection test failed. HTTP code: ", result);
      
      // Provide specific guidance for HTTP -1 error
      if(result == -1) {
         Print("TradingSignalEA: ERROR - HTTP code -1 indicates:");
         Print("TradingSignalEA: 1. URL may not be allowed in MT5 settings");
         Print("TradingSignalEA:    Go to: Tools → Options → Expert Advisors");
         Print("TradingSignalEA:    Check 'Allow WebRequest for listed URL'");
         Print("TradingSignalEA:    Add this URL: ", ServerURL);
         Print("TradingSignalEA: 2. Network connectivity issue");
         Print("TradingSignalEA: 3. DNS resolution failure");
         Print("TradingSignalEA: 4. SSL/TLS certificate problem");
         Print("TradingSignalEA: Will retry connection automatically...");
      } else if(result == 404) {
         Print("TradingSignalEA: ERROR - Server endpoint not found (404)");
         Print("TradingSignalEA: Check if server URL is correct: ", ServerURL);
      } else if(result == 500 || result >= 500) {
         Print("TradingSignalEA: ERROR - Server error (", result, ")");
         Print("TradingSignalEA: Server may be temporarily unavailable");
      } else if(result == 0) {
         Print("TradingSignalEA: ERROR - Request timeout or connection refused");
      } else {
         Print("TradingSignalEA: ERROR - HTTP error code: ", result);
      }
      
      if(ArraySize(response) > 0) {
         string errorResponse = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
         Print("TradingSignalEA: Connection Test Error Response: ", errorResponse);
      }
      
      if(DebugMode && responseHeaders != "") {
         Print("TradingSignalEA: Response Headers: ", responseHeaders);
      }
      
      Print("TradingSignalEA: ========================================");
      return false;
   }
}

//+------------------------------------------------------------------+
//| Parse trading symbols from comma-separated string                |
//+------------------------------------------------------------------+
void ParseTradingSymbols(string symbolsStr, string& symbols[]) {
   ArrayResize(symbols, 0);
   if(symbolsStr == "") return;
   
   string tempStr = symbolsStr;
   StringReplace(tempStr, " ", ""); // Remove spaces
   StringToUpper(tempStr); // Convert to uppercase
   
   int pos = 0;
   int startPos = 0;
   
   while(pos >= 0 && pos < StringLen(tempStr)) {
      pos = StringFind(tempStr, ",", startPos);
      string symbol = "";
      
      if(pos >= 0) {
         symbol = StringSubstr(tempStr, startPos, pos - startPos);
         startPos = pos + 1;
      } else {
         symbol = StringSubstr(tempStr, startPos);
      }
      
      if(StringLen(symbol) > 0) {
         int size = ArraySize(symbols);
         ArrayResize(symbols, size + 1);
         symbols[size] = symbol;
      }
      
      if(pos < 0) break;
   }
}

//+------------------------------------------------------------------+
//| Poll for signals for a specific symbol                          |
//+------------------------------------------------------------------+
void PollForSignalsForSymbol(string symbol, int timeframe) {
   if(symbol == "" || symbol == "unknown") {
      Print("TradingSignalEA: Invalid symbol for polling: ", symbol);
      return;
   }
   
   long account = AccountInfoInteger(ACCOUNT_LOGIN);
   
   string url = ServerURL + "/signals/pending";
   string postDataStr = StringFormat(
      "{\"terminal\":\"MT5\",\"account\":%d,\"symbol\":\"%s\",\"timeframe\":%d}",
      (int)account,
      symbol,
      timeframe
   );
   
   string headers = GenerateHeaders("POST");
   if(DebugMode) {
      Print("TradingSignalEA: Polling for ", symbol, " - POST Body: ", postDataStr);
   }
   
   uchar postData[];
   int arraySize = StringToCharArray(postDataStr, postData, 0, StringLen(postDataStr), CP_UTF8);
   
   uchar response[];
   string responseHeaders;
   int result = WebRequest("POST", url, headers, 5000, postData, response, responseHeaders);
   
   if(result == 200) {
      string responseStr = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
      if(DebugMode) Print("TradingSignalEA: Poll Success for ", symbol, " - Response: ", responseStr);
      ProcessSignalsResponse(responseStr);
      connectionManager.UpdateConnectionHealth(true);
      lastSuccessfulPoll = TimeGMT();
   } else {
      if(DebugMode) Print("TradingSignalEA: Poll Failed for ", symbol, " - HTTP Code: ", result);
      if(ArraySize(response) > 0) {
         string errorResponse = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
         if(DebugMode) Print("TradingSignalEA: Poll Error Response for ", symbol, ": ", errorResponse);
      }
      connectionManager.UpdateConnectionHealth(false);
   }
}

//+------------------------------------------------------------------+
//| Poll for new signals                                             |
//+------------------------------------------------------------------+
void PollForSignals() {
   Print("TradingSignalEA: Polling for signals (POST method)...");
   
   int timeframe = Period();
   if(timeframe <= 0) timeframe = 15;
   
   // Determine which symbols to poll for
   if(EnableMultiSymbolTrading && !UseChartSymbolForPolling) {
      // Poll for all symbols in TradingSymbols list
      string symbols[];
      ParseTradingSymbols(TradingSymbols, symbols);
      
      int symbolCount = ArraySize(symbols);
      if(symbolCount > 0) {
         Print("TradingSignalEA: Multi-symbol mode - Polling for ", symbolCount, " symbols");
         for(int i = 0; i < symbolCount; i++) {
            if(symbols[i] != "") {
               PollForSignalsForSymbol(symbols[i], timeframe);
               // Small delay between requests to avoid overwhelming server
               Sleep(100);
            }
         }
      } else {
         Print("TradingSignalEA: WARNING - No valid symbols found in TradingSymbols: ", TradingSymbols);
         // Fallback to chart symbol
         string chartSymbol = Symbol();
         if(chartSymbol == "" || chartSymbol == "unknown") chartSymbol = "XAUUSD";
         PollForSignalsForSymbol(chartSymbol, timeframe);
      }
   } else {
      // Use chart symbol (original behavior)
      string symbol = Symbol();
      if(symbol == "" || symbol == "unknown") symbol = "XAUUSD";
      Print("TradingSignalEA: Single-symbol mode - Polling for chart symbol: ", symbol);
      PollForSignalsForSymbol(symbol, timeframe);
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
   signal.rr_ratio = 1.0;  // Default to 1:1
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
   string rrStr = ExtractJsonValue(signalData, "rr");
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

   // Parse RR ratio from signal
   if(rrStr != "") {
      signal.rr_ratio = StringToDouble(rrStr);
      if(signal.rr_ratio <= 0) {
         Print("TradingSignalEA: WARNING - Invalid RR ratio from signal: '", rrStr, "', using default 1.0");
         signal.rr_ratio = 1.0;
      } else {
         Print("TradingSignalEA: Using RR ratio from signal: ", signal.rr_ratio, ":1");
      }
   } else {
      signal.rr_ratio = 1.0;
      Print("TradingSignalEA: No RR ratio in signal, using default: 1.0:1");
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
            "ID: ", signal.id, " (length: ", StringLen(signal.id), "), ",
            "Symbol: ", signal.symbol, ", ", 
            "Action: ", EnumToString(signal.action), ", ",
            "Entry: ", signal.entry, ", ",
            "Target: ", signal.target, ", ",
            "Stop: ", signal.stop, ", ",
            "Risk: ", signal.risk_percent, "%, ",
            "RR: ", signal.rr_ratio, ":1");
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

            // Cleanup expired duplicate entries before checking window
            CleanupRecentSymbols();

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
         bool lockActive = (GlobalLockTimeoutSeconds > 0) ? (lockAge < GlobalLockTimeoutSeconds) : false;
         if(lockActive) {
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
      
      // FILTER CHECK: Higher timeframe validation
      if(EnableSignalFilter) {
         Print("TradingSignalEA: ========================================");
         Print("TradingSignalEA: FILTER CHECK for signal: ", signal.id);
         Print("TradingSignalEA: ========================================");
         
         // Check higher timeframe confirmation
         if(!ConfirmWithHigherTimeframe(signal)) {
            Print("TradingSignalEA: Signal ", signal.id, " REJECTED by filter - HTF confirmation failed");
            SendSignalAck(signal.id, "rejected", "HTF confirmation failed");
            SendSignalRejectionEmail(signal, "HTF confirmation failed");
            RemoveActiveSymbol(signal.symbol);
            RemoveSignalFromProcessedList(signal.id);
            return;
         }
         
         Print("TradingSignalEA: Signal ", signal.id, " PASSED filter checks - proceeding to execution");
         Print("TradingSignalEA: ========================================");
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
      RemoveActiveSymbol(signal.symbol);
      // Remove from processed list so it can be retried when trading is enabled
      RemoveSignalFromProcessedList(signal.id);
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
      RemoveActiveSymbol(signal.symbol);
      // Remove from processed list (expired signals shouldn't block retries)
      RemoveSignalFromProcessedList(signal.id);
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
      // Remove from processed list so it can be retried
      RemoveSignalFromProcessedList(signal.id);
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
         // Signal remains in processed list (already marked) - this is correct
      return true;
   } else {
         Print("TradingSignalEA: Trade execution failed for signal: ", signal.id);
         SendSignalAck(signal.id, "failed", "Trade execution failed");
         AddSignalToRetryList(signal.id);
         RemoveActiveSymbol(signal.symbol);
         // Remove from processed list so it can be retried
         RemoveSignalFromProcessedList(signal.id);
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
   bool terminalAllowed = TerminalInfoInteger(TERMINAL_TRADE_ALLOWED);
   bool accountAllowed = (AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) == 1);
   bool autoExecuteEnabled = AutoExecute;
   
   if(!terminalAllowed) {
      string errorMsg = StringFormat(
         "TradingSignalEA: ERROR - Terminal trading disabled\n"
         "Fix: Enable 'Allow automated trading' in MT5:\n"
         "Tools → Options → Expert Advisors → Check 'Allow automated trading'\n"
         "Account: %d\n"
         "Time: %s",
         AccountInfoInteger(ACCOUNT_LOGIN),
         TimeToString(TimeGMT())
      );
      Print(errorMsg);
      SendErrorEmail("Trading Disabled - Terminal Setting", errorMsg);
      return false;
   }
   
   if(!accountAllowed) {
      string errorMsg = StringFormat(
         "TradingSignalEA: ERROR - Account trading disabled by broker\n"
         "Account: %d\n"
         "Account Name: %s\n"
         "Time: %s\n"
         "Action: Contact your broker to enable trading for this account",
         AccountInfoInteger(ACCOUNT_LOGIN),
         AccountInfoString(ACCOUNT_NAME),
         TimeToString(TimeGMT())
      );
      Print(errorMsg);
      SendErrorEmail("Trading Disabled - Account Restriction", errorMsg);
      return false;
   }
   
   if(!autoExecuteEnabled) {
      string errorMsg = StringFormat(
         "TradingSignalEA: ERROR - AutoExecute parameter is disabled\n"
         "Account: %d\n"
         "Time: %s\n"
         "Fix: Enable 'AutoExecute' input parameter in EA settings",
         AccountInfoInteger(ACCOUNT_LOGIN),
         TimeToString(TimeGMT())
      );
      Print(errorMsg);
      SendErrorEmail("Trading Disabled - AutoExecute Off", errorMsg);
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
//| Determine HTF trend tolerance per symbol                          |
//+------------------------------------------------------------------+
double GetHTFTrendTolerance(const string symbol) {
   if(HTFTrendTolerance > 0.0)
      return HTFTrendTolerance;

   string upperSymbol = symbol;
   StringToUpper(upperSymbol);

   if(upperSymbol == "XAUUSD" || upperSymbol == "XAGUSD")
      return 0.50;      // $0.50 = 50 pips for metals

   if(StringFind(upperSymbol, "JPY") >= 0)
      return 0.05;      // 5 pips for JPY pairs

   return 0.0005;       // 5 pips for standard forex pairs
}

//+------------------------------------------------------------------+
//| Confirm signal with higher timeframe analysis                     |
//+------------------------------------------------------------------+
bool ConfirmWithHigherTimeframe(const TradingSignal& signal) {
   if(!EnableSignalFilter) return true; // Filter disabled, allow all
   
   // Ensure symbol is available
   if(!SymbolSelect(signal.symbol, true)) {
      Print("TradingSignalEA: Filter - Cannot select symbol: ", signal.symbol);
      return false;
   }
   
   // Get HTF timeframe
   ENUM_TIMEFRAMES htf = (ENUM_TIMEFRAMES)FilterHTFTimeframe;
   
   // Get multiple HTF candles for better trend analysis (look at last 5 CLOSED candles)
   double htf_close_0 = iClose(signal.symbol, htf, 1);  // Most recently CLOSED candle
   double htf_close_1 = iClose(signal.symbol, htf, 2);  // One candle prior
   double htf_close_2 = iClose(signal.symbol, htf, 3);  // 2 candles ago
   double htf_close_3 = iClose(signal.symbol, htf, 4);  // 3 candles ago
   double htf_close_4 = iClose(signal.symbol, htf, 5);  // 4 candles ago
   
   if(htf_close_0 <= 0 || htf_close_1 <= 0 || htf_close_2 <= 0 || htf_close_3 <= 0 || htf_close_4 <= 0) {
      Print("TradingSignalEA: Filter - Invalid HTF prices for ", signal.symbol);
      // Fallback to 2-candle check if we don't have enough data
      if(htf_close_0 <= 0 || htf_close_1 <= 0) {
         return false;
      }
      // If we have at least 2 candles, use simpler check
      double tolerance = GetHTFTrendTolerance(signal.symbol);
      double priceDiff = MathAbs(htf_close_0 - htf_close_1);
      double rangingTolerance = tolerance * HTFRangingMarketTolerance;
      
      if(priceDiff < rangingTolerance && !AllowNeutralHTFMarkets) {
         Print("TradingSignalEA: Filter - HTF ranging market detected - insufficient data");
         return false;
      }
      if(AllowNeutralHTFMarkets) return true;
      
      double trendTolerance = tolerance * 0.15;  // RELAXED: Reduced from 0.3 to 0.15 (much easier trend detection)
      bool htf_uptrend = (htf_close_0 - htf_close_1) >= trendTolerance;
      bool htf_downtrend = (htf_close_1 - htf_close_0) >= trendTolerance;
      
      if(signal.action == ORDER_TYPE_BUY && htf_uptrend) return true;
      if(signal.action == ORDER_TYPE_SELL && htf_downtrend) return true;
      if(AllowNeutralHTFMarkets) return true;
      return false;
   }
   
   // Determine tolerance based on symbol (with optional override)
   double tolerance = GetHTFTrendTolerance(signal.symbol);
   
   // Get symbol-specific multipliers for different symbol types
   // Metals (XAUUSD, XAGUSD) have much larger price movements, need different scaling
   string upperSymbol = signal.symbol;
   StringToUpper(upperSymbol);
   bool isMetal = (upperSymbol == "XAUUSD" || upperSymbol == "XAGUSD");
   bool isJPY = (StringFind(upperSymbol, "JPY") >= 0);
   
   // Adjust multipliers based on symbol type - RELAXED SETTINGS
   // For metals: larger movements, but more lenient thresholds for M30 timeframe
   // For JPY: medium movements (more lenient settings)
   // For standard forex: smaller movements (more lenient settings)
   double rangingMultiplier = isMetal ? 5.0 : (isJPY ? 6.0 : 6.0);  // RELAXED: Increased from 4.0/4.5 to 5.0/6.0 (more lenient)
   double trendMultiplier = isMetal ? 0.05 : (isJPY ? 0.12 : 0.12);   // RELAXED: Reduced from 0.08/0.20 to 0.05/0.12 (easier trend detection)
   
   // IMPROVED: Analyze trend using multiple candles (more robust)
   // Calculate average price movement over last 5 candles
   double priceChange_0_1 = htf_close_0 - htf_close_1;
   double priceChange_1_2 = htf_close_1 - htf_close_2;
   double priceChange_2_3 = htf_close_2 - htf_close_3;
   double priceChange_3_4 = htf_close_3 - htf_close_4;
   
   // Calculate overall trend direction (positive = up, negative = down)
   double avgPriceChange = (priceChange_0_1 + priceChange_1_2 + priceChange_2_3 + priceChange_3_4) / 4.0;
   
   // Calculate total price movement over the period
   double totalPriceMove = MathAbs(htf_close_0 - htf_close_4);
   double rangingTolerance = tolerance * HTFRangingMarketTolerance * rangingMultiplier;
   
   // Check if market is ranging (very little movement over 5 candles)
   if(totalPriceMove < rangingTolerance) {
      Print("TradingSignalEA: Filter - HTF ranging market detected over 5 candles (total move: ", totalPriceMove, 
            " < tolerance: ", rangingTolerance, ")");
      Print("TradingSignalEA: Filter - Symbol type: ", (isMetal ? "METAL" : (isJPY ? "JPY" : "FOREX")), 
            " HTF Close[0]: ", htf_close_0, " HTF Close[4]: ", htf_close_4);
      
      if(AllowNeutralHTFMarkets) {
         Print("TradingSignalEA: Filter - Allowing trade in neutral HTF market (AllowNeutralHTFMarkets enabled)");
         return true;
      }
      
      Print("TradingSignalEA: Filter - Signal REJECTED - No clear HTF trend (ranging market)");
      return false;
   }
   
   // Determine trend direction using average price change
   // Use symbol-specific threshold multiplier
   double trendTolerance = tolerance * trendMultiplier;
   bool htf_uptrend = avgPriceChange >= trendTolerance;
   bool htf_downtrend = avgPriceChange <= -trendTolerance;
   
   bool confirmed = false;
   
   if(signal.action == ORDER_TYPE_BUY && htf_uptrend) {
      Print("TradingSignalEA: Filter - BUY signal confirmed by HTF uptrend (5-candle analysis)");
      Print("TradingSignalEA: Filter - Symbol type: ", (isMetal ? "METAL" : (isJPY ? "JPY" : "FOREX")),
            " Avg price change: ", avgPriceChange, " Trend threshold: ", trendTolerance);
      Print("TradingSignalEA: Filter - HTF Close[0]: ", htf_close_0, " HTF Close[4]: ", htf_close_4);
      confirmed = true;
   }
   else if(signal.action == ORDER_TYPE_SELL && htf_downtrend) {
      Print("TradingSignalEA: Filter - SELL signal confirmed by HTF downtrend (5-candle analysis)");
      Print("TradingSignalEA: Filter - Symbol type: ", (isMetal ? "METAL" : (isJPY ? "JPY" : "FOREX")),
            " Avg price change: ", avgPriceChange, " Trend threshold: ", trendTolerance);
      Print("TradingSignalEA: Filter - HTF Close[0]: ", htf_close_0, " HTF Close[4]: ", htf_close_4);
      confirmed = true;
   }
   else {
      // If AllowNeutralHTFMarkets is enabled, allow trades even if trend doesn't perfectly match
      if(AllowNeutralHTFMarkets) {
         Print("TradingSignalEA: Filter - HTF trend mismatch (avg change: ", avgPriceChange, 
               " vs threshold: ", trendTolerance, "), but allowing trade (AllowNeutralHTFMarkets enabled)");
         Print("TradingSignalEA: Filter - Symbol type: ", (isMetal ? "METAL" : (isJPY ? "JPY" : "FOREX")),
               " Action: ", EnumToString(signal.action), 
               " HTF Close[0]: ", htf_close_0, " HTF Close[4]: ", htf_close_4);
         confirmed = true;
      } else {
         Print("TradingSignalEA: Filter - Signal REJECTED - HTF trend mismatch");
         Print("TradingSignalEA: Filter - Symbol type: ", (isMetal ? "METAL" : (isJPY ? "JPY" : "FOREX")),
               " Action: ", EnumToString(signal.action), 
               " Avg price change: ", avgPriceChange, " Trend threshold: ", trendTolerance);
         Print("TradingSignalEA: Filter - HTF Close[0]: ", htf_close_0, " HTF Close[4]: ", htf_close_4);
      }
   }
   
   return confirmed;
}


//+------------------------------------------------------------------+
//| Calculate lot size based on signal-specific risk percentage      |
//| CORRECTED VERSION - Proper 1:1 R:R with accurate cost handling   |
//| Uses actual execution price if provided to account for slippage   |
//+------------------------------------------------------------------+
double CalculateLotSize(const TradingSignal& signal, double actualEntryPrice = 0.0) {
   double actualBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   double actualEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   string accountCurrency = AccountInfoString(ACCOUNT_CURRENCY);
   
   if(actualBalance <= 0) {
      Print("TradingSignalEA: ERROR - Invalid balance: ", actualBalance);
    SendErrorEmail("Invalid Account Balance", StringFormat("Balance: %.2f - account may be unavailable", actualBalance));
      return 0;
   }

   // Determine which base amount to use for risk calculation
   double baseAmount = actualBalance;
   
   if(!UseDynamicContractSize) {
      // Use fixed sizing (not dynamic) - ALWAYS use initial deposit for consistent risk
      if(UseManualBaseSize) {
         // Manual mode: use configured ManualBaseAccountSize
         baseAmount = ManualBaseAccountSize;
         Print("TradingSignalEA: Using MANUAL base account size: ", accountCurrency, " ", baseAmount, 
               " (Current balance: ", accountCurrency, " ", actualBalance, ", Equity: ", accountCurrency, " ", actualEquity, ")");
      } else {
         // Auto mode: ALWAYS use initial account balance captured at EA start
         if(initialAccountBalance > 0) {
            baseAmount = initialAccountBalance;
            Print("TradingSignalEA: Using INITIAL DEPOSIT (FIXED): ", accountCurrency, " ", baseAmount, 
                  " (Current balance: ", accountCurrency, " ", actualBalance, ", Equity: ", accountCurrency, " ", actualEquity, ")");
         } else {
            // Fallback if initial balance not captured (shouldn't happen)
            baseAmount = actualBalance;
            Print("TradingSignalEA: WARNING - Initial balance not captured, using current balance: ", 
                  accountCurrency, " ", baseAmount);
         }
      }
   } else {
      // Use current EQUITY (dynamic sizing) - Risk calculated from current equity after wins/losses
      // This means position size increases after wins and decreases after losses
      baseAmount = actualEquity;
      Print("TradingSignalEA: Using CURRENT EQUITY (DYNAMIC): ", accountCurrency, " ", baseAmount, 
            " (Balance: ", accountCurrency, " ", actualBalance, ")");
      Print("TradingSignalEA: Risk is calculated from current equity - position size adjusts with account performance");
   }

   // Calculate target risk amount in account currency
   double targetRiskAmount = baseAmount * (signal.risk_percent / 100.0);
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: RISK CALCULATION FOR ", signal.symbol);
   Print("TradingSignalEA: Base Amount (for calculation): ", accountCurrency, " ", baseAmount);
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
   
   // Use actual entry price if provided (to account for slippage), otherwise use signal entry
   double entryPrice = (actualEntryPrice > 0) ? actualEntryPrice : signal.entry;
   bool usingActualEntry = (actualEntryPrice > 0);
   
   // Calculate price difference using ACTUAL entry price (if provided) or signal entry
   // This ensures actual risk matches target risk even with slippage
   double priceDiff = (signal.action == ORDER_TYPE_BUY) 
       ? (entryPrice - signal.stop) 
       : (signal.stop - entryPrice);
   
   if(priceDiff <= 0) {
      Print("TradingSignalEA: ERROR - Invalid stop loss (stop on wrong side of entry)");
      Print("TradingSignalEA: Entry Price: ", entryPrice, ", Stop: ", signal.stop);
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
   
   Print("TradingSignalEA: Signal Entry: ", signal.entry, ", Actual Entry: ", entryPrice, ", Stop: ", signal.stop);
   Print("TradingSignalEA: Price Difference: ", priceDiff);
   Print("TradingSignalEA: Pip Size: ", pipSize);
   Print("TradingSignalEA: Stop Distance: ", stopDistancePips, " pips");
   if(usingActualEntry) {
      Print("TradingSignalEA: NOTE: Lot size calculated using ACTUAL execution price to ensure accurate risk");
   } else {
      Print("TradingSignalEA: NOTE: Lot size calculated using SIGNAL entry price");
   }

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
  
  // GrossProfitMatchesRisk: Lot = Risk / (StopPips × PipValue) → gross profit/loss = risk amount
  // Otherwise: Lot = Risk / (StopPips × PipValue + Commission) → net loss at SL = risk amount
  double perLotCommission = (AccountForBrokerCosts && !GrossProfitMatchesRisk) ? commissionPerLotInAccountCcy : 0.0;
  double denominator = perLotRiskValue + perLotCommission;
  double calculatedLotSize = (denominator > 0.0) ? (targetRiskAmount / denominator) : 0.0;
   
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: LOT SIZE CALCULATION BREAKDOWN");
   Print("TradingSignalEA: ----------------------------------------");
   Print("TradingSignalEA: Target Risk Amount: ", accountCurrency, " ", targetRiskAmount);
   Print("TradingSignalEA: Stop Distance: ", stopDistancePips, " pips");
   Print("TradingSignalEA: Pip Value per Lot: ", accountCurrency, " ", pipValueInAccountCurrency);
  Print("TradingSignalEA: Risk per Lot (pips×pipValue): ", accountCurrency, " ", perLotRiskValue);
  if(GrossProfitMatchesRisk) {
     Print("TradingSignalEA: Mode: GROSS = Risk (Lot = Risk ÷ PipValue only)");
  } else if(AccountForBrokerCosts) {
     Print("TradingSignalEA: Commission per Lot: ", accountCurrency, " ", commissionPerLotInAccountCcy);
     Print("TradingSignalEA: Denominator (risk + commission): ", accountCurrency, " ", denominator);
  }
   Print("TradingSignalEA: Calculated Lot Size (before constraints): ", calculatedLotSize);
   Print("TradingSignalEA: Formula: ", targetRiskAmount, " ÷ ", denominator, " = ", calculatedLotSize);
   Print("TradingSignalEA: ========================================");

   // Apply broker constraints
   double minLot = SymbolInfoDouble(signal.symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(signal.symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(signal.symbol, SYMBOL_VOLUME_STEP);
   
   if(minLot <= 0) minLot = 0.01;
   if(maxLot <= 0) maxLot = 100.0;
   if(lotStep <= 0) lotStep = 0.01;
   
   // Round to nearest lot step
   double roundedSteps = MathRound(calculatedLotSize / lotStep);
   double finalLotSize = roundedSteps * lotStep;
   
   // Apply min/max constraints
   if(finalLotSize < minLot) {
      Print("TradingSignalEA: WARNING - Calculated lot (", finalLotSize, ") below minimum (", minLot, "), using minimum");
      finalLotSize = minLot;
   }
   if(finalLotSize > maxLot) {
      Print("TradingSignalEA: WARNING - Calculated lot (", finalLotSize, ") above maximum (", maxLot, "), using maximum");
      finalLotSize = maxLot;
   }
   
   // 🛡️ Apply maximum lot size safety cap (if enabled)
   // If MaxLotSizeOnlyOnDrawdown = true, only cap during drawdowns (loss protection)
   // If false, cap applies to all trades regardless of account performance
   bool shouldApplyCap = false;
   if(MaxLotSize > 0 && finalLotSize > MaxLotSize) {
      if(MaxLotSizeOnlyOnDrawdown) {
         // Only apply cap if we're in drawdown (current equity < peak equity)
         ResetDailyRiskTracking();
         double currentEquity = AccountInfoDouble(ACCOUNT_EQUITY);
         if(currentEquity < peakEquity) {
            shouldApplyCap = true;
            double drawdownPercent = ((peakEquity - currentEquity) / peakEquity) * 100.0;
            Print("TradingSignalEA: 🛡️ DRAWDOWN DETECTED - Current Equity: ", currentEquity, " | Peak Equity: ", peakEquity, " | Drawdown: ", drawdownPercent, "%");
            Print("TradingSignalEA: 🛡️ APPLYING LOT SIZE CAP (Loss Protection Mode)");
         } else {
            Print("TradingSignalEA: ✅ Account at peak equity (", currentEquity, ") - Lot size cap NOT applied (allowing larger positions)");
         }
      } else {
         // Apply cap to all trades
         shouldApplyCap = true;
      }
      
      if(shouldApplyCap) {
         double originalLotSize = finalLotSize;
         Print("TradingSignalEA: 🛡️ SAFETY CAP - Calculated lot (", originalLotSize, ") exceeds maximum safety cap (", MaxLotSize, "), capping at ", MaxLotSize);
         finalLotSize = MaxLotSize;
         SendErrorEmail("Lot Size Safety Cap Applied", 
                        StringFormat("Calculated lot size (%.2f) exceeded safety cap (%.2f).\nTrade executed with capped lot size (%.2f).\nReview position sizing settings.",
                                    originalLotSize, MaxLotSize, finalLotSize));
      }
   }

   // Calculate actual risk with final lot size (including commission)
   double actualGrossRisk = finalLotSize * stopDistancePips * pipValueInAccountCurrency;
   double actualCommission = AccountForBrokerCosts ? (finalLotSize * commissionPerLotInAccountCcy) : 0.0;
   double actualNetRisk = actualGrossRisk + actualCommission;
   double riskDeviation = ((actualNetRisk - targetRiskAmount) / targetRiskAmount) * 100.0;
   
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: FINAL RISK SUMMARY");
   Print("TradingSignalEA: ----------------------------------------");
   Print("TradingSignalEA: Final Lot Size: ", finalLotSize);
   Print("TradingSignalEA: Stop Distance: ", stopDistancePips, " pips");
   Print("TradingSignalEA: Pip Value: ", accountCurrency, " ", pipValueInAccountCurrency);
   Print("TradingSignalEA: Gross Risk (pips only): ", accountCurrency, " ", actualGrossRisk);
   if(AccountForBrokerCosts) {
      Print("TradingSignalEA: Commission: ", accountCurrency, " ", actualCommission);
   }
   Print("TradingSignalEA: Actual Net Risk (at SL): ", accountCurrency, " ", actualNetRisk);
   Print("TradingSignalEA: Target Risk: ", accountCurrency, " ", targetRiskAmount);
   if(GrossProfitMatchesRisk) {
      Print("TradingSignalEA: Note: Gross = Risk; Net at SL = Risk + Commission");
   }
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
   // Check if signal already has correct RR ratio
   // If signal has rr_ratio = 1.0 and target is already correct, use signal's target (adjusted for actual entry)
   double baseTarget = 0;
   
   // Calculate pip size
   double pipSize = 0;
   bool isXAUUSD = (signal.symbol == "XAUUSD" || signal.symbol == "XAGUSD");
   bool isJPY = (StringFind(signal.symbol, "JPY") >= 0);
   if(isXAUUSD) pipSize = 0.10;
   else if(isJPY) pipSize = 0.01;
   else pipSize = 0.0001;
   
   // Calculate stop distance from actual entry
   double stopDistanceFromActual = 0;
   if(signal.action == ORDER_TYPE_BUY) {
      stopDistanceFromActual = actualEntryPrice - signal.stop;
   } else {
      stopDistanceFromActual = signal.stop - actualEntryPrice;
   }
   double stopDistancePips = stopDistanceFromActual / pipSize;
   
   // If signal has correct RR ratio (1.0), use stop distance to calculate target (maintains 1:1 even with slippage)
   if(signal.rr_ratio > 0 && MathAbs(signal.rr_ratio - 1.0) < 0.01) {
      // Use stop distance from ACTUAL entry to calculate target (ensures 1:1 RR regardless of slippage)
      // This maintains the signal's intended 1:1 RR ratio
      double targetDistancePips = stopDistancePips;  // 1:1 RR = target distance = stop distance
      
      if(signal.action == ORDER_TYPE_BUY) {
         baseTarget = actualEntryPrice + (targetDistancePips * pipSize);
      } else {
         baseTarget = actualEntryPrice - (targetDistancePips * pipSize);
      }
      
      Print("TradingSignalEA: ========================================");
      Print("TradingSignalEA: USING SIGNAL RR RATIO (", signal.rr_ratio, ":1)");
      Print("TradingSignalEA: ----------------------------------------");
      Print("TradingSignalEA: Signal Entry: ", signal.entry, " | Actual Entry: ", actualEntryPrice);
      Print("TradingSignalEA: Signal Target: ", signal.target, " | Calculated Target: ", baseTarget);
      Print("TradingSignalEA: Stop Loss: ", signal.stop);
      Print("TradingSignalEA: Stop Distance: ", stopDistancePips, " pips");
      Print("TradingSignalEA: Target Distance: ", targetDistancePips, " pips");
      Print("TradingSignalEA: RR Ratio: ", signal.rr_ratio, ":1 (maintained from signal)");
      Print("TradingSignalEA: ========================================");
   } else {
      // Signal doesn't have 1:1 RR or ForceOneToOneRR is enabled - recalculate
      baseTarget = CalculateOneToOneTarget(signal, actualEntryPrice);
   }
   
   if(!AdjustTargetForCosts || !AccountForBrokerCosts) {
      return baseTarget;  // Return target without cost adjustment
   }
   
   string accountCurrency = AccountInfoString(ACCOUNT_CURRENCY);
   
   // stopDistancePips and pipSize already calculated above - reuse them
   
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
   
   // Calculate expected net loss at stop loss
   double expectedNetLoss = (lotSize * stopDistancePips * pipValueInAccountCurrency) + totalBrokerCosts;
   
   // Calculate target net profit to be slightly larger than net loss for positive edge
   // Conservative approach: TP should be only slightly larger than SL (around 3-5% more)
   // This balances profitability with achievability to avoid near-misses
   double netProfitEdgePercent = 0.01;  // 1% larger net profit than net loss (conservative)
   double targetNetProfit = expectedNetLoss * (1.0 + netProfitEdgePercent);
   
   // Calculate required gross profit to achieve target net profit
   double requiredGrossProfit = targetNetProfit + totalBrokerCosts;
   
   // Calculate required TP pips to achieve target net profit
   double requiredTPPips = requiredGrossProfit / (lotSize * pipValueInAccountCurrency);
   
   // Calculate how many pips to add to base 1:1 target
   double costPipsToAdd = requiredTPPips - stopDistancePips;
   
   // Limit adjustment to conservative range - TP should be only slightly larger than SL
   // For 17.3 pip SL, max TP would be ~18 pips (about 4% more)
   double maxAdjustmentPercent = 0.05;  // Max 5% of stop distance (conservative)
   double maxAdjustmentPips = MathMin(stopDistancePips * maxAdjustmentPercent, 3.0);  // Cap at 3 pips max
   
   if(costPipsToAdd > maxAdjustmentPips) {
      Print("TradingSignalEA: WARNING - Cost adjustment (", costPipsToAdd, " pips) exceeds max (", maxAdjustmentPips, " pips), limiting");
      costPipsToAdd = maxAdjustmentPips;
      // Recalculate with limited adjustment
      requiredTPPips = stopDistancePips + costPipsToAdd;
      requiredGrossProfit = requiredTPPips * lotSize * pipValueInAccountCurrency;
      targetNetProfit = requiredGrossProfit - totalBrokerCosts;
   }
   
   // Ensure TP is larger than SL to guarantee net profit > net loss after all costs
   double minTPPips = stopDistancePips * 1.02;  // At least 2% more to ensure positive R:R after costs
   double finalTargetPips = MathMax(minTPPips, requiredTPPips);
   
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
   
   // Calculate final expected values
   double finalExpectedNetProfit = (lotSize * actualTPPips * pipValueInAccountCurrency) - totalBrokerCosts;
   double finalExpectedNetLoss = (lotSize * actualSLPips * pipValueInAccountCurrency) + totalBrokerCosts;
   double profitLossRatio = (finalExpectedNetLoss > 0) ? (finalExpectedNetProfit / finalExpectedNetLoss) : 1.0;
   double profitExcess = finalExpectedNetProfit - finalExpectedNetLoss;
   double profitExcessPercent = (finalExpectedNetLoss > 0) ? ((profitExcess / finalExpectedNetLoss) * 100.0) : 0.0;
   
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
   Print("TradingSignalEA: ----------------------------------------");
   Print("TradingSignalEA: Expected Net Profit (at TP): ", accountCurrency, " ", finalExpectedNetProfit);
   Print("TradingSignalEA: Expected Net Loss (at SL): ", accountCurrency, " ", finalExpectedNetLoss);
   Print("TradingSignalEA: Profit/Loss Ratio: ", DoubleToString(profitLossRatio, 3));
   Print("TradingSignalEA: Profit Excess: ", accountCurrency, " ", profitExcess, " (", DoubleToString(profitExcessPercent, 2), "%)");
   Print("TradingSignalEA: ========================================");
   
   return adjustedTarget;
}

//+------------------------------------------------------------------+
//| Reset daily tracking at midnight                                 |
//+------------------------------------------------------------------+
void ResetDailyRiskTracking() {
   MqlDateTime currentTime;
   TimeToStruct(TimeGMT(), currentTime);
   
   MqlDateTime lastResetTime;
   if(lastDailyResetTime > 0) {
      TimeToStruct(lastDailyResetTime, lastResetTime);
      
      // Check if we've crossed midnight (new day)
      if(currentTime.day != lastResetTime.day || 
         currentTime.mon != lastResetTime.mon || 
         currentTime.year != lastResetTime.year) {
         Print("TradingSignalEA: New day detected - resetting daily risk tracking");
         dailyStartBalance = AccountInfoDouble(ACCOUNT_BALANCE);
         dailyStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
         peakEquity = dailyStartEquity;
      }
   } else {
      // First time initialization
      dailyStartBalance = AccountInfoDouble(ACCOUNT_BALANCE);
      dailyStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      peakEquity = dailyStartEquity;
   }
   
   lastDailyResetTime = TimeGMT();
   
   // Update peak equity if current equity is higher
   double currentEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(currentEquity > peakEquity) {
      peakEquity = currentEquity;
   }
}

//+------------------------------------------------------------------+
//| Check if daily loss limit exceeded                              |
//+------------------------------------------------------------------+
bool IsDailyLossLimitExceeded() {
   if(!EnableDailyLossLimit) return false;
   
   ResetDailyRiskTracking();
   
   double currentBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   double currentEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   double accountBase = UseDynamicContractSize ? currentEquity : dailyStartBalance;
   
   if(accountBase <= 0) return false;
   
   // Calculate daily loss (use the lower of balance or equity)
   double dailyLoss = dailyStartBalance - currentBalance;
   double dailyLossPercent = (dailyLoss / accountBase) * 100.0;
   
   if(dailyLossPercent >= MaxDailyLossPercent) {
      Print("TradingSignalEA: 🛡️ DAILY LOSS LIMIT EXCEEDED - Daily Loss: ", dailyLossPercent, "% (Limit: ", MaxDailyLossPercent, "%)");
      Print("TradingSignalEA: Daily Start Balance: ", dailyStartBalance, " | Current Balance: ", currentBalance);
      SendErrorEmail("Daily Loss Limit Exceeded", 
                     StringFormat("Daily loss: %.2f%% (Limit: %.2f%%)\nStart Balance: %.2f\nCurrent Balance: %.2f\nTrading halted for today.",
                                 dailyLossPercent, MaxDailyLossPercent, dailyStartBalance, currentBalance));
      return true;
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Check if maximum drawdown exceeded                              |
//+------------------------------------------------------------------+
bool IsMaxDrawdownExceeded() {
   if(!EnableMaxDrawdownProtection) return false;
   
   ResetDailyRiskTracking();
   
   double currentEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   // Update peak equity if current is higher
   if(currentEquity > peakEquity) {
      peakEquity = currentEquity;
      return false;
   }
   
   if(peakEquity <= 0) return false;
   
   // Calculate drawdown from peak
   double drawdown = peakEquity - currentEquity;
   double drawdownPercent = (drawdown / peakEquity) * 100.0;
   
   if(drawdownPercent >= MaxDrawdownPercent) {
      Print("TradingSignalEA: 🛡️ MAX DRAWDOWN EXCEEDED - Drawdown: ", drawdownPercent, "% (Limit: ", MaxDrawdownPercent, "%)");
      Print("TradingSignalEA: Peak Equity: ", peakEquity, " | Current Equity: ", currentEquity);
      SendErrorEmail("Maximum Drawdown Exceeded", 
                     StringFormat("Drawdown: %.2f%% (Limit: %.2f%%)\nPeak Equity: %.2f\nCurrent Equity: %.2f\nTrading halted.",
                                 drawdownPercent, MaxDrawdownPercent, peakEquity, currentEquity));
      return true;
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Check if margin level is sufficient                             |
//+------------------------------------------------------------------+
bool IsMarginLevelSufficient() {
   double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   
   // If no margin used, margin level is 0 or infinite - allow trading
   if(AccountInfoDouble(ACCOUNT_MARGIN) <= 0) return true;
   
   if(marginLevel < MinMarginLevelPercent) {
      Print("TradingSignalEA: 🛡️ INSUFFICIENT MARGIN LEVEL - Current: ", marginLevel, "% (Required: ", MinMarginLevelPercent, "%)");
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Check for correlated symbols already open                       |
//+------------------------------------------------------------------+
bool HasCorrelatedSymbolOpen(const string& newSymbol) {
   if(!CheckSymbolCorrelation) return false;
   
   // Extract base currency from new symbol (first 3 chars)
   string newBaseCurrency = StringSubstr(newSymbol, 0, 3);
   string newQuoteCurrency = StringSubstr(newSymbol, 3, 3);
   
   // Check all open positions for correlation
   for(int i = 0; i < PositionsTotal(); i++) {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket)) {
         if(PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
            string openSymbol = PositionGetString(POSITION_SYMBOL);
            
            // Same symbol = correlated
            if(openSymbol == newSymbol) return true;
            
            // Extract base/quote from open position
            string openBaseCurrency = StringSubstr(openSymbol, 0, 3);
            string openQuoteCurrency = StringSubstr(openSymbol, 3, 3);
            
            // Same base currency = highly correlated (e.g., GBPUSD + GBPJPY)
            if(openBaseCurrency == newBaseCurrency && openBaseCurrency != "") {
               Print("TradingSignalEA: 🛡️ CORRELATED SYMBOL DETECTED - ", newSymbol, " correlates with open ", openSymbol, " (same base: ", openBaseCurrency, ")");
               return true;
            }
         }
      }
   }
   
   return false;
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
   Print("TradingSignalEA: ========================================");
   Print("TradingSignalEA: ATTEMPTING TRADE EXECUTION");
   Print("TradingSignalEA: Signal ID: ", signal.id);
   Print("TradingSignalEA: Symbol: ", signal.symbol);
   Print("TradingSignalEA: Action: ", EnumToString(signal.action));
   Print("TradingSignalEA: Entry: ", signal.entry);
   Print("TradingSignalEA: ========================================");
   
   if(!IsTradingEnabled()) {
      Print("TradingSignalEA: ERROR - Cannot execute - trading is disabled");
      return false;
   }
   
   // 🛡️ RISK PROTECTION CHECKS
   if(IsDailyLossLimitExceeded()) {
      Print("TradingSignalEA: 🛡️ BLOCKED - Daily loss limit exceeded");
      return false;
   }
   
   if(IsMaxDrawdownExceeded()) {
      Print("TradingSignalEA: 🛡️ BLOCKED - Maximum drawdown exceeded");
      return false;
   }
   
   if(!IsMarginLevelSufficient()) {
      Print("TradingSignalEA: 🛡️ BLOCKED - Insufficient margin level");
      SendErrorEmail("Insufficient Margin", 
                     StringFormat("Margin Level: %.2f%% (Required: %.2f%%)\nCannot open new positions.",
                                 AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), MinMarginLevelPercent));
      return false;
   }
   
   if(HasCorrelatedSymbolOpen(signal.symbol)) {
      Print("TradingSignalEA: 🛡️ BLOCKED - Correlated symbol already open");
      return false;
   }

   // Ensure symbol is selected and available BEFORE getting price
   if(!SymbolSelect(signal.symbol, true)) {
      Print("TradingSignalEA: ERROR - Cannot select symbol: ", signal.symbol);
      return false;
   }
   
   // Get current price FIRST (this will be the actual execution price)
   double currentPrice = (signal.action == ORDER_TYPE_BUY) 
      ? SymbolInfoDouble(signal.symbol, SYMBOL_ASK) 
      : SymbolInfoDouble(signal.symbol, SYMBOL_BID);
   
   if(currentPrice <= 0) {
      Print("TradingSignalEA: ERROR - Invalid current price for ", signal.symbol, ": ", currentPrice);
      return false;
   }

   // Calculate lot size using ACTUAL execution price to ensure accurate risk
   // This accounts for slippage and ensures actual risk matches target risk
   double lotSize = CalculateLotSize(signal, currentPrice);
   if(lotSize <= 0) {
      Print("TradingSignalEA: ERROR - Invalid lot size calculated: ", lotSize);
      return false;
   }

   double point = SymbolInfoDouble(signal.symbol, SYMBOL_POINT);
   
   // Symbol-specific volatility thresholds (more lenient for different symbol types)
   double volatilityThreshold;
   string upperSymbol = signal.symbol;
   StringToUpper(upperSymbol);
   bool isMetal = (upperSymbol == "XAUUSD" || upperSymbol == "XAGUSD");
   bool isJPY = (StringFind(upperSymbol, "JPY") >= 0);
   
   if(isMetal) {
      volatilityThreshold = point * 200;  // Metals: 200 points (high volatility)
   } else if(isJPY) {
      volatilityThreshold = point * 150;  // JPY pairs: 150 points (more lenient)
   } else {
      volatilityThreshold = point * 120;  // Standard forex: 120 points (more lenient)
   }
   
   double priceDiff = MathAbs(currentPrice - signal.entry);
   
   Print("TradingSignalEA: Current Price: ", currentPrice, " | Signal Entry: ", signal.entry);
   Print("TradingSignalEA: Price Difference: ", priceDiff, " (", priceDiff/point, " points)");
   Print("TradingSignalEA: Volatility Threshold: ", volatilityThreshold, " (", volatilityThreshold/point, " points)");
   Print("TradingSignalEA: Symbol Type: ", (isMetal ? "METAL" : (isJPY ? "JPY" : "FOREX")));
   
   if(priceDiff > volatilityThreshold) {
      Print("TradingSignalEA: ERROR - Price moved too far (", priceDiff/point, " points, threshold: ", volatilityThreshold/point, ") from entry - avoiding bad fill");
      Print("TradingSignalEA: This may indicate fast market movement or delayed signal processing");
      
      // Send rejection email (only once per signal - duplicate prevention built-in)
      SendSignalRejectionEmail(signal, StringFormat("Price moved too far - Current: %.5f, Signal Entry: %.5f, Difference: %.1f points (threshold: %.1f)", 
         currentPrice, signal.entry, priceDiff/point, volatilityThreshold/point));
      
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
      string retcodeDescription = "";
      switch(result.retcode) {
         case TRADE_RETCODE_REQUOTE: retcodeDescription = "Requote - price changed"; break;
         case TRADE_RETCODE_REJECT: retcodeDescription = "Request rejected by broker"; break;
         case TRADE_RETCODE_CANCEL: retcodeDescription = "Request cancelled"; break;
         case TRADE_RETCODE_PLACED: retcodeDescription = "Order placed but not executed"; break;
         case TRADE_RETCODE_DONE_PARTIAL: retcodeDescription = "Partial fill"; break;
         case TRADE_RETCODE_NO_MONEY: retcodeDescription = "Insufficient funds"; break;
         case TRADE_RETCODE_PRICE_OFF: retcodeDescription = "Price too far from market"; break;
         case TRADE_RETCODE_INVALID_PRICE: retcodeDescription = "Invalid price"; break;
         case TRADE_RETCODE_INVALID_STOPS: retcodeDescription = "Invalid stops / No margin available"; break;  // Also covers TRADE_RETCODE_NO_MARGIN (same value: 10016)
         case TRADE_RETCODE_TRADE_DISABLED: retcodeDescription = "Trading disabled"; break;
         case TRADE_RETCODE_MARKET_CLOSED: retcodeDescription = "Market closed"; break;
         case TRADE_RETCODE_TOO_MANY_REQUESTS: retcodeDescription = "Too many requests"; break;
         default: retcodeDescription = "Unknown error"; break;
      }
      
      Print("TradingSignalEA: Execution failed - Code: ", result.retcode, " (", retcodeDescription, ")");
      Print("TradingSignalEA: Expected Price: ", currentPrice, " | Actual Price: ", result.price);
      Print("TradingSignalEA: Deal: ", result.deal, " | Order: ", result.order, " | Volume: ", result.volume);
      
      // Email on execution failure with detailed error
      SendTradeExecutionEmail(signal, result, false);
      SendErrorEmail("Trade Execution Failed", 
                     StringFormat("Execution Code: %d (%s)\nExpected: %.5f\nActual: %.5f\nDeal: %d\nOrder: %d\nComment: %s",
                                 result.retcode, retcodeDescription, currentPrice, result.price, result.deal, result.order, result.comment));
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
//| Poll for signals for a specific symbol (GET method)             |
//+------------------------------------------------------------------+
void PollForSignalsGETForSymbol(string symbol, int timeframe) {
   if(symbol == "" || symbol == "unknown") {
      Print("TradingSignalEA: Invalid symbol for GET polling: ", symbol);
      return;
   }

   string account = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string encodedSymbol = UrlEncode(symbol);
   string timeframeStr = IntegerToString(timeframe);

   string queryString = StringFormat("terminal=MT5&account=%s&symbol=%s&timeframe=%s", account, encodedSymbol, timeframeStr);
   string url = ServerURL + "/signals/pending?" + queryString;

   string headers = GenerateHeaders("GET");
   if(headers == "") {
      Print("TradingSignalEA: GET poll request aborted (invalid headers)");
      return;
   }

   if(DebugMode) {
      Print("TradingSignalEA: GET Poll for ", symbol, " - URL: ", url);
   }

   uchar emptyData[];
   uchar response[];
   string responseHeaders;
   int result = WebRequest("GET", url, headers, 5000, emptyData, response, responseHeaders);

   if(result == 200) {
      string responseStr = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
      if(DebugMode) Print("TradingSignalEA: Received response (GET) for ", symbol, ": ", responseStr);
      ProcessSignalsResponse(responseStr);
      connectionManager.UpdateConnectionHealth(true);
      lastSuccessfulPoll = TimeGMT();
   } else {
      if(DebugMode) Print("TradingSignalEA: Failed to poll for signals (GET) for ", symbol, ". HTTP code: ", result);
      if(ArraySize(response) > 0) {
         string errorResponse = CharArrayToString(response, 0, ArraySize(response), CP_UTF8);
         if(DebugMode) Print("TradingSignalEA: GET Error Response for ", symbol, ": ", errorResponse);
      }
      connectionManager.UpdateConnectionHealth(false);
   }
}

//+------------------------------------------------------------------+
//| Alternative polling method using GET                             |
//+------------------------------------------------------------------+
void PollForSignalsGET() {
   Print("TradingSignalEA: Polling for signals (GET method)...");

   int timeframe = Period();
   if(timeframe <= 0) timeframe = 15;

   // Determine which symbols to poll for
   if(EnableMultiSymbolTrading && !UseChartSymbolForPolling) {
      // Poll for all symbols in TradingSymbols list
      string symbols[];
      ParseTradingSymbols(TradingSymbols, symbols);
      
      int symbolCount = ArraySize(symbols);
      if(symbolCount > 0) {
         Print("TradingSignalEA: Multi-symbol mode (GET) - Polling for ", symbolCount, " symbols");
         for(int i = 0; i < symbolCount; i++) {
            if(symbols[i] != "") {
               PollForSignalsGETForSymbol(symbols[i], timeframe);
               // Small delay between requests to avoid overwhelming server
               Sleep(100);
            }
         }
      } else {
         Print("TradingSignalEA: WARNING - No valid symbols found in TradingSymbols: ", TradingSymbols);
         // Fallback to chart symbol
         string chartSymbol = Symbol();
         if(chartSymbol == "" || chartSymbol == "unknown") chartSymbol = "XAUUSD";
         PollForSignalsGETForSymbol(chartSymbol, timeframe);
      }
   } else {
      // Use chart symbol (original behavior)
      string symbol = Symbol();
      if(symbol == "" || symbol == "unknown") symbol = "XAUUSD";
      Print("TradingSignalEA: Single-symbol mode (GET) - Polling for chart symbol: ", symbol);
      PollForSignalsGETForSymbol(symbol, timeframe);
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
            request.comment = StringFormat("Auto-close at HK shutdown time (%d:00 AM)", HKShutdownHour);

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
//| Update trade outcome to backend (with symbol parameter)          |
//+------------------------------------------------------------------+
bool UpdateTradeOutcomeWithSymbol(ulong ticket, string symbol, string outcome) {
   // Get close price and other details from history
   double closePrice = 0.0;
   double profit = 0.0;
   double swap = 0.0;
   double commission = 0.0;
   double netProfit = 0.0;
   double entryPrice = 0.0;
   double lotSize = 0.0;
   string actionStr = "";
   string signalId = "";
   datetime openTime = 0;
   datetime closeTime = TimeGMT();
   
   // Find all deals for this position to get complete information
   // We need to find both open and close deals
   ulong openDealTicket = 0;
   ulong closeDealTicket = 0;
   datetime earliestDealTime = 0;
   datetime latestDealTime = 0;
   
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--) {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket > 0 && HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID) == ticket) {
         ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
         datetime dealTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
         
         if(dealType == DEAL_TYPE_BUY || dealType == DEAL_TYPE_SELL) {
            // Track the latest deal (close) and earliest deal (open)
            if(closeDealTicket == 0 || dealTime > latestDealTime) {
               closeDealTicket = dealTicket;
               latestDealTime = dealTime;
            }
            if(openDealTicket == 0 || dealTime < earliestDealTime || earliestDealTime == 0) {
               openDealTicket = dealTicket;
               earliestDealTime = dealTime;
            }
         }
         
         // Try to extract signal ID from deal comment (prefer close deal comment)
         string comment = HistoryDealGetString(dealTicket, DEAL_COMMENT);
         if(StringFind(comment, "Signal:") >= 0 && signalId == "") {
            int signalPos = StringFind(comment, "Signal: ");
            if(signalPos >= 0) {
               int pipePos = StringFind(comment, " |", signalPos);
               if(pipePos > signalPos) {
                  signalId = StringSubstr(comment, signalPos + 8, pipePos - signalPos - 8);
               }
            }
         }
      }
   }
   
   // Extract information from close deal
   if(closeDealTicket > 0) {
      closePrice = HistoryDealGetDouble(closeDealTicket, DEAL_PRICE);
      profit = HistoryDealGetDouble(closeDealTicket, DEAL_PROFIT);
      swap = HistoryDealGetDouble(closeDealTicket, DEAL_SWAP);
      commission = HistoryDealGetDouble(closeDealTicket, DEAL_COMMISSION);
      netProfit = profit + swap + commission;
      closeTime = (datetime)HistoryDealGetInteger(closeDealTicket, DEAL_TIME);
      lotSize = HistoryDealGetDouble(closeDealTicket, DEAL_VOLUME);
      
      ENUM_DEAL_TYPE closeDealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(closeDealTicket, DEAL_TYPE);
      // If close deal is BUY, original position was SELL. If close deal is SELL, original position was BUY.
      actionStr = (closeDealType == DEAL_TYPE_BUY) ? "SELL" : "BUY";
   }
   
   // Extract information from open deal
   if(openDealTicket > 0) {
      entryPrice = HistoryDealGetDouble(openDealTicket, DEAL_PRICE);
      openTime = (datetime)HistoryDealGetInteger(openDealTicket, DEAL_TIME);
      
      // If we didn't get action from close deal, get it from open deal
      if(actionStr == "") {
         ENUM_DEAL_TYPE openDealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(openDealTicket, DEAL_TYPE);
         actionStr = (openDealType == DEAL_TYPE_BUY) ? "BUY" : "SELL";
      }
   }
   
   // FIX: If we couldn't find deals in history, try to get prices from current position history
   // This can happen if deal history hasn't been updated yet when OnTradeTransaction fires
   if(closePrice <= 0 || entryPrice <= 0) {
      Print("TradingSignalEA: WARNING - Could not find complete deal history, attempting fallback lookup...");
      
      // Try to get close price from the most recent deal for this position
      if(closePrice <= 0) {
         // Search for the most recent deal with this position ID
         for(int i = HistoryDealsTotal() - 1; i >= 0; i--) {
            ulong dealTicket = HistoryDealGetTicket(i);
            if(dealTicket > 0 && HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID) == ticket) {
               ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
               if(dealEntry == DEAL_ENTRY_OUT) {
                  closePrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
                  if(closePrice > 0) {
                     closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
                     lotSize = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
                     profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
                     swap = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
                     commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
                     netProfit = profit + swap + commission;
                     Print("TradingSignalEA: Found close deal via fallback - Price: ", closePrice);
                     break;
                  }
               }
            }
         }
      }
      
      // Try to get entry price from the earliest deal for this position
      if(entryPrice <= 0) {
         datetime earliestTime = 0;
         for(int i = 0; i < HistoryDealsTotal(); i++) {
            ulong dealTicket = HistoryDealGetTicket(i);
            if(dealTicket > 0 && HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID) == ticket) {
               ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
               if(dealEntry == DEAL_ENTRY_IN) {
                  datetime dealTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
                  if(earliestTime == 0 || dealTime < earliestTime) {
                     entryPrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
                     if(entryPrice > 0) {
                        openTime = dealTime;
                        earliestTime = dealTime;
                        if(actionStr == "") {
                           ENUM_DEAL_TYPE openDealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
                           actionStr = (openDealType == DEAL_TYPE_BUY) ? "BUY" : "SELL";
                        }
                        Print("TradingSignalEA: Found entry deal via fallback - Price: ", entryPrice);
                     }
                  }
               }
            }
         }
      }
      
      // Final fallback: if still no prices, try to get from symbol info (last resort)
      if(closePrice <= 0) {
         closePrice = SymbolInfoDouble(symbol, SYMBOL_BID);
         if(closePrice <= 0) closePrice = SymbolInfoDouble(symbol, SYMBOL_ASK);
         Print("TradingSignalEA: Using current market price as fallback for close: ", closePrice);
      }
      if(entryPrice <= 0) {
         // If we still don't have entry price, we can't send a meaningful email
         Print("TradingSignalEA: ERROR - Cannot determine entry price for ticket ", ticket, " - email may be incomplete");
      }
   }
   
   string postData = StringFormat("{\"ticket\":%d,\"outcome\":\"%s\",\"symbol\":\"%s\",\"closePrice\":%.5f,\"closeTime\":\"%s\"}",
                                 ticket, outcome, symbol, closePrice, TimeToString(closeTime));

   uchar data[], response[];
   string headers = "Content-Type: application/json\r\n";
   string responseHeaders;

   StringToCharArray(postData, data);

   int result = WebRequest("POST", ServerURL + "/mt5/trade-outcome", headers, 5000, data, response, responseHeaders);

   // Send trade close email regardless of web request result
   // Email notification should be independent of backend update status
   Print("TradingSignalEA: About to call SendTradeCloseEmailDetailed for ticket ", ticket);
   Print("TradingSignalEA: Entry Price: ", entryPrice, ", Close Price: ", closePrice, ", Lot Size: ", lotSize);
   SendTradeCloseEmailDetailed(ticket, symbol, actionStr, entryPrice, closePrice, lotSize, netProfit, outcome, signalId, openTime, closeTime);
   Print("TradingSignalEA: SendTradeCloseEmailDetailed completed for ticket ", ticket);

   if(result == 200) {
      Print("TradingSignalEA: Trade outcome updated successfully - Ticket: ", ticket, ", Symbol: ", symbol, ", Outcome: ", outcome);
      return true;
   } else {
      Print("TradingSignalEA: Failed to update trade outcome - Ticket: ", ticket, ", Error: ", result);
      return false;
   }
}

//+------------------------------------------------------------------+
//| Update trade outcome to backend (legacy - uses current symbol)   |
//+------------------------------------------------------------------+
bool UpdateTradeOutcome(ulong ticket, string outcome) {
   return UpdateTradeOutcomeWithSymbol(ticket, Symbol(), outcome);
}

//+------------------------------------------------------------------+
//| Check and update trade outcomes                                  |
//+------------------------------------------------------------------+
void CheckAndUpdateTradeOutcomes() {
   // Build list of currently open positions
   ulong openPositions[];
   int openCount = 0;
   ArrayResize(openPositions, PositionsTotal());
   
   for(int i = 0; i < PositionsTotal(); i++) {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket)) {
         if(PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
            openPositions[openCount] = ticket;
            openCount++;
         }
      }
   }
   ArrayResize(openPositions, openCount);
   
   // Check history for closed positions
   // IMPORTANT: Also check deals with magic 0, as closing deals sometimes have magic 0
   if(HistorySelect(0, TimeCurrent())) {
      for(int i = HistoryDealsTotal() - 1; i >= 0; i--) {
         ulong dealTicket = HistoryDealGetTicket(i);
         if(dealTicket > 0) {
            long dealMagic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
            ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
            ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
            
            // Check for position close deals (out deals) - CRITICAL: Only process OUT deals
            if(dealEntry == DEAL_ENTRY_OUT && (dealType == DEAL_TYPE_SELL || dealType == DEAL_TYPE_BUY)) {
               ulong positionTicket = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
               
               if(positionTicket > 0) {
                  // Check if this deal belongs to our EA
                  bool belongsToEA = false;
                  
                  if(dealMagic == MagicNumber) {
                     belongsToEA = true;
                  } else if(dealMagic == 0) {
                     // Magic is 0, check if opening deal has our magic number
                     // Search for opening deal of this position
                     for(int j = HistoryDealsTotal() - 1; j >= 0; j--) {
                        ulong histDeal = HistoryDealGetTicket(j);
                        if(histDeal > 0) {
                           ulong histPosId = HistoryDealGetInteger(histDeal, DEAL_POSITION_ID);
                           ENUM_DEAL_ENTRY histEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(histDeal, DEAL_ENTRY);
                           
                           if(histPosId == positionTicket && histEntry == DEAL_ENTRY_IN) {
                              long histMagic = HistoryDealGetInteger(histDeal, DEAL_MAGIC);
                              if(histMagic == MagicNumber) {
                                 belongsToEA = true;
                                 Print("TradingSignalEA: CheckAndUpdateTradeOutcomes - Found closing deal with magic 0, verified via opening deal magic: ", histMagic);
                                 break;
                              }
                           }
                        }
                     }
                  }
                  
                  if(belongsToEA) {
                     // Check if position still exists
                     bool positionExists = false;
                     for(int j = 0; j < openCount; j++) {
                        if(openPositions[j] == positionTicket) {
                           positionExists = true;
                           break;
                        }
                     }
                     
                     // If position doesn't exist and we haven't processed it, it was closed
                     if(!positionExists && !IsTradeOutcomeProcessed(positionTicket)) {
                        string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
                        double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
                        double swap = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
                        double commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
                        double netProfit = profit + swap + commission;
                        
                        string outcome = (netProfit > 0) ? "win" : "loss";
                        
                        Print("TradingSignalEA: ========================================");
                        Print("TradingSignalEA: Closed trade detected in history check");
                        Print("TradingSignalEA: Position Ticket: ", positionTicket);
                        Print("TradingSignalEA: Symbol: ", symbol);
                        Print("TradingSignalEA: Outcome: ", outcome);
                        Print("TradingSignalEA: Net Profit: $", netProfit);
                        Print("TradingSignalEA: Deal Magic: ", dealMagic);
                        Print("TradingSignalEA: ========================================");
                        
                        // Update trade outcome and send email
                        // Email is now sent inside UpdateTradeOutcomeWithSymbol regardless of web request result
                        Print("TradingSignalEA: Calling UpdateTradeOutcomeWithSymbol for position ", positionTicket, " (from history check)");
                        UpdateTradeOutcomeWithSymbol(positionTicket, symbol, outcome);
                        
                        // Mark as processed after email is sent (to prevent duplicate emails)
                        // Web request success/failure is separate from email notification
                        MarkTradeOutcomeProcessed(positionTicket);
                        Print("TradingSignalEA: Trade closure processed - Email should have been sent (check logs above for email status)");
                        
                     }
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
//| Check if trade close email was already sent                      |
//+------------------------------------------------------------------+
bool IsTradeCloseEmailSent(ulong ticket) {
   for(int i = 0; i < tradeCloseEmailsSentCount; i++) {
      if(tradeCloseEmailsSent[i] == ticket) {
         return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Mark trade close email as sent                                  |
//+------------------------------------------------------------------+
void MarkTradeCloseEmailSent(ulong ticket) {
   if(IsTradeCloseEmailSent(ticket)) {
      Print("TradingSignalEA: WARNING - Attempted to mark already-sent email for ticket ", ticket);
      return;
   }
   
   ArrayResize(tradeCloseEmailsSent, tradeCloseEmailsSentCount + 1);
   tradeCloseEmailsSent[tradeCloseEmailsSentCount] = ticket;
   tradeCloseEmailsSentCount++;
   Print("TradingSignalEA: Marked trade close email as sent for ticket ", ticket, " (Total: ", tradeCloseEmailsSentCount, ")");
   
   // Clean up old entries to prevent memory issues (keep last 200)
   if(tradeCloseEmailsSentCount > 200) {
      for(int i = 0; i < 100; i++) {
         tradeCloseEmailsSent[i] = tradeCloseEmailsSent[i + 100];
      }
      tradeCloseEmailsSentCount = 100;
      ArrayResize(tradeCloseEmailsSent, 100);
      Print("TradingSignalEA: Cleaned up old trade close email tracking entries");
   }
}
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//| Email notification functions                                     |
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//| Send email notification with error handling                      |
//+------------------------------------------------------------------+
void SendTradeEmail(string subject, string body) {
  if(!SendEmailNotifications) return;
  if(!SendMail(subject, body)) {
    Print("TradingSignalEA: Failed to send email notification - ensure MT5 email settings are configured (Tools → Options → Email)");
  } else {
    if(EmailAddress != "")
       Print("TradingSignalEA: Email notification sent (configured recipient: ", EmailAddress, ")");
    else
       Print("TradingSignalEA: Email notification sent via terminal email configuration");
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
//| Format and send detailed trade close email                       |
//+------------------------------------------------------------------+
void SendTradeCloseEmailDetailed(ulong ticket, string symbol, string action, 
                                  double entryPrice, double closePrice, double lotSize,
                                  double netProfit, string outcome, string signalId,
                                  datetime openTime, datetime closeTime) {
  Print("TradingSignalEA: ========================================");
  Print("TradingSignalEA: SendTradeCloseEmailDetailed called");
  Print("TradingSignalEA: Ticket: ", ticket);
  Print("TradingSignalEA: Symbol: ", symbol);
  Print("TradingSignalEA: SendOnTradeClose: ", SendOnTradeClose);
  Print("TradingSignalEA: SendEmailNotifications: ", SendEmailNotifications);
  Print("TradingSignalEA: ========================================");
  
  // Validate required settings FIRST (before duplicate check)
  if(!SendEmailNotifications) {
    Print("TradingSignalEA: WARNING - SendEmailNotifications is disabled - email not sent");
    return;
  }
  
  if(!SendOnTradeClose) {
    Print("TradingSignalEA: WARNING - SendOnTradeClose is disabled - email not sent");
    return;
  }
  
  // Validate required parameters
  if(ticket == 0) {
    Print("TradingSignalEA: ERROR - Invalid ticket (0) - cannot send email");
    return;
  }
  
  if(symbol == "" || symbol == "unknown") {
    Print("TradingSignalEA: ERROR - Invalid symbol (", symbol, ") - cannot send email");
    return;
  }
  
  // FIX: Allow email even if entry price is missing (close price is more critical)
  if(closePrice <= 0) {
    Print("TradingSignalEA: ERROR - Invalid close price (", closePrice, ") - cannot send email");
    Print("TradingSignalEA: Will retry when deal history becomes available");
    return;
  }
  
  // Warn if entry price is missing but still send email
  if(entryPrice <= 0) {
    Print("TradingSignalEA: WARNING - Entry price not available (", entryPrice, ") - sending email with available data");
    entryPrice = closePrice; // Use close price as fallback for calculations
  }
  
  // FIX: Check for duplicate email AFTER validation passes
  // This allows retry if previous attempt failed due to validation
  bool alreadySent = IsTradeCloseEmailSent(ticket);
  Print("TradingSignalEA: Checking duplicate email status for ticket ", ticket, ": ", (alreadySent ? "ALREADY SENT" : "NOT SENT YET"));
  Print("TradingSignalEA: Total emails tracked: ", tradeCloseEmailsSentCount);
  if(alreadySent) {
    Print("TradingSignalEA: Email already sent successfully for ticket ", ticket, " - skipping duplicate");
    Print("TradingSignalEA: If you believe this is incorrect, the EA needs to be restarted to clear the tracking array");
    return;
  }
  
  if(openTime <= 0 || closeTime <= 0) {
    Print("TradingSignalEA: WARNING - Invalid times (Open: ", openTime, ", Close: ", closeTime, ") - using current time");
    if(openTime <= 0) openTime = TimeGMT();
    if(closeTime <= 0) closeTime = TimeGMT();
  }
  
  Print("TradingSignalEA: Preparing trade close email for Ticket: ", ticket, ", Symbol: ", symbol);
  
  string outcomeTag = (outcome == "win") ? "WIN" : "LOSS";
  string actionStr = (action == "") ? "N/A" : action;
  string signalIdStr = (signalId == "") ? "N/A" : signalId;
  
  // Calculate duration
  int durationSeconds = (int)(closeTime - openTime);
  int hours = durationSeconds / 3600;
  int minutes = (durationSeconds % 3600) / 60;
  int seconds = durationSeconds % 60;
  string durationStr = StringFormat("%02d:%02d:%02d", hours, minutes, seconds);
  
  // Calculate price difference
  double priceDiff = MathAbs(closePrice - entryPrice);
  double priceDiffPips = 0.0;
  
  // Determine pip size based on symbol
  bool isXAUUSD = (symbol == "XAUUSD" || symbol == "XAGUSD");
  bool isJPY = (StringFind(symbol, "JPY") >= 0);
  double pipSize = isXAUUSD ? 0.10 : (isJPY ? 0.01 : 0.0001);
  priceDiffPips = priceDiff / pipSize;
  
  string subject = StringFormat("MT5 Trade CLOSED - %s %s %s (ID: %s)", 
                                outcomeTag, actionStr, symbol, signalIdStr);
  
  string body = StringFormat(
    "Signal ID: %s\n"
    "Ticket: %d\n"
    "Symbol: %s\n"
    "Action: %s\n"
    "Entry: %.5f\n"
    "Close: %.5f\n"
    "Lot: %.2f\n"
    "Outcome: %s\n"
    "Net Profit: $%.2f\n"
    "Price Move: %.5f (%.1f pips)\n"
    "Duration: %s\n"
    "Open Time: %s\n"
    "Close Time: %s\n"
    "Balance: $%.2f\n"
    "Equity: $%.2f\n"
    "Account: %d",
    signalIdStr,
    ticket,
    symbol,
    actionStr,
    entryPrice,
    closePrice,
    lotSize,
    outcomeTag,
    netProfit,
    priceDiff,
    priceDiffPips,
    durationStr,
    TimeToString(openTime),
    TimeToString(closeTime),
    AccountInfoDouble(ACCOUNT_BALANCE),
    AccountInfoDouble(ACCOUNT_EQUITY),
    AccountInfoInteger(ACCOUNT_LOGIN)
  );
  
  Print("TradingSignalEA: ========================================");
  Print("TradingSignalEA: Sending trade close email");
  Print("TradingSignalEA: Subject: ", subject);
  Print("TradingSignalEA: Ticket: ", ticket);
  Print("TradingSignalEA: Entry Price: ", entryPrice);
  Print("TradingSignalEA: Close Price: ", closePrice);
  Print("TradingSignalEA: Net Profit: ", netProfit);
  Print("TradingSignalEA: Outcome: ", outcome);
  Print("TradingSignalEA: ========================================");
  
  // Attempt to send email
  bool emailSent = false;
  Print("TradingSignalEA: Calling SendMail() function...");
  
  if(SendMail(subject, body)) {
    emailSent = true;
    Print("TradingSignalEA: ✓ Trade close email sent successfully for ticket ", ticket);
    if(EmailAddress != "") {
      Print("TradingSignalEA: Email sent to: ", EmailAddress);
    } else {
      Print("TradingSignalEA: Email sent via terminal email configuration");
    }
  } else {
    int errorCode = GetLastError();
    string errorDesc = "";
    switch(errorCode) {
      case 0: errorDesc = "No error"; break;
      case 4006: errorDesc = "Invalid function parameters"; break;
      case 4014: errorDesc = "Array is too small"; break;
      default: errorDesc = "Unknown error"; break;
    }
    Print("TradingSignalEA: ✗ FAILED to send trade close email for ticket ", ticket);
    Print("TradingSignalEA: Error Code: ", errorCode, " (", errorDesc, ")");
    Print("TradingSignalEA: Please check MT5 email settings (Tools → Options → Email)");
    Print("TradingSignalEA: Ensure SMTP server is configured and email is enabled");
    Print("TradingSignalEA: Email subject: ", subject);
    Print("TradingSignalEA: Email will be retried on next trade closure check");
    ResetLastError(); // Clear error for next attempt
  }
  
  // Mark email as sent ONLY if it was successfully sent
  // This prevents duplicate sends while allowing retry on failure
  if(emailSent) {
    MarkTradeCloseEmailSent(ticket);
    Print("TradingSignalEA: Email marked as sent for ticket ", ticket);
  } else {
    Print("TradingSignalEA: Email NOT marked as sent (failed) - will retry on next attempt");
  }
  
  Print("TradingSignalEA: Trade close email processing completed for ticket ", ticket);
}

//+------------------------------------------------------------------+
//| Format and send trade close email (legacy - simple version)      |
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
//| Send position sizing settings email                              |
//+------------------------------------------------------------------+
void SendPositionSizingSettingsEmail() {
  if(!SendEmailNotifications) return;
  
  string accountCurrency = AccountInfoString(ACCOUNT_CURRENCY);
  double currentBalance = AccountInfoDouble(ACCOUNT_BALANCE);
  double currentEquity = AccountInfoDouble(ACCOUNT_EQUITY);
  
  string subject = StringFormat("MT5 Position Sizing Settings - Account %d", AccountInfoInteger(ACCOUNT_LOGIN));
  
  string sizingMode = "";
  string sizingDetails = "";
  
  if(UseDynamicContractSize) {
     sizingMode = "DYNAMIC (Current Equity)";
     sizingDetails = StringFormat(
       "Mode: %s\n"
       "Risk Base: CURRENT EQUITY\n"
       "Current Equity: %s %.2f\n"
       "Current Balance: %s %.2f\n"
       "Initial Balance: %s %.2f\n\n"
       "How it works:\n"
       "- Risk percentage stays constant (e.g., 0.5%%)\n"
       "- Dollar risk amount changes with equity\n"
       "- After wins: Equity increases → Position size increases\n"
       "- After losses: Equity decreases → Position size decreases\n\n"
       "Example:\n"
       "Starting: Equity %s 10,000 → Risk 0.5%% = %s 50\n"
       "After wins: Equity %s 10,200 → Risk 0.5%% = %s 51\n"
       "After losses: Equity %s 9,800 → Risk 0.5%% = %s 49",
       sizingMode,
       accountCurrency, currentEquity,
       accountCurrency, currentBalance,
       accountCurrency, initialAccountBalance,
       accountCurrency, accountCurrency,
       accountCurrency, accountCurrency,
       accountCurrency, accountCurrency
     );
  } else {
     if(UseManualBaseSize) {
        sizingMode = "FIXED (Manual Base Size)";
        sizingDetails = StringFormat(
          "Mode: %s\n"
          "Risk Base: MANUAL BASE SIZE\n"
          "Manual Base Size: %s %.2f\n"
          "Current Balance: %s %.2f\n"
          "Current Equity: %s %.2f\n\n"
          "How it works:\n"
          "- Risk is ALWAYS calculated from Manual Base Size\n"
          "- Position size stays constant regardless of wins/losses\n"
          "- Risk percentage stays constant (e.g., 0.5%%)\n"
          "- Dollar risk amount stays constant\n\n"
          "Example:\n"
          "Manual Base: %s %.2f → Risk 0.5%% = %s %.2f (ALWAYS)",
          sizingMode,
          accountCurrency, ManualBaseAccountSize,
          accountCurrency, currentBalance,
          accountCurrency, currentEquity,
          accountCurrency, ManualBaseAccountSize,
          accountCurrency, (ManualBaseAccountSize * 0.005)
        );
     } else {
        sizingMode = "FIXED (Initial Deposit)";
        sizingDetails = StringFormat(
          "Mode: %s\n"
          "Risk Base: INITIAL DEPOSIT\n"
          "Initial Deposit: %s %.2f\n"
          "Current Balance: %s %.2f\n"
          "Current Equity: %s %.2f\n\n"
          "How it works:\n"
          "- Risk is ALWAYS calculated from Initial Deposit\n"
          "- Position size stays constant regardless of wins/losses\n"
          "- Risk percentage stays constant (e.g., 0.5%%)\n"
          "- Dollar risk amount stays constant\n\n"
          "Example:\n"
          "Initial Deposit: %s %.2f → Risk 0.5%% = %s %.2f (ALWAYS)",
          sizingMode,
          accountCurrency, initialAccountBalance,
          accountCurrency, currentBalance,
          accountCurrency, currentEquity,
          accountCurrency, initialAccountBalance,
          accountCurrency, (initialAccountBalance * 0.005)
        );
     }
  }
  
  string body = StringFormat(
    "Position Sizing Configuration\n"
    "============================\n\n"
    "%s\n\n"
    "Account Information:\n"
    "Account: %d\n"
    "Time: %s\n"
    "Terminal: %s\n"
    "Server: %s\n",
    sizingDetails,
    AccountInfoInteger(ACCOUNT_LOGIN),
    TimeToString(TimeGMT()),
    TerminalInfoString(TERMINAL_NAME),
    AccountInfoString(ACCOUNT_SERVER)
  );
  
  SendTradeEmail(subject, body);
  Print("TradingSignalEA: Position sizing settings email sent");
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
//| Check and warn about log file size                               |
//+------------------------------------------------------------------+
void CheckAndWarnLogFileSize() {
   // MT5 log files are stored in the terminal's data folder
   // We can't directly access them, but we can provide warnings and instructions
   // Log files typically located at: Terminal Data Folder/logs/
   
   string logPath = TerminalInfoString(TERMINAL_DATA_PATH) + "\\logs\\";
   string accountLogFile = StringFormat("%s%d.log", logPath, AccountInfoInteger(ACCOUNT_LOGIN));
   
   // Note: We can't directly check file size in MQL5 without using DLL
   // Instead, we'll provide periodic reminders and instructions
   static datetime lastWarningTime = 0;
   static int warningCount = 0;
   
   // Warn every 6 hours if verbose logging is enabled
   if(EnableVerboseLogging && (TimeGMT() - lastWarningTime) >= 21600) {
      string warningMsg = StringFormat(
         "TradingSignalEA: LOG FILE MANAGEMENT REMINDER\n"
         "Account: %d\n"
         "Log Location: %s\n"
         "To reduce log file size:\n"
         "1. Set 'EnableVerboseLogging = false' in EA inputs\n"
         "2. Manually delete old log files from: %s\n"
         "3. Restart MT5 terminal to start fresh logs\n"
         "Current log file: %s\n"
         "If log file is > 500MB, consider cleanup to improve performance",
         AccountInfoInteger(ACCOUNT_LOGIN),
         logPath,
         logPath,
         accountLogFile
      );
      
      if(warningCount < 3) {  // Only warn 3 times, then stop
         Print(warningMsg);
         warningCount++;
         lastWarningTime = TimeGMT();
      }
   }
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

//+------------------------------------------------------------------+
//| Check if rejection email was already sent for this signal        |
//+------------------------------------------------------------------+
bool HasRejectionEmailBeenSent(const string& signalId) {
   for(int i = 0; i < rejectionEmailSentCount; i++) {
      if(rejectionEmailSent[i] == signalId) {
         return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Mark signal as having rejection email sent                        |
//+------------------------------------------------------------------+
void MarkRejectionEmailSent(const string& signalId) {
   if(!HasRejectionEmailBeenSent(signalId)) {
      ArrayResize(rejectionEmailSent, rejectionEmailSentCount + 1);
      rejectionEmailSent[rejectionEmailSentCount] = signalId;
      rejectionEmailSentCount++;
      
      // Cleanup old entries if array gets too large (keep last 100)
      if(rejectionEmailSentCount > 100) {
         for(int i = 0; i < 50; i++) {
            rejectionEmailSent[i] = rejectionEmailSent[i + 50];
         }
         rejectionEmailSentCount = 50;
         ArrayResize(rejectionEmailSent, 50);
      }
   }
}

//+------------------------------------------------------------------+
//| Send signal rejection email notification                         |
//+------------------------------------------------------------------+
void SendSignalRejectionEmail(const TradingSignal& signal, string rejectionReason) {
  if(!SendOnErrors) return;
  
  // Check if we've already sent a rejection email for this signal
  if(HasRejectionEmailBeenSent(signal.id)) {
     Print("TradingSignalEA: Rejection email already sent for signal ", signal.id, " - skipping duplicate notification");
     return;
  }
  
  string actionStr = (signal.action == ORDER_TYPE_BUY) ? "BUY" : "SELL";
  string subject = StringFormat("MT5 Signal REJECTED - %s %s (ID: %s)", actionStr, signal.symbol, signal.id);
  
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
    "Risk: %.2f%%\n"
    "Stop Distance: %.1f pips\n"
    "Status: REJECTED\n"
    "Rejection Reason: %s\n"
    "Time: %s\n"
    "Account: %d",
    signal.id,
    signal.symbol,
    actionStr,
    signal.entry,
    signal.stop,
    signal.target,
    signal.risk_percent,
    stopPips,
    rejectionReason,
    TimeToString(TimeGMT()),
    AccountInfoInteger(ACCOUNT_LOGIN)
  );
  
  SendTradeEmail(subject, body);
  
  // Mark this signal as having rejection email sent
  MarkRejectionEmailSent(signal.id);
}

//+------------------------------------------------------------------+
//| Check and send daily health check email                          |
//+------------------------------------------------------------------+
void CheckAndSendDailyHealthCheck() {
   datetime currentTime = TimeGMT();
   MqlDateTime currentDateTime;
   TimeToStruct(currentTime, currentDateTime);
   
   // Check if we're at the specified hour and haven't sent today's email yet
   if(currentDateTime.hour == HealthCheckHour && currentDateTime.min == 0) {
      // Check if we already sent today (compare dates, not exact time)
      MqlDateTime lastCheckDateTime;
      if(lastHealthCheckEmail > 0) {
         TimeToStruct(lastHealthCheckEmail, lastCheckDateTime);
         // If same day, skip
         if(currentDateTime.day == lastCheckDateTime.day && 
            currentDateTime.mon == lastCheckDateTime.mon && 
            currentDateTime.year == lastCheckDateTime.year) {
            return; // Already sent today
         }
      }
      
      // Send health check email
      SendDailyHealthCheckEmail();
      lastHealthCheckEmail = currentTime;
   }
}

//+------------------------------------------------------------------+
//| Send daily health check email                                    |
//+------------------------------------------------------------------+
void SendDailyHealthCheckEmail() {
   if(!SendEmailNotifications || !SendDailyHealthCheck) return;
   
   string accountCurrency = AccountInfoString(ACCOUNT_CURRENCY);
   double currentBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   double currentEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   double currentMargin = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   
   // Count active positions
   int activePositions = 0;
   double totalProfit = 0.0;
   string activeSymbolsList = "";
   for(int i = 0; i < PositionsTotal(); i++) {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket)) {
         if(PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
            activePositions++;
            totalProfit += PositionGetDouble(POSITION_PROFIT);
            string symbol = PositionGetString(POSITION_SYMBOL);
            if(activeSymbolsList != "") activeSymbolsList += ", ";
            activeSymbolsList += symbol;
         }
      }
   }
   
   // Connection status
   string connectionStatus = connectionManager.GetStateString();
   bool isHealthy = connectionManager.IsHealthy();
   string healthStatus = isHealthy ? "HEALTHY ✓" : "ISSUES DETECTED ⚠";
   
   // Position sizing mode with detailed information
   string sizingMode = "";
   string sizingBase = "";
   string sizingDetails = "";
   
   if(UseDynamicContractSize) {
      sizingMode = "DYNAMIC (Current Equity)";
      sizingBase = StringFormat("%s %.2f", accountCurrency, currentEquity);
      sizingDetails = StringFormat(
         "Mode: %s\n"
         "Risk Base: CURRENT EQUITY\n"
         "Current Equity: %s %.2f\n"
         "Current Balance: %s %.2f\n"
         "Initial Balance: %s %.2f\n\n"
         "How it works:\n"
         "- Risk percentage stays constant (e.g., %.2f%%)\n"
         "- Dollar risk amount changes with equity\n"
         "- After wins: Equity increases → Position size increases\n"
         "- After losses: Equity decreases → Position size decreases\n\n"
         "Example:\n"
         "Starting: Equity %s %.2f → Risk %.2f%% = %s %.2f\n"
         "After wins: Equity %s %.2f → Risk %.2f%% = %s %.2f\n"
         "After losses: Equity %s %.2f → Risk %.2f%% = %s %.2f",
         sizingMode,
         accountCurrency, currentEquity,
         accountCurrency, currentBalance,
         accountCurrency, initialAccountBalance,
         RiskPercent,
         accountCurrency, initialAccountBalance, RiskPercent, accountCurrency, (initialAccountBalance * RiskPercent / 100.0),
         accountCurrency, (currentEquity * 1.02), RiskPercent, accountCurrency, (currentEquity * 1.02 * RiskPercent / 100.0),
         accountCurrency, (currentEquity * 0.98), RiskPercent, accountCurrency, (currentEquity * 0.98 * RiskPercent / 100.0)
      );
   } else {
      if(UseManualBaseSize) {
         sizingMode = "FIXED (Manual Base Size)";
         sizingBase = StringFormat("%s %.2f", accountCurrency, ManualBaseAccountSize);
         sizingDetails = StringFormat(
            "Mode: %s\n"
            "Risk Base: MANUAL BASE SIZE\n"
            "Manual Base Size: %s %.2f\n"
            "Current Balance: %s %.2f\n"
            "Current Equity: %s %.2f\n"
            "Initial Balance: %s %.2f\n\n"
            "How it works:\n"
            "- Risk is ALWAYS calculated from Manual Base Size\n"
            "- Position size stays constant regardless of wins/losses\n"
            "- Risk percentage stays constant (e.g., %.2f%%)\n"
            "- Dollar risk amount stays constant\n\n"
            "Example:\n"
            "Manual Base: %s %.2f → Risk %.2f%% = %s %.2f (ALWAYS)",
            sizingMode,
            accountCurrency, ManualBaseAccountSize,
            accountCurrency, currentBalance,
            accountCurrency, currentEquity,
            accountCurrency, initialAccountBalance,
            RiskPercent,
            accountCurrency, ManualBaseAccountSize,
            RiskPercent,
            accountCurrency, (ManualBaseAccountSize * RiskPercent / 100.0)
         );
      } else {
         sizingMode = "FIXED (Initial Deposit)";
         sizingBase = StringFormat("%s %.2f", accountCurrency, initialAccountBalance);
         sizingDetails = StringFormat(
            "Mode: %s\n"
            "Risk Base: INITIAL DEPOSIT\n"
            "Initial Deposit: %s %.2f\n"
            "Current Balance: %s %.2f\n"
            "Current Equity: %s %.2f\n\n"
            "How it works:\n"
            "- Risk is ALWAYS calculated from Initial Deposit\n"
            "- Position size stays constant regardless of wins/losses\n"
            "- Risk percentage stays constant (e.g., %.2f%%)\n"
            "- Dollar risk amount stays constant\n\n"
            "Example:\n"
            "Initial Deposit: %s %.2f → Risk %.2f%% = %s %.2f (ALWAYS)",
            sizingMode,
            accountCurrency, initialAccountBalance,
            accountCurrency, currentBalance,
            accountCurrency, currentEquity,
            RiskPercent,
            accountCurrency, initialAccountBalance,
            RiskPercent,
            accountCurrency, (initialAccountBalance * RiskPercent / 100.0)
         );
      }
   }
   
   // Filter status
   string filterStatus = EnableSignalFilter ? "ENABLED" : "DISABLED";
   string filterHTF = "";
   if(EnableSignalFilter) {
      filterHTF = StringFormat("M%d", FilterHTFTimeframe);
   }
   
   // Recent activity (last successful poll)
   string lastPollStatus = "N/A";
   if(lastSuccessfulPoll > 0) {
      int secondsSincePoll = (int)(TimeGMT() - lastSuccessfulPoll);
      if(secondsSincePoll < 60) {
         lastPollStatus = StringFormat("%d seconds ago", secondsSincePoll);
      } else if(secondsSincePoll < 3600) {
         lastPollStatus = StringFormat("%d minutes ago", secondsSincePoll / 60);
      } else {
         lastPollStatus = StringFormat("%d hours ago", secondsSincePoll / 3600);
      }
   }
   
   string subject = StringFormat("MT5 Daily Health Check - Account %d [%s]", 
                                 AccountInfoInteger(ACCOUNT_LOGIN), healthStatus);
   
   string body = StringFormat(
      "═══════════════════════════════════════════════════════\n"
      "MT5 TRADING EA - DAILY HEALTH CHECK\n"
      "═══════════════════════════════════════════════════════\n\n"
      
      "📊 ACCOUNT STATUS\n"
      "───────────────────────────────────────────────────────\n"
      "Account: %d\n"
      "Balance: %s %.2f\n"
      "Equity: %s %.2f\n"
      "Margin Used: %s %.2f\n"
      "Free Margin: %s %.2f\n"
      "Margin Level: %.2f%%\n"
      "Currency: %s\n\n"
      
      "📈 ACTIVE POSITIONS\n"
      "───────────────────────────────────────────────────────\n"
      "Total Positions: %d\n"
      "Total Floating P/L: %s %.2f\n"
      "Active Symbols: %s\n\n"
      
      "⚙️ EA CONFIGURATION\n"
      "───────────────────────────────────────────────────────\n"
      "Position Sizing: %s\n"
      "Risk Base: %s\n"
      "HTF Filter: %s %s\n"
      "Auto Execute: %s\n"
      "Max Concurrent Positions: %d\n\n"
      
      "💰 POSITION SIZING DETAILS\n"
      "───────────────────────────────────────────────────────\n"
      "%s\n\n"
      
      "🔌 CONNECTION STATUS\n"
      "───────────────────────────────────────────────────────\n"
      "Status: %s\n"
      "Health: %s\n"
      "Last Successful Poll: %s\n"
      "Consecutive Failures: %d\n"
      "Server: %s\n\n"
      
      "📋 SYSTEM INFO\n"
      "───────────────────────────────────────────────────────\n"
      "Terminal: %s\n"
      "EA Version: 1.06\n"
      "Report Time: %s (UTC)\n"
      "Report Date: %s\n\n"
      
      "═══════════════════════════════════════════════════════\n"
      "This is an automated daily health check.\n"
      "If you see any issues, please check the MT5 logs.\n"
      "═══════════════════════════════════════════════════════",
      
      // Account Status
      AccountInfoInteger(ACCOUNT_LOGIN),
      accountCurrency, currentBalance,
      accountCurrency, currentEquity,
      accountCurrency, currentMargin,
      accountCurrency, freeMargin,
      marginLevel > 0 ? marginLevel : 0.0,
      accountCurrency,
      
      // Active Positions
      activePositions,
      accountCurrency, totalProfit,
      activeSymbolsList != "" ? activeSymbolsList : "None",
      
      // EA Configuration
      sizingMode,
      sizingBase,
      filterStatus,
      filterHTF,
      AutoExecute ? "ENABLED" : "DISABLED",
      MaxConcurrentPositions,
      
      // Position Sizing Details
      sizingDetails,
      
      // Connection Status
      connectionStatus,
      healthStatus,
      lastPollStatus,
      consecutiveFailures,
      AccountInfoString(ACCOUNT_SERVER),
      
      // System Info
      TerminalInfoString(TERMINAL_NAME),
      TimeToString(TimeGMT(), TIME_DATE|TIME_MINUTES),
      TimeToString(TimeGMT(), TIME_DATE)
   );
   
   SendTradeEmail(subject, body);
   Print("TradingSignalEA: Daily health check email sent");
}
