#!/usr/bin/env node
/**
 * PolyClawster Balance
 *
 * Usage:
 *   node balance.js
 */
'use strict';
const https = require('https');
const { loadConfig } = require('./setup');

const API_BASE = 'https://polyclawster.com';

function getJSON(url, apiKey) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: {
        'User-Agent': 'polyclawster-skill/1.2',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      timeout: 10000,
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

async function getWalletBalance() {
  const config = loadConfig();
  if (!config?.apiKey) {
    throw new Error('Not configured. Run: node scripts/setup.js --auto');
  }

  const result = await getJSON(`${API_BASE}/api/agents?action=portfolio`, config.apiKey);

  if (!result.ok) {
    throw new Error(result.error || 'Failed to get portfolio');
  }

  return result;
}

module.exports = { getWalletBalance };

if (require.main === module) {
  const config = loadConfig();
  if (!config?.apiKey) {
    console.error('❌ Not configured. Run: node scripts/setup.js --auto');
    process.exit(1);
  }

  getWalletBalance().then(r => {
    const pnlSign = r.totalPnl >= 0 ? '+' : '';
    console.log('');
    console.log(`🤖 ${r.emoji || '🤖'} ${r.name}`);
    console.log(`📍 ${r.walletAddress}`);
    console.log('');
    console.log('💰 Live Balance:');
    console.log(`   Available:  $${parseFloat(r.cashBalance || 0).toFixed(2)}`);
    console.log(`   Deposited:  $${parseFloat(r.totalDeposited || 0).toFixed(2)}`);
    console.log(`   Total PnL:  ${pnlSign}$${parseFloat(r.totalPnl || 0).toFixed(2)}`);
    console.log(`   Win Rate:   ${(parseFloat(r.winRate || 0) * 100).toFixed(0)}%`);
    console.log(`   Trades:     ${r.totalBets || 0}`);
    console.log('');
    console.log('🎮 Demo Balance:');
    console.log(`   Available:  $${parseFloat(r.demoBal || 0).toFixed(2)}`);
    if (r.openBets && r.openBets.length > 0) {
      console.log('');
      console.log('📋 Open Bets:');
      r.openBets.forEach(b => {
        const mode = b.is_demo ? '[DEMO]' : '[LIVE]';
        console.log(`   ${mode} ${b.side} $${parseFloat(b.amount).toFixed(2)} — ${b.market || 'Unknown'}`);
      });
    }
    console.log('');
    console.log(`🔗 Dashboard: ${config.dashboard || 'https://polyclawster.com/a/' + r.agentId}`);
  }).catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
}
