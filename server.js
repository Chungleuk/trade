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

// Position sizing mode: "global" (all pairs share W-L) or "per_pair" (each pair independent)
const POSITION_SIZING_MODE = (process.env.POSITION_SIZING_MODE || 'global').toLowerCase();

// Node-to-risk map (same as Supabase webhook)
const NODE_RISK_MAP = {
  'Start': 0.65, '1-0': 0.58, '0-1': 0.73, '2-0': 0.44, '1-1': 0.73, '0-2': 0.73,
  '3-0': 0.25, '2-1': 0.62, '1-2': 0.83, '0-3': 0.62, '4-0': 0.08, '3-1': 0.41,
  '2-2': 0.83, '1-3': 0.83, '0-4': 0.41, '4-1': 0.17, '3-2': 0.66, '2-3': 0.99,
  '1-4': 0.66, '0-5': 0.17, '4-2': 0.33, '3-3': 0.99, '2-4': 0.99, '1-5': 0.33,
  '4-3': 0.66, '3-4': 1.33, '2-5': 0.66, '4-4': 1.33, '3-5': 1.33, '4-5': 2.65,
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Trading Backend API is running!',
    endpoints: {
      status: '/status',
      health: '/health',
      webhook: '/webhook (TradingView - no Edge Function)',
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

// TradingView webhook - receives alerts, saves to Supabase (no Edge Function)
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

    const groupKey = POSITION_SIZING_MODE === 'per_pair' ? symbol : 'GLOBAL';
    let riskPercent = '0.65';
    try {
      const { data: state } = await supabase
        .from('position_sizing_state')
        .select('*')
        .eq('group_key', groupKey)
        .maybeSingle();
      const node = state?.current_node || 'Start';
      riskPercent = (NODE_RISK_MAP[node] ?? 0.65).toFixed(2);
    } catch {}

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
    console.log(`Webhook: ${symbol} ${act} saved, risk ${riskPercent}% (${groupKey})`);
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

// Signals endpoint
app.post('/signals/pending', async (req, res) => {
  console.log('MT5 EA requesting signals:', req.body);
  
  try {
    // Fetch pending signals from Supabase
    const { data: signals, error } = await supabase
      .from('trading_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch signals',
        message: error.message 
      });
    }
    
    // Transform signals for MT5 EA
    const transformedSignals = signals.map(signal => ({
      id: signal.alert_id || signal.id,
      symbol: signal.symbol,
      action: signal.action,
      entry: signal.entry,
      target: signal.target,
      stop: signal.stop,
      timeframe: signal.timeframe,
      risk: signal.risk,
      timestamp: signal.created_at
    }));
    
    // Filter out duplicate signal IDs (keep only the most recent)
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
    
    console.log(`Found ${transformedSignals.length} total signals, ${uniqueSignals.length} unique signals`);
    
    res.json({ 
      signals: uniqueSignals, 
      message: `${uniqueSignals.length} unique signals found`,
      timestamp: new Date().toISOString(),
      queue_size: uniqueSignals.length
    });
    
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Heartbeat endpoint
app.post('/mt5/heartbeat', (req, res) => {
  console.log('MT5 EA heartbeat:', req.body);
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    message: 'Backend is responding'
  });
});

// Signal acknowledgment endpoint - marks alert as completed in Supabase
app.post('/signals/ack', async (req, res) => {
  console.log('Signal acknowledgment received:', req.body);
  const { signalId, status: ackStatus } = req.body;

  if (signalId && (ackStatus === 'executed' || ackStatus === 'failed')) {
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

// Position sizing: advance node based on outcome (GLOBAL mode - all pairs share one W-L sequence)
function advanceNode(currentNode, outcome) {
  if (currentNode === 'Start') {
    if (outcome === 'win') return '1-0';
    if (outcome === 'loss') return '0-1';
    return 'Start';
  }
  const match = currentNode.match(/^(\d+)-(\d+)$/);
  if (!match) return 'Start';
  const wins = parseInt(match[1], 10);
  const losses = parseInt(match[2], 10);
  const newWins = outcome === 'win' ? wins + 1 : wins;
  const newLosses = outcome === 'loss' ? losses + 1 : losses;
  if (newWins > 4 || newLosses > 5) return 'Start';
  if (outcome === 'win') return `${wins + 1}-${losses}`;
  if (outcome === 'loss') return `${wins}-${losses + 1}`;
  return currentNode;
}

// MT5 trade outcome endpoint - Updates position_sizing_state in Supabase
app.post('/mt5/trade-outcome', async (req, res) => {
  console.log('Trade outcome received:', req.body);
  
  const { ticket, outcome, symbol, closePrice, closeTime, hk_shutdown } = req.body;

  if (!outcome || (outcome !== 'win' && outcome !== 'loss')) {
    console.error(`Invalid outcome: "${outcome}" for ticket ${ticket}`);
    return res.status(400).json({ error: 'Invalid outcome, must be "win" or "loss"' });
  }

  if (hk_shutdown) {
    console.log(`HK shutdown close: ticket ${ticket} (${symbol}) — position sizing NOT updated`);
  } else {
    try {
      const groupKey = POSITION_SIZING_MODE === 'per_pair'
        ? (symbol || 'UNKNOWN').toUpperCase()
        : 'GLOBAL';
      const { data: state } = await supabase
        .from('position_sizing_state')
        .select('*')
        .eq('group_key', groupKey)
        .maybeSingle();
      
      const currentNode = state?.current_node || 'Start';
      const nextNode = advanceNode(currentNode, outcome);
      
      const { error: upsertError } = await supabase
        .from('position_sizing_state')
        .upsert({ group_key: groupKey, current_node: nextNode }, { onConflict: 'group_key' });
      
      if (upsertError) {
        console.error('Failed to update position_sizing_state:', upsertError);
      } else {
        console.log(`Position sizing [${POSITION_SIZING_MODE}]: ${symbol} ${outcome} → ${currentNode} → ${nextNode} (${groupKey})`);
      }
    } catch (err) {
      console.error('Error updating position sizing:', err);
    }
  }
  
  console.log(`Trade ${ticket} (${symbol}) marked as ${outcome} at ${closePrice}`);
  
  res.json({ 
    status: 'success', 
    message: 'Trade outcome updated successfully',
    trade: {
      ticket,
      outcome,
      symbol,
      closePrice,
      closeTime
    },
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
  console.log(`🚀 Trading backend running on port ${PORT}`);
  console.log(`📊 Position sizing mode: ${POSITION_SIZING_MODE}`);
  console.log(`📊 Status: http://localhost:${PORT}/status`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
