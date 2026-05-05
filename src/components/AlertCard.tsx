import React from 'react';
import { TrendingUp, TrendingDown, Clock, Target, Shield, DollarSign, MoreVertical, CheckCircle, XCircle, Trash2, Trophy, TrendingDown as LossIcon, Minus, PenLine, Loader2 } from 'lucide-react';
import { TradingAlert } from '../types/alert';
import { AlertParsingService } from '../services/alertParsingService';
import { splitManualMessage, buildManualStoredMessage } from '../lib/manualAlertMessage';

interface AlertCardProps {
  alert: TradingAlert;
  onUpdateStatus?: (alertId: string, status: 'active' | 'completed' | 'stopped') => void;
  onMarkOutcome?: (alertId: string, outcome: 'win' | 'loss') => void;
  onDelete?: (alertId: string) => void;
  onSaveManualMessage?: (alertId: string, message: string) => Promise<boolean>;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  onUpdateStatus,
  onMarkOutcome,
  onDelete,
  onSaveManualMessage,
}) => {
  const [showActions, setShowActions] = React.useState(false);
  const [editingNotes, setEditingNotes] = React.useState(false);
  const [draftNotes, setDraftNotes] = React.useState('');
  const [savingNotes, setSavingNotes] = React.useState(false);

  React.useEffect(() => {
    setEditingNotes(false);
  }, [alert.id]);
  const isManual = AlertParsingService.isManualEntryAlert(alert);
  const isBuy = alert.action === 'BUY';
  const actionColor = isBuy ? 'text-green-600' : 'text-red-600';
  const outcomeBorderColor = alert.outcome === 'win'
    ? 'border-l-green-500'
    : alert.outcome === 'loss'
      ? 'border-l-red-500'
      : alert.outcome === 'breakeven'
        ? 'border-l-yellow-500'
        : null;
  const borderColor = outcomeBorderColor || (isBuy ? 'border-l-green-500' : 'border-l-red-500');
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
  const manualParts =
    isManual && alert.message ? splitManualMessage(alert.message) : null;

  const startEditingNotes = () => {
    const parts = isManual && alert.message ? splitManualMessage(alert.message) : null;
    setDraftNotes(parts?.notesSection ?? '');
    setEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    if (!manualParts || !onSaveManualMessage) return;
    setSavingNotes(true);
    try {
      const newMessage = buildManualStoredMessage(
        manualParts.label,
        manualParts.pasteSection,
        draftNotes.trim() || null
      );
      const ok = await onSaveManualMessage(alert.id, newMessage);
      if (ok) setEditingNotes(false);
    } finally {
      setSavingNotes(false);
    }
  };

  /** Light green / red wash on the whole card when outcome is set (keeps manual violet accents blended in). */
  const surfaceClass =
    alert.outcome === 'win'
      ? isManual
        ? 'pt-9 ring-2 ring-violet-300/90 ring-inset bg-gradient-to-br from-green-50/90 via-violet-50/80 to-indigo-50/35'
        : 'pt-6 bg-gradient-to-br from-green-50/95 via-green-50/60 to-white'
      : alert.outcome === 'loss'
        ? isManual
          ? 'pt-9 ring-2 ring-violet-300/90 ring-inset bg-gradient-to-br from-red-50/90 via-violet-50/80 to-indigo-50/35'
          : 'pt-6 bg-gradient-to-br from-red-50/95 via-red-50/60 to-white'
        : isManual
          ? 'pt-9 ring-2 ring-violet-300/90 ring-inset bg-gradient-to-br from-violet-50/95 via-white to-indigo-50/30'
          : 'pt-6 bg-white';

  return (
    <div
      className={`relative border-l-4 ${borderColor} rounded-lg shadow-sm hover:shadow-md transition-colors transition-shadow px-6 pb-6 ${surfaceClass}`}
    >
      {isManual && (
        <div
          className="absolute top-0 right-4 -translate-y-1/2 flex items-center gap-1.5 rounded-full border border-violet-400/90 bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-md sm:right-6"
          title="Logged from the Manual signal form — not a TradingView webhook"
        >
          <PenLine className="h-3 w-3 opacity-95" aria-hidden />
          Manual
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 lg:pr-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
            <div className={`p-2 rounded-lg ${bgColor}`}>
              {isBuy ? (
                <TrendingUp className={`w-5 h-5 ${actionColor}`} />
              ) : (
                <TrendingDown className={`w-5 h-5 ${actionColor}`} />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{alert.symbol}</span>
                <span className="text-gray-400">•</span>
                <span>{alert.timeframe}m</span>
                {alert.status && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(alert.status)}`}>
                      {alert.status.toUpperCase()}
                    </span>
                  </>
                )}
                {outcomeDisplay && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-xs text-gray-500">Outcome</span>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${outcomeDisplay.color}`}>
                      <outcomeDisplay.icon className="w-3 h-3 shrink-0" />
                      {outcomeDisplay.label}
                    </div>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Alert id</span>
                <span
                  className="font-mono text-[11px] text-gray-600 truncate max-w-[min(100%,14rem)] sm:max-w-md"
                  title={alert.id}
                >
                  {alert.id}
                </span>
              </div>
              <div className={`text-lg font-bold tracking-tight ${actionColor}`}>{alert.action}</div>
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

        <div className="flex items-start gap-4 flex-wrap">
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1 tabular-nums">
              {alert.entry?.trim() ? alert.entry : '—'}
            </div>
            <div className="text-sm text-gray-600">Entry {alert.entry?.trim() ? 'price' : '(not set)'}</div>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
            <Clock className="w-3 h-3" />
            <span>{date}</span>
            <span>{time}</span>
          </div>
          
          {/* Direct Outcome Buttons */}
          {onMarkOutcome && !alert.outcome && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onMarkOutcome(alert.id, 'win')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
              >
                <Trophy className="w-4 h-4" />
                Mark as Win
              </button>
              <button
                onClick={() => onMarkOutcome(alert.id, 'loss')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
              >
                <LossIcon className="w-4 h-4" />
                Mark as Loss
              </button>
            </div>
          )}
          
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
                      {/* Breakeven option removed as requested */}
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Delete button clicked for alert ID:', alert.id);
                          console.log('onDelete function available:', !!onDelete);
                          console.log('Total alerts count:', 'checking...');
                          onDelete(alert.id);
                          setShowActions(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        style={{ pointerEvents: 'auto' }}
                        title="Delete this alert"
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
        <div className="mt-4">
          {isManual && manualParts ? (
            <div className="overflow-hidden rounded-xl border border-violet-300/90 bg-violet-100/35 shadow-inner shadow-violet-100/50">
              <div className="flex flex-wrap items-center gap-2 border-b border-violet-200/80 bg-gradient-to-r from-violet-200/50 to-indigo-100/50 px-3 py-2">
                <span className="rounded-md bg-white/80 px-2 py-0.5 font-sans text-xs font-semibold text-violet-900 shadow-sm">
                  {manualParts.label}
                </span>
              </div>

              <div className="space-y-3 px-3 py-3">
                {manualParts.pasteSection && (
                  <div>
                    {manualParts.label.includes('pasted') && (
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-800/80">
                        Pasted
                      </div>
                    )}
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-violet-950/95">
                      {manualParts.pasteSection}
                    </pre>
                  </div>
                )}

                {!manualParts.pasteSection && !editingNotes && (
                  <p className="text-xs text-violet-800/70">
                    No pasted text. Paste is optional when you create a signal in the Manual signal form.
                  </p>
                )}

                <div
                  className={
                    manualParts.pasteSection ? 'border-t border-violet-200/80 pt-3' : ''
                  }
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-800/80">
                      Notes
                    </div>
                    {onSaveManualMessage && !editingNotes && (
                      <button
                        type="button"
                        onClick={startEditingNotes}
                        className="text-xs font-medium text-violet-700 hover:text-violet-900 underline underline-offset-2"
                      >
                        {manualParts.notesSection ? 'Edit notes' : 'Add notes'}
                      </button>
                    )}
                  </div>

                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm text-violet-950 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        placeholder="Your notes for this trade…"
                        disabled={savingNotes}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveNotes()}
                          disabled={savingNotes}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          {savingNotes && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                          Save notes
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNotes(false)}
                          disabled={savingNotes}
                          className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : manualParts.notesSection ? (
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-violet-950/95">
                      {manualParts.notesSection}
                    </pre>
                  ) : (
                    <p className="text-xs italic text-violet-700/80">No notes yet — use Add notes to write some.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-sm text-gray-700">
                {alert.message}
                {alert.strategyName && (
                  <div className="mt-1 text-xs text-gray-500">Strategy: {alert.strategyName}</div>
                )}
              </div>
            </div>
          )}
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