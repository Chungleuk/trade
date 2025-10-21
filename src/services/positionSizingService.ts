import { supabase } from '../lib/supabase';

// Mirrors the decision tree in dynamic-position-sizing.pine
const decisionNodeToRiskPercent: Record<string, number> = {
  'Start': 0.65,
  '1-0': 0.58,
  '0-1': 0.73,
  '2-0': 0.44,
  '1-1': 0.73,
  '0-2': 0.73,
  '3-0': 0.25,
  '2-1': 0.62,
  '1-2': 0.83,
  '0-3': 0.62,
  '4-0': 0.08,
  '3-1': 0.41,
  '2-2': 0.83,
  '1-3': 0.83,
  '0-4': 0.41,
  '4-1': 0.17,
  '3-2': 0.66,
  '2-3': 0.99,
  '1-4': 0.66,
  '0-5': 0.17,
  '4-2': 0.33,
  '3-3': 0.99,
  '2-4': 0.99,
  '1-5': 0.33,
  '4-3': 0.66,
  '3-4': 1.33,
  '2-5': 0.66,
  '4-4': 1.33,
  '3-5': 1.33,
  '4-5': 2.65,
};

type Outcome = 'win' | 'loss' | 'breakeven';

// Simple group mapping: group by base symbol (e.g., USDJPY => USDJPY, XAUUSD => XAUUSD)
export function getGroupKeyForSymbol(symbol: string): string {
  return symbol?.toUpperCase() ?? 'UNKNOWN';
}

export async function getCurrentNode(groupKey: string): Promise<string> {
  const { data } = await supabase
    .from('position_sizing_state')
    .select('*')
    .eq('group_key', groupKey)
    .maybeSingle();
  return data?.current_node ?? 'Start';
}

export function getRiskPercentForNode(node: string): number {
  return decisionNodeToRiskPercent[node] ?? 0.65;
}

export async function upsertNode(groupKey: string, node: string): Promise<void> {
  await supabase
    .from('position_sizing_state')
    .upsert({ group_key: groupKey, current_node: node });
}

// Advance node according to outcome: increment wins or losses in the node key "W-L"
export function advanceNode(currentNode: string, outcome: Outcome): string {
  if (currentNode === 'Start') {
    if (outcome === 'win') return '1-0';
    if (outcome === 'loss') return '0-1';
    return 'Start';
  }

  const match = currentNode.match(/^(\d+)-(\d+)$/);
  if (!match) return 'Start';

  const wins = parseInt(match[1], 10);
  const losses = parseInt(match[2], 10);

  // Calculate new wins/losses based on outcome
  const newWins = outcome === 'win' ? wins + 1 : wins;
  const newLosses = outcome === 'loss' ? losses + 1 : losses;
  
  // RESET TO START if we exceed the defined decision tree limits (max 4 wins or 5 losses)
  if (newWins > 4 || newLosses > 5) {
    console.log(`[Position Sizing] Decision tree limit reached at ${wins}-${losses}, resetting to Start (0.65% risk)`);
    return 'Start';  // Reset to beginning
  }

  if (outcome === 'win') return `${wins + 1}-${losses}`;
  if (outcome === 'loss') return `${wins}-${losses + 1}`;
  return currentNode; // breakeven keeps same node by default
}



