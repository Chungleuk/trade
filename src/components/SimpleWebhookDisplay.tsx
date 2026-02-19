import React, { useState } from 'react';
import { Copy, Check, Globe, Send, TestTube, AlertCircle } from 'lucide-react';
import { useSimpleWebhook } from '../hooks/useSimpleWebhook';

export const SimpleWebhookDisplay: React.FC = () => {
  const { webhookUrl, submitAlert, testAlert } = useSimpleWebhook();
  const [copied, setCopied] = useState(false);
  const [manualAlert, setManualAlert] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Use Render backend (no Supabase Edge Function - free tier)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://trading-backend-4v0f.onrender.com';
  const actualWebhookUrl = `${backendUrl}/webhook`;

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(actualWebhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy webhook URL:', error);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualAlert.trim()) return;

    setSubmitting(true);
    setResult(null);

    try {
      const response = await submitAlert(manualAlert);
      
      if (response.success) {
        setResult({ success: true, message: 'Alert submitted successfully!' });
        setManualAlert('');
      } else {
        setResult({ success: false, message: response.error || 'Failed to submit alert' });
      }
    } catch (error) {
      setResult({ success: false, message: 'Error submitting alert' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestAlert = async () => {
    setSubmitting(true);
    setResult(null);

    try {
      const response = await testAlert();
      
      if (response.success) {
        setResult({ success: true, message: 'Test alert created successfully!' });
      } else {
        setResult({ success: false, message: response.error || 'Failed to create test alert' });
      }
    } catch (error) {
      setResult({ success: false, message: 'Error creating test alert' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Webhook Setup
        </h2>
      </div>

      <div className="space-y-4">
        {/* Webhook URL Display */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            TradingView Webhook URL
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono text-sm text-gray-800 overflow-x-auto">
              {actualWebhookUrl}
            </div>
            <button
              onClick={copyWebhookUrl}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {copied ? 'Copied!' : 'Copy'}
              </span>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleTestAlert}
            disabled={submitting}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
          >
            <TestTube className="w-4 h-4" />
            Test Alert
          </button>
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="text"
              placeholder="Paste alert JSON here..."
              value={manualAlert}
              onChange={(e) => setManualAlert(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              onClick={handleManualSubmit}
              disabled={submitting || !manualAlert.trim()}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`p-3 rounded-lg text-sm ${
            result.success 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {result.success ? (
                <Check className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {result.message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};