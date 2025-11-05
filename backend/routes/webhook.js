import express from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { signalQueue } from '../server.js';
import { EmailService } from '../services/emailService.js';
import { SupabaseService } from '../services/supabaseService.js';

const router = express.Router();

// Initialize services
const emailService = new EmailService();
const supabaseService = new SupabaseService();

// Webhook secret for validation
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'tradingview-webhook-secret';

// Middleware to validate webhook signature
const validateWebhook = (req, res, next) => {
  const signature = req.headers['x-tradingview-signature'];
  const timestamp = req.headers['x-tradingview-timestamp'];
  
  if (!signature || !timestamp) {
    logger.warn('Missing webhook headers', { 
      signature: !!signature, 
      timestamp: !!timestamp 
    });
    return res.status(401).json({ error: 'Missing authentication headers' });
  }
  
  // Validate timestamp (prevent replay attacks)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 300000) { // 5 minutes
    logger.warn('Webhook timestamp too old', { 
      requestTime, 
      now, 
      difference: now - requestTime 
    });
    return res.status(401).json({ error: 'Request too old' });
  }
  
  // Validate signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(timestamp + JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== expectedSignature) {
    logger.warn('Invalid webhook signature', { 
      received: signature, 
      expected: expectedSignature 
    });
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
};

// POST /api/webhook/tradingview - Complete webhook handler (replaces Supabase Edge Function)
router.post('/tradingview', validateWebhook, async (req, res) => {
  try {
    const signalData = req.body;
    logger.info('Received TradingView webhook', { signalData });
    
    // Validate required fields
    const requiredFields = ['action', 'symbol', 'entry'];
    const missingFields = requiredFields.filter(field => !signalData[field]);
    
    if (missingFields.length > 0) {
      logger.warn('Missing required fields', { missingFields });
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing: missingFields 
      });
    }

    // Parse risk percentage
    let riskPercent = '0.65%';
    if (signalData.risk) {
      riskPercent = typeof signalData.risk === 'string' ? signalData.risk : `${signalData.risk}%`;
    }

    // Prepare alert data
    const alertData = {
      action: signalData.action.toUpperCase(),
      symbol: signalData.symbol.toUpperCase(),
      entry: parseFloat(signalData.entry),
      target: signalData.target ? parseFloat(signalData.target) : null,
      stop: signalData.stop ? parseFloat(signalData.stop) : null,
      timeframe: signalData.timeframe || '15',
      rr: signalData.rr || null,
      risk: riskPercent,
      rawMessage: JSON.stringify(signalData, null, 2)
    };

    // STEP 1: Save alert to Supabase (if available)
    let savedAlert = null;
    if (supabaseService.isAvailable()) {
      try {
        savedAlert = await supabaseService.saveAlert(alertData);
        logger.info('✅ Alert saved to Supabase', { id: savedAlert?.id });
      } catch (dbError) {
        logger.error('❌ Failed to save alert to Supabase:', dbError);
        // Continue even if database save fails
      }
    }

    // STEP 2: Send immediate email (first email)
    try {
      await emailService.sendImmediateAlert(alertData);
      logger.info('✅ Immediate alert email sent');
    } catch (emailError) {
      logger.error('❌ Failed to send immediate email:', emailError);
      // Continue even if email fails
    }

    // STEP 3: Generate unique signal ID and add to queue
    const signalId = savedAlert?.id || `tv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const signal = {
      id: signalId,
      ...alertData,
      source: 'tradingview',
      rawData: signalData,
      timestamp: new Date().toISOString()
    };
    
    // Add to signal queue
    const result = await signalQueue.addSignal(signal);
    logger.info('Signal queued successfully', { signalId, jobId: result.jobId });

    // Return response immediately
    res.json({
      success: true,
      message: 'Alert received, saved, and email sent.',
      signalId,
      jobId: result.jobId,
      alertId: savedAlert?.id || null
    });
    
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// GET /api/webhook/status
router.get('/status', async (req, res) => {
  try {
    const queueStatus = await signalQueue.getQueueStatus();
    
    res.json({
      success: true,
      queue: queueStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting webhook status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// POST /api/webhook/test
router.post('/test', (req, res) => {
  logger.info('Test webhook received', { body: req.body });
  
  res.json({
    success: true,
    message: 'Test webhook received successfully',
    timestamp: new Date().toISOString(),
    received: req.body
  });
});

export { router as webhookRoutes };
