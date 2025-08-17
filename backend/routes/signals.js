import express from 'express';
import { logger } from '../utils/logger.js';
import { dbManager } from '../server.js';
import { signalQueue } from '../server.js';
import { mt5Manager } from '../server.js';

const router = express.Router();

// GET /api/signals - Get all signals
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0, status, symbol } = req.query;
    
    let signals = await dbManager.getSignals(parseInt(limit), parseInt(offset));
    
    // Apply filters
    if (status) {
      signals = signals.filter(s => s.status === status);
    }
    
    if (symbol) {
      signals = signals.filter(s => s.symbol.toLowerCase().includes(symbol.toLowerCase()));
    }
    
    res.json({
      success: true,
      signals,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: signals.length
      }
    });
  } catch (error) {
    logger.error('Error getting signals:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// GET /api/signals/stats - Get signal statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await dbManager.getSignalStats();
    const queueStatus = await signalQueue.getQueueStatus();
    const mt5Status = mt5Manager.getConnectionStatus();
    
    res.json({
      success: true,
      signals: stats,
      queue: queueStatus,
      mt5: {
        connections: Object.keys(mt5Status).length,
        status: mt5Status
      }
    });
  } catch (error) {
    logger.error('Error getting signal stats:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// GET /api/signals/:id - Get signal by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const signal = await dbManager.getSignalById(id);
    
    if (!signal) {
      return res.status(404).json({ 
        error: 'Signal not found',
        message: `Signal with ID ${id} not found` 
      });
    }
    
    res.json({
      success: true,
      signal
    });
  } catch (error) {
    logger.error('Error getting signal by ID:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// POST /api/signals - Create manual signal
router.post('/', async (req, res) => {
  try {
    const signalData = req.body;
    
    // Validate required fields
    const requiredFields = ['action', 'symbol', 'entry'];
    const missingFields = requiredFields.filter(field => !signalData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing: missingFields 
      });
    }
    
    // Generate unique signal ID
    const signalId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Prepare signal
    const signal = {
      id: signalId,
      action: signalData.action.toUpperCase(),
      symbol: signalData.symbol.toUpperCase(),
      entry: parseFloat(signalData.entry),
      target: signalData.target ? parseFloat(signalData.target) : null,
      stop: signalData.stop ? parseFloat(signalData.stop) : null,
      timeframe: signalData.timeframe || '15',
      source: 'manual',
      notes: signalData.notes || '',
      timestamp: new Date().toISOString()
    };
    
    // Add to signal queue
    const result = await signalQueue.addSignal(signal);
    
    logger.info('Manual signal created successfully', { 
      signalId, 
      jobId: result.jobId 
    });
    
    res.json({
      success: true,
      message: 'Manual signal created and queued',
      signalId,
      jobId: result.jobId,
      signal
    });
    
  } catch (error) {
    logger.error('Error creating manual signal:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// PUT /api/signals/:id/status - Update signal status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        error: 'Status is required' 
      });
    }
    
    await dbManager.updateSignalStatus(id, status);
    
    logger.info('Signal status updated', { signalId: id, status });
    
    res.json({
      success: true,
      message: 'Signal status updated successfully',
      signalId: id,
      status
    });
    
  } catch (error) {
    logger.error('Error updating signal status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// POST /api/signals/:id/retry - Retry failed signal
router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get signal from database
    const signal = await dbManager.getSignalById(id);
    
    if (!signal) {
      return res.status(404).json({ 
        error: 'Signal not found',
        message: `Signal with ID ${id} not found` 
      });
    }
    
    // Create new signal object for retry
    const retrySignal = {
      id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: signal.action,
      symbol: signal.symbol,
      entry: signal.entry,
      target: signal.target,
      stop: signal.stop,
      timeframe: signal.timeframe || '15',
      source: 'retry',
      originalSignalId: id,
      timestamp: new Date().toISOString()
    };
    
    // Add to signal queue
    const result = await signalQueue.addSignal(retrySignal);
    
    logger.info('Signal retry queued successfully', { 
      originalId: id,
      retryId: retrySignal.id, 
      jobId: result.jobId 
    });
    
    res.json({
      success: true,
      message: 'Signal retry queued successfully',
      originalId: id,
      retryId: retrySignal.id,
      jobId: result.jobId
    });
    
  } catch (error) {
    logger.error('Error retrying signal:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// GET /api/signals/mt5/status - Get MT5 connection status
router.get('/mt5/status', (req, res) => {
  try {
    const status = mt5Manager.getConnectionStatus();
    
    res.json({
      success: true,
      connections: Object.keys(status).length,
      status
    });
  } catch (error) {
    logger.error('Error getting MT5 status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// POST /api/signals/mt5/disconnect - Disconnect MT5 connection
router.post('/mt5/disconnect/:connectionId', (req, res) => {
  try {
    const { connectionId } = req.params;
    
    // This would need to be implemented in the MT5 manager
    // For now, just return success
    logger.info('MT5 disconnect requested', { connectionId });
    
    res.json({
      success: true,
      message: 'MT5 disconnect requested',
      connectionId
    });
    
  } catch (error) {
    logger.error('Error disconnecting MT5:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

export { router as signalRoutes };
