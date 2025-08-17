import React, { useState } from 'react';
import { Plus, Send, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface SignalForm {
  action: 'BUY' | 'SELL';
  symbol: string;
  entry: string;
  target: string;
  stop: string;
  timeframe: string;
  notes: string;
}

interface SignalResponse {
  success: boolean;
  message: string;
  signalId?: string;
  jobId?: string;
}

export const ManualSignalControl: React.FC = () => {
  const [form, setForm] = useState<SignalForm>({
    action: 'BUY',
    symbol: '',
    entry: '',
    target: '',
    stop: '',
    timeframe: '15',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<SignalResponse | null>(null);
  const [showForm, setShowForm] = useState(false);

  const commonSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'GBPJPY', 'EURJPY', 'AUDUSD', 'NZDUSD'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResponse(null);

    try {
      // Validate form
      if (!form.symbol || !form.entry) {
        throw new Error('Symbol and Entry are required');
      }

      if (parseFloat(form.entry) <= 0) {
        throw new Error('Entry price must be greater than 0');
      }

      // Prepare signal data
      const signalData = {
        action: form.action,
        symbol: form.symbol.toUpperCase(),
        entry: parseFloat(form.entry),
        target: form.target ? parseFloat(form.target) : null,
        stop: form.stop ? parseFloat(form.stop) : null,
        timeframe: parseInt(form.timeframe),
        notes: form.notes
      };

      // Send to backend
      const response = await fetch('/api/signals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || 'demo-token'}`
        },
        body: JSON.stringify(signalData)
      });

      const result = await response.json();

      if (result.success) {
        setResponse({
          success: true,
          message: 'Signal created successfully!',
          signalId: result.signalId,
          jobId: result.jobId
        });
        
        // Reset form
        setForm({
          action: 'BUY',
          symbol: '',
          entry: '',
          target: '',
          stop: '',
          timeframe: '15',
          notes: ''
        });
        
        setShowForm(false);
      } else {
        throw new Error(result.message || 'Failed to create signal');
      }

    } catch (error) {
      setResponse({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof SignalForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const quickSymbolSelect = (symbol: string) => {
    setForm(prev => ({ ...prev, symbol }));
  };

  const calculateRiskReward = () => {
    if (!form.entry || !form.target || !form.stop) return null;

    const entry = parseFloat(form.entry);
    const target = parseFloat(form.target);
    const stop = parseFloat(form.stop);

    if (form.action === 'BUY') {
      const risk = entry - stop;
      const reward = target - entry;
      return risk > 0 ? (reward / risk).toFixed(2) : null;
    } else {
      const risk = stop - entry;
      const reward = entry - target;
      return risk > 0 ? (reward / risk).toFixed(2) : null;
    }
  };

  const riskReward = calculateRiskReward();

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Manual Signal Control</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Hide Form' : 'Create Signal'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Quick Symbol Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Symbol Selection
              </label>
              <div className="flex flex-wrap gap-2">
                {commonSymbols.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => quickSymbolSelect(symbol)}
                    className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                      form.symbol === symbol
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>

            {/* Signal Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action
                </label>
                <select
                  value={form.action}
                  onChange={(e) => handleInputChange('action', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symbol
                </label>
                <input
                  type="text"
                  value={form.symbol}
                  onChange={(e) => handleInputChange('symbol', e.target.value)}
                  placeholder="e.g., EURUSD"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entry Price
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={form.entry}
                  onChange={(e) => handleInputChange('entry', e.target.value)}
                  placeholder="e.g., 1.12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframe (minutes)
                </label>
                <select
                  value={form.timeframe}
                  onChange={(e) => handleInputChange('timeframe', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1">1m</option>
                  <option value="5">5m</option>
                  <option value="15">15m</option>
                  <option value="30">30m</option>
                  <option value="60">1h</option>
                  <option value="240">4h</option>
                  <option value="1440">1d</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Price
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={form.target}
                  onChange={(e) => handleInputChange('target', e.target.value)}
                  placeholder="e.g., 1.12500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stop Loss
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={form.stop}
                  onChange={(e) => handleInputChange('stop', e.target.value)}
                  placeholder="e.g., 1.12000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Risk/Reward Display */}
            {riskReward && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Risk/Reward Ratio:</span>
                  <span className={`text-lg font-bold ${
                    parseFloat(riskReward) >= 2 ? 'text-green-600' : 
                    parseFloat(riskReward) >= 1.5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    1:{riskReward}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {parseFloat(riskReward) >= 2 ? 'Excellent R:R ratio' :
                   parseFloat(riskReward) >= 1.5 ? 'Good R:R ratio' : 'Consider adjusting targets'}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Add any additional notes about this signal..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Response Message */}
            {response && (
              <div className={`p-4 rounded-lg ${
                response.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {response.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-medium ${
                    response.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {response.message}
                  </span>
                </div>
                {response.success && response.signalId && (
                  <div className="mt-2 text-sm text-green-700">
                    Signal ID: {response.signalId}
                    {response.jobId && ` | Job ID: ${response.jobId}`}
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isSubmitting ? 'Creating Signal...' : 'Create Signal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
