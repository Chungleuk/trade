import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wifi, WifiOff, Activity, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';

interface Signal {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entry: number;
  target?: number;
  stop?: number;
  status: string;
  timestamp: string;
  source: string;
}

interface MT5Connection {
  connectionId: string;
  account: string;
  terminal: string;
  version: string;
  status: string;
  connectedAt: string;
  lastHeartbeat: string;
}

interface DashboardStats {
  totalSignals: number;
  received: number;
  sentToMT5: number;
  executed: number;
  failed: number;
}

interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

export const RealTimeDashboard: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [mt5Connections, setMt5Connections] = useState<MT5Connection[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Mock WebSocket connection for demo
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
      // Simulate real-time updates
      updateMockData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const updateMockData = () => {
    // Simulate new signals
    if (Math.random() > 0.7) {
      const newSignal: Signal = {
        id: `signal_${Date.now()}`,
        symbol: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'][Math.floor(Math.random() * 4)],
        action: Math.random() > 0.5 ? 'BUY' : 'SELL',
        entry: 1.1 + Math.random() * 0.1,
        target: 1.1 + Math.random() * 0.1 + 0.01,
        stop: 1.1 + Math.random() * 0.1 - 0.01,
        status: 'received',
        timestamp: new Date().toISOString(),
        source: 'tradingview'
      };
      setSignals(prev => [newSignal, ...prev.slice(0, 19)]);
    }

    // Update stats
    setStats({
      totalSignals: signals.length + Math.floor(Math.random() * 10),
      received: Math.floor(Math.random() * 50),
      sentToMT5: Math.floor(Math.random() * 40),
      executed: Math.floor(Math.random() * 30),
      failed: Math.floor(Math.random() * 5)
    });

    // Update queue status
    setQueueStatus({
      waiting: Math.floor(Math.random() * 10),
      active: Math.floor(Math.random() * 5),
      completed: Math.floor(Math.random() * 100),
      failed: Math.floor(Math.random() * 3),
      total: Math.floor(Math.random() * 120)
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'text-blue-600 bg-blue-100';
      case 'sent_to_mt5': return 'text-yellow-600 bg-yellow-100';
      case 'executed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received': return <Clock className="w-4 h-4" />;
      case 'sent_to_mt5': return <Activity className="w-4 h-4" />;
      case 'executed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const chartData = signals.slice(0, 10).map(signal => ({
    time: format(new Date(signal.timestamp), 'HH:mm'),
    entry: signal.entry,
    symbol: signal.symbol
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Real-Time Signal Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            Last update: {format(lastUpdate, 'HH:mm:ss')}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Signals</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalSignals || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Queue Status</p>
              <p className="text-2xl font-bold text-yellow-600">{queueStatus?.waiting || 0}</p>
              <p className="text-sm text-gray-500">waiting</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">MT5 Connections</p>
              <p className="text-2xl font-bold text-green-600">{mt5Connections.length}</p>
              <p className="text-sm text-gray-500">active</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Wifi className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {stats && stats.totalSignals > 0 
                  ? Math.round((stats.executed / stats.totalSignals) * 100) 
                  : 0}%
              </p>
              <p className="text-sm text-gray-500">executed</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signal Activity Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Signal Activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="entry" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Queue Status Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { name: 'Waiting', value: queueStatus?.waiting || 0, color: '#f59e0b' },
              { name: 'Active', value: queueStatus?.active || 0, color: '#3b82f6' },
              { name: 'Completed', value: queueStatus?.completed || 0, color: '#10b981' },
              { name: 'Failed', value: queueStatus?.failed || 0, color: '#ef4444' }
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Signals */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Recent Signals</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Symbol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entry
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {signals.map((signal) => (
                <tr key={signal.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg ${
                        signal.action === 'BUY' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {signal.action === 'BUY' ? (
                          <TrendingUp className={`w-4 h-4 ${
                            signal.action === 'BUY' ? 'text-green-600' : 'text-red-600'
                          }`} />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <span className="ml-2 text-sm font-medium text-gray-900">
                        {signal.action}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {signal.symbol}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {signal.entry.toFixed(5)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(signal.status)}`}>
                      {getStatusIcon(signal.status)}
                      {signal.status.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(signal.timestamp), 'HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {signal.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MT5 Connections */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">MT5 Connections</h3>
        </div>
        <div className="p-6">
          {mt5Connections.length === 0 ? (
            <div className="text-center py-8">
              <WifiOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No MT5 connections active</p>
              <p className="text-sm text-gray-400">Connect your MT5 EA to start receiving signals</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mt5Connections.map((connection) => (
                <div key={connection.connectionId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {connection.account}
                    </span>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      connection.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {connection.status}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Terminal: {connection.terminal}</p>
                    <p>Version: {connection.version}</p>
                    <p>Connected: {format(new Date(connection.connectedAt), 'HH:mm:ss')}</p>
                    <p>Last HB: {format(new Date(connection.lastHeartbeat), 'HH:mm:ss')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
