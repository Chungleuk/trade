import React, { useState } from 'react';
import { Search, Filter, TrendingUp, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { TradingAlert } from '../types/alert';
import { AlertCard } from './AlertCard';

interface AlertsListProps {
  alerts: TradingAlert[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onUpdateStatus?: (alertId: string, status: 'active' | 'completed' | 'stopped') => void;
  onMarkOutcome?: (alertId: string, outcome: 'win' | 'loss' | 'breakeven') => void;
  onDelete?: (alertId: string) => void;
}

export const AlertsList: React.FC<AlertsListProps> = ({ 
  alerts, 
  loading = false, 
  error, 
  onRefresh, 
  onUpdateStatus, 
  onMarkOutcome,
  onDelete 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'completed' | 'stopped'>('ALL');

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterAction === 'ALL' || alert.action === filterAction;
    const matchesStatus = filterStatus === 'ALL' || alert.status === filterStatus;
    return matchesSearch && matchesFilter && matchesStatus;
  });

  const LoadingState = () => (
    <div className="text-center py-16">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Loading alerts...</h3>
      <p className="text-gray-600">Please wait while we fetch your trading alerts.</p>
    </div>
  );

  const ErrorState = () => (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading alerts</h3>
      <p className="text-gray-600 mb-4">{error}</p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <TrendingUp className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts yet</h3>
      <p className="text-gray-600 max-w-sm mx-auto">
        Configure your TradingView alerts to start receiving signals. Once set up, your alerts will appear here in real-time.
      </p>
    </div>
  );

  const NoResultsState = () => (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts match your filters</h3>
      <p className="text-gray-600">Try adjusting your search terms or filters.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Trading Alerts ({alerts.length})
            </h2>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                title="Refresh alerts"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          <p className="text-gray-600 text-sm mt-1">
            Real-time alerts from your TradingView strategies
          </p>
        </div>

        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as 'ALL' | 'BUY' | 'SELL')}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="ALL">All Actions</option>
              <option value="BUY">Buy Only</option>
              <option value="SELL">Sell Only</option>
            </select>
          </div>
          
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'ALL' | 'active' | 'completed' | 'stopped')}
              className="pl-4 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="ALL">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState />
        ) : alerts.length === 0 ? (
          <EmptyState />
        ) : filteredAlerts.length === 0 ? (
          <NoResultsState />
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard 
              key={alert.id} 
              alert={alert} 
              onUpdateStatus={onUpdateStatus}
              onMarkOutcome={onMarkOutcome}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
};