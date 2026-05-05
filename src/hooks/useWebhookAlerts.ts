import { useState, useEffect, useCallback } from 'react';
import { TradingAlert, WebhookConfig } from '../types/alert';
import { AlertService } from '../services/alertService';
import { AlertParsingService } from '../services/alertParsingService';
import { getPositionSizingMode, resolveSizingGroupKey } from '../lib/positionSizingMode';
import { getCurrentNode, getRiskPercentForNode, advanceNode, upsertNode } from '../services/positionSizingService';

export const useWebhookAlerts = () => {
  const [alerts, setAlerts] = useState<TradingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://trading-backend-4v0f.onrender.com';
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    url: `${backendUrl}/webhook`,
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
    // Optimistic UI update
    let previousAlert: TradingAlert | undefined;
    setAlerts(prev => prev.map(a => {
      if (a.id === alertId) {
        previousAlert = a;
        return { ...a, status };
      }
      return a;
    }));

    try {
      const { data: updatedAlert, error } = await AlertService.updateAlert(alertId, { status });
      if (error || !updatedAlert) {
        // Revert on failure
        setAlerts(prev => prev.map(a => (a.id === alertId && previousAlert ? previousAlert : a)));
        // Do not set global error to avoid collapsing the list UI; caller will show a toast
        return false;
      }

      // Ensure we keep any client-only fields while merging
      setAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, ...updatedAlert } : a)));

      // Final consistency sync from DB
      try {
        const { data: fresh } = await AlertService.getAlerts({ limit: 100 });
        if (fresh && Array.isArray(fresh)) setAlerts(fresh);
      } catch {}
      return true;
    } catch (err) {
      console.error('Error updating alert status:', err);
      // Revert on exception
      setAlerts(prev => prev.map(a => (a.id === alertId && previousAlert ? previousAlert : a)));
      // Do not set global error; caller will show a toast
      return false;
    }
  }, []);

  // Function to delete an alert
  const deleteAlert = useCallback(async (alertId: string) => {
    try {
      // Optimistically remove from UI first
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      
      const { error } = await AlertService.deleteAlert(alertId);
      
      if (error) {
        // If delete failed, restore the alert in UI
        const { data: restoredAlerts } = await AlertService.getAlerts({ limit: 100 });
        setAlerts(restoredAlerts);
        setError(error);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error deleting alert:', err);
      // If delete failed, restore the alerts
      const { data: restoredAlerts } = await AlertService.getAlerts({ limit: 100 });
      setAlerts(restoredAlerts);
      setError('Failed to delete alert');
      return false;
    }
  }, []);

  // Function to update alert outcome
  const updateAlertOutcome = useCallback(
    async (
      alertId: string,
      outcome: 'win' | 'loss' | 'breakeven'
    ): Promise<{ success: boolean; nextSuggestedRiskPercent?: string; pairKey?: string }> => {
    // Optimistic UI update - also set status to completed when marking outcome
    let previousAlert: TradingAlert | undefined;
    setAlerts(prev => prev.map(a => {
      if (a.id === alertId) {
        previousAlert = a;
        return { ...a, outcome, status: 'completed' };
      }
      return a;
    }));

    try {
      // Update both outcome and status to completed
      const { data: updatedAlert, error } = await AlertService.updateAlert(alertId, { 
        outcome, 
        status: 'completed' 
      });
      if (error || !updatedAlert) {
        // Revert on failure
        setAlerts(prev => prev.map(a => (a.id === alertId && previousAlert ? previousAlert : a)));
        // Do not set global error; caller will show a toast
        return { success: false };
      }

      let nextSuggestedRiskPercent: string | undefined;
      let pairKey: string | undefined;
      try {
        pairKey = resolveSizingGroupKey(updatedAlert.symbol, getPositionSizingMode());
        const currentNode = await getCurrentNode(pairKey);
        const nextNode = advanceNode(currentNode, outcome);
        await upsertNode(pairKey, nextNode);
        nextSuggestedRiskPercent = getRiskPercentForNode(nextNode).toFixed(2);
      } catch (e) {
        console.warn('Failed to advance position sizing node:', e);
      }

      setAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, ...updatedAlert } : a)));

      // Final consistency sync from DB
      try {
        const { data: fresh } = await AlertService.getAlerts({ limit: 100 });
        if (fresh && Array.isArray(fresh)) setAlerts(fresh);
      } catch {}
      return { success: true, nextSuggestedRiskPercent, pairKey };
    } catch (err) {
      console.error('Error updating alert outcome:', err);
      // Revert on exception
      setAlerts(prev => prev.map(a => (a.id === alertId && previousAlert ? previousAlert : a)));
      // Do not set global error; caller will show a toast
      return { success: false };
    }
  },
  []);


  // Function to clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setError(null);
  }, []);

  /** Update stored `message` (e.g. manual signal notes). */
  const updateAlertMessage = useCallback(async (alertId: string, message: string) => {
    let previousAlert: TradingAlert | undefined;
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id === alertId) {
          previousAlert = a;
          return { ...a, message };
        }
        return a;
      })
    );

    try {
      const { data: updatedAlert, error } = await AlertService.updateAlert(alertId, { message });
      if (error || !updatedAlert) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId && previousAlert ? previousAlert : a))
        );
        return false;
      }
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, ...updatedAlert } : a)));
      try {
        const { data: fresh } = await AlertService.getAlerts({ limit: 100 });
        if (fresh && Array.isArray(fresh)) setAlerts(fresh);
      } catch {
        /* ignore */
      }
      return true;
    } catch (err) {
      console.error('Error updating alert message:', err);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId && previousAlert ? previousAlert : a))
      );
      return false;
    }
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
    updateAlertOutcome,
    deleteAlert,
    clearAlerts,
    updateAlertMessage
  };
};