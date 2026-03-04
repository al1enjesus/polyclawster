/**
 * e2e-flow.test.js — end-to-end тесты реального флоу ставок
 * Проверяет: ставка → сохранение в DB → отображение в portfolio
 * 
 * Запуск: node tests/e2e-flow.test.js [baseUrl]
 * Пример: node tests/e2e-flow.test.js https://polyclawster.com
 */
'use strict';
const https = require('https');
const http  = require('http');

const BASE = process.argv[2] || process.env.TEST_URL || 'http://localhost:3000';
const TG_ID = process.env.TEST_TG_ID || '399089761';
let passed = 0, failed = 0;

function ok(cond, msg) {
  if (cond) { console.log('  ✅', msg); passed++; }
  else       { console.error('  ❌', msg); failed++; }
}

function api(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const lib = u.protocol === 'https:' ? https : http;
    const body = opts.body ? JSON.stringify(opts.body) : null;
    const r = lib.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'e2e-test',
                 ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) },
      timeout: 12000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    r.on('error', reject).on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (body) r.write(body);
    r.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\n🧪 PolyEdge E2E Flow Tests');
  console.log('   URL:', BASE, '| tgId:', TG_ID);
  console.log('');

  // ── 1. Читаем начальное состояние ────────────────────────────
  console.log('📊 Step 1: Get initial portfolio state');
  const init = await api('/api/portfolio?tgId=' + TG_ID);
  ok(init.status === 200, 'portfolio 200');
  ok(init.body.ok === true, 'portfolio ok');
  const initDemoBal = init.body.portfolio?.demoBalance || 0;
  const initBetsCount = (init.body.portfolio?.bets || []).length;
  const initActiveBets = (init.body.portfolio?.activeBets || []).length;
  console.log(`   demo_balance=$${initDemoBal} | bets=${initBetsCount} | activeBets=${initActiveBets}`);
  ok(Array.isArray(init.body.portfolio?.bets), 'portfolio has bets array');
  ok(Array.isArray(init.body.portfolio?.activeBets), 'portfolio has activeBets array');

  // ── 2. Размещаем demo ставку ──────────────────────────────────
  console.log('\n💸 Step 2: Place demo bet ($1 YES)');
  const betAmt = 1;
  const bet = await api('/api/trade', {
    method: 'POST',
    body: {
      tgId: TG_ID,
      market: 'E2E Test Market ' + Date.now(),
      conditionId: 'test-condition-e2e',
      slug: 'e2e-test',
      side: 'YES',
      amount: betAmt,
      signalScore: 7.5,
      isDemo: true
    }
  });
  ok(bet.status === 200, 'trade API 200');
  ok(bet.body.ok === true, 'trade ok:true');
  ok(bet.body.isDemo === true, 'isDemo:true');
  console.log('   response:', bet.body.message);

  // ── 3. Ждём 1 сек и проверяем portfolio ──────────────────────
  console.log('\n⏳ Step 3: Wait 1s then check portfolio reflects bet');
  await sleep(1000);

  const after = await api('/api/portfolio?tgId=' + TG_ID);
  ok(after.status === 200, 'portfolio after bet 200');
  ok(after.body.ok === true, 'portfolio ok');
  
  const afterBetsCount  = (after.body.portfolio?.bets || []).length;
  const afterActiveBets = (after.body.portfolio?.activeBets || []).length;
  const afterDemoBal    = after.body.portfolio?.demoBalance;
  
  console.log(`   bets: ${initBetsCount} → ${afterBetsCount} | activeBets: ${initActiveBets} → ${afterActiveBets} | demoBalance: $${initDemoBal} → $${afterDemoBal}`);
  ok(afterBetsCount > initBetsCount, `bets count increased (${initBetsCount} → ${afterBetsCount})`);
  ok(afterActiveBets > initActiveBets, `activeBets count increased (${initActiveBets} → ${afterActiveBets})`);
  ok(afterDemoBal !== undefined, 'demoBalance field present in portfolio');

  // Проверяем что demo_balance уменьшился
  if (initDemoBal > 0) {
    ok(afterDemoBal < initDemoBal, `demo_balance decreased ($${initDemoBal} → $${afterDemoBal})`);
  } else {
    console.log('   ⚠️  initDemoBal=0, skip deduction check');
  }

  // ── 4. Проверяем последнюю ставку в bets ─────────────────────
  console.log('\n🔍 Step 4: Verify bet details in bets array');
  const bets = after.body.portfolio?.bets || [];
  const lastBet = bets.find(b => b.is_demo && b.market && b.market.includes('E2E Test'));
  ok(!!lastBet, 'E2E test bet found in bets array');
  if (lastBet) {
    ok(lastBet.side === 'YES', 'correct side: YES');
    ok(parseFloat(lastBet.amount) === betAmt, `correct amount: $${betAmt}`);
    ok(lastBet.status === 'open', 'status: open');
    ok(lastBet.is_demo === true, 'is_demo: true');
    console.log('   bet:', JSON.stringify({ market: lastBet.market?.slice(0,30), side: lastBet.side, amount: lastBet.amount, status: lastBet.status }));
  }

  // ── 5. Проверяем activeBets содержит нашу ставку ─────────────
  console.log('\n📋 Step 5: Check activeBets contains our bet');
  const activeBets = after.body.portfolio?.activeBets || [];
  const ourActive = activeBets.find(b => b.is_demo && b.market && b.market.includes('E2E Test'));
  ok(!!ourActive, 'bet appears in activeBets');

  // ── 6. Trade validation edge cases ───────────────────────────
  console.log('\n🛡️  Step 6: Trade validation');
  
  const noTgId = await api('/api/trade', { method: 'POST', body: { market: 'x', amount: 1 } });
  ok(noTgId.body.ok === false, 'rejects missing tgId');
  
  const noAmt = await api('/api/trade', { method: 'POST', body: { tgId: TG_ID, market: 'x' } });
  ok(noAmt.body.ok === false, 'rejects missing amount');
  
  const tooSmall = await api('/api/trade', { method: 'POST', body: { tgId: TG_ID, market: 'x', amount: 0.1 } });
  ok(tooSmall.body.ok === false, 'rejects amount < $1');

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(45));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) { console.error(`\n⚠️  ${failed} test(s) FAILED`); process.exit(1); }
  else { console.log('\n🎉 All E2E tests passed!'); }
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
