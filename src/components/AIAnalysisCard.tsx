import React from 'react';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, Clock, Target, Zap } from 'lucide-react';
import { AnalysisResult } from '../services/openaiAnalysisService';

interface AIAnalysisCardProps {
  analysis: AnalysisResult;
  alertSymbol: string;
  alertAction: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const AIAnalysisCard: React.FC<AIAnalysisCardProps> = ({
  analysis,
  alertSymbol,
  alertAction,
  isExpanded = false,
  onToggleExpand
}) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-600 bg-green-100';
    if (confidence >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_buy': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'buy': return <TrendingUp className="w-4 h-4 text-blue-600" />;
      case 'hold': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'sell': return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'strong_sell': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRecommendationText = (recommendation: string) => {
    return recommendation.replace('_', ' ').toUpperCase();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div 
        className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 border-b border-gray-200 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">AI Analysis</h3>
              <p className="text-sm text-gray-600">
                {alertAction} {alertSymbol} • {analysis.confidence}% Confidence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(analysis.confidence)}`}>
              {analysis.confidence}%
            </div>
            {getRecommendationIcon(analysis.recommendation)}
            <span className="text-sm font-medium text-gray-700">
              {getRecommendationText(analysis.recommendation)}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                {analysis.entryAlignment === 'align' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Entry Alignment</span>
              </div>
              <p className="text-xs text-gray-600">{analysis.entryAlignment}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                {analysis.actionFit === 'fits' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Action Fit</span>
              </div>
              <p className="text-xs text-gray-600">{analysis.actionFit}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Win Rate</span>
              </div>
              <p className="text-xs text-gray-600">{analysis.winRatePrediction}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                {analysis.marketEvents === 'yes' ? (
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
                <span className="text-sm font-medium">Market Events</span>
              </div>
              <p className="text-xs text-gray-600">{analysis.marketEvents}</p>
            </div>
          </div>

          {/* Detailed Analysis */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Detailed Analysis</h4>
            
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Entry Reasoning:</p>
                <p className="text-sm text-gray-600">{analysis.entryReasoning}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">Action Reasoning:</p>
                <p className="text-sm text-gray-600">{analysis.actionReasoning}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">Win Rate Reasoning:</p>
                <p className="text-sm text-gray-600">{analysis.winRateReasoning}</p>
              </div>
              
              {analysis.marketEvents === 'yes' && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Market Events:</p>
                  <p className="text-sm text-gray-600">{analysis.marketEventsDetails}</p>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Summary</h4>
            
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-gray-700 mb-2">
                <strong>English:</strong>
              </p>
              <p className="text-sm text-gray-600">{analysis.summary}</p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-sm text-gray-700 mb-2">
                <strong>繁體中文:</strong>
              </p>
              <p className="text-sm text-gray-600">{analysis.summaryChinese}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
