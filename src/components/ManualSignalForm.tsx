import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardPaste, Save, RefreshCw, RotateCcw, Info } from 'lucide-react';
import { usePositionSizingMode } from '../context/PositionSizingModeContext';
import { AlertParsingService } from '../services/alertParsingService';
import { AlertService } from '../services/alertService';
import { getCurrentNode, getGroupKeyForSymbol, getRiskPercentForNode, resetNodeToStart } from '../services/positionSizingService';
import { resolveSizingGroupKey } from '../lib/positionSizingMode';
import { TradingAlert } from '../types/alert';
import { buildManualStoredMessage } from '../lib/manualAlertMessage';

function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ManualSignalFormProps {
  onSaved?: () => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  /** Increment when any alert outcome changes so this pair’s suggested risk reloads */
  sizingStateNonce?: number;
  /** Bump when sizing state is reset so other panels can refresh */
  onSizingStateChanged?: () => void;
}

export const ManualSignalForm: React.FC<ManualSignalFormProps> = ({
  onSaved,
  onNotify,
  sizingStateNonce = 0,
  onSizingStateChanged,
}) => {
  const { mode: sizingMode } = usePositionSizingMode();
  const [symbol, setSymbol] = useState('');
  const [action, setAction] = useState<'BUY' | 'SELL'>('SELL');
  const [entry, setEntry] = useState('');
  const [target, setTarget] = useState('');
  const [stop, setStop] = useState('');
  const [timeframe, setTimeframe] = useState('15');
  const [signalDateTime, setSignalDateTime] = useState(defaultDatetimeLocal);
  const [pasteText, setPasteText] = useState('');
  /** Optional free-form notes; stored on the alert and shown on the card */
  const [notesText, setNotesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [sizingNode, setSizingNode] = useState<string>('Start');
  const [suggestedRisk, setSuggestedRisk] = useState<string>('0.65');
  const [loadingRisk, setLoadingRisk] = useState(false);

  /** Load decision-tree node for current Risk ladder mode (global vs per symbol). */
  const loadSizingForSymbol = useCallback(
    async (symRaw: string) => {
      setLoadingRisk(true);
      try {
        if (sizingMode === 'per_pair' && !symRaw.trim()) {
          setSizingNode('Start');
          setSuggestedRisk('0.65');
          return;
        }
        const groupKey = resolveSizingGroupKey(symRaw, sizingMode);
        const node = await getCurrentNode(groupKey);
        setSizingNode(node);
        setSuggestedRisk(getRiskPercentForNode(node).toFixed(2));
      } catch {
        setSizingNode('Start');
        setSuggestedRisk('0.65');
      } finally {
        setLoadingRisk(false);
      }
    },
    [sizingMode]
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadSizingForSymbol(symbol);
    }, 300);
    return () => window.clearTimeout(id);
  }, [symbol, loadSizingForSymbol, sizingStateNonce, sizingMode]);

  const rrPreview = useMemo(() => {
    if (!entry || !target || !stop) return null;
    return AlertParsingService.computeRR(action, entry, target, stop);
  }, [action, entry, target, stop]);

  const applyPaste = () => {
    const parsed = AlertParsingService.parseManualPaste(pasteText);
    if (parsed.symbol) setSymbol(parsed.symbol);
    if (parsed.action) setAction(parsed.action);
    if (parsed.entry) setEntry(parsed.entry);
    if (parsed.target) setTarget(parsed.target);
    if (parsed.stop) setStop(parsed.stop);
    if (parsed.createdAt) {
      const local = isoToDatetimeLocalValue(parsed.createdAt);
      if (local) setSignalDateTime(local);
    }
    if (parsed.warnings.length) {
      onNotify(parsed.warnings.join(' '), 'info');
    } else {
      onNotify('Parsed paste into the form — review and save.', 'success');
    }
  };

  const handleSave = async () => {
    const paste = pasteText.trim();
    const notes = notesText.trim();
    const messageBody = buildManualStoredMessage(
      paste ? 'Manual signal (pasted)' : 'Manual signal',
      paste || null,
      notes || null
    );

    const alertDraft: Omit<TradingAlert, 'timestamp'> = {
      id: AlertParsingService.generateAlertId(),
      action,
      symbol: symbol.trim().toUpperCase(),
      timeframe: timeframe.trim() || '15',
      entry: entry.trim(),
      target: target.trim() || undefined,
      stop: stop.trim() || undefined,
      rr: rrPreview ?? undefined,
      status: 'active',
      message: messageBody,
      rawMessage: undefined,
      createdAt: signalDateTime
        ? new Date(signalDateTime).toISOString()
        : undefined,
    };

    if (!AlertParsingService.validateAlert(alertDraft)) {
      onNotify('Enter a symbol and side (BUY/SELL). Entry, target, and stop are optional.', 'error');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await AlertService.createAlert(alertDraft);
      if (error || !data) {
        onNotify(error || 'Failed to save signal', 'error');
        return;
      }
      const ladderLabel =
        sizingMode === 'global'
          ? 'GLOBAL'
          : getGroupKeyForSymbol(alertDraft.symbol);
      onNotify(
        `Signal saved (${ladderLabel} ladder). Risk this trade: ${data.risk ?? suggestedRisk}% (node ${sizingNode}).`,
        'success'
      );
      await loadSizingForSymbol(symbol);
      onSaved?.();
      setPasteText('');
      setNotesText('');
    } finally {
      setSaving(false);
    }
  };

  const handleResetSizingNode = async () => {
    if (sizingMode === 'per_pair' && !symbol.trim()) {
      onNotify('Enter a symbol above to reset that pair’s ladder.', 'warning');
      return;
    }
    const groupKey = sizingMode === 'global' ? 'GLOBAL' : getGroupKeyForSymbol(symbol.trim());
    const label = sizingMode === 'global' ? 'GLOBAL (all symbols)' : groupKey;
    if (
      !window.confirm(
        `Reset the ${label} risk ladder to Start (0.65%)? This does not delete alerts; it only clears the stored W–L node.`
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      const { error } = await resetNodeToStart(groupKey);
      if (error) {
        onNotify(error, 'error');
        return;
      }
      onNotify(`Risk ladder reset to Start (0.65%) for ${label}.`, 'success');
      await loadSizingForSymbol(symbol);
      onSizingStateChanged?.();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-blue-600" />
            Manual signal
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Use the header <strong>Risk ladder</strong> toggle: <strong>Global</strong> (default) shares one win–loss tree for every symbol;
            <strong> Per symbol</strong> keeps a separate tree per pair (e.g. <code className="text-xs bg-gray-100 px-1 rounded">usdjpy</code> =
            <code className="text-xs bg-gray-100 px-1 rounded">USDJPY</code>). New ladders start at <strong>0.65%</strong>. Mark win/loss on an alert to advance the active ladder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadSizingForSymbol(symbol)}
            disabled={loadingRisk}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingRisk ? 'animate-spin' : ''}`} />
            Refresh risk
          </button>
          <button
            type="button"
            onClick={() => void handleResetSizingNode()}
            disabled={resetting || loadingRisk}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-900 bg-amber-100 border border-amber-200 rounded-lg hover:bg-amber-200 disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            Reset node to 0.65%
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-900">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">
            {sizingMode === 'global' ? (
              <>
                Suggested risk for next trade — <strong>global</strong> ladder (all symbols share node{' '}
                <span className="tabular-nums">{sizingNode}</span>)
              </>
            ) : (
              <>
                Suggested risk for next trade on{' '}
                {symbol.trim() ? (
                  <strong>{getGroupKeyForSymbol(symbol)}</strong>
                ) : (
                  <span className="font-normal text-amber-800">— enter symbol (defaults to 0.65% / Start)</span>
                )}
              </>
            )}
          </div>
          {loadingRisk ? (
            <div className="text-amber-800">Loading…</div>
          ) : (
            <div>
              <span className="text-lg font-semibold tabular-nums">{suggestedRisk}%</span>
              <span className="text-amber-800 ml-2">(node {sizingNode})</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Paste signal text (optional)</label>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={`Example:\nXAUUSD, 29/4/2026\nSELL\nTarget: 4633.418\nStop Loss: 4670.115`}
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={applyPaste}
          disabled={!pasteText.trim()}
          className="mt-2 px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
        >
          Apply paste to form
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <textarea
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          placeholder="Your comments for this signal — shown on the alert card after save."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Symbol</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="XAUUSD"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Side</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as 'BUY' | 'SELL')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Timeframe (minutes)</label>
          <input
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            placeholder="15"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Signal date & time</label>
          <input
            type="datetime-local"
            value={signalDateTime}
            onChange={(e) => setSignalDateTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Entry (optional)</label>
          <input
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="e.g. 2650.5"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Target (optional)</label>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Take profit"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Stop loss (optional)</label>
          <input
            value={stop}
            onChange={(e) => setStop(e.target.value)}
            placeholder="Stop"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        {rrPreview != null && (
          <div className="sm:col-span-2 lg:col-span-3 text-sm text-gray-700">
            Reward : risk (price units) ≈ <strong>{rrPreview}</strong> : 1
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving…' : 'Save signal'}
      </button>
    </div>
  );
};
