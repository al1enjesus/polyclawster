/**
 * /api/market-info — live market data for bet cards
 * GET ?ids=conditionId1,conditionId2,...
 * Returns { markets: { [conditionId]: { price, priceYes, priceNo, endDate, image, volume24h, liquidity } } }
 */
'use strict';
const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'polyclawster/2.0' }, timeout: 8000 }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

// Simple in-memory cache
const _cache = new Map();
const CACHE_TTL = 60_000; // 1 min

async function getMarketInfo(conditionId) {
  const cached = _cache.get(conditionId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    // Parallel: Gamma API for metadata + CLOB for live price
    const [gamma, clob] = await Promise.allSettled([
      httpGet(`https://gamma-api.polymarket.com/markets?conditionId=${conditionId}`),
      httpGet(`https://clob.polymarket.com/markets/${conditionId}`)
    ]);

    const g = gamma.status === 'fulfilled' && Array.isArray(gamma.value) ? gamma.value[0] : null;
    const c = clob.status === 'fulfilled' ? clob.value : null;

    // Prices: prefer CLOB (real-time), fallback to Gamma
    let priceYes = 0.5, priceNo = 0.5;
    if (c && c.tokens && c.tokens.length >= 2) {
      priceYes = c.tokens.find(t => t.outcome === 'Yes')?.price || 0.5;
      priceNo  = c.tokens.find(t => t.outcome === 'No')?.price || 0.5;
    } else if (g && g.outcomePrices) {
      try {
        const pp = JSON.parse(g.outcomePrices);
        priceYes = parseFloat(pp[0]) || 0.5;
        priceNo  = parseFloat(pp[1]) || 0.5;
      } catch {}
    }

    // Token IDs
    let tokenYes = '', tokenNo = '';
    if (c && c.tokens && c.tokens.length >= 2) {
      tokenYes = c.tokens.find(t => t.outcome === 'Yes')?.token_id || '';
      tokenNo  = c.tokens.find(t => t.outcome === 'No')?.token_id || '';
    } else if (g && g.clobTokenIds) {
      try {
        const tt = JSON.parse(g.clobTokenIds);
        tokenYes = tt[0] || ''; tokenNo = tt[1] || '';
      } catch {}
    }

    // CLOB is authoritative for market identity; Gamma may return wrong market
    const clobQuestion = c?.question || '';
    const gammaQuestion = g?.question || '';
    // Only use Gamma data if it matches CLOB (or CLOB unavailable)
    const gammaMatch = !clobQuestion || gammaQuestion.slice(0,20) === clobQuestion.slice(0,20);
    
    const data = {
      conditionId,
      question: clobQuestion || gammaQuestion,
      image: gammaMatch ? (g?.image || g?.icon || '') : '',
      endDate: c?.end_date_iso || (gammaMatch ? g?.endDateIso : null) || null,
      priceYes: +priceYes.toFixed(4),
      priceNo:  +priceNo.toFixed(4),
      volume24h: parseFloat(g?.volume24hr || 0),
      liquidity: parseFloat(g?.liquidity || 0),
      spread: g?.spread || null,
      closed: g?.closed || c?.closed || false,
      acceptingOrders: c?.accepting_orders ?? true,
      tokenYes,
      tokenNo,
      slug: g?.slug || '',
    };

    _cache.set(conditionId, { data, ts: Date.now() });
    return data;
  } catch (e) {
    console.error('[market-info] error for', conditionId, e.message);
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 10);
  if (!ids.length) { res.json({ markets: {} }); return; }

  const results = await Promise.allSettled(ids.map(id => getMarketInfo(id)));
  const markets = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) markets[ids[i]] = r.value;
  });

  res.json({ markets });
};
