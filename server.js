// server.js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

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
app.post('/signals/pending', (req, res) => {
  console.log('MT5 EA requesting signals:', req.body);
  res.json({ 
    signals: [], 
    message: 'No pending signals',
    timestamp: new Date().toISOString(),
    queue_size: 0
  });
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
