#!/usr/bin/env node
/**
 * PolyClawster — Search Polymarket markets
 * 
 * Usage:
 *   node search.js "bitcoin"        # search for markets about bitcoin
 *   node search.js                   # show top markets by volume
 *   node search.js --limit 5 "trump" # limit results
 */
'use strict';
const https = require('https');

const API_BASE = 'https://polyclawster.com';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { 'User-Agent': 'polyclawster-skill/1.0' },
      timeout: 15000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error('Invalid JSON response')); }
      });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

async function searchMarkets(query, limit = 20) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  params.set('limit', String(limit));
  
  const url = `${API_BASE}/api/search-markets?${params.toString()}`;
  const data = await fetchJSON(url);
  
  if (!data.ok) throw new Error(data.error || 'Search failed');
  return data.markets || [];
}

function formatTable(markets) {
  if (markets.length === 0) {
    console.log('No markets found.');
    return;
  }

  console.log('');
  console.log('┌─' + '─'.repeat(50) + '─┬─' + '─'.repeat(8) + '─┬─' + '─'.repeat(12) + '─┬─' + '─'.repeat(12) + '─┐');
  console.log('│ ' + 'Market'.padEnd(50) + ' │ ' + 'Price'.padEnd(8) + ' │ ' + 'Vol 24h'.padEnd(12) + ' │ ' + 'End Date'.padEnd(12) + ' │');
  console.log('├─' + '─'.repeat(50) + '─┼─' + '─'.repeat(8) + '─┼─' + '─'.repeat(12) + '─┼─' + '─'.repeat(12) + '─┤');

  markets.forEach(m => {
    const question = m.question.length > 50 ? m.question.slice(0, 47) + '...' : m.question.padEnd(50);
    const price = (m.bestAsk || m.bestBid || 0).toFixed(2).padEnd(8);
    const vol = ('$' + Math.round(m.volume24hr).toLocaleString()).padEnd(12);
    const end = m.endDate ? m.endDate.slice(0, 10).padEnd(12) : 'N/A'.padEnd(12);
    console.log(`│ ${question} │ ${price} │ ${vol} │ ${end} │`);
  });

  console.log('└─' + '─'.repeat(50) + '─┴─' + '─'.repeat(8) + '─┴─' + '─'.repeat(12) + '─┴─' + '─'.repeat(12) + '─┘');
  console.log(`\n${markets.length} market(s) found.`);
  
  // Output machine-readable JSON for agent use
  if (process.env.JSON_OUTPUT) {
    console.log('\n__JSON__');
    console.log(JSON.stringify(markets, null, 2));
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let query = '';
  let limit = 20;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
      i++;
    } else if (!args[i].startsWith('--')) {
      query = args[i];
    }
  }

  searchMarkets(query, limit)
    .then(formatTable)
    .catch(e => {
      console.error('Error:', e.message);
      process.exit(1);
    });
}

module.exports = { searchMarkets };
