import React from 'react';
import { TrendingUp, TrendingDown, Clock, Target, Shield, DollarSign, MoreVertical, CheckCircle, XCircle, Trash2, Trophy, TrendingDown as LossIcon, Minus } from 'lucide-react';
import { TradingAlert } from '../types/alert';

interface AlertCardProps {
  alert: TradingAlert;
  onUpdateStatus?: (alertId: string, status: 'active' | 'completed' | 'stopped') => void;
  onMarkOutcome?: (alertId: string, outcome: 'win' | 'loss' | 'breakeven') => void;
  onDelete?: (alertId: string) => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert, onUpdateStatus, onMarkOutcome, onDelete }) => {
  const [showActions, setShowActions] = React.useState(false);
  const isBuy = alert.action === 'BUY';
  const actionColor = isBuy ? 'text-green-600' : 'text-red-600';
  const borderColor = isBuy ? 'border-l-green-500' : 'border-l-red-500';
  const bgColor = isBuy ? 'bg-green-50' : 'bg-red-50';

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'stopped':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  const getOutcomeDisplay = (outcome?: string) => {
    switch (outcome) {
      case 'win':
        return { icon: Trophy, color: 'text-green-600 bg-green-100', label: 'WIN' };
      case 'loss':
        return { icon: LossIcon, color: 'text-red-600 bg-red-100', label: 'LOSS' };
      case 'breakeven':
        return { icon: Minus, color: 'text-yellow-600 bg-yellow-100', label: 'BREAKEVEN' };
      default:
        return null;
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const { date, time } = formatDate(alert.timestamp);
  const outcomeDisplay = getOutcomeDisplay(alert.outcome);

  return (
    <div className={`bg-white border-l-4 ${borderColor} rounded-lg shadow-sm hover:shadow-md transition-shadow p-6`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${bgColor}`}>
              {isBuy ? (
                <TrendingUp className={`w-5 h-5 ${actionColor}`} />
              ) : (
                <TrendingDown className={`w-5 h-5 ${actionColor}`} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium text-gray-900">{alert.symbol}</span>
                <span>•</span>
                <span>{alert.timeframe}m</span>
                <span>•</span>
                <span>ID: {alert.id}</span>
                {alert.status && (
                  <>
                    <span>•</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
                      {alert.status.toUpperCase()}
                    </span>
                  </>
                )}
                {outcomeDisplay && (
                  <>
                    <span>•</span>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${outcomeDisplay.color}`}>
                      <outcomeDisplay.icon className="w-3 h-3" />
                      {outcomeDisplay.label}
                    </div>
                  </>
                )}
              </div>
              <div className={`text-lg font-semibold ${actionColor}`}>
                {alert.action}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {alert.target && (
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-gray-600">Target</div>
                  <div className="font-medium">{alert.target}</div>
                </div>
              </div>
            )}
            {alert.stop && (
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-gray-600">Stop Loss</div>
                  <div className="font-medium">{alert.stop}</div>
                </div>
              </div>
            )}
            {alert.rr && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-gray-600">R:R</div>
                  <div className="font-medium">{alert.rr}</div>
                </div>
              </div>
            )}
            {alert.risk && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 text-gray-400">%</div>
                <div>
                  <div className="text-gray-600">Risk</div>
                  <div className="font-medium">{alert.risk}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {alert.entry}
          </div>
          <div className="text-sm text-gray-600">Entry Price</div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
            <Clock className="w-3 h-3" />
            <span>{date}</span>
            <span>{time}</span>
          </div>
          
          {(onUpdateStatus || onDelete) && (
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {showActions && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                  {onMarkOutcome && (
                    <>
                      <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Mark Outcome
                      </div>
                      {alert.outcome !== 'win' && (
                        <button
                          onClick={() => {
                            onMarkOutcome(alert.id, 'win');
                            setShowActions(false);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
                        >
                          <Trophy className="w-4 h-4" />
                          Mark as Win
                        </button>
                      )}
                      {alert.outcome !== 'loss' && (
                        <button
                          onClick={() => {
                            onMarkOutcome(alert.id, 'loss');
                            setShowActions(false);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LossIcon className="w-4 h-4" />
                          Mark as Loss
                        </button>
                      )}
                      {alert.outcome !== 'breakeven' && (
                        <button
                          onClick={() => {
                            onMarkOutcome(alert.id, 'breakeven');
                            setShowActions(false);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-yellow-600 hover:bg-yellow-50 transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                          Mark as Breakeven
                        </button>
                      )}
                      <hr className="my-1" />
                    </>
                  )}
                  {onUpdateStatus && alert.status !== 'completed' && (
                    <button
                      onClick={() => {
                        onUpdateStatus(alert.id, 'completed');
                        setShowActions(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark Completed
                    </button>
                  )}
                  {onUpdateStatus && alert.status !== 'stopped' && (
                    <button
                      onClick={() => {
                        onUpdateStatus(alert.id, 'stopped');
                        setShowActions(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Mark Stopped
                    </button>
                  )}
                  {onUpdateStatus && alert.status !== 'active' && (
                    <button
                      onClick={() => {
                        onUpdateStatus(alert.id, 'active');
                        setShowActions(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                      Mark Active
                    </button>
                  )}
                  {onDelete && (
                    <>
                      <hr className="my-1" />
                      <button
                        onClick={() => {
                          onDelete(alert.id);
                          setShowActions(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Alert
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {alert.message && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-700">
            {alert.message}
            {alert.strategyName && (
              <div className="text-xs text-gray-500 mt-1">
                Strategy: {alert.strategyName}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Click outside to close actions menu */}
      {showActions && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowActions(false)}
        />
      )}
    </div>
  );
};