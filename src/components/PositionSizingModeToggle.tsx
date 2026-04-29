import React from 'react';
import { GitBranch } from 'lucide-react';
import { usePositionSizingMode } from '../context/PositionSizingModeContext';
import type { PositionSizingMode } from '../lib/positionSizingMode';

interface Props {
  /** e.g. refresh manual form suggested risk immediately */
  onModeApplied?: () => void;
}

export const PositionSizingModeToggle: React.FC<Props> = ({ onModeApplied }) => {
  const { mode, setMode } = usePositionSizingMode();

  const pick = (m: PositionSizingMode) => {
    if (m === mode) return;
    setMode(m);
    onModeApplied?.();
  };

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <GitBranch className="w-3.5 h-3.5 shrink-0" />
        <span className="whitespace-nowrap font-medium text-gray-600">Risk ladder</span>
      </div>
      <div
        className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
        role="group"
        aria-label="Position sizing mode"
      >
        <button
          type="button"
          onClick={() => pick('global')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === 'global'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Global
        </button>
        <button
          type="button"
          onClick={() => pick('per_pair')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === 'per_pair'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Per symbol
        </button>
      </div>
    </div>
  );
};
