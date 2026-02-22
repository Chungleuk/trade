#!/usr/bin/env node
// E2E API test: webhook → signals/pending (GET + POST) → ack → trade-outcome
// Run: BASE_URL=http://localhost:3001 node e2e_api_test.mjs
// Or: BASE_URL=https://your-backend.onrender.com node e2e_api_test.mjs

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const SIGNAL_ID = `E2E-${Date.now()}`;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { console.log(`  PASS: ${msg}`); pass++; }
  else { console.error(`  FAIL: ${msg}`); fail++; }
}

async function run() {
  console.log(`\nE2E API test → ${BASE_URL}\n`);

  // 1. Webhook: create signal
  let res, data;
  try {
    res = await fetch(`${BASE_URL}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'BUY',
        symbol: 'XAUUSD',
        entry: 2650.5,
        target: 2658,
        stop: 2643,
        id: SIGNAL_ID,
        rr: '1',
        risk: '0.65%',
        timeframe: '15'
      })
    });
    data = await res.json();
  } catch (e) {
    console.error('  FAIL: Webhook request error:', e.message);
    fail++;
    console.log(`\nResult: ${pass} passed, ${fail} failed`);
    process.exit(1);
  }
  ok(res.ok, `Webhook returns ${res.status}`);
  ok(data.success === true, 'Webhook response success = true');
  ok(data.risk != null, 'Webhook returns risk');

  // 2. GET /signals/pending
  try {
    res = await fetch(`${BASE_URL}/signals/pending`);
    data = await res.json();
  } catch (e) {
    console.error('  FAIL: GET /signals/pending error:', e.message);
    fail++;
  }
  ok(res.ok, `GET /signals/pending returns ${res.status}`);
  ok(Array.isArray(data.signals), 'Response has signals array');
  const found = data.signals.find(s => s.id === SIGNAL_ID);
  ok(found != null, `Signal ${SIGNAL_ID} appears in pending`);
  if (found) {
    ok(found.symbol === 'XAUUSD' && found.action === 'BUY', 'Signal fields correct');
    ok(parseFloat(found.entry) === 2650.5 && parseFloat(found.stop) === 2643, 'Entry and stop parsed');
  }

  // 3. POST /signals/pending
  try {
    res = await fetch(`${BASE_URL}/signals/pending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    data = await res.json();
  } catch (e) {
    console.error('  FAIL: POST /signals/pending error:', e.message);
    fail++;
  }
  ok(res.ok, `POST /signals/pending returns ${res.status}`);
  ok(Array.isArray(data.signals), 'POST response has signals array');

  // 4. Ack executed
  try {
    res = await fetch(`${BASE_URL}/signals/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId: SIGNAL_ID, status: 'executed' })
    });
    data = await res.json();
  } catch (e) {
    console.error('  FAIL: /signals/ack error:', e.message);
    fail++;
  }
  ok(res.ok, `POST /signals/ack returns ${res.status}`);

  // 5. Trade outcome
  try {
    res = await fetch(`${BASE_URL}/mt5/trade-outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket: 99999,
        outcome: 'loss',
        symbol: 'XAUUSD',
        closePrice: 2643,
        closeTime: new Date().toISOString()
      })
    });
    data = await res.json();
  } catch (e) {
    console.error('  FAIL: /mt5/trade-outcome error:', e.message);
    fail++;
  }
  ok(res.ok, `POST /mt5/trade-outcome returns ${res.status}`);
  ok(data.status === 'success' || data.message != null, 'Trade outcome accepted');

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
