import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { WebhookDisplay } from './components/WebhookDisplay';
import { SetupInstructions } from './components/SetupInstructions';
import { AlertsList } from './components/AlertsList';
import { StatusNotification } from './components/StatusNotification';
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
    deleteAlert 
  } = useWebhookAlerts();
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
    } else {
      showNotification('Failed to update alert status', 'error');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      const success = await deleteAlert(alertId);
      if (success) {
        showNotification('Alert deleted successfully', 'success');
      } else {
        showNotification('Failed to delete alert', 'error');
      }
    }
  };

  const handleRefresh = () => {
    fetchAlerts();
  };

  // Show error notification when there's a database error
  React.useEffect(() => {
    if (error) {
      showNotification(error, 'error');
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50">
      <StatusNotification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  TradingView Alert Receiver
                </h1>
                <p className="text-sm text-gray-600">
                  Real-time trading alerts dashboard
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Webhook Configuration */}
          <WebhookDisplay
            webhookUrl={webhookConfig.url}
            isActive={webhookConfig.isActive}
            lastReceived={webhookConfig.lastReceived}
          />

          {/* Setup Instructions */}
          <SetupInstructions />

          {/* Alerts List */}
          <AlertsList 
            alerts={alerts} 
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            onUpdateStatus={handleUpdateStatus}
            onDelete={handleDeleteAlert}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>TradingView Alert Receiver Dashboard - Built for professional traders</p>
            <p className="mt-1">Connect your strategies and receive real-time alerts</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;