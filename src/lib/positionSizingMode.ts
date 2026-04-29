import { getGroupKeyForSymbol } from '../services/positionSizingService';

export type PositionSizingMode = 'global' | 'per_pair';

const STORAGE_KEY = 'positionSizingMode';

/** Default: one shared GLOBAL ladder for all symbols */
export function getPositionSizingMode(): PositionSizingMode {
  if (typeof localStorage === 'undefined') return 'global';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'per_pair' ? 'per_pair' : 'global';
}

export function setPositionSizingMode(mode: PositionSizingMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

/** `position_sizing_state.group_key`: GLOBAL or uppercase symbol */
export function resolveSizingGroupKey(
  symbol: string,
  mode: PositionSizingMode = getPositionSizingMode()
): string {
  if (mode === 'global') return 'GLOBAL';
  return getGroupKeyForSymbol(symbol);
}
