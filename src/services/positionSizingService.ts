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

// Group key = normalized symbol (uppercase). With dashboard "Per symbol" mode, each pair is independent.
// With "Global" mode, the app uses group_key GLOBAL instead (see src/lib/positionSizingMode.ts).
export function getGroupKeyForSymbol(symbol: string): string {
  return symbol?.toUpperCase() ?? 'UNKNOWN';
}

// Validate and normalize node - resets invalid nodes to 'Start'
export function validateAndNormalizeNode(node: string): string {
  if (!node || node === 'Start') return 'Start';
  
  const match = node.match(/^(\d+)-(\d+)$/);
  if (!match) {
    console.warn(`[Position Sizing] Invalid node format "${node}", resetting to Start`);
    return 'Start';
  }
  
  const wins = parseInt(match[1], 10);
  const losses = parseInt(match[2], 10);
  
  // Check if node exceeds decision tree limits (max 4 wins or 5 losses)
  if (wins > 4 || losses > 5) {
    console.warn(`[Position Sizing] Node "${node}" exceeds limits (wins: ${wins} > 4 or losses: ${losses} > 5), resetting to Start`);
    return 'Start';
  }
  
  // Check if node exists in decision tree
  if (!decisionNodeToRiskPercent[node]) {
    console.warn(`[Position Sizing] Node "${node}" not found in decision tree, resetting to Start`);
    return 'Start';
  }
  
  return node;
}

export async function getCurrentNode(groupKey: string): Promise<string> {
  const { data } = await supabase
    .from('position_sizing_state')
    .select('*')
    .eq('group_key', groupKey)
    .maybeSingle();
  
  const node = data?.current_node ?? 'Start';
  const validatedNode = validateAndNormalizeNode(node);
  
  // Auto-fix invalid nodes in database
  if (validatedNode !== node) {
    console.log(`[Position Sizing] Auto-fixing invalid node "${node}" -> "${validatedNode}" for ${groupKey}`);
    await upsertNode(groupKey, validatedNode);
  }
  
  return validatedNode;
}

export function getRiskPercentForNode(node: string): number {
  return decisionNodeToRiskPercent[node] ?? 0.65;
}

export async function upsertNode(groupKey: string, node: string): Promise<void> {
  // Validate node before saving
  const validatedNode = validateAndNormalizeNode(node);
  await supabase
    .from('position_sizing_state')
    .upsert({ group_key: groupKey, current_node: validatedNode });
}

// Reset node to Start for a specific currency pair
export async function resetNodeToStart(groupKey: string): Promise<{ error: string | null }> {
  try {
    console.log(`[Position Sizing] Resetting node to Start for ${groupKey}`);
    await upsertNode(groupKey, 'Start');
    console.log(`[Position Sizing] Successfully reset ${groupKey} to Start (0.65% risk)`);
    return { error: null };
  } catch (error) {
    console.error(`[Position Sizing] Error resetting node for ${groupKey}:`, error);
    return { error: 'Failed to reset node to Start' };
  }
}

// Fix all invalid nodes in the database (utility function)
export async function fixAllInvalidNodes(): Promise<void> {
  try {
    const { data: allStates, error } = await supabase
      .from('position_sizing_state')
      .select('*');
    
    if (error) {
      console.error('[Position Sizing] Error fetching nodes for validation:', error);
      return;
    }
    
    if (!allStates || allStates.length === 0) return;
    
    let fixedCount = 0;
    for (const state of allStates) {
      const validatedNode = validateAndNormalizeNode(state.current_node);
      if (validatedNode !== state.current_node) {
        console.log(`[Position Sizing] Fixing invalid node "${state.current_node}" -> "${validatedNode}" for ${state.group_key}`);
        await upsertNode(state.group_key, validatedNode);
        fixedCount++;
      }
    }
    
    if (fixedCount > 0) {
      console.log(`[Position Sizing] Fixed ${fixedCount} invalid node(s) in database`);
    } else {
      console.log('[Position Sizing] All nodes are valid');
    }
  } catch (error) {
    console.error('[Position Sizing] Error fixing invalid nodes:', error);
  }
}

// Clean up orphaned position sizing states (pairs with no trades)
export async function cleanupOrphanedNodes(): Promise<void> {
  try {
    // Get all position sizing states
    const { data: allStates, error: statesError } = await supabase
      .from('position_sizing_state')
      .select('*');
    
    if (statesError) {
      console.error('[Position Sizing] Error fetching states for cleanup:', statesError);
      return;
    }
    
    if (!allStates || allStates.length === 0) return;
    
    // Get all completed trades grouped by symbol
    const { data: allAlerts, error: alertsError } = await supabase
      .from('trading_alerts')
      .select('symbol, status, outcome')
      .eq('status', 'completed')
      .not('outcome', 'is', null);
    
    if (alertsError) {
      console.error('[Position Sizing] Error fetching alerts for cleanup:', alertsError);
      return;
    }
    
    // Create a set of symbols that have completed trades
    const symbolsWithTrades = new Set<string>();
    (allAlerts || []).forEach(alert => {
      if (alert.symbol) {
        symbolsWithTrades.add(alert.symbol.toUpperCase());
      }
    });
    
    // Find orphaned states (no completed trades for this symbol)
    let deletedCount = 0;
    for (const state of allStates) {
      if (state.group_key === 'GLOBAL') continue;
      if (!symbolsWithTrades.has(state.group_key)) {
        console.log(`[Position Sizing] Removing orphaned state for ${state.group_key} (no completed trades)`);
        const { error: deleteError } = await supabase
          .from('position_sizing_state')
          .delete()
          .eq('group_key', state.group_key);
        
        if (deleteError) {
          console.error(`[Position Sizing] Error deleting orphaned state for ${state.group_key}:`, deleteError);
        } else {
          deletedCount++;
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`[Position Sizing] Cleaned up ${deletedCount} orphaned node(s) from database`);
    } else {
      console.log('[Position Sizing] No orphaned nodes found');
    }
  } catch (error) {
    console.error('[Position Sizing] Error cleaning up orphaned nodes:', error);
  }
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

/**
 * Recompute position_sizing_state by replaying completed win/loss alerts (chronological).
 * Call after deletes so removing an outcome-backed alert restores the correct node (e.g. back to Start / 0.65%).
 */
export async function syncPositionSizingStateFromAlerts(params: {
  mode: 'global' | 'per_pair';
  /** Uppercase symbol; required when mode is per_pair */
  symbolUpper?: string;
}): Promise<void> {
  const { mode, symbolUpper } = params;
  if (mode === 'per_pair' && !symbolUpper) {
    console.warn('[Position Sizing] sync skipped: per_pair requires symbolUpper');
    return;
  }

  let query = supabase
    .from('trading_alerts')
    .select('outcome, updated_at, id')
    .eq('status', 'completed')
    .in('outcome', ['win', 'loss']);

  if (mode === 'per_pair') {
    query = query.eq('symbol', symbolUpper!);
  }

  const { data: rows, error } = await query
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error('[Position Sizing] sync replay query failed:', error);
    return;
  }

  let node: string = 'Start';
  for (const row of rows || []) {
    const o = row.outcome;
    if (o === 'win' || o === 'loss') {
      node = advanceNode(node, o);
    }
  }

  const storageKey = mode === 'global' ? 'GLOBAL' : symbolUpper!;
  await upsertNode(storageKey, node);
}
