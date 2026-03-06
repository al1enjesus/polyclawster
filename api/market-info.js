/**
 * /api/market-info — live market data for bet cards
 * GET ?ids=conditionId1,conditionId2,...
 * Returns { markets: { [conditionId]: { price, priceYes, priceNo, endDate, image, volume24h, liquidity, tokenYes, tokenNo } } }
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
    // Step 1: Get CLOB data (authoritative — always correct for this conditionId)
    let c = null;
    try {
      c = await httpGet(`https://clob.polymarket.com/markets/${conditionId}`);
    } catch (e) {
      console.warn('[market-info] CLOB fetch failed:', e.message);
    }

    // Extract token IDs from CLOB
    let tokenYes = '', tokenNo = '';
    let priceYes = 0.5, priceNo = 0.5;
    if (c && c.tokens && c.tokens.length >= 2) {
      const yesToken = c.tokens.find(t => t.outcome === 'Yes');
      const noToken = c.tokens.find(t => t.outcome === 'No');
      tokenYes = yesToken?.token_id || '';
      tokenNo = noToken?.token_id || '';
      priceYes = parseFloat(yesToken?.price) || 0.5;
      priceNo = parseFloat(noToken?.price) || 0.5;
    }

    // Step 2: Get Gamma data using clob_token_ids (NOT conditionId — that returns wrong markets!)
    let g = null;
    const gammaTokenId = tokenYes || tokenNo;
    if (gammaTokenId) {
      try {
        const gammaResult = await httpGet(`https://gamma-api.polymarket.com/markets?clob_token_ids=${gammaTokenId}`);
        if (Array.isArray(gammaResult) && gammaResult.length > 0) {
          g = gammaResult[0];
        }
      } catch (e) {
        console.warn('[market-info] Gamma fetch failed:', e.message);
      }
    }

    // Fallback: if CLOB didn't have tokens, try gamma with slug-based search
    if (!g && !tokenYes) {
      try {
        const gammaResult = await httpGet(`https://gamma-api.polymarket.com/markets?condition_id=${conditionId}&limit=1`);
        if (Array.isArray(gammaResult) && gammaResult.length === 1) {
          g = gammaResult[0];
          // Extract tokens from gamma if CLOB failed
          if (g.clobTokenIds) {
            try {
              const tt = JSON.parse(g.clobTokenIds);
              tokenYes = tt[0] || ''; tokenNo = tt[1] || '';
            } catch {}
          }
          if (g.outcomePrices) {
            try {
              const pp = JSON.parse(g.outcomePrices);
              priceYes = parseFloat(pp[0]) || 0.5;
              priceNo = parseFloat(pp[1]) || 0.5;
            } catch {}
          }
        }
      } catch {}
    }

    const data = {
      conditionId,
      question: c?.question || g?.question || '',
      image: g?.image || g?.icon || '',
      endDate: c?.end_date_iso || g?.endDateIso || null,
      priceYes: +priceYes.toFixed(4),
      priceNo:  +priceNo.toFixed(4),
      volume24h: parseFloat(g?.volume24hr || g?.volume24h || 0),
      liquidity: parseFloat(g?.liquidityNum || g?.liquidity || 0),
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
