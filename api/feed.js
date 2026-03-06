/**
 * /api/feed — live whale activity + market movers from Polymarket
 */
'use strict';
const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 8000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

// Filter out pure sports (allow "Super Bowl winner" politics crossovers)
const SPORTS_STRICT = /\bNBA\b|\bNFL\b|\bNHL\b|\bMLB\b|\bsoccer\b|\bbasketball\b|\btennis\b|\bUFC\b|\bMMA\b|\bbox(ing)?\b|\bFormula.?1\b|\bF1\b|vs\.\s+[A-Z]/i;

function shortAddr(addr) {
  if (!addr) return '?';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

// Polymarket timestamps are Unix seconds
function timeAgo(unixSec) {
  const sec = Math.floor(Date.now() / 1000) - unixSec;
  if (sec < 0)   return 'just now';
  if (sec < 60)  return sec + 's ago';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
  if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
  return Math.floor(sec / 86400) + 'd ago';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    // ── 1. Whale trades ──────────────────────────────────────────
    let rawTrades = [];
    try {
      rawTrades = await get('https://data-api.polymarket.com/trades?limit=100&taker_only=false') || [];
    } catch {}

    const nowSec = Math.floor(Date.now() / 1000);
    const cutoffSec = nowSec - 24 * 3600; // last 24h

    const trades = (Array.isArray(rawTrades) ? rawTrades : [])
      .filter(t => {
        const usd   = (t.size || 0) * (t.price || 0);
        const ts    = parseInt(t.timestamp, 10) || 0;
        const title = t.title || '';
        return usd >= 50 && ts > cutoffSec && !SPORTS_STRICT.test(title);
      })
      .sort((a, b) => (b.size * b.price) - (a.size * a.price))
      .slice(0, 15)
      .map(t => {
        const usd   = Math.round((t.size || 0) * (t.price || 0));
        const ts    = parseInt(t.timestamp, 10) || nowSec;
        const price = Math.round((t.price || 0) * 100);
        return {
          wallet:  shortAddr(t.proxyWallet || t.maker || t.taker),
          market:  (t.title || '').slice(0, 65),
          side:    t.outcome || 'YES',
          amount:  usd,
          price,
          ts,
          ago:     timeAgo(ts),
          icon:    usd >= 5000 ? '🐳' : usd >= 1000 ? '🐋' : '🐟',
          slug:    t.slug || t.eventSlug || '',
          conditionId: t.conditionId || t.marketSlug || '',
          image: t.image || '',
        };
      });

    // ── 2. Market movers ─────────────────────────────────────────
    let movers = [];
    try {
      const raw = await get('https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=20') || [];
      movers = (Array.isArray(raw) ? raw : [])
        .filter(m => !SPORTS_STRICT.test(m.question || ''))
        .slice(0, 6)
        .map(m => ({
          title:  (m.question || '').slice(0, 60),
          volume: Math.round(parseFloat(m.volume24hr || 0)),
          yes:    (() => {
          let prices = m.outcomePrices;
          if (typeof prices === 'string') { try { prices = JSON.parse(prices); } catch {} }
          const p = Array.isArray(prices) ? parseFloat(prices[0] || 0) : parseFloat(m.bestBid || 0.5);
          return Math.round((isNaN(p) ? 0.5 : p) * 100);
        })(),
          slug:   m.slug || '',
          image: m.image || m.icon || '',
          conditionId: m.conditionId || '',
          endDate: m.endDateIso || '',
        }));
    } catch {}

    res.json({ ok: true, trades, movers, updated: new Date().toISOString() });

  } catch (e) {
    res.json({ ok: false, error: e.message, trades: [], movers: [] });
  }
};
