import React, { useState } from 'react';
import { Activity, BarChart3 } from 'lucide-react';
import { SimpleWebhookDisplay } from './components/SimpleWebhookDisplay';
import { SetupInstructions } from './components/SetupInstructions';
import { AlertsList } from './components/AlertsList';
import { StatusNotification } from './components/StatusNotification';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { useWebhookAlerts } from './hooks/useWebhookAlerts';

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
    deleteAlert 
  } = useWebhookAlerts();
  
  const [activeTab, setActiveTab] = useState<'alerts' | 'analytics' | 'setup'>('alerts');
  const [analyticsRefreshTrigger, setAnalyticsRefreshTrigger] = useState(0);
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
      } else {
        showNotification('Failed to delete alert', 'error');
      }
    } else {
      console.log('User cancelled deletion');
    }
  };

  const handleMarkOutcome = async (alertId: string, outcome: 'win' | 'loss') => {
    const success = await updateAlertOutcome(alertId, outcome);
    if (success) {
      showNotification(`Alert marked as ${outcome} and completed`, 'success');
      setAnalyticsRefreshTrigger(prev => prev + 1); // Trigger analytics refresh
    } else {
      showNotification('Failed to mark alert outcome', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Activity className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Trading Alert Dashboard</h1>
            </div>
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
            <SimpleWebhookDisplay />
            
            <AlertsList
              alerts={alerts}
              loading={loading}
              error={error}
              onRefresh={fetchAlerts}
              onUpdateStatus={handleUpdateStatus}
              onMarkOutcome={handleMarkOutcome}
              onDelete={handleDeleteAlert}
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