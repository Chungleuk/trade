import pg from 'pg';
import { logger } from '../utils/logger.js';

export class DatabaseManager {
  constructor() {
    this.client = null;
    this.connected = false;
    this.connect();
  }

  async connect() {
    try {
      this.client = new pg.Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'trading_signals',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
      });

      await this.client.connect();
      this.connected = true;
      
      // Create tables if they don't exist
      await this.createTables();
      
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      this.connected = false;
    }
  }

  async createTables() {
    try {
      // Signals table
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS signals (
          id SERIAL PRIMARY KEY,
          signal_id VARCHAR(255) UNIQUE NOT NULL,
          symbol VARCHAR(50) NOT NULL,
          action VARCHAR(10) NOT NULL,
          entry DECIMAL(10, 5) NOT NULL,
          target DECIMAL(10, 5),
          stop DECIMAL(10, 5),
          status VARCHAR(50) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Signal errors table
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS signal_errors (
          id SERIAL PRIMARY KEY,
          signal_id VARCHAR(255) NOT NULL,
          error_message TEXT NOT NULL,
          error_stack TEXT,
          permanent BOOLEAN DEFAULT FALSE,
          timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Trade executions table
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS trade_executions (
          id SERIAL PRIMARY KEY,
          signal_id VARCHAR(255) NOT NULL,
          trade_id VARCHAR(255) UNIQUE NOT NULL,
          status VARCHAR(50) NOT NULL,
          details JSONB,
          timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // MT5 connections table
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS mt5_connections (
          id SERIAL PRIMARY KEY,
          connection_id VARCHAR(255) UNIQUE NOT NULL,
          account VARCHAR(100) NOT NULL,
          terminal VARCHAR(100) NOT NULL,
          version VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          connected_at TIMESTAMP NOT NULL,
          last_heartbeat TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      logger.info('Database tables created/verified successfully');
    } catch (error) {
      logger.error('Failed to create tables:', error);
    }
  }

  async logSignal(signalData) {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        INSERT INTO signals (signal_id, symbol, action, entry, target, stop, status, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (signal_id) 
        DO UPDATE SET 
          status = EXCLUDED.status,
          timestamp = EXCLUDED.timestamp
      `;

      const values = [
        signalData.signal_id,
        signalData.symbol,
        signalData.action,
        signalData.entry,
        signalData.target,
        signalData.stop,
        signalData.status,
        signalData.timestamp
      ];

      await this.client.query(query, values);
      logger.info('Signal logged to database', { signalId: signalData.signal_id });
    } catch (error) {
      logger.error('Failed to log signal:', error);
      throw error;
    }
  }

  async logSignalError(errorData) {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        INSERT INTO signal_errors (signal_id, error_message, error_stack, permanent, timestamp)
        VALUES ($1, $2, $3, $4, $5)
      `;

      const values = [
        errorData.signal_id,
        errorData.error_message,
        errorData.error_stack,
        errorData.permanent,
        errorData.timestamp
      ];

      await this.client.query(query, values);
      logger.info('Signal error logged to database', { signalId: errorData.signal_id });
    } catch (error) {
      logger.error('Failed to log signal error:', error);
      throw error;
    }
  }

  async logTradeExecution(tradeData) {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        INSERT INTO trade_executions (signal_id, trade_id, status, details, timestamp)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (trade_id) 
        DO UPDATE SET 
          status = EXCLUDED.status,
          details = EXCLUDED.details,
          timestamp = EXCLUDED.timestamp
      `;

      const values = [
        tradeData.signal_id,
        tradeData.trade_id,
        tradeData.status,
        JSON.stringify(tradeData.details),
        tradeData.timestamp
      ];

      await this.client.query(query, values);
      logger.info('Trade execution logged to database', { tradeId: tradeData.trade_id });
    } catch (error) {
      logger.error('Failed to log trade execution:', error);
      throw error;
    }
  }

  async updateSignalStatus(signalId, status) {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        UPDATE signals 
        SET status = $1, timestamp = CURRENT_TIMESTAMP
        WHERE signal_id = $2
      `;

      await this.client.query(query, [status, signalId]);
      logger.info('Signal status updated', { signalId, status });
    } catch (error) {
      logger.error('Failed to update signal status:', error);
      throw error;
    }
  }

  async getSignals(limit = 100, offset = 0) {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        SELECT * FROM signals 
        ORDER BY timestamp DESC 
        LIMIT $1 OFFSET $2
      `;

      const result = await this.client.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get signals:', error);
      throw error;
    }
  }

  async getSignalById(signalId) {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        SELECT * FROM signals 
        WHERE signal_id = $1
      `;

      const result = await this.client.query(query, [signalId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get signal by ID:', error);
      throw error;
    }
  }

  async getSignalStats() {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        SELECT 
          COUNT(*) as total_signals,
          COUNT(CASE WHEN status = 'received' THEN 1 END) as received,
          COUNT(CASE WHEN status = 'sent_to_mt5' THEN 1 END) as sent_to_mt5,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM signals
      `;

      const result = await this.client.query(query);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get signal stats:', error);
      throw error;
    }
  }

  isConnected() {
    return this.connected;
  }

  async close() {
    if (this.client) {
      try {
        await this.client.end();
        this.connected = false;
        logger.info('Database connection closed');
      } catch (error) {
        logger.error('Error closing database connection:', error);
      }
    }
  }
}
