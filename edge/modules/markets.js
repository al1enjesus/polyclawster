/**
 * edge/modules/markets.js — Market fetcher + cache + filtering
 */
const { get } = require('./http');
const { load, save } = require('./state');
const cfg = require('../config');

const CACHE_TTL = 25 * 60 * 1000; // 25 min

function isSports(title) {
  const t = (title || '').toLowerCase();
  return cfg.SPORTS.some(s => t.includes(s));
}

async function getTopMarkets({ limit = 200, forceRefresh = false } = {}) {
  const cache = load(cfg.MARKETS_DB, {});
  if (!forceRefresh && cache.ts && Date.now() - cache.ts < CACHE_TTL && cache.markets?.length) {
    return cache.markets;
  }

  const raw = await get(`https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=${limit}&order=volumeNum&ascending=false`);
  if (!Array.isArray(raw)) return cache.markets || [];

  save(cfg.MARKETS_DB, { ts: Date.now(), markets: raw });
  return raw;
}

function filterPolitical(markets) {
  return markets.filter(m => !isSports(m.question));
}

function filterWithOdds(markets, { min = 8, max = 92 } = {}) {
  return markets.filter(m => {
    const prices = JSON.parse(m.outcomePrices || '[]');
    return prices.some(p => { const pct = parseFloat(p) * 100; return pct > min && pct < max; });
  });
}

function getTokenId(market) {
  try { return JSON.parse(market.clobTokenIds || '[]')[0] || null; } catch { return null; }
}

// Watch-list: markets linked by theme for cross-correlation
const CORRELATED_THEMES = [
  {
    name: 'Iran_War',
    keywords: ['iran', 'irgc', 'tehran', 'ormuz', 'pahlavi'],
  },
  {
    name: 'Ukraine_Peace',
    keywords: ['ukraine', 'ceasefire', 'russia', 'kramatorsk', 'nato'],
  },
  {
    name: 'US_Policy',
    keywords: ['trump', 'fed chair', 'tariff', 'greenland'],
  },
];

function groupByTheme(markets) {
  const groups = {};
  for (const theme of CORRELATED_THEMES) {
    groups[theme.name] = markets.filter(m =>
      theme.keywords.some(k => (m.question || '').toLowerCase().includes(k))
    );
  }
  return groups;
}

module.exports = { getTopMarkets, filterPolitical, filterWithOdds, getTokenId, groupByTheme, isSports };
