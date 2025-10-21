# Position Sizing Decision Tree Reset Implementation

## Overview
Implemented automatic reset to "Start" node when the decision tree reaches its defined limits (4 wins or 5 losses), preventing undefined risk percentages and ensuring consistent risk management.

## Changes Made

### 1. `src/services/positionSizingService.ts`
**Modified `advanceNode()` function** (lines 64-90)

#### What Changed:
- Added logic to calculate new wins/losses before advancing
- Added boundary check: if `newWins > 4` OR `newLosses > 5`, reset to "Start"
- Added console logging for tracking reset events
- Maintains 0.65% baseline risk on reset

#### Code Addition:
```typescript
// Calculate new wins/losses based on outcome
const newWins = outcome === 'win' ? wins + 1 : wins;
const newLosses = outcome === 'loss' ? losses + 1 : losses;

// RESET TO START if we exceed the defined decision tree limits (max 4 wins or 5 losses)
if (newWins > 4 || newLosses > 5) {
  console.log(`[Position Sizing] Decision tree limit reached at ${wins}-${losses}, resetting to Start (0.65% risk)`);
  return 'Start';  // Reset to beginning
}
```

### 2. `src/services/analyticsService.ts`
**Refactored to use centralized risk calculation**

#### What Changed:
- Added import: `import { getRiskPercentForNode } from './positionSizingService'`
- Removed duplicate `getRiskForNode()` method (was lines 212-221)
- Now uses centralized `getRiskPercentForNode()` function
- Ensures consistency across all risk calculations

#### Benefits:
- Single source of truth for risk percentages
- Automatic consistency with position sizing logic
- Easier maintenance (update in one place)

## Testing Results

### Edge Cases (Reset to Start):
✅ `4-5 + win` → `Start` (would be 5-5)
✅ `4-5 + loss` → `Start` (would be 4-6)
✅ `4-4 + win` → `Start` (would be 5-4)
✅ `3-5 + loss` → `Start` (would be 3-6)
✅ `0-5 + loss` → `Start` (would be 0-6)

### Normal Cases (Works as Expected):
✅ `3-4 + loss` → `3-5` (stays within limits)
✅ `Start + win` → `1-0`
✅ `2-3 + win` → `3-3`
✅ `1-4 + loss` → `1-5`

### Breakeven Cases:
✅ `2-3 + breakeven` → `2-3` (no change)
✅ `4-5 + breakeven` → `4-5` (stays at current)

## Decision Tree Boundaries

### Defined Nodes:
- **Maximum Wins**: 4 (nodes: 4-0, 4-1, 4-2, 4-3, 4-4, 4-5)
- **Maximum Losses**: 5 (nodes: 0-5, 1-5, 2-5, 3-5, 4-5)
- **Terminal Node**: 4-5 (2.65% risk - highest in tree)

### Reset Triggers:
- Any win from a node with 4 wins (e.g., 4-5 → would be 5-5)
- Any loss from a node with 5 losses (e.g., 3-5 → would be 3-6)

## Impact on System Components

### ✅ Position Sizing Service
- Core logic updated with reset functionality
- Centralized risk percentage mapping

### ✅ Analytics Dashboard
- Automatically reads reset nodes from database
- Uses centralized risk calculation
- Displays accurate risk progression

### ✅ Webhook Alerts Hook
- Calls `advanceNode()` when marking outcomes
- Automatically gets reset behavior
- Saves new nodes to database via `upsertNode()`

### ✅ Database
- `position_sizing_state` table stores current nodes
- Reset nodes ("Start") are persisted correctly
- No schema changes required

## User Experience

When trading:
1. Normal win/loss progression follows decision tree
2. Reach maximum node (e.g., "4-5" with 2.65% risk)
3. Next outcome triggers reset
4. Console logs: `[Position Sizing] Decision tree limit reached at 4-5, resetting to Start (0.65% risk)`
5. System begins fresh tracking from baseline
6. Analytics dashboard shows updated node as "Start"

## Benefits

1. **Prevents Undefined Risk**: No more undefined nodes falling back silently to 0.65%
2. **Predictable Behavior**: Clear reset pattern at boundaries
3. **Risk Management**: Caps maximum exposure at 2.65%
4. **Fresh Start**: Clean slate after extreme win/loss streaks
5. **Transparency**: Console logging tracks all resets
6. **Consistency**: Single source of truth for risk calculations

## No Breaking Changes

- ✅ No API changes
- ✅ No database schema changes
- ✅ No UI changes required
- ✅ Backward compatible
- ✅ Zero linting errors

## Files Modified

1. `src/services/positionSizingService.ts` - Core reset logic
2. `src/services/analyticsService.ts` - Removed duplication, use centralized function

## Date Implemented
October 21, 2025

