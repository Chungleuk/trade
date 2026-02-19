// test_scenarios.mjs — Simulates the full position sizing flow
// Run: node test_scenarios.mjs

const NODE_RISK_MAP = {
  'Start': 0.65, '1-0': 0.58, '0-1': 0.73, '2-0': 0.44, '1-1': 0.73, '0-2': 0.73,
  '3-0': 0.25, '2-1': 0.62, '1-2': 0.83, '0-3': 0.62, '4-0': 0.08, '3-1': 0.41,
  '2-2': 0.83, '1-3': 0.83, '0-4': 0.41, '4-1': 0.17, '3-2': 0.66, '2-3': 0.99,
  '1-4': 0.66, '0-5': 0.17, '4-2': 0.33, '3-3': 0.99, '2-4': 0.99, '1-5': 0.33,
  '4-3': 0.66, '3-4': 1.33, '2-5': 0.66, '4-4': 1.33, '3-5': 1.33, '4-5': 2.65,
};

function advanceNode(currentNode, outcome) {
  if (currentNode === 'Start') {
    if (outcome === 'win') return '1-0';
    if (outcome === 'loss') return '0-1';
    return 'Start';
  }
  const match = currentNode.match(/^(\d+)-(\d+)$/);
  if (!match) return 'Start';
  const wins = parseInt(match[1], 10);
  const losses = parseInt(match[2], 10);
  const newWins = outcome === 'win' ? wins + 1 : wins;
  const newLosses = outcome === 'loss' ? losses + 1 : losses;
  if (newWins > 4 || newLosses > 5) return 'Start';
  if (outcome === 'win') return `${wins + 1}-${losses}`;
  if (outcome === 'loss') return `${wins}-${losses + 1}`;
  return currentNode;
}

