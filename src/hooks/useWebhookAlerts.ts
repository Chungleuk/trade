import { useState, useEffect, useCallback } from 'react';
import { TradingAlert, WebhookConfig } from '../types/alert';
import { AlertService } from '../services/alertService';
import { AlertParsingService } from '../services/alertParsingService';

export const useWebhookAlerts = () => {
  const [alerts, setAlerts] = useState<TradingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook`,
    isActive: false
  });
  const [isConnected, setIsConnected] = useState(false);

  // Initialize webhook connection and load alerts
  useEffect(() => {
    const initializeConnection = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load existing alerts from database
        const { data, error: fetchError } = await AlertService.getAlerts({ limit: 100 });
        
        if (fetchError) {
          setError(fetchError);
        } else {
          setAlerts(data);
        }
        
        // Set up real-time subscription
        const subscription = AlertService.subscribeToAlerts((newAlert) => {
          setAlerts(prev => [newAlert, ...prev]);
          setWebhookConfig(prev => ({
            ...prev,
            lastReceived: newAlert.timestamp
          }));
        });
        
        setIsConnected(true);
        setWebhookConfig(prev => ({ ...prev, isActive: true }));
        
        // Cleanup function
        return () => {
          AlertService.unsubscribeFromAlerts(subscription);
          setIsConnected(false);
          setWebhookConfig(prev => ({ ...prev, isActive: false }));
        };
      } catch (err) {
        console.error('Error initializing connection:', err);
        setError('Failed to initialize connection');
      } finally {
        setLoading(false);
      }
    };
    
    const cleanup = initializeConnection();
    setIsConnected(true);
    setWebhookConfig(prev => ({ ...prev, isActive: true }));

    return () => {
      cleanup.then(cleanupFn => cleanupFn && cleanupFn());
    };
  }, []);

  // Function to handle new alerts from webhook
  const handleNewAlert = useCallback((rawAlertData: any) => {
    const createAlert = async () => {
      try {
        const { data: newAlert, error } = await AlertService.createAlertFromWebhook(rawAlertData);
        
        if (error) {
          console.error('Error creating alert:', error);
          setError(error);
          return;
        }
        
        if (newAlert) {
          // Alert will be added via real-time subscription
          // But we can also add it immediately for better UX
          setAlerts(prev => {
            // Check if alert already exists to avoid duplicates
            const exists = prev.some(alert => alert.id === newAlert.id);
            return exists ? prev : [newAlert, ...prev];
          });
          
          setWebhookConfig(prev => ({
            ...prev,
            lastReceived: newAlert.timestamp
          }));
        }
      } catch (err) {
        console.error('Error handling new alert:', err);
        setError('Failed to save alert');
      }
    };

    createAlert();
  }, []);

  // Function to test alert parsing with sample data
  const testAlertParsing = useCallback((sampleData: any) => {
    const parsedAlert = AlertParsingService.parseAlert(sampleData);
    console.log('Parsed alert:', parsedAlert);
    
    if (parsedAlert && AlertParsingService.validateAlert(parsedAlert)) {
      handleNewAlert(sampleData);
    } else {
      setError('Failed to parse sample alert data');
    }
  }, [handleNewAlert]);
  // Function to refresh alerts from database
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await AlertService.getAlerts({ limit: 100 });
      
      if (error) {
        setError(error);
      } else {
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setError('Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to update alert status
  const updateAlertStatus = useCallback(async (alertId: string, status: 'active' | 'completed' | 'stopped') => {
    try {
      const { data: updatedAlert, error } = await AlertService.updateAlert(alertId, { status });
      
      if (error) {
        setError(error);
        return false;
      }
      
      if (updatedAlert) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? updatedAlert : alert
        ));
      }
      
      return true;
    } catch (err) {
      console.error('Error updating alert status:', err);
      setError('Failed to update alert');
      return false;
    }
  }, []);

  // Function to delete an alert
  const deleteAlert = useCallback(async (alertId: string) => {
    try {
      const { error } = await AlertService.deleteAlert(alertId);
      
      if (error) {
        setError(error);
        return false;
      }
      
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      return true;
    } catch (err) {
      console.error('Error deleting alert:', err);
      setError('Failed to delete alert');
      return false;
    }
  }, []);

  // Function to clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setError(null);
  }, []);

  return {
    alerts,
    loading,
    error,
    webhookConfig,
    isConnected,
    handleNewAlert,
    fetchAlerts,
    updateAlertStatus,
    deleteAlert,
    clearAlerts
  };
};