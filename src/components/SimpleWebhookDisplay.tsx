import React, { useState } from 'react';
import { Copy, Check, Globe, Send, TestTube, AlertCircle } from 'lucide-react';
import { useSimpleWebhook } from '../hooks/useSimpleWebhook';

export const SimpleWebhookDisplay: React.FC = () => {
  const { webhookUrl, submitAlert, testAlert } = useSimpleWebhook();
  const [copied, setCopied] = useState(false);
  const [manualAlert, setManualAlert] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Get the correct webhook URL from Supabase
  const actualWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook`;

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Simple Webhook Setup
        </h2>
      </div>

      <div className="space-y-6">
        {/* Webhook URL Display */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            TradingView Webhook URL
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-sm text-gray-800 overflow-x-auto">
              {actualWebhookUrl}
            </div>
            <button
              onClick={copyWebhookUrl}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">
                {copied ? 'Copied!' : 'Copy'}
              </span>
            </button>
          </div>
        </div>

        {/* Manual Alert Submission */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Manual Alert Submission
          </label>
          <div className="space-y-3">
            <textarea
              value={manualAlert}
              onChange={(e) => setManualAlert(e.target.value)}
              placeholder='Paste your TradingView alert here (JSON format or raw message)...'
              className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={handleManualSubmit}
                disabled={!manualAlert.trim() || submitting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit Alert'}
              </button>
              <button
                onClick={handleTestAlert}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TestTube className="w-4 h-4" />
                {submitting ? 'Creating...' : 'Test Alert'}
              </button>
            </div>
          </div>
        </div>

        {/* Result Display */}
        {result && (
          <div className={`p-4 rounded-lg border ${
            result.success 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {result.success ? (
                <Check className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="font-medium">{result.message}</span>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Webhook Setup</h4>
          <div className="text-blue-800 text-sm space-y-2">
            <p><strong>For TradingView Webhooks:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Copy the webhook URL above</li>
              <li>In TradingView, create an alert and enable "Webhook URL"</li>
              <li>Paste the webhook URL into TradingView's webhook field</li>
              <li>Your alerts will automatically appear in the dashboard</li>
            </ul>
            <p className="mt-2"><strong>For Manual Testing:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Use the form above to manually submit alerts</li>
              <li>Click "Test Alert" to create sample data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};