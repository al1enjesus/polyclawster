#!/usr/bin/env node
/**
 * PolyClawster Browse — explore Polymarket markets
 *
 * Usage:
 *   node browse.js                                    # Top markets by volume
 *   node browse.js "bitcoin"                          # Search by keyword
 *   node browse.js "crypto" --min-volume 100000       # Filter by min volume
 *   node browse.js "election" --min-price 0.1 --max-price 0.9
 *   node browse.js --limit 20
 */
'use strict';
const https = require('https');

const API_BASE = 'https://polyclawster.com';

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: { 'User-Agent': 'polyclawster-skill/1.2' },
      timeout: 12000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Invalid JSON')); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ── Keyword aliases (expand generic terms → specific search queries) ──────────
const KEYWORD_ALIASES = {
  'crypto':   'bitcoin ethereum solana',
  'btc':      'bitcoin',
  'eth':      'ethereum',
  'sol':      'solana',
  'defi':     'defi ethereum uniswap',
  'ai':       'artificial intelligence openai',
  'stock':    'market stocks s&p nasdaq',
  'politics': 'election president senate',
  'election': 'election president',
  'war':      'war ukraine russia middle east',
  'sports':   'nba nfl soccer championship',
  'nba':      'nba basketball',
  'nfl':      'nfl football',
  'ufc':      'ufc fight',
  'weather':  'climate hurricane storm',
};

function expandQuery(q) {
  if (!q) return q;
  const lower = q.toLowerCase().trim();
  return KEYWORD_ALIASES[lower] || q;
}

async function browseMarkets(query, opts = {}) {
  const { minVolume = 0, minPrice = 0, maxPrice = 1, limit = 10 } = opts;

  const expandedQuery = expandQuery(query);

  const qs = new URLSearchParams({ limit: '50' });
  if (expandedQuery) qs.set('q', expandedQuery);

  const result = await getJSON(`${API_BASE}/api/search-markets?${qs}`);
  if (!result.ok) throw new Error(result.error || 'Failed to fetch markets');

  // If alias expansion gave no results, try original query
  if (expandedQuery !== query && (!result.markets || result.markets.length === 0) && query) {
    const qs2 = new URLSearchParams({ limit: '50', q: query });
    const r2 = await getJSON(`${API_BASE}/api/search-markets?${qs2}`).catch(() => null);
    if (r2?.ok && r2.markets?.length > 0) {
      result.markets = r2.markets;
    }
  }

  let markets = result.markets || [];

  // Apply filters
  if (minVolume > 0) markets = markets.filter(m => parseFloat(m.volume24hr || 0) >= minVolume);
  if (minPrice > 0)  markets = markets.filter(m => parseFloat(m.bestAsk || m.bestBid || 0.5) >= minPrice);
  if (maxPrice < 1)  markets = markets.filter(m => parseFloat(m.bestAsk || m.bestBid || 0.5) <= maxPrice);

  return markets.slice(0, limit);
}

module.exports = { browseMarkets };

if (require.main === module) {
  const args = process.argv.slice(2);

  const getArg = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  };

  const query     = args.find(a => !a.startsWith('--'));
  const minVolume = parseFloat(getArg('--min-volume') || getArg('--volume') || '0');
  const minPrice  = parseFloat(getArg('--min-price')  || '0');
  const maxPrice  = parseFloat(getArg('--max-price')  || '1');
  const limit     = parseInt(getArg('--limit')        || '10');

  browseMarkets(query, { minVolume, minPrice, maxPrice, limit }).then(markets => {
    if (!markets.length) {
      console.log('No markets found.');
      return;
    }

    console.log('');
    const expandedQ = expandQuery(query);
    if (query && expandedQ !== query) console.log(`🔍 Markets matching "${query}" (expanded: "${expandedQ}"):\n`);
    else if (query)                   console.log(`🔍 Markets matching "${query}":\n`);
    else                              console.log('📊 Top Polymarket markets:\n');

    markets.forEach((m, i) => {
      const price   = parseFloat(m.bestAsk || m.bestBid || 0.5);
      const vol24   = parseFloat(m.volume24hr || 0);
      const endDate = m.endDate ? new Date(m.endDate).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '?';
      const pct     = (price * 100).toFixed(0);
      const volStr  = vol24 >= 1e6 ? '$' + (vol24/1e6).toFixed(1) + 'M' : vol24 >= 1e3 ? '$' + (vol24/1e3).toFixed(0) + 'k' : '$' + vol24.toFixed(0);

      console.log(`${i + 1}. ${m.question}`);
      console.log(`   YES: ${pct}% | Vol: ${volStr}/24h | Ends: ${endDate}`);
      console.log(`   Slug: ${m.slug || m.conditionId}`);
      console.log('');
    });

    console.log('Trade: node scripts/trade.js --market "SLUG" --side YES --amount 5');
  }).catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
}
