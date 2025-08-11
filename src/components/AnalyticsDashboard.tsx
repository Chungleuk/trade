import React, { useState, useEffect } from 'react';
import { 
  Bar, Line, Pie, Doughnut
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  ArcElement,
} from 'chart.js';
import { 
  TrendingUp, TrendingDown, Target, AlertTriangle, DollarSign, 
  Calendar, Filter, RefreshCw, BarChart3, PieChart as PieChartIcon 
} from 'lucide-react';
import { TradingAnalytics, AnalyticsFilters } from '../types/analytics';
import { AnalyticsService } from '../services/analyticsService';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  ChartLegend,
  ArcElement
);

interface AnalyticsDashboardProps {
  refreshTrigger?: number; // Add a refresh trigger prop
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ refreshTrigger = 0 }) => {
  const [analytics, setAnalytics] = useState<TradingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: { start: null, end: null },
    symbols: [],
    status: ['active', 'completed', 'stopped']
  });

  useEffect(() => {
    fetchAnalytics();
  }, [filters, refreshTrigger]); // Add refreshTrigger to dependencies

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await AnalyticsService.getTradingAnalytics(filters);
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
          <span className="text-red-800">Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center text-gray-500 py-8">
        No analytics data available
      </div>
    );
  }

  // Chart data preparation
  const winLossData = {
    labels: ['Wins', 'Losses'],
    datasets: [
      {
        data: [analytics.totalWins, analytics.totalLosses],
        backgroundColor: ['#10b981', '#ef4444'],
        borderColor: ['#059669', '#dc2626'],
        borderWidth: 1,
      },
    ],
  };

  const monthlyData = {
    labels: analytics.monthlyPerformance.map(m => m.month),
    datasets: [
      {
        label: 'Win Rate %',
        data: analytics.monthlyPerformance.map(m => m.winRate),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const symbolData = {
    labels: analytics.symbolPerformance.map(s => s.symbol),
    datasets: [
      {
        label: 'Win Rate %',
        data: analytics.symbolPerformance.map(s => s.winRate),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: '#3b82f6',
        borderWidth: 1,
      },
    ],
  };

  const riskProgressionData = {
    labels: analytics.riskProgression.map(r => r.symbol),
    datasets: [
      {
        label: 'Current Risk %',
        data: analytics.riskProgression.map(r => r.risk),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Trading Analytics Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAnalytics}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Alerts"
          value={analytics.totalAlerts}
          icon={AlertTriangle}
          color="blue"
        />
        <MetricCard
          title="Win Rate"
          value={`${analytics.winRate.toFixed(1)}%`}
          icon={TrendingUp}
          color="green"
        />
        <MetricCard
          title="Completed Trades"
          value={analytics.completedAlerts}
          icon={Target}
          color="purple"
        />
        <MetricCard
          title="Avg Risk"
          value={`${analytics.averageRisk.toFixed(2)}%`}
          icon={DollarSign}
          color="orange"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win/Loss Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <PieChartIcon className="w-5 h-5 mr-2" />
            Win/Loss Distribution
          </h3>
          <div className="h-64">
            <Pie data={winLossData} />
          </div>
        </div>

        {/* Monthly Performance */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Monthly Win Rate
          </h3>
          <div className="h-64">
            <Line data={monthlyData} />
          </div>
        </div>

        {/* Symbol Performance */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Currency Pair Performance
          </h3>
          <div className="h-64">
            <Bar data={symbolData} />
          </div>
        </div>

        {/* Risk Progression */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Risk Progression by Currency Pair
          </h3>
          <div className="h-64">
            <Line data={riskProgressionData} />
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Symbol Performance Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Currency Pair Performance</h3>
          <p className="text-sm text-gray-600 mb-4">Win rates grouped by currency pairs (USDJPY, XAUUSD, etc.)</p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Currency Pair
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Trades
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Win Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Risk
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.symbolPerformance.map((symbol) => (
                  <tr key={symbol.symbol}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {symbol.symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {symbol.totalTrades}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`font-medium ${symbol.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {symbol.winRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {symbol.averageRisk.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Progression Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Progression by Currency Pair</h3>
          <p className="text-sm text-gray-600 mb-4">Current decision tree node and risk level for each currency pair</p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Currency Pair
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Decision Node
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed Trades
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.riskProgression.map((progression) => (
                  <tr key={progression.symbol}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {progression.symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {progression.node}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="font-medium text-orange-600">
                        {progression.risk.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {progression.tradesAtNode}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for metric cards
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};