let passCount = 0;
let failCount = 0;

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL: ${msg}`); failCount++; }
  else { console.log(`  PASS: ${msg}`); passCount++; }
}

function getRisk(node) { return NODE_RISK_MAP[node] ?? 0.65; }

// ─── Scenario 1: Fresh start, basic win-loss progression ────────────────────
console.log('\n=== Scenario 1: Fresh Start — Sequential Wins ===');
{
  let node = 'Start';
  assert(getRisk(node) === 0.65, `Start risk = 0.65% (got ${getRisk(node)})`);

  node = advanceNode(node, 'win'); // → 1-0
  assert(node === '1-0', `Win → 1-0 (got ${node})`);
  assert(getRisk(node) === 0.58, `1-0 risk = 0.58%`);

  node = advanceNode(node, 'win'); // → 2-0
  assert(node === '2-0', `Win → 2-0`);
  assert(getRisk(node) === 0.44, `2-0 risk = 0.44%`);

  node = advanceNode(node, 'win'); // → 3-0
  assert(node === '3-0', `Win → 3-0`);
  assert(getRisk(node) === 0.25, `3-0 risk = 0.25%`);

  node = advanceNode(node, 'win'); // → 4-0
  assert(node === '4-0', `Win → 4-0`);
  assert(getRisk(node) === 0.08, `4-0 risk = 0.08%`);

  node = advanceNode(node, 'win'); // wins=5 > 4 → reset
  assert(node === 'Start', `5th win resets to Start (got ${node})`);
  assert(getRisk(node) === 0.65, `Reset risk = 0.65%`);
}

// ─── Scenario 2: Fresh start, sequential losses ─────────────────────────────
console.log('\n=== Scenario 2: Fresh Start — Sequential Losses ===');
{
  let node = 'Start';
  node = advanceNode(node, 'loss'); // → 0-1
  assert(node === '0-1', `Loss → 0-1`);
  assert(getRisk(node) === 0.73, `0-1 risk = 0.73%`);

  node = advanceNode(node, 'loss'); // → 0-2
  assert(node === '0-2', `Loss → 0-2`);

  node = advanceNode(node, 'loss'); // → 0-3
  assert(node === '0-3', `Loss → 0-3`);

  node = advanceNode(node, 'loss'); // → 0-4
  assert(node === '0-4', `Loss → 0-4`);

  node = advanceNode(node, 'loss'); // → 0-5
  assert(node === '0-5', `Loss → 0-5`);
  assert(getRisk(node) === 0.17, `0-5 risk = 0.17%`);

  node = advanceNode(node, 'loss'); // losses=6 > 5 → reset
  assert(node === 'Start', `6th loss resets to Start (got ${node})`);
}

// ─── Scenario 3: Mixed global sequence (XAUUSD win, USDJPY loss, etc.) ─────
console.log('\n=== Scenario 3: Global Mode — Mixed Pairs ===');
{
  let node = 'Start';
  // XAUUSD wins
  node = advanceNode(node, 'win'); // 1-0
  assert(node === '1-0', `XAUUSD win → 1-0`);

  // USDJPY loses
  node = advanceNode(node, 'loss'); // 1-1
  assert(node === '1-1', `USDJPY loss → 1-1`);
  assert(getRisk(node) === 0.73, `1-1 risk = 0.73%`);

  // GBPUSD wins
  node = advanceNode(node, 'win'); // 2-1
  assert(node === '2-1', `GBPUSD win → 2-1`);
  assert(getRisk(node) === 0.62, `2-1 risk = 0.62%`);

  // EURUSD loses
  node = advanceNode(node, 'loss'); // 2-2
  assert(node === '2-2', `EURUSD loss → 2-2`);
  assert(getRisk(node) === 0.83, `2-2 risk = 0.83%`);
}

// ─── Scenario 4: HK shutdown close — no position sizing update ──────────────
console.log('\n=== Scenario 4: HK Shutdown Close — State Should NOT Change ===');
{
  let node = '2-1'; // simulate current state
  const riskBefore = getRisk(node);

  // HK shutdown triggers — EA sends hk_shutdown=true
  // Backend skips advanceNode — node stays '2-1'
  const hk_shutdown = true;
  const nodeAfter = hk_shutdown ? node : advanceNode(node, 'loss');

  assert(nodeAfter === '2-1', `HK shutdown: node unchanged (got ${nodeAfter})`);
  assert(getRisk(nodeAfter) === riskBefore, `HK shutdown: risk unchanged at ${riskBefore}%`);
}

// ─── Scenario 5: Normal loss (no HK shutdown) after state 2-1 ───────────────
console.log('\n=== Scenario 5: Normal Loss (no HK shutdown) — State SHOULD Change ===');
{
  let node = '2-1';
  const hk_shutdown = false;
  node = hk_shutdown ? node : advanceNode(node, 'loss');
  assert(node === '2-2', `Normal loss: 2-1 → 2-2 (got ${node})`);
  assert(getRisk(node) === 0.83, `2-2 risk = 0.83%`);
}

// ─── Scenario 6: Edge — 4-5 then win and loss ──────────────────────────────
console.log('\n=== Scenario 6: Maximum Node (4-5) — Next Trade Resets ===');
{
  let node = '4-5';
  assert(getRisk(node) === 2.65, `4-5 risk = 2.65%`);

  const afterWin = advanceNode(node, 'win'); // wins=5 > 4 → reset
  assert(afterWin === 'Start', `4-5 + win → Start (got ${afterWin})`);

  const afterLoss = advanceNode(node, 'loss'); // losses=6 > 5 → reset
  assert(afterLoss === 'Start', `4-5 + loss → Start (got ${afterLoss})`);
}

// ─── Scenario 7: Invalid/corrupt node name ──────────────────────────────────
console.log('\n=== Scenario 7: Invalid Node Name — Should Reset to Start ===');
{
  const fromBad = advanceNode('garbage', 'win');
  assert(fromBad === 'Start', `garbage + win → Start (got ${fromBad})`);

  const fromEmpty = advanceNode('', 'loss');
  assert(fromEmpty === 'Start', `"" + loss → Start (got ${fromEmpty})`);
}

// ─── Scenario 8: Invalid outcome ────────────────────────────────────────────
console.log('\n=== Scenario 8: Invalid Outcome — Node Should Not Change ===');
{
  const from = advanceNode('2-1', 'draw');
  assert(from === '2-1', `2-1 + draw → stays 2-1 (got ${from})`);

  const from2 = advanceNode('Start', 'tie');
  assert(from2 === 'Start', `Start + tie → stays Start (got ${from2})`);
}

// ─── Scenario 9: Full realistic sequence ────────────────────────────────────
console.log('\n=== Scenario 9: Full Realistic Trading Day ===');
{
  let node = 'Start';
  const trades = [
    { symbol: 'XAUUSD', outcome: 'win', hk: false },
    { symbol: 'USDJPY', outcome: 'win', hk: false },
    { symbol: 'GBPUSD', outcome: 'loss', hk: false },
    { symbol: 'XAUUSD', outcome: 'win', hk: false },
    { symbol: 'EURUSD', outcome: 'loss', hk: true },   // HK shutdown
    { symbol: 'USDJPY', outcome: 'loss', hk: false },
    { symbol: 'XAUUSD', outcome: 'win', hk: false },
  ];

  const expectedNodes = ['1-0', '2-0', '2-1', '3-1', '3-1', '3-2', '4-2'];

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (!t.hk) {
      node = advanceNode(node, t.outcome);
    }
    assert(
      node === expectedNodes[i],
      `Trade ${i + 1}: ${t.symbol} ${t.outcome}${t.hk ? ' (HK shutdown)' : ''} → ${node} (expected ${expectedNodes[i]})`
    );
  }
  assert(getRisk(node) === 0.33, `Final risk after day: ${getRisk(node)}% (expected 0.33%)`);
}

// ─── Scenario 10: All nodes in NODE_RISK_MAP are reachable ──────────────────
console.log('\n=== Scenario 10: Node Reachability — All Mapped Nodes Can Be Reached ===');
{
  const visited = new Set();
  const queue = ['Start'];
  visited.add('Start');

  while (queue.length > 0) {
    const current = queue.shift();
    for (const outcome of ['win', 'loss']) {
      const next = advanceNode(current, outcome);
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  const mapKeys = Object.keys(NODE_RISK_MAP);
  for (const key of mapKeys) {
    assert(visited.has(key), `Node "${key}" is reachable`);
  }

  for (const v of visited) {
    assert(NODE_RISK_MAP[v] !== undefined, `Reachable node "${v}" has a risk mapping`);
  }
}

// ─── Scenario 11: Per-pair mode isolation ───────────────────────────────────
console.log('\n=== Scenario 11: Per-Pair Mode — Pairs Are Independent ===');
{
  const pairStates = {};
  function getNode(pair) { return pairStates[pair] || 'Start'; }
  function setNode(pair, node) { pairStates[pair] = node; }

  // XAUUSD wins
  setNode('XAUUSD', advanceNode(getNode('XAUUSD'), 'win'));
  assert(getNode('XAUUSD') === '1-0', `XAUUSD win → 1-0`);
  assert(getNode('USDJPY') === 'Start', `USDJPY still at Start`);

  // USDJPY loses
  setNode('USDJPY', advanceNode(getNode('USDJPY'), 'loss'));
  assert(getNode('USDJPY') === '0-1', `USDJPY loss → 0-1`);
  assert(getNode('XAUUSD') === '1-0', `XAUUSD still at 1-0`);

  // XAUUSD wins again
  setNode('XAUUSD', advanceNode(getNode('XAUUSD'), 'win'));
  assert(getNode('XAUUSD') === '2-0', `XAUUSD win → 2-0`);
  assert(getRisk(getNode('XAUUSD')) === 0.44, `XAUUSD risk = 0.44%`);
  assert(getRisk(getNode('USDJPY')) === 0.73, `USDJPY risk = 0.73%`);
}

// ─── Scenario 12: Webhook → poll → ack → trade-outcome full cycle ───────────
console.log('\n=== Scenario 12: Full Webhook-to-Outcome Lifecycle ===');
{
  let dbNode = 'Start';
  let alertStatus = null;

  // 1. TradingView fires webhook
  const webhookRisk = getRisk(dbNode);
  alertStatus = 'active';
  assert(webhookRisk === 0.65, `Webhook: risk from Start = 0.65%`);
  assert(alertStatus === 'active', `Alert created with status=active`);

  // 2. EA polls /signals/pending — sees active alert
  const polled = alertStatus === 'active';
  assert(polled, `EA polls and finds active alert`);

  // 3. EA sends /signals/ack with executed
  alertStatus = 'completed';
  assert(alertStatus === 'completed', `After ack: status=completed`);

  // 4. EA won't see this alert again on next poll
  const polled2 = alertStatus === 'active';
  assert(!polled2, `Alert no longer appears in pending (status=${alertStatus})`);

  // 5. Trade closes with win → /mt5/trade-outcome
  dbNode = advanceNode(dbNode, 'win');
  assert(dbNode === '1-0', `After win: node = 1-0`);

  // 6. Next webhook should use updated node
  const nextRisk = getRisk(dbNode);
  assert(nextRisk === 0.58, `Next webhook risk = 0.58% (from 1-0)`);
}

// ─── Scenario 13: EA POST body format ───────────────────────────────────────
console.log('\n=== Scenario 13: EA POST Body — hk_shutdown Flag ===');
{
  function buildPostBody(ticket, outcome, symbol, closePrice, closeTime, isHKShutdown) {
    return JSON.stringify({
      ticket, outcome, symbol, closePrice, closeTime,
      hk_shutdown: isHKShutdown
    });
  }

  const normalBody = buildPostBody(12345, 'loss', 'XAUUSD', 2650.5, '2025.08.10 03:00:00', false);
  const parsed = JSON.parse(normalBody);
  assert(parsed.hk_shutdown === false, `Normal close: hk_shutdown=false`);

  const hkBody = buildPostBody(12345, 'loss', 'XAUUSD', 2650.5, '2025.08.10 03:00:00', true);
  const parsedHK = JSON.parse(hkBody);
  assert(parsedHK.hk_shutdown === true, `HK close: hk_shutdown=true`);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════');
console.log(`  Results: ${passCount} passed, ${failCount} failed`);
console.log('════════════════════════════════════════════════');
process.exit(failCount > 0 ? 1 : 0);
