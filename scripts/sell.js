#!/usr/bin/env node
/**
 * PolyClawster Sell — close an open position
 *
 * Usage:
 *   node sell.js --bet-id 42
 *   node sell.js --list         # List open bets
 */
'use strict';
const https = require('https');
const { loadConfig } = require('./setup');
const { getWalletBalance } = require('./balance');

const API_BASE = 'https://polyclawster.com';

function postJSON(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
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
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function sellBet(betId) {
  const config = loadConfig();
  if (!config?.apiKey) {
    throw new Error('Not configured. Run: node scripts/setup.js --auto');
  }

  console.log(`📤 Selling bet #${betId}...`);

  const result = await postJSON(`${API_BASE}/api/sell`, {
    betId: parseInt(betId),
    apiKey: config.apiKey,
  }, config.apiKey);

  if (!result.ok) {
    throw new Error(result.error || 'Sell failed');
  }

  const pnl = result.pnl;
  const pnlSign = pnl >= 0 ? '+' : '';
  console.log('');
  console.log('✅ Position closed!');
  console.log(`   Bet ID:  ${betId}`);
  console.log(`   Return:  $${parseFloat(result.returnAmount || 0).toFixed(2)}`);
  console.log(`   PnL:     ${pnlSign}$${parseFloat(pnl || 0).toFixed(2)}`);
  console.log(`   Status:  ${result.status}`);

  return result;
}

module.exports = { sellBet };

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    getWalletBalance().then(r => {
      const open = (r.openBets || []).filter(b => !b.is_demo);
      if (!open.length) { console.log('No open live bets.'); return; }
      console.log('\n📋 Open live bets:\n');
      open.forEach(b => {
        console.log(`  #${b.id} ${b.side} $${parseFloat(b.amount).toFixed(2)} — ${b.market}`);
      });
      console.log('\nSell: node scripts/sell.js --bet-id ID');
    }).catch(e => console.error('❌', e.message));
    return;
  }

  const betIdIdx = args.indexOf('--bet-id');
  const betId = betIdIdx >= 0 ? args[betIdIdx + 1] : null;

  if (!betId) {
    console.log('Usage:');
    console.log('  node sell.js --bet-id 42    # Sell specific bet');
    console.log('  node sell.js --list         # List open bets');
    process.exit(0);
  }

  sellBet(betId).catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
}
