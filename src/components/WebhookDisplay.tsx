import React, { useState } from 'react';
import { Copy, Check, Globe, Settings } from 'lucide-react';

interface WebhookDisplayProps {
  webhookUrl: string;
  isActive: boolean;
  lastReceived?: string;
}

export const WebhookDisplay: React.FC<WebhookDisplayProps> = ({
  webhookUrl,
  isActive,
  lastReceived
}) => {
  const [copied, setCopied] = useState(false);

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy webhook URL:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Webhook Configuration
        </h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm text-gray-600">
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Webhook URL
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-sm text-gray-800 overflow-x-auto">
              {webhookUrl}
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

        {lastReceived && (
          <div className="text-sm text-gray-600">
            Last alert received: {new Date(lastReceived).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};