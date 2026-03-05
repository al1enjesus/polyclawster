#!/usr/bin/env node
/**
 * edge/index.js — Orchestrator
 *
 * Runs all signal modules, scores, deduplicates, sends alerts.
 *
 * Signal priority (score 0–10):
 *   8–10 → STRONG (send immediately)
 *   5–7  → MEDIUM (group, send top 3)
 *   <5   → WEAK (log only)
 */

const { getTopMarkets, filterPolitical } = require('./modules/markets');
const { scanOrderbooks, scanVolumeSpikes } = require('./modules/orderbook');
const { discoverWallets, checkActivity } = require('./modules/wallets');
const { scanCrossMarket } = require('./modules/cross');
const { fetchNews, findNewsEdge } = require('./modules/news');
const { sendTg, formatSignal } = require('./modules/notify');
const { load, save, loadSet, saveSet } = require('./modules/state');
const cfg = require('./config');
const { executeTrades } = require('./modules/trade');
const signalsStore  = require('./modules/signals-store');
const db            = require('../lib/db');
const { scanRisk } = require('./modules/risk');
const { checkResolutions } = require('./modules/tracker');
const { syncAll: syncBalances } = require('./modules/sync-balances');
const { checkAndSwapAll } = require('./modules/auto-swap');

// ── Push file to GitHub ──────────────────────────────────────
async function ghPush(filename, content, token=process.env.GH_TOKEN||'') {
  const https = require('https');
  const repo = 'al1enjesus/polyclawster-app';
  // Get current SHA
  const sha = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${repo}/contents/${filename}`,
      method: 'GET',
      headers: { 'Authorization': 'token ' + token, 'User-Agent': 'edge-runner' },
      timeout: 8000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d).sha); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
  // sha=null means file doesn't exist yet — will create it
  const putPayload = {
    message: `sync: update ${filename} [edge-runner]`,
    content: Buffer.from(content).toString('base64'),
  };
  if (sha) putPayload.sha = sha;
  const body = JSON.stringify(putPayload);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${repo}/contents/${filename}`,
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + token,
        'User-Agent': 'edge-runner',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        console.log('[ghPush]', filename, ok ? '✅' : '❌', res.statusCode);
        resolve(ok);
      });
    });
    req.on('error', e => { console.log('[ghPush] error:', e.message); resolve(false); });
    req.on('timeout', () => { req.destroy(); console.log('[ghPush] timeout'); resolve(false); });
    req.write(body); req.end();
  });
}





const sleep = ms => new Promise(r => setTimeout(r, ms));

const SCORE_STRONG = 7.5;
const SCORE_MEDIUM = 5.0;

