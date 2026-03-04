/**
 * edge/modules/wallets.js — Smart wallet discovery + tracking v3
 *
 * Два режима:
 * 1. WHALE MODE: кошелёк ставит $5k+ на политику = сразу в radar, без history
 * 2. SMART MODE: кошелёк с историей WR > 58% = высокий score
 *
 * API limitation: positions?user= не работает с proxyWallet адресами
 * Workaround: отслеживаем через per-market trades
 */
const { get } = require('./http');
const { load, save } = require('./state');
const { isSports } = require('./markets');
const cfg = require('../config');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const WHALE_THRESHOLD = 5_000;   // $5k+ = whale
const WHALE_STRONG    = 20_000;  // $20k+ = strong whale signal

// ── DISCOVERY ────────────────────────────────────────────────────────────────
async function discoverWallets(topMarkets) {
  const db = load(cfg.WALLETS_DB, {});
  const prevCount = Object.keys(db).length;

  const targets = topMarkets
    .filter(m => !isSports(m.question))
    .filter(m => parseFloat(m.volume || 0) > 1_000_000)
    .slice(0, 8);

  for (const m of targets) {
    if (!m.conditionId) continue;
    await sleep(200);
    const trades = await get(`https://data-api.polymarket.com/trades?market=${m.conditionId}&limit=200`);
    if (!Array.isArray(trades)) continue;

    // Aggregate trades by wallet
    const byWallet = {};
    for (const t of trades) {
      const w = t.proxyWallet;
      if (!w || w === cfg.MY_WALLET) continue;
      const size = (t.size || 0) * (t.price || 0);
      if (!byWallet[w]) byWallet[w] = { total: 0, sides: {}, title: t.title, market: m.question };
      byWallet[w].total += size;
      const side = t.outcome || t.side || 'Unknown';
      byWallet[w].sides[side] = (byWallet[w].sides[side] || 0) + size;
    }

    // Add wallets with big enough bets
    for (const [addr, info] of Object.entries(byWallet)) {
      if (info.total < WHALE_THRESHOLD) continue;
      if (db[addr]) {
        // Update existing entry with latest trade info
        db[addr].lastSeen = new Date().toISOString();
        db[addr].totalVol = (db[addr].totalVol || 0) + info.total;
        continue;
      }
      const dominant = Object.entries(info.sides).sort((a, b) => b[1] - a[1])[0];
      db[addr] = {
        type: 'whale',
        score: Math.min(10, 3 + info.total / WHALE_STRONG * 7),
        totalVol: info.total,
        dominantSide: dominant?.[0],
        dominantMarket: info.market,
        addedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        wins: 0, losses: 0,   // Will accumulate as markets resolve
      };
      console.log(`[wallets] 🐋 ${addr.substring(0,12)} $${info.total.toFixed(0)} on ${dominant?.[0]} — ${info.market?.substring(0,40)}`);
    }
  }

  const added = Object.keys(db).length - prevCount;
  if (added > 0 || Object.keys(db).length > 0) save(cfg.WALLETS_DB, db);
  console.log(`[wallets] DB: ${Object.keys(db).length} wallets (+${added} new)`);
  return db;
}

// ── ACTIVITY CHECK ───────────────────────────────────────────────────────────
// Check recent trades on political markets — alert when tracked whale makes NEW move
async function checkActivity(db, topMarkets, seen) {
  const alerts = [];
  if (Object.keys(db).length === 0) return alerts;

  const politicalMarkets = topMarkets
    .filter(m => !isSports(m.question))
    .filter(m => parseFloat(m.volume || 0) > 500_000)
    .slice(0, 15);

  // Track new trades that are from our known whales
  const newTrades = [];
  for (const m of politicalMarkets) {
    if (!m.conditionId) continue;
    await sleep(120);
    const trades = await get(`https://data-api.polymarket.com/trades?market=${m.conditionId}&limit=50`);
    if (!Array.isArray(trades)) continue;

    for (const t of trades) {
      const key = t.transactionHash;
      if (!key || seen.has(key)) continue;
      if (isSports(t.title)) continue;

      const addr = t.proxyWallet;
      const info = db[addr];
      const size = (t.size || 0) * (t.price || 0);
      if (size < 500) continue;

      seen.add(key);

      if (info) {
        // Known whale made a new trade
        alerts.push({
          type: 'smartwallet', addr,
          score: Math.min(10, 3 + size / WHALE_STRONG * 7),
          winRate: info.winRate || 0,
          totalPnl: info.totalPnl || 0,
          concentration: info.concentration || 1,
          outcome: t.outcome || t.side,
          title: t.title || m.question || 'Unknown market',
          size: size.toFixed(0), price: t.price,
          strength: size > WHALE_STRONG ? 'HIGH' : 'MEDIUM',
          isNew: true,
        });
      } else if (size >= WHALE_STRONG) {
        // New unknown wallet making a huge bet — flag it
        alerts.push({
          type: 'smartwallet', addr,
          score: Math.min(10, 3 + size / WHALE_STRONG * 7),
          winRate: 0, totalPnl: 0, concentration: 1,
          outcome: t.outcome || t.side,
          title: t.title || m.question || 'Unknown market',
          size: size.toFixed(0), price: t.price,
          strength: size > 50_000 ? 'HIGH' : 'MEDIUM',
          isNew: false,
          tag: '🆕 Новый кит',
        });
        // Auto-add to DB
        db[addr] = {
          type: 'whale', score: Math.min(10, 3 + size / WHALE_STRONG * 7),
          totalVol: size, dominantSide: t.outcome,
          dominantMarket: t.title, addedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(), wins: 0, losses: 0,
        };
      }
    }
  }

  if (Object.keys(db).length > 0) save(cfg.WALLETS_DB, db);
  return alerts;
}

module.exports = { discoverWallets, checkActivity };
