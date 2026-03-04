#!/usr/bin/env node
/**
 * polyclawster-agent/scripts/polymarket.js
 * 
 * Gives an OpenClaw agent access to Polymarket prediction markets
 * via the PolyClawster platform. Handles wallet creation, signals,
 * placing bets, and checking portfolio.
 *
 * Usage:
 *   node polymarket.js signals [--min-score 7] [--limit 10]
 *   node polymarket.js portfolio <tgId>
 *   node polymarket.js bet <tgId> <market> <YES|NO> <amount>
 *   node polymarket.js wallet <tgId>
 *   node polymarket.js register <tgId> <agentName>
 */
'use strict';

const https = require('https');
const API_BASE = 'polyclawster.com';

function apiCall(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: API_BASE,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function getSignals({ minScore = 0, limit = 20 } = {}) {
  const data = await apiCall(`/api/signals?limit=${limit}&minScore=${minScore}`);
  if (!data.ok) throw new Error(data.error || 'signals failed');
  return data.signals;
}

async function getPortfolio(tgId) {
  const data = await apiCall(`/api/portfolio?tgId=${tgId}`);
  if (!data.ok) throw new Error(data.error || 'portfolio failed');
  return data.portfolio;
}

async function getOrCreateWallet(tgId) {
  const data = await apiCall('/api/wallet-create', 'POST', { tgId });
  if (!data.ok) throw new Error(data.error || 'wallet failed');
  return data.data;
}

async function placeBet({ tgId, market, marketId, side, amount, signalScore }) {
  const data = await apiCall('/api/trade', 'POST', {
    tgId, market, conditionId: marketId || '', side, amount,
    score: signalScore || 0,
  });
  if (!data.ok) throw new Error(data.error || 'bet failed');
  return data;
}

async function registerAgent({ tgId, name, strategy }) {
  const data = await apiCall('/api/agents', 'POST', { tgId, name, strategy, action: 'register' });
  return data;
}

// ── CLI runner ────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

async function main() {
  switch (cmd) {
    case 'signals': {
      const minScore = parseFloat(args.find(a => a.startsWith('--min-score=') || a.startsWith('--min-score'))?.split('=')[1] || args[args.indexOf('--min-score') + 1] || '0');
      const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '20');
      const signals = await getSignals({ minScore, limit });
      console.log(JSON.stringify(signals, null, 2));
      break;
    }
    case 'portfolio': {
      const [tgId] = args;
      if (!tgId) { console.error('Usage: polymarket.js portfolio <tgId>'); process.exit(1); }
      const p = await getPortfolio(tgId);
      console.log(JSON.stringify(p, null, 2));
      break;
    }
    case 'wallet': {
      const [tgId] = args;
      if (!tgId) { console.error('Usage: polymarket.js wallet <tgId>'); process.exit(1); }
      const w = await getOrCreateWallet(tgId);
      console.log(JSON.stringify(w, null, 2));
      break;
    }
    case 'bet': {
      const [tgId, market, side, amount] = args;
      if (!tgId || !market || !side || !amount) {
        console.error('Usage: polymarket.js bet <tgId> <market> <YES|NO> <amount>');
        process.exit(1);
      }
      const result = await placeBet({ tgId, market, side: side.toUpperCase(), amount: parseFloat(amount) });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'register': {
      const [tgId, ...nameParts] = args;
      const name = nameParts.join(' ') || 'My Agent';
      const result = await registerAgent({ tgId, name });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    default:
      console.log('PolyClawster Agent Tool\n\nCommands:');
      console.log('  signals [--min-score=7] [--limit=10]  — get AI signals');
      console.log('  portfolio <tgId>                       — get your portfolio');
      console.log('  wallet <tgId>                          — get/create wallet');
      console.log('  bet <tgId> <market> <YES|NO> <amount> — place a bet');
      console.log('  register <tgId> <name>                 — register agent in leaderboard');
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });

module.exports = { getSignals, getPortfolio, getOrCreateWallet, placeBet, registerAgent };
