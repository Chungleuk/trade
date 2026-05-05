import React, { useState } from 'react';
import { Activity, BarChart3 } from 'lucide-react';
import { ManualSignalForm } from './components/ManualSignalForm';
import { PositionSizingModeToggle } from './components/PositionSizingModeToggle';
import { SimpleWebhookDisplay } from './components/SimpleWebhookDisplay';
import { SetupInstructions } from './components/SetupInstructions';
import { AlertsList } from './components/AlertsList';
import { StatusNotification } from './components/StatusNotification';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { useWebhookAlerts } from './hooks/useWebhookAlerts';
import { AlertService } from './services/alertService';
import { cleanupOrphanedNodes } from './services/positionSizingService';

function App() {
  const { 
    alerts, 
    loading, 
    error, 
    webhookConfig, 
    isConnected, 
    fetchAlerts, 
    updateAlertStatus, 
    updateAlertOutcome,
    updateAlertMessage,
    deleteAlert 
  } = useWebhookAlerts();
  
  const [activeTab, setActiveTab] = useState<'alerts' | 'analytics' | 'setup'>('alerts');
  const [analyticsRefreshTrigger, setAnalyticsRefreshTrigger] = useState(0);
  /** Bumps when an alert outcome updates sizing so ManualSignalForm can refetch that pair’s node */
  const [positionSizingNonce, setPositionSizingNonce] = useState(0);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ message, type, isVisible: true });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };

  const handleUpdateStatus = async (alertId: string, status: 'active' | 'completed' | 'stopped') => {
    const success = await updateAlertStatus(alertId, status);
    if (success) {
      showNotification(`Alert marked as ${status}`, 'success');
      setAnalyticsRefreshTrigger(prev => prev + 1); // Trigger analytics refresh
    } else {
      showNotification('Failed to update alert status', 'error');
    }
  };

  const handleSaveManualMessage = async (alertId: string, message: string) => {
    const ok = await updateAlertMessage(alertId, message);
    if (ok) showNotification('Notes saved', 'success');
    else showNotification('Failed to save notes', 'error');
    return ok;
  };

  const handleDeleteAlert = async (alertId: string) => {
    console.log('handleDeleteAlert called with alertId:', alertId);
    console.log('Current alerts count:', alerts.length);
    console.log('deleteAlert function available:', !!deleteAlert);
    
    if (window.confirm('Are you sure you want to delete this alert?')) {
      console.log('User confirmed deletion');
      const success = await deleteAlert(alertId);
      console.log('Delete result:', success);
      if (success) {
        showNotification('Alert deleted successfully', 'success');
        setAnalyticsRefreshTrigger(prev => prev + 1); // Trigger analytics refresh
        setPositionSizingNonce((n) => n + 1);
      } else {
        showNotification('Failed to delete alert', 'error');
      }
    } else {
      console.log('User cancelled deletion');
    }
  };

  const handleMarkOutcome = async (alertId: string, outcome: 'win' | 'loss') => {
    const result = await updateAlertOutcome(alertId, outcome);
    if (result.success) {
      const sym = result.pairKey ? ` for ${result.pairKey}` : '';
      const riskHint =
        result.nextSuggestedRiskPercent != null
          ? ` Next suggested risk${sym}: ${result.nextSuggestedRiskPercent}%.`
          : '';
      showNotification(`Alert marked as ${outcome} and completed.${riskHint}`, 'success');
      setAnalyticsRefreshTrigger(prev => prev + 1); // Trigger analytics refresh
      setPositionSizingNonce((n) => n + 1);
    } else {
      showNotification('Failed to mark alert outcome', 'error');
    }
  };

  const handleDeleteByGroup = async (symbol: string) => {
    try {
      const { deletedCount, error } = await AlertService.deleteAlertsBySymbol(symbol);
      
      if (error) {
        showNotification(`Failed to delete alerts: ${error}`, 'error');
        return;
      }
      
      if (deletedCount === 0) {
        showNotification(`No alerts found for ${symbol}`, 'info');
        return;
      }
      
      // Clean up orphaned position sizing state
      await cleanupOrphanedNodes();
      
      // Refresh alerts
      await fetchAlerts();
      
      // Trigger analytics refresh
      setAnalyticsRefreshTrigger(prev => prev + 1);
      setPositionSizingNonce((n) => n + 1);
      
      showNotification(`Successfully deleted ${deletedCount} alert(s) for ${symbol}`, 'success');
    } catch (err) {
      console.error('Error deleting alerts by group:', err);
      showNotification('Failed to delete alerts by group', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center gap-3 min-h-16 py-2">
            <div className="flex items-center min-w-0">
              <Activity className="w-8 h-8 text-blue-600 mr-3 shrink-0" />
              <h1 className="text-xl font-semibold text-gray-900">Trading Alert Dashboard</h1>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <PositionSizingModeToggle
                onModeApplied={() => setPositionSizingNonce((n) => n + 1)}
              />
              <div className="flex items-center space-x-4">
              <div className={`px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                activeTab === 'alerts' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`} onClick={() => setActiveTab('alerts')}>
                <Activity className="w-4 h-4 inline mr-2" />
                Alerts
              </div>
              <div className={`px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                activeTab === 'analytics' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`} onClick={() => setActiveTab('analytics')}>
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Analytics
              </div>
              <div className={`px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                activeTab === 'setup' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`} onClick={() => setActiveTab('setup')}>
                Setup
              </div>
            </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Notification */}
        <StatusNotification
          message={notification.message}
          type={notification.type}
          isVisible={notification.isVisible}
          onClose={hideNotification}
        />

        {/* Tab Content */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <ManualSignalForm
              onSaved={fetchAlerts}
              onNotify={showNotification}
              sizingStateNonce={positionSizingNonce}
              onSizingStateChanged={() => setPositionSizingNonce((n) => n + 1)}
            />
            <SimpleWebhookDisplay />
            
            <AlertsList
              alerts={alerts}
              loading={loading}
              error={error}
              onRefresh={fetchAlerts}
              onUpdateStatus={handleUpdateStatus}
              onMarkOutcome={handleMarkOutcome}
              onDelete={handleDeleteAlert}
              onDeleteByGroup={handleDeleteByGroup}
              onSaveManualMessage={handleSaveManualMessage}
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard refreshTrigger={analyticsRefreshTrigger} />
        )}

        {activeTab === 'setup' && (
          <SetupInstructions />
        )}
      </main>
    </div>
  );
}

export default App;