import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from './utils/logger.js';
import { SignalQueue } from './services/signalQueue.js';
import { MT5WebSocketManager } from './services/mt5WebSocketManager.js';
import { DatabaseManager } from './services/databaseManager.js';
import { authMiddleware } from './middleware/auth.js';
import { webhookRoutes } from './routes/webhook.js';
import { signalRoutes } from './routes/signals.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Environment variables
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'tradingview-webhook-secret';

// Initialize services
const dbManager = new DatabaseManager();
const signalQueue = new SignalQueue();
const mt5Manager = new MT5WebSocketManager(wss, signalQueue);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbManager.isConnected(),
      signalQueue: signalQueue.isHealthy(),
      mt5Connections: mt5Manager.getConnectionCount()
    }
  });
});

// Routes
app.use('/api/webhook', webhookRoutes);
app.use('/api/signals', authMiddleware, signalRoutes);

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  logger.info('New WebSocket connection', { ip: req.socket.remoteAddress });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      mt5Manager.handleMessage(ws, data);
    } catch (error) {
      logger.error('WebSocket message parsing error:', error);
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
    mt5Manager.removeConnection(ws);
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await signalQueue.close();
  await dbManager.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server ready for MT5 connections`);
});

export { app, server, wss, mt5Manager, signalQueue, dbManager };
