/**
 * betting.test.js — автотесты для системы ставок PolyEdge
 * Запуск: node tests/betting.test.js
 * Требует: запущенный dev-сервер на PORT (default 3000) или Vercel
 */
'use strict';

const http = require('http');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const TEST_TG_ID = process.env.TEST_TG_ID || '399089761';

// ── Helpers ─────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  ✅', msg);
    passed++;
  } else {
    console.error('  ❌', msg);
    failed++;
  }
}

function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const body = opts.body ? JSON.stringify(opts.body) : null;
    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'polyedge-test',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
      timeout: 10000,
    };
    const r = lib.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (body) r.write(body);
    r.end();
  });
}

// ── Tests ────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n🧪 PolyEdge Betting System Tests');
  console.log('   Base URL:', BASE_URL);
  console.log('   Test tgId:', TEST_TG_ID);
  console.log('');

  // ── 1. GET /api/signals ──────────────────────────────────────
  console.log('📡 Test 1: GET /api/signals');
  try {
    const r = await req(BASE_URL + '/api/signals');
    assert(r.status === 200, 'HTTP 200');
    assert(typeof r.body === 'object', 'Response is JSON');
    assert(r.body.ok === true, 'ok === true');
    assert(Array.isArray(r.body.signals), 'signals is array');
    if (Array.isArray(r.body.signals) && r.body.signals.length > 0) {
      const s = r.body.signals[0];
      assert(typeof s.score === 'number', 'signal has score field');
      assert(typeof s.type === 'string', 'signal has type field');
    }
  } catch(e) {
    assert(false, 'Request failed: ' + e.message);
  }

  // ── 2. GET /api/portfolio without tgId ──────────────────────
  console.log('\n📊 Test 2: GET /api/portfolio without tgId');
  try {
    const r = await req(BASE_URL + '/api/portfolio');
    assert(r.status === 200, 'HTTP 200');
    assert(r.body.ok === true, 'ok === true');
    assert(typeof r.body.portfolio === 'object', 'has portfolio object');
    assert(Array.isArray(r.body.signals), 'has signals array');
  } catch(e) {
    assert(false, 'Request failed: ' + e.message);
  }

  // ── 3. GET /api/portfolio with tgId ─────────────────────────
  console.log('\n📊 Test 3: GET /api/portfolio?tgId=' + TEST_TG_ID);
  try {
    const r = await req(BASE_URL + '/api/portfolio?tgId=' + TEST_TG_ID);
    assert(r.status === 200, 'HTTP 200');
    assert(r.body.ok === true, 'ok === true');
    assert(typeof r.body.portfolio === 'object', 'has portfolio object');
    assert(Array.isArray(r.body.portfolio.bets) || r.body.portfolio.bets === undefined, 'bets is array or absent');
    assert(Array.isArray(r.body.portfolio.activeBets) || r.body.portfolio.activeBets === undefined, 'activeBets is array or absent');
    console.log('   activeBets count:', (r.body.portfolio.activeBets || []).length);
  } catch(e) {
    assert(false, 'Request failed: ' + e.message);
  }

  // ── 4. POST /api/trade without tgId ─────────────────────────
  console.log('\n💸 Test 4: POST /api/trade — missing tgId');
  try {
    const r = await req(BASE_URL + '/api/trade', {
      method: 'POST',
      body: { market: 'Test', amount: 5, side: 'YES' }
    });
    assert(r.status === 200, 'HTTP 200');
    assert(r.body.ok === false, 'ok === false (missing tgId)');
    assert(typeof r.body.error === 'string', 'has error message');
  } catch(e) {
    assert(false, 'Request failed: ' + e.message);
  }

  // ── 5. POST /api/trade without amount ───────────────────────
  console.log('\n💸 Test 5: POST /api/trade — missing amount');
  try {
    const r = await req(BASE_URL + '/api/trade', {
      method: 'POST',
      body: { tgId: TEST_TG_ID, market: 'Test', side: 'YES' }
    });
    assert(r.status === 200, 'HTTP 200');
    assert(r.body.ok === false, 'ok === false (missing amount)');
  } catch(e) {
    assert(false, 'Request failed: ' + e.message);
  }

  // ── 6. POST /api/trade below minimum ────────────────────────
  console.log('\n💸 Test 6: POST /api/trade — amount below minimum ($1)');
  try {
    const r = await req(BASE_URL + '/api/trade', {
      method: 'POST',
      body: { tgId: TEST_TG_ID, market: 'Test', side: 'YES', amount: 0.5 }
    });
    assert(r.status === 200, 'HTTP 200');
    assert(r.body.ok === false, 'ok === false (below minimum)');
    assert((r.body.error || '').toLowerCase().includes('minimum') || (r.body.error || '').toLowerCase().includes('1'), 'error mentions minimum');
  } catch(e) {
    assert(false, 'Request failed: ' + e.message);
  }

  // ── 7. POST /api/trade — demo bet ───────────────────────────
  console.log('\n💸 Test 7: POST /api/trade — demo bet (should always work)');
  try {
    const r = await req(BASE_URL + '/api/trade', {
      method: 'POST',
      body: {
        tgId: TEST_TG_ID,
        market: 'Will this test pass?',
        conditionId: '',
        slug: '',
        side: 'YES',
        amount: 5,
        isDemo: true
      }
    });
    assert(r.status === 200, 'HTTP 200');
    assert(r.body.ok === true, 'ok === true for demo bet');
    assert(r.body.isDemo === true, 'isDemo === true');
  } catch(e) {
    assert(false, 'Request failed: ' + e.message);
  }

  // ── 8. GET /api/wallet ───────────────────────────────────────
  console.log('\n💼 Test 8: GET /api/wallet?tgId=' + TEST_TG_ID);
  try {
    const r = await req(BASE_URL + '/api/wallet?tgId=' + TEST_TG_ID);
    assert(r.status === 200, 'HTTP 200');
    // Either ok:true with data or ok:false with error - both valid depending on user existence
    assert(typeof r.body === 'object', 'Response is JSON');
    if (r.body.ok) {
      assert(typeof r.body.data === 'object', 'has data object');
      console.log('   wallet address:', r.body.data.address ? r.body.data.address.slice(0, 12) + '...' : 'none');
    } else {
      console.log('   wallet not found (user may not exist)');
    }
  } catch(e) {
    assert(false, 'Request failed: ' + e.message);
  }

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`\n⚠️  ${failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

runTests().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