async function main() {
  const t0 = Date.now();

  // ── RISK MANAGEMENT (runs first) ─────────────────────────────
  try { await scanRisk(); } catch(e) { console.log('[risk] skip:', e.message?.slice(0,50)); }
  try { await checkResolutions(); } catch(e) { console.log('[tracker] skip:', e.message?.slice(0,50)); }
  try { await syncBalances(); } catch(e) { console.log('[sync] skip:', e.message?.slice(0,50)); }
  try { await checkAndSwapAll(); } catch(e) { console.log('[swap] skip:', e.message?.slice(0,50)); }

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`🤖 POLYMARKET EDGE — ${new Date().toISOString()}`);
  console.log('═'.repeat(55));

  // Load state
  const state    = load(cfg.STATE, {});
  const seen     = loadSet(cfg.SEEN);
  const obState  = state.ob || {};
  const volState = state.vol || {};
  const crossState = state.cross || {};

  // ── 1. Fetch markets (cached 25 min) ──────────────────────────────────
  console.log('\n[1/5] Fetching markets...');
  const allMarkets   = await getTopMarkets({ limit: 200 });
  const polMarkets   = filterPolitical(allMarkets);
  console.log(`      ${allMarkets.length} total → ${polMarkets.length} political`);

  const allSignals = [];

  // ── 2. Orderbook + price drift + volume spike ──────────────────────────
  console.log('\n[2/5] Orderbook analysis...');
  const { signals: obSigs, newState: obNew } = await scanOrderbooks(polMarkets, obState);
  const { signals: volSigs, newVolumes } = await scanVolumeSpikes(volState);
  allSignals.push(...obSigs, ...volSigs);
  console.log(`      OB: ${obSigs.length} | VOL: ${volSigs.length}`);

  // ── 3. Smart wallet discovery + activity ──────────────────────────────
  console.log('\n[3/5] Smart wallets...');
  const walletDb = await discoverWallets(allMarkets);
  const swAlerts = await checkActivity(walletDb, allMarkets, seen);
  allSignals.push(...swAlerts);
  console.log(`      SW alerts: ${swAlerts.length}`);

  // ── 4. Cross-market correlations ──────────────────────────────────────
  console.log('\n[4/5] Cross-market...');
  const { signals: crossSigs, newPrices } = await scanCrossMarket(polMarkets, crossState);
  allSignals.push(...crossSigs);
  console.log(`      Cross: ${crossSigs.length}`);

  // ── 5. News edge ──────────────────────────────────────────────────────
  console.log('\n[5/5] News edge...');
  const news = await fetchNews(['Iran war ceasefire', 'Khamenei successor IRGC', 'Ukraine Russia peace', 'Bitcoin market']);
  const newsSigs = await findNewsEdge(polMarkets, news);
  allSignals.push(...newsSigs);
  console.log(`      News signals: ${newsSigs.length}`);

  // ── Save state ────────────────────────────────────────────────────────
  save(cfg.STATE, { ob: obNew, vol: newVolumes, cross: newPrices, ts: Date.now() });
  saveSet(cfg.SEEN, seen);

  // ── Enrich top signals with Perplexity news context ──────────────────
  const topToEnrich = allSignals.filter(s => s.score >= SCORE_MEDIUM).slice(0, 6);
  if (topToEnrich.length > 0) {
    try {
      const topics = [...new Set(topToEnrich.map(s =>
        (s.market || s.title || s.triggerMarket || '').split(' ').slice(0, 6).join(' ')
      ))].filter(Boolean).slice(0, 4);
      if (topics.length > 0) {
        const newsText = await fetchNews(topics);
        const newsLines = (newsText || '').split('\n').filter(l => l.trim().length > 25);
        for (const s of topToEnrich) {
          const mktWords = (s.market || s.title || '').toLowerCase().split(' ').filter(w => w.length > 4);
          const matchLine = newsLines.find(line =>
            mktWords.filter(w => line.toLowerCase().includes(w)).length >= 2
          );
          if (matchLine) s.newsContext = matchLine.replace(/^[-•*\[\]\d.]+/, '').trim();
        }
      }
    } catch(e) { console.log('[enrich] error:', e.message); }
  }

  // ── Score & route ─────────────────────────────────────────────────────
  const strong = allSignals.filter(s => s.score >= SCORE_STRONG).sort((a,b) => b.score - a.score);
  const medium = allSignals.filter(s => s.score >= SCORE_MEDIUM && s.score < SCORE_STRONG).sort((a,b) => b.score - a.score);
  const weak   = allSignals.filter(s => s.score < SCORE_MEDIUM);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`✅ Done in ${elapsed}s | Strong: ${strong.length} | Medium: ${medium.length} | Weak: ${weak.length}`);

  if (allSignals.length === 0) {
    console.log('No signals this run.');
    return;
  }

  // Print all to console
  for (const s of allSignals) {
    const label = s.score >= SCORE_STRONG ? '🔴' : s.score >= SCORE_MEDIUM ? '🟡' : '⚪';
    const mktLabel = s.market || s.title || s.triggerMarket || s.headline || '';
    console.log(`\n${label} [${s.type}] score=${s.score?.toFixed(1)} | ${mktLabel.substring(0,55)}`);
  }

  // Dedup: skip if we already sent same signal type+market this run
  const sentKeys = new Set();
  const deduped = [...strong, ...medium].filter(s => {
    const key = `${s.type}:${(s.market || s.triggerMarket || s.title || '').substring(0, 40)}:${s.side || s.outcome || ''}`;
    if (sentKeys.has(key)) return false;
    sentKeys.add(key);
    return true;
  });
  const toSend = deduped.filter(s => s.score >= SCORE_STRONG).concat(
    deduped.filter(s => s.score < SCORE_STRONG).slice(0, 3)
  );
  // Save signals for TMA dashboard (always, even if nothing to send)
  const st = load(cfg.STATE, {});
  st.lastSignals = allSignals.slice(0, 20).map(s => ({
    type: s.type, score: s.score, market: s.market || s.title || s.triggerMarket || '',
    side: s.side, amount: s.amount, price: s.price, newsContext: s.newsContext,
    tokenId: s.tokenId, marketId: s.marketId, addr: s.addr,
    winRate: s.winRate, totalPnl: s.totalPnl, outcome: s.outcome,
    bidDepth: s.bidDepth, askDepth: s.askDepth, ratio: s.ratio,
    from: s.from, to: s.to, drift: s.drift, volume: s.volume,
    headline: s.headline, currentPrice: s.currentPrice, fairPrice: s.fairPrice, edgePct: s.edgePct
  }));
  st.lastRun = new Date().toISOString();
  save(cfg.STATE, st);
  // ── Also persist to signals history store ──
  signalsStore.upsert(allSignals.slice(0, 30));
  // ── Persist to Supabase ──
  const topSignals = allSignals.slice(0, 20);
  Promise.all(topSignals.map(s => db.upsertSignal(s).catch(() => null)))
    .then(r => console.log('[db] Upserted', r.filter(Boolean).length, 'signals to Supabase'))
    .catch(() => {});

  if (toSend.length === 0) { console.log('\nNo alerts to send (all weak or duped).'); return; }

    console.log(`\n📤 Sending ${toSend.length} alerts to Telegram...`);
  for (const s of toSend) {
    const msg = formatSignal(s);
    await sendTg(msg);
    await sleep(700);
  }

  // ── AUTO-TRADE: Execute strong signals ────────────────────────
  if (!process.argv.includes('--no-trade') && strong.length > 0) {
    console.log(`\n[trade] Executing ${strong.length} strong signal(s)...`);
    try {
      const trades = await executeTrades(strong);
      if (trades.length > 0) {
        console.log(`[trade] Executed ${trades.length} trade(s)`);
      }
    } catch (e) {
      console.log('[trade] Error:', e.message?.slice(0, 80));
    }
  }
}

