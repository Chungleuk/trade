import { useState, useEffect, useCallback } from 'react';
import { TradingAlert } from '../types/alert';
import { AlertParsingService } from '../services/alertParsingService';
import { AlertService } from '../services/alertService';

export const useSimpleWebhook = () => {
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isPolling, setIsPolling] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  // Generate webhook URL on component mount
  useEffect(() => {
    const generateUrl = async () => {
      // For simplicity, we'll use a manual approach
      // User can set up their own webhook URL using services like:
      // - Webhook.site (temporary)
      // - Zapier webhooks
      // - IFTTT webhooks
      // - Or any simple webhook service
      
      const baseUrl = window.location.origin;
      const simpleWebhookUrl = `${baseUrl}/webhook-receiver`;
      setWebhookUrl(simpleWebhookUrl);
    };

    generateUrl();
  }, []);

  // Manual alert submission function
  const submitAlert = useCallback(async (alertData: string | object) => {
    try {
      let parsedData;
      
      if (typeof alertData === 'string') {
        try {
          parsedData = JSON.parse(alertData);
        } catch {
          // If it's not JSON, treat as raw message
          parsedData = { message: alertData };
        }
      } else {
        parsedData = alertData;
      }

      const alert = AlertParsingService.parseAlert(parsedData);
      
      if (!alert) {
        throw new Error('Unable to parse alert data');
      }

      if (!AlertParsingService.validateAlert(alert)) {
        throw new Error('Alert data is missing required fields');
      }

      const { data, error } = await AlertService.createAlert(alert);
      
      if (error) {
        throw new Error(error);
      }

      return { success: true, alert: data };
    } catch (error) {
      console.error('Error submitting alert:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  // Test alert function
  const testAlert = useCallback(() => {
    const testData = {
      action: 'BUY',
      symbol: 'EURUSD',
      timeframe: '15',
      entry: '1.1565',
      target: '1.1598',
      stop: '1.1532',
      id: `test_${Date.now()}`,
      rr: '1.2',
      risk: '1%'
    };

    return submitAlert(testData);
  }, [submitAlert]);

  return {
    webhookUrl,
    isPolling,
    lastChecked,
    submitAlert,
    testAlert,
  };
};