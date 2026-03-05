/**
 * /api/signals — returns fresh top markets from Polymarket as tradeable signals
 * GET ?limit=20&category=all
 */
'use strict';
const https = require('https');

// Simple cache to avoid hammering Gamma API
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { 'User-Agent': 'polyclawster/2.0' },
      timeout: 8000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchTopMarkets(limit = 20) {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL) return _cache;

  try {
    const markets = await httpGet(
      `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${Math.min(limit * 3, 60)}&order=volume&ascending=false`
    );
    if (!Array.isArray(markets)) return [];

    const signals = markets
      .filter(m => m.conditionId && m.question && parseFloat(m.volume || 0) > 100)
      .sort((a, b) => parseFloat(b.volume || 0) - parseFloat(a.volume || 0))
      .slice(0, limit)
      .map(m => {
        const prices = (() => {
          try { return JSON.parse(m.outcomePrices || '[0.5,0.5]'); } catch { return [0.5, 0.5]; }
        })();
        const tokenIds = (() => {
          try { return JSON.parse(m.clobTokenIds || '[]'); } catch { return []; }
        })();
        const pYes = parseFloat(prices[0]) || 0.5;
        const pNo  = parseFloat(prices[1]) || (1 - pYes);
        const vol  = parseFloat(m.volume || 0);

        // Score based on volume + interesting price (not too close to 0 or 1)
        const priceInterest = 1 - Math.abs(pYes - 0.5) * 2; // 0=boring, 1=50/50
        const score = Math.min(10, Math.max(5, 5 + priceInterest * 3 + Math.min(2, vol / 50000)));

        return {
          type: 'market',
          market: m.question,
          title: m.question,
          slug: m.slug || '',
          conditionId: m.conditionId,
          marketId: m.conditionId,
          tokenIdYes: tokenIds[0] || '',
          tokenIdNo:  tokenIds[1] || '',
          price: pYes,
          priceYes: pYes,
          priceNo: pNo,
          volume: vol,
          score: parseFloat(score.toFixed(1)),
          side: pYes < 0.5 ? 'YES' : 'NO', // suggest contrarian side
          timestamp: new Date().toISOString(),
          source: 'polymarket',
        };
      });

    _cache = signals;
    _cacheAt = now;
    return signals;
  } catch (e) {
    console.error('[signals] fetch error:', e.message);
    return _cache || [];
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=120');

  const url   = new URL(req.url || '/', 'http://x');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  try {
    const signals = await fetchTopMarkets(limit);
    res.json({ ok: true, count: signals.length, signals });
  } catch (e) {
    res.json({ ok: false, error: e.message, signals: [] });
  }
};
