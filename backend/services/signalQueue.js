import Bull from 'bull';
import { logger } from '../utils/logger.js';
import { DatabaseManager } from './databaseManager.js';

export class SignalQueue {
  constructor() {
    this.dbManager = new DatabaseManager();
    this.signalQueue = new Bull('trading-signals', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      }
    });
    
    this.setupQueue();
  }

  setupQueue() {
    // Process signals with retry logic
    this.signalQueue.process('process-signal', async (job) => {
      try {
        const signal = job.data;
        logger.info('Processing signal', { signalId: signal.id, symbol: signal.symbol });
        
        // Add authentication layer
        const authenticatedSignal = this.addAuthentication(signal);
        
        // Log to PostgreSQL
        await this.logSignal(signal, 'received');
        
        // Send to MT5 via WebSocket
        const result = await this.sendToMT5(authenticatedSignal);
        
        if (result.success) {
          await this.logSignal(signal, 'sent_to_mt5');
          logger.info('Signal sent to MT5 successfully', { signalId: signal.id });
          return { success: true, mt5Response: result.response };
        } else {
          throw new Error(`Failed to send to MT5: ${result.error}`);
        }
      } catch (error) {
        logger.error('Signal processing error', { 
          signalId: job.data.id, 
          error: error.message,
          attempt: job.attemptsMade + 1
        });
        
        // Log error to database
        await this.logSignalError(job.data, error);
        
        throw error; // This will trigger retry
      }
    });

    // Handle failed jobs
    this.signalQueue.on('failed', (job, err) => {
      logger.error('Signal processing failed permanently', {
        signalId: job.data.id,
        error: err.message,
        attempts: job.attemptsMade
      });
      
      // Log permanent failure
      this.logSignalError(job.data, err, true);
    });

    // Handle completed jobs
    this.signalQueue.on('completed', (job, result) => {
      logger.info('Signal processed successfully', {
        signalId: job.data.id,
        result
      });
    });
  }

  addAuthentication(signal) {
    const timestamp = Date.now();
    const token = this.generateJWT(signal, timestamp);
    
    return {
      ...signal,
      auth: {
        token,
        timestamp,
        signature: this.generateSignature(signal, timestamp)
      }
    };
  }

  generateJWT(signal, timestamp) {
    const payload = {
      signalId: signal.id,
      symbol: signal.symbol,
      action: signal.action,
      timestamp,
      exp: Math.floor(timestamp / 1000) + (60 * 60) // 1 hour expiry
    };
    
    // In production, use proper JWT library
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  generateSignature(signal, timestamp) {
    const data = `${signal.id}${signal.symbol}${signal.action}${timestamp}`;
    const secret = process.env.SIGNATURE_SECRET || 'default-secret';
    
    // Simple hash for demo - use crypto.createHmac in production
    return require('crypto').createHash('sha256')
      .update(data + secret)
      .digest('hex');
  }

  async addSignal(signal) {
    try {
      const job = await this.signalQueue.add('process-signal', signal, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 50
      });
      
      logger.info('Signal added to queue', { 
        signalId: signal.id, 
        jobId: job.id 
      });
      
      return { success: true, jobId: job.id };
    } catch (error) {
      logger.error('Failed to add signal to queue', { 
        signalId: signal.id, 
        error: error.message 
      });
      throw error;
    }
  }

  async sendToMT5(signal) {
    // This will be implemented by the WebSocket manager
    // For now, return a mock response
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, response: 'MT5_ACK' });
      }, 100);
    });
  }

  async logSignal(signal, status) {
    try {
      await this.dbManager.logSignal({
        signal_id: signal.id,
        symbol: signal.symbol,
        action: signal.action,
        entry: signal.entry,
        target: signal.target,
        stop: signal.stop,
        status,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to log signal to database', { error: error.message });
    }
  }

  async logSignalError(signal, error, permanent = false) {
    try {
      await this.dbManager.logSignalError({
        signal_id: signal.id,
        error_message: error.message,
        error_stack: error.stack,
        permanent,
        timestamp: new Date()
      });
    } catch (dbError) {
      logger.error('Failed to log signal error to database', { error: dbError.message });
    }
  }

  async getQueueStatus() {
    try {
      const waiting = await this.signalQueue.getWaiting();
      const active = await this.signalQueue.getActive();
      const completed = await this.signalQueue.getCompleted();
      const failed = await this.signalQueue.getFailed();
      
      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length
      };
    } catch (error) {
      logger.error('Failed to get queue status', { error: error.message });
      return null;
    }
  }

  isHealthy() {
    return this.signalQueue.client.status === 'ready';
  }

  async close() {
    try {
      await this.signalQueue.close();
      logger.info('Signal queue closed');
    } catch (error) {
      logger.error('Error closing signal queue', { error: error.message });
    }
  }
}
