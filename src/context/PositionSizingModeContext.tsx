import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  getPositionSizingMode,
  setPositionSizingMode as persistMode,
  type PositionSizingMode,
} from '../lib/positionSizingMode';

type Ctx = {
  mode: PositionSizingMode;
  setMode: (m: PositionSizingMode) => void;
};

const PositionSizingModeContext = createContext<Ctx | null>(null);

export function PositionSizingModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<PositionSizingMode>(() => getPositionSizingMode());

  const setMode = useCallback((m: PositionSizingMode) => {
    persistMode(m);
    setModeState(m);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <PositionSizingModeContext.Provider value={value}>{children}</PositionSizingModeContext.Provider>
  );
}

export function usePositionSizingMode(): Ctx {
  const ctx = useContext(PositionSizingModeContext);
  if (!ctx) {
    throw new Error('usePositionSizingMode must be used within PositionSizingModeProvider');
  }
  return ctx;
}
