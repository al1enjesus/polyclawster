#!/usr/bin/env node
/**
 * PolyClawster Trade
 *
 * Usage:
 *   node trade.js --market "bitcoin-100k" --side YES --amount 5
 *   node trade.js --market "will-trump-win" --side NO --amount 10 --demo
 *   node trade.js --slug "bitcoin-reach-100k-2025" --side YES --amount 5
 */
'use strict';
const https = require('https');
const { loadConfig } = require('./setup');

const API_BASE = 'https://polyclawster.com';

function postJSON(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'polyclawster-skill/1.2',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      timeout: 20000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Invalid JSON')); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(payload);
    req.end();
  });
}

async function executeTrade({ market, slug, conditionId, side, amount, isDemo }) {
  const config = loadConfig();
  if (!config?.apiKey) {
    throw new Error('Not configured. Run: node scripts/setup.js --auto');
  }

  const sideUpper = (side || 'YES').toUpperCase();
  const amt = parseFloat(amount);
  if (!amt || amt < 0.5) throw new Error('Invalid amount (min $0.5)');

  console.log(`📤 Placing ${isDemo ? 'DEMO ' : ''}${sideUpper} bet on "${market || slug || conditionId}" for $${amt}...`);

  const result = await postJSON(`${API_BASE}/api/agents`, {
    action: 'trade',
    market: market || '',
    slug:   slug || market || '',
    conditionId: conditionId || '',
    side: sideUpper,
    amount: amt,
    isDemo: !!isDemo,
  }, config.apiKey);

  if (!result.ok) {
    throw new Error(result.error || 'Trade failed');
  }

  console.log('');
  console.log('✅ Trade placed!');
  console.log(`   Market:  ${result.market || market || slug}`);
  console.log(`   Side:    ${result.side}`);
  console.log(`   Amount:  $${result.amount}`);
  if (result.orderID) console.log(`   Order:   ${result.orderID}`);
  console.log(`   Status:  ${result.status}`);
  if (result.betId) console.log(`   Bet ID:  ${result.betId}`);

  return result;
}

module.exports = { executeTrade };

if (require.main === module) {
  const args = process.argv.slice(2);

  const getArg = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  };

  const market  = getArg('--market') || getArg('--slug');
  const side    = getArg('--side') || 'YES';
  const amount  = getArg('--amount') || getArg('--amt');
  const isDemo  = args.includes('--demo');

  if (!market || !amount) {
    console.log('PolyClawster Trade');
    console.log('');
    console.log('Usage:');
    console.log('  node trade.js --market "bitcoin-100k" --side YES --amount 5');
    console.log('  node trade.js --market "trump-win-2026" --side NO --amount 10 --demo');
    process.exit(0);
  }

  executeTrade({ market, side, amount: parseFloat(amount), isDemo }).catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
}