main().catch(e => {
  console.error('\n❌ FATAL:', e.message);
  process.exit(1);
});

// Update static data.json for Vercel TMA
async function updateStaticData() {
  const fs = require('fs');
  const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
  const DATA_PATH = '/workspace/data.json';
  try {
    const WALLET = '0x6f314d7d2f50808cec1d26c1092e7729d9378d75';
    const r = await fetch(`https://data-api.polymarket.com/positions?user=${WALLET}&limit=100&sizeThreshold=0.01`);
    const positions = await r.json();
    const open = Array.isArray(positions) ? positions.filter(p => p.currentValue > 0.01) : [];

    let portfolio;
    if (open.length > 0) {
      const totalValue = open.reduce((s,p) => s+(p.currentValue||0),0);
      const totalCost  = open.reduce((s,p) => s+(p.initialValue||0),0);
      const totalPnl   = open.reduce((s,p) => s+(p.cashPnl||0),0);
      const pnlPct     = totalCost>0 ? totalPnl/totalCost*100 : 0;
      portfolio = {positions:open,totalValue,totalCost,totalPnl,pnlPct};
    } else {
      // API returned empty — keep existing portfolio data
      try {
        const prev = JSON.parse(fs.readFileSync(DATA_PATH));
        portfolio = prev.portfolio || {positions:[],totalValue:0,totalCost:0,totalPnl:0,pnlPct:0};
        console.log('[data.json] API empty, keeping', portfolio.positions.length, 'cached positions');
      } catch { portfolio = {positions:[],totalValue:0,totalCost:0,totalPnl:0,pnlPct:0}; }
    }

    let signals = [];
    try { const s=JSON.parse(fs.readFileSync('/tmp/edge_state.json')); signals=s.lastSignals||[]; } catch{}
    fs.writeFileSync(DATA_PATH, JSON.stringify({
      portfolio, signals, updated:new Date().toISOString()
    }));
    console.log('[data.json] updated:', portfolio.positions.length, 'positions, P&L +$'+(portfolio.totalPnl||0).toFixed(2));

    // ── Sync users.json: totalValue + snapshots ──────────────
    try {
      const USERS_PATH = require('path').join(__dirname, '../users.json');
      const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
      const OWNER_ID = '399089761';
      if (users[OWNER_ID]) {
        const realVal = parseFloat(portfolio.totalValue || 0);
        const realPnl = parseFloat(portfolio.totalPnl   || 0);
        const realPct = parseFloat(portfolio.pnlPct     || 0);
        const dep     = parseFloat(users[OWNER_ID].totalDeposited || 0);

        // Синхронизируем реальные значения из Polymarket
        users[OWNER_ID].totalValue = realVal;
        users[OWNER_ID].totalPnl   = realPnl;
        users[OWNER_ID].pnlPct     = realPct;

        // Snapshot для графика
        const snap = { ts: Date.now(), val: realVal, pnl: realPnl };
        if (!users[OWNER_ID].snapshots) users[OWNER_ID].snapshots = [];
        users[OWNER_ID].snapshots.push(snap);
        const MAX_SNAPS = 72; // 72 * 20min = 24h
        if (users[OWNER_ID].snapshots.length > MAX_SNAPS) {
          users[OWNER_ID].snapshots = users[OWNER_ID].snapshots.slice(-MAX_SNAPS);
        }

        const usersStr = JSON.stringify(users, null, 2);
        fs.writeFileSync(USERS_PATH, usersStr);
        console.log('[sync] users.json: val=$' + realVal.toFixed(2) + ' pnl=$' + realPnl.toFixed(2) + ' snaps=' + users[OWNER_ID].snapshots.length);

        // Push updated users.json to GitHub so Vercel serverless always has fresh data
        await ghPush('users.json', usersStr).catch(e => console.log('[ghPush] fail:', e.message));
      }
    } catch(e) { console.log('[sync] error:', e.message); }

  } catch(e){ console.log('[data.json] error:', e.message); }
}

updateStaticData();
