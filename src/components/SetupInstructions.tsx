import React from 'react';
import { BookOpen, ArrowRight, Code } from 'lucide-react';

export const SetupInstructions: React.FC = () => {
  const examplePayload = {
    action: "BUY",
    symbol: "EURUSD",
    timeframe: "15",
    entry: "1.1565",
    target: "1.1598",
    stop: "1.1532",
    id: "{{strategy.order.id}}",
    rr: "1.2",
    risk: "1%"
  };

  const tradingViewExample = `26/7/2025 Fixed Target/Stop Logic VIDYA Strategy (8, 14, 1.8, 10, close, 2, 5, 25, 1.8, 18, 6, 20, 50, 3, 15, 1.5, 35, 20, 3, 3, 50, 15, 0.4, 1, 1, 50, 100000, 0.1, 0.1): order {{strategy.order.action}} @ {{strategy.order.contracts}} filled on {{ticker}}. New strategy position is {{strategy.position_size}}`;
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-6">
        <BookOpen className="w-5 h-5" />
        Setup Instructions
      </h2>

      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-800">TradingView Configuration</h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-green-900 mb-2">✅ Working Webhook URL</h4>
            <p className="text-green-800 text-sm">
              Your webhook endpoint is now active and ready to receive TradingView alerts!
            </p>
          </div>
          <ol className="space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <span>Open TradingView and create a new alert or edit an existing strategy alert</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <span>In the alert settings, enable the "Webhook URL" option</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <span>Paste the webhook URL from the "Simple Webhook Setup" section above</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <span>Format your alert message using either JSON format or TradingView variables (see examples below)</span>
            </li>
          </ol>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
            <Code className="w-5 h-5" />
            Option 1: JSON Format (Recommended)
          </h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <pre className="text-sm text-gray-800 overflow-x-auto">
              {JSON.stringify(examplePayload, null, 2)}
            </pre>
          </div>
          <p className="text-sm text-gray-600">
            You can customize the fields based on your trading strategy. Required fields are <code className="bg-gray-100 px-1 rounded">action</code>, <code className="bg-gray-100 px-1 rounded">symbol</code>, and <code className="bg-gray-100 px-1 rounded">entry</code>.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
            <Code className="w-5 h-5" />
            Option 2: TradingView Strategy Message
          </h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap">
              {tradingViewExample}
            </pre>
          </div>
          <p className="text-sm text-gray-600">
            The system can automatically parse TradingView strategy messages. Use variables like <code className="bg-gray-100 px-1 rounded">{'{{strategy.order.action}}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{{ticker}}'}</code>, and <code className="bg-gray-100 px-1 rounded">{'{{strategy.order.contracts}}'}</code> in your alert message.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ArrowRight className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Ready to Receive Alerts</h4>
              <p className="text-blue-800 text-sm">
                Your webhook endpoint is now live and can receive POST requests from TradingView. Alerts will automatically appear in your dashboard in real-time and an email notification will be sent to <strong>leechungleuk@gmail.com</strong>. You can also manually submit alerts using the form above for testing.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 text-green-600 mt-0.5">📧</div>
            <div>
              <h4 className="font-medium text-green-900 mb-1">Email Notifications Enabled</h4>
              <p className="text-green-800 text-sm">
                Every trading alert will trigger an email notification to <strong>leechungleuk@gmail.com</strong> with complete alert details including action, symbol, entry price, targets, and stop loss levels.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};