import { logger } from '../utils/logger.js';

export class MT5WebSocketManager {
  constructor(wss, signalQueue) {
    this.wss = wss;
    this.signalQueue = signalQueue;
    this.connections = new Map(); // Map of WebSocket connections
    this.mt5Connections = new Map(); // Map of MT5 EA connections
    this.connectionHealth = new Map(); // Connection health monitoring
    
    this.setupHealthMonitoring();
  }

  handleMessage(ws, data) {
    try {
      const { type, ...payload } = data;
      
      switch (type) {
        case 'mt5_connect':
          this.handleMT5Connection(ws, payload);
          break;
        case 'mt5_heartbeat':
          this.handleHeartbeat(ws, payload);
          break;
        case 'signal_ack':
          this.handleSignalAcknowledgment(ws, payload);
          break;
        case 'trade_executed':
          this.handleTradeExecution(ws, payload);
          break;
        case 'connection_status':
          this.handleConnectionStatus(ws, payload);
          break;
        default:
          logger.warn('Unknown message type received', { type, payload });
          ws.send(JSON.stringify({ error: 'Unknown message type' }));
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', { error: error.message });
      ws.send(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  handleMT5Connection(ws, payload) {
    const { account, terminal, version, auth } = payload;
    
    // Validate authentication
    if (!this.validateMT5Auth(auth)) {
      ws.send(JSON.stringify({ 
        type: 'connection_rejected', 
        reason: 'Invalid authentication' 
      }));
      return;
    }
    
    // Register MT5 connection
    const connectionId = this.generateConnectionId();
    this.mt5Connections.set(connectionId, {
      ws,
      account,
      terminal,
      version,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      status: 'connected'
    });
    
    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'connection_confirmed',
      connectionId,
      timestamp: new Date().toISOString()
    }));
    
    logger.info('MT5 EA connected', { 
      connectionId, 
      account, 
      terminal, 
      version 
    });
  }

  handleHeartbeat(ws, payload) {
    const { connectionId } = payload;
    const connection = this.mt5Connections.get(connectionId);
    
    if (connection) {
      connection.lastHeartbeat = new Date();
      connection.status = 'healthy';
      
      // Send heartbeat response
      ws.send(JSON.stringify({
        type: 'heartbeat_response',
        timestamp: new Date().toISOString()
      }));
    }
  }

  handleSignalAcknowledgment(ws, payload) {
    const { signalId, status, message } = payload;
    
    logger.info('Signal acknowledged by MT5', { 
      signalId, 
      status, 
      message 
    });
    
    // Update signal status in queue/database
    this.signalQueue.updateSignalStatus(signalId, status);
  }

  handleTradeExecution(ws, payload) {
    const { signalId, tradeId, status, details } = payload;
    
    logger.info('Trade executed by MT5', { 
      signalId, 
      tradeId, 
      status, 
      details 
    });
    
    // Log trade execution
    this.logTradeExecution(signalId, tradeId, status, details);
  }

  handleConnectionStatus(ws, payload) {
    const { connectionId, status, details } = payload;
    
    const connection = this.mt5Connections.get(connectionId);
    if (connection) {
      connection.status = status;
      connection.lastUpdate = new Date();
      
      logger.info('MT5 connection status updated', { 
        connectionId, 
        status, 
        details 
      });
    }
  }

  validateMT5Auth(auth) {
    // Implement proper JWT validation here
    // For demo purposes, accept any auth object
    return auth && auth.token;
  }

  generateConnectionId() {
    return `mt5_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async sendSignalToMT5(signal) {
    const connections = Array.from(this.mt5Connections.values());
    
    if (connections.length === 0) {
      throw new Error('No MT5 connections available');
    }
    
    // Send to all connected MT5 instances
    const results = await Promise.allSettled(
      connections.map(connection => this.sendToConnection(connection, signal))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');
    
    if (successful.length === 0) {
      throw new Error('Failed to send signal to any MT5 connection');
    }
    
    logger.info('Signal sent to MT5 connections', {
      signalId: signal.id,
      successful: successful.length,
      failed: failed.length
    });
    
    return {
      success: true,
      sentTo: successful.length,
      totalConnections: connections.length
    };
  }

  async sendToConnection(connection, signal) {
    return new Promise((resolve, reject) => {
      try {
        const message = {
          type: 'trading_signal',
          signal: {
            ...signal,
            timestamp: new Date().toISOString()
          }
        };
        
        connection.ws.send(JSON.stringify(message));
        
        // Set up acknowledgment timeout
        const timeout = setTimeout(() => {
          reject(new Error('Signal acknowledgment timeout'));
        }, 10000); // 10 second timeout
        
        // Listen for acknowledgment
        const ackHandler = (data) => {
          try {
            const response = JSON.parse(data);
            if (response.type === 'signal_ack' && response.signalId === signal.id) {
              clearTimeout(timeout);
              connection.ws.removeEventListener('message', ackHandler);
              resolve({ success: true, response });
            }
          } catch (error) {
            // Ignore parsing errors
          }
        };
        
        connection.ws.addEventListener('message', ackHandler);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  removeConnection(ws) {
    // Find and remove connection
    for (const [id, connection] of this.mt5Connections.entries()) {
      if (connection.ws === ws) {
        this.mt5Connections.delete(id);
        logger.info('MT5 connection removed', { connectionId: id });
        break;
      }
    }
  }

  setupHealthMonitoring() {
    // Monitor connection health every 30 seconds
    setInterval(() => {
      const now = new Date();
      
      for (const [id, connection] of this.mt5Connections.entries()) {
        const timeSinceHeartbeat = now - connection.lastHeartbeat;
        
        if (timeSinceHeartbeat > 60000) { // 1 minute
          connection.status = 'unhealthy';
          logger.warn('MT5 connection unhealthy', { 
            connectionId: id, 
            timeSinceHeartbeat 
          });
        }
      }
    }, 30000);
  }

  getConnectionCount() {
    return this.mt5Connections.size;
  }

  getConnectionStatus() {
    const status = {};
    
    for (const [id, connection] of this.mt5Connections.entries()) {
      status[id] = {
        account: connection.account,
        terminal: connection.terminal,
        version: connection.version,
        status: connection.status,
        connectedAt: connection.connectedAt,
        lastHeartbeat: connection.lastHeartbeat
      };
    }
    
    return status;
  }

  async logTradeExecution(signalId, tradeId, status, details) {
    // Implement trade execution logging
    logger.info('Trade execution logged', { 
      signalId, 
      tradeId, 
      status, 
      details 
    });
  }
}
