/**
 * betting.test.js — Auto-tests for PolyEdge betting system
 * Run: node tests/betting.test.js
 * Requires server running on PORT (default 3000) or set PORT env var
 */

'use strict';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
let passed = 0;
let failed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ FAIL  ${name}`);
    console.log(`         ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function postJSON(path, body) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}

async function getJSON(path) {
  const r = await fetch(`${BASE_URL}${path}`);
  return { status: r.status, data: await r.json() };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log(`\n🧪 PolyEdge Betting Tests — ${BASE_URL}\n`);

  // Test 1: POST /api/trade with valid data returns ok:true or a meaningful error
  await test('POST /api/trade with valid data returns ok:true or meaningful error', async () => {
    const { status, data } = await postJSON('/api/trade', {
      tgId: '000000001',
      market: 'Will BTC exceed $100k by 2025?',
      conditionId: 'test-condition-id',
      slug: 'btc-100k-2025',
      side: 'YES',
      amount: 5,
      signalScore: 8,
    });
    // Either ok:true (success) or ok:false with a real error message — both acceptable
    assert(
      typeof data === 'object',
      `Expected JSON response, got: ${JSON.stringify(data)}`
    );
    assert(
      data.ok === true || (data.ok === false && typeof data.error === 'string'),
      `Expected ok:true or ok:false with error string. Got: ${JSON.stringify(data)}`
    );
  });

  // Test 2: POST /api/trade without tgId returns ok:false
  await test('POST /api/trade without tgId returns ok:false', async () => {
    const { data } = await postJSON('/api/trade', {
      market: 'Test Market',
      conditionId: 'cid',
      slug: 'test',
      side: 'YES',
      amount: 5,
    });
    assert(data.ok === false, `Expected ok:false, got: ${JSON.stringify(data)}`);
    assert(typeof data.error === 'string', 'Expected error message string');
  });

  // Test 3: POST /api/trade without amount returns ok:false
  await test('POST /api/trade without amount returns ok:false', async () => {
    const { data } = await postJSON('/api/trade', {
      tgId: '000000001',
      market: 'Test Market',
      conditionId: 'cid',
      slug: 'test',
      side: 'YES',
    });
    assert(data.ok === false, `Expected ok:false, got: ${JSON.stringify(data)}`);
    assert(typeof data.error === 'string', 'Expected error message string');
  });

  // Test 4: GET /api/portfolio?tgId=xxx returns field bets
  await test('GET /api/portfolio?tgId=xxx returns field bets', async () => {
    const { status, data } = await getJSON('/api/portfolio?tgId=000000001');
    assert(status === 200, `Expected status 200, got ${status}`);
    const portfolio = data.portfolio || data.data?.portfolio || data;
    assert(
      portfolio !== null && typeof portfolio === 'object',
      `Expected portfolio object, got: ${JSON.stringify(portfolio)}`
    );
    assert(
      'bets' in portfolio || data.portfolio?.bets !== undefined || data.data?.portfolio?.bets !== undefined,
      `Expected bets field in portfolio response. Keys: ${Object.keys(portfolio).join(', ')}`
    );
  });

  // Test 5: GET /api/signals returns array of signals
  await test('GET /api/signals returns array of signals', async () => {
    const { status, data } = await getJSON('/api/signals');
    assert(status === 200, `Expected status 200, got ${status}`);
    const signals = data.signals || data;
    assert(Array.isArray(signals), `Expected array, got: ${typeof signals}`);
  });

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('⚠️  Some tests failed. Check the server output.\n');
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!\n');
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err.message);
  process.exit(1);
});
