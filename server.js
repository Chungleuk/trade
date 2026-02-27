// server.js
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://xdjthqpnsyrlulqldlpi.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_service_role_key_here';
const supabase = createClient(supabaseUrl, supabaseKey);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Trading Backend API is running!',
    endpoints: {
      status: '/status',
      health: '/health',
      webhook: '/webhook',
      mt5_connect: '/mt5/connect',
      mt5_heartbeat: '/mt5/heartbeat',
      mt5_disconnect: '/mt5/disconnect',
      mt5_trade_outcome: '/mt5/trade-outcome',
      signals_pending: '/signals/pending',
      signals_ack: '/signals/ack'
    },
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test endpoint
app.get('/status', (req, res) => {
  res.json({ 
    status: 'Trading Backend Running on Render!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// TradingView webhook - receives alerts, saves to Supabase
app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    const action = (data.action || data.side || data.type || '').toString().toUpperCase();
    const symbol = (data.symbol || data.ticker || data.instrument || data.pair || 'UNKNOWN').toString().toUpperCase();
    const entry = parseFloat(data.entry || data.price || data.entry_price || data.fill_price || data.close || 0);

    if (!action || !symbol || !entry || isNaN(entry)) {
      return res.status(400).json({ error: 'Missing action, symbol, or entry' });
    }
    const act = action.includes('BUY') || action.includes('LONG') ? 'BUY' : action.includes('SELL') || action.includes('SHORT') ? 'SELL' : null;
    if (!act) return res.status(400).json({ error: 'Invalid action' });

    const riskPercent = data.risk ? String(data.risk).replace('%', '') : '0.65';

    const alertId = data.id || `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { data: inserted, error } = await supabase
      .from('trading_alerts')
      .insert({
        action: act,
        symbol,
        timeframe: String(data.timeframe || data.tf || '15'),
        entry: String(entry),
        target: data.target || data.tp ? String(parseFloat(data.target || data.tp)) : null,
        stop: data.stop || data.sl ? String(parseFloat(data.stop || data.sl)) : null,
        rr: data.rr || data.risk_reward || null,
        risk: riskPercent,
        alert_id: alertId,
        message: JSON.stringify(data),
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Webhook Supabase error:', error);
      return res.status(500).json({ error: 'Failed to save alert' });
    }
    console.log(`Webhook: ${symbol} ${act} saved, risk ${riskPercent}%`);
    res.json({ success: true, alert: inserted, risk: riskPercent });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// MT5 connection endpoint
app.post('/mt5/connect', (req, res) => {
  console.log('MT5 EA connected:', req.body);
  res.json({ 
    status: 'connected', 
    message: 'MT5 EA connected successfully',
    timestamp: new Date().toISOString(),
    account: req.body.account || 'unknown',
    terminal: req.body.terminal || 'unknown'
  });
});

// Shared: fetch active signals and return JSON (used by both GET and POST)
async function fetchPendingSignals() {
  const { data: signals, error } = await supabase
    .from('trading_alerts')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  const transformedSignals = signals.map(signal => ({
    id: signal.alert_id || signal.id,
    symbol: signal.symbol,
    action: signal.action,
    entry: signal.entry,
    target: signal.target,
    stop: signal.stop,
    timeframe: signal.timeframe,
    risk: signal.risk,
    rr: signal.rr || '1',
    timestamp: signal.created_at
  }));

  const uniqueSignals = [];
  const seenIds = new Set();
  for (const signal of transformedSignals) {
    if (!seenIds.has(signal.id)) {
      seenIds.add(signal.id);
      uniqueSignals.push(signal);
    } else {
      console.log(`Filtered duplicate signal ID: ${signal.id}`);
    }
  }
  return { signals: uniqueSignals };
}

// Signals endpoint (GET and POST - EA may use either)
app.get('/signals/pending', async (req, res) => {
  console.log('MT5 EA requesting signals (GET):', req.query);
  try {
    const { signals: uniqueSignals } = await fetchPendingSignals();
    res.json({
      signals: uniqueSignals,
      message: `${uniqueSignals.length} unique signals found`,
      timestamp: new Date().toISOString(),
      queue_size: uniqueSignals.length
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.post('/signals/pending', async (req, res) => {
  console.log('MT5 EA requesting signals (POST):', req.body);
  try {
    const { signals: uniqueSignals } = await fetchPendingSignals();
    res.json({
      signals: uniqueSignals,
      message: `${uniqueSignals.length} unique signals found`,
      timestamp: new Date().toISOString(),
      queue_size: uniqueSignals.length
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Heartbeat endpoint
app.post('/mt5/heartbeat', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    message: 'Backend is responding'
  });
});

// Signal acknowledgment endpoint
app.post('/signals/ack', async (req, res) => {
  console.log('Signal acknowledgment received:', req.body);
  const { signalId, status: ackStatus } = req.body;

  // Mark as completed only when executed; stopped for failed/expired/rejected
  const terminalStatuses = ['executed', 'failed', 'expired', 'rejected'];
  if (signalId && terminalStatuses.includes(ackStatus)) {
    try {
      const newStatus = ackStatus === 'executed' ? 'completed' : 'stopped';
      const { error } = await supabase
        .from('trading_alerts')
        .update({ status: newStatus })
        .eq('alert_id', signalId);
      if (error) {
        console.error('Failed to update alert status:', error);
      } else {
        console.log(`Alert ${signalId} status → ${newStatus}`);
      }
    } catch (err) {
      console.error('Error updating alert status:', err);
    }
  }

  res.json({ 
    status: 'acknowledged', 
    message: 'Signal status updated',
    timestamp: new Date().toISOString(),
    signalId: signalId || 'unknown'
  });
});

// MT5 disconnect endpoint
app.post('/mt5/disconnect', (req, res) => {
  console.log('MT5 EA disconnected:', req.body);
  res.json({ 
    status: 'disconnected', 
    message: 'MT5 EA disconnected successfully',
    timestamp: new Date().toISOString()
  });
});

// MT5 trade outcome endpoint
app.post('/mt5/trade-outcome', async (req, res) => {
  const { ticket, outcome, symbol, closePrice, closeTime } = req.body;

  if (!outcome || (outcome !== 'win' && outcome !== 'loss')) {
    return res.status(400).json({ error: 'Invalid outcome, must be "win" or "loss"' });
  }

  console.log(`Trade ${ticket} (${symbol}) marked as ${outcome} at ${closePrice}`);
  
  res.json({ 
    status: 'success', 
    message: 'Trade outcome recorded',
    trade: { ticket, outcome, symbol, closePrice, closeTime },
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Trading backend running on port ${PORT}`);
  console.log(`Status: http://localhost:${PORT}/status`);
  console.log(`Health: http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
