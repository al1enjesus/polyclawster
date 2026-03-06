/**
 * /api/price-history — proxy for Polymarket CLOB prices-history
 * GET ?market={clobTokenId}&interval={1d|1w|1m|all}&fidelity={1|10|60}
 * Returns { history: [{ t, p }, ...] }
 */
'use strict';
const https = require('https');

const _cache = new Map();
const CACHE_TTL = 180_000; // 3 min

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { 'User-Agent': 'polyclawster/2.0' },
      timeout: 10000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const market = req.query.market || '';
  const interval = req.query.interval || 'all';
  const fidelity = req.query.fidelity || '60';

  if (!market) { res.json({ history: [] }); return; }

  const cacheKey = `${market}_${interval}_${fidelity}`;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  try {
    const url = `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(market)}&interval=${interval}&fidelity=${fidelity}`;
    const data = await httpGet(url);
    if (data) {
      _cache.set(cacheKey, { data, ts: Date.now() });
      // Prune cache if too large
      if (_cache.size > 200) {
        const oldest = [..._cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
        for (let i = 0; i < 50; i++) _cache.delete(oldest[i][0]);
      }
    }
    res.json(data || { history: [] });
  } catch (e) {
    console.error('[price-history] error:', e.message);
    res.json({ history: [] });
  }
};
