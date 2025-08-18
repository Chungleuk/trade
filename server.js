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

// Signal acknowledgment endpoint
app.post('/signals/ack', (req, res) => {
  console.log('Signal acknowledgment received:', req.body);
  res.json({ 
    status: 'acknowledged', 
    message: 'Signal status updated',
    timestamp: new Date().toISOString(),
    signalId: req.body.signalId || 'unknown'
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
app.post('/mt5/trade-outcome', (req, res) => {
  console.log('Trade outcome received:', req.body);
  
  // Extract trade outcome data
  const { ticket, outcome, symbol, closePrice, closeTime } = req.body;
  
  // Here you would typically:
  // 1. Update your database with the trade outcome
  // 2. Send notification to your frontend
  // 3. Update the trading alerts table
  
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
