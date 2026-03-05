/**
 * /api/leaderboard — Agent leaderboard sorted by P&L
 * GET /api/leaderboard?limit=50
 * 
 * Queries Supabase for all users with wallets, fetches position data,
 * returns sorted by total P&L.
 */
'use strict';
const db = require('../lib/db');
const https = require('https');

function polyGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://data-api.polymarket.com' + path);
    https.get({
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { 'User-Agent': 'polyclawster/1.0' },
      timeout: 8000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve([]); }
      });
    }).on('error', () => resolve([])).on('timeout', () => resolve([]));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=120');

  const limit = Math.min(parseInt(req.query?.limit || '50') || 50, 200);

  try {
    // Get all wallets from Supabase
    const wallets = await db.getAllWallets();
    if (!Array.isArray(wallets) || wallets.length === 0) {
      return res.json({ ok: true, leaderboard: [], count: 0 });
    }

    // Get all users for metadata
    const users = await db.getAllUsers();
    const userMap = {};
    if (Array.isArray(users)) {
      users.forEach(u => { userMap[String(u.id)] = u; });
    }

    // Fetch positions for each wallet (parallel, max 10 concurrent)
    const entries = [];
    const batchSize = 10;
    for (let i = 0; i < wallets.length; i += batchSize) {
      const batch = wallets.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (w) => {
        if (!w.address) return null;
        try {
          const positions = await polyGet(`/positions?user=${w.address.toLowerCase()}&limit=100&sizeThreshold=0`);
          if (!Array.isArray(positions)) return null;

          const totalValue = positions.reduce((s, p) => s + parseFloat(p.currentValue || 0), 0);
          const totalPnl = positions.reduce((s, p) => s + parseFloat(p.cashPnl || 0), 0);
          const realizedPnl = positions.reduce((s, p) => s + parseFloat(p.realizedPnl || 0), 0);
          const posCount = positions.filter(p => parseFloat(p.currentValue || 0) > 0.01).length;

          const user = userMap[String(w.tg_id)] || {};
          return {
            address: w.address,
            tgId: String(w.tg_id),
            username: user.username || null,
            totalValue: parseFloat(totalValue.toFixed(2)),
            totalPnl: parseFloat((totalPnl + realizedPnl).toFixed(2)),
            openPnl: parseFloat(totalPnl.toFixed(2)),
            realizedPnl: parseFloat(realizedPnl.toFixed(2)),
            positions: posCount,
            trades: user.trades || 0,
            totalDeposited: parseFloat(user.total_deposited || 0),
          };
        } catch {
          return null;
        }
      }));
      entries.push(...results.filter(Boolean));
    }

    // Sort by total P&L descending
    entries.sort((a, b) => b.totalPnl - a.totalPnl);

    return res.json({
      ok: true,
      leaderboard: entries.slice(0, limit),
      count: entries.length,
      ts: Date.now(),
    });
  } catch (e) {
    console.error('[leaderboard] error:', e.message);
    return res.json({ ok: false, error: e.message });
  }
};
