#!/usr/bin/env node
/**
 * PolyClawster Sell — close an open position
 *
 * Usage:
 *   node sell.js --list               # Show open positions
 *   node sell.js --bet-id 42          # Close position by bet ID
 *   node sell.js --bet-id 42 --demo   # Close demo position
 */
'use strict';
const https = require('https');
const { loadConfig } = require('./setup');

const API_BASE = 'https://polyclawster.com';

function apiCall(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const u       = new URL(`${API_BASE}${path}`);
    const payload = body ? JSON.stringify(body) : null;
    const req     = https.request({
      hostname: u.hostname,
      path:     u.pathname + (u.search || ''),
      method,
      headers: {
        'Content-Type':   'application/json',
        'User-Agent':     'polyclawster-skill/2.0',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(apiKey  ? { 'X-Api-Key': apiKey } : {}),
      },
      timeout: 20000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Bad JSON')); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ── List open positions ───────────────────────────────────────────────────────
async function listPositions(isDemo) {
  const config = loadConfig();
  if (!config?.agentId) throw new Error('Not configured. Run: node scripts/setup.js --auto');

  const portfolio = await apiCall('GET', `/api/agents?action=portfolio&agent_id=${config.agentId}`, null, config.apiKey);
  const bets = (portfolio?.openBets || []).filter(b => !!b.is_demo === !!isDemo);

  if (!bets.length) {
    console.log(`No open ${isDemo ? 'demo' : 'live'} positions.`);
    return;
  }

  console.log(`📊 Open ${isDemo ? 'demo ' : ''}positions:`);
  bets.forEach(b => {
    console.log(`  [${b.id}] ${b.side} $${b.amount} — ${b.market?.slice(0, 60)}`);
  });
}

// ── Close a position ──────────────────────────────────────────────────────────
async function closePosition({ betId, isDemo }) {
  const config = loadConfig();
  if (!config?.agentId) throw new Error('Not configured. Run: node scripts/setup.js --auto');

  console.log(`🔄 Closing ${isDemo ? 'demo ' : ''}position #${betId}...`);

  if (isDemo) {
    // Demo close: just mark as closed via agents API
    const r = await apiCall('POST', '/api/agents', {
      action: 'close_bet',
      betId:  parseInt(betId),
      isDemo: true,
    }, config.apiKey);
    if (!r?.ok) throw new Error(r?.error || 'Failed to close demo position');
    console.log('✅ Demo position closed.');
    return r;
  }

  // Live close: use sell API (relays a SELL order to CLOB)
  // For live positions, we need to sell the outcome token back
  const { ethers }                              = await import('ethers');
  const { ClobClient, SignatureType, OrderType, Side } = await import('@polymarket/clob-client');

  const wallet = new ethers.Wallet(config.privateKey);
  const creds  = {
    key:        config.clobApiKey,
    secret:     config.clobApiSecret,
    passphrase: config.clobApiPassphrase,
  };
  const client = new ClobClient(config.clobRelayUrl, 137, wallet, creds, SignatureType.EOA);

  // Get bet details from polyclawster.com
  const portfolio = await apiCall('GET', `/api/agents?action=portfolio&agent_id=${config.agentId}`, null, config.apiKey);
  const bet = (portfolio?.openBets || []).find(b => b.id === parseInt(betId));
  if (!bet) throw new Error(`Bet #${betId} not found or already closed`);

  // For a SELL, we need the tokenId — market_id in bets table is the tokenId
  const tokenId = bet.market_id;
  if (!tokenId) throw new Error('No tokenId for this bet. Live sell requires conditionId/tokenId.');

  // Original side was YES → we hold YES tokens → SELL YES tokens back
  // Original side was NO  → we hold NO tokens  → SELL NO tokens back (BUY the opposite? depends on CLOB)
  // On Polymarket: to close a YES position, SELL YES tokens; to close NO, SELL NO tokens
  const clob_side = Side.SELL; // always SELL to close

  console.log(`   Selling ${bet.side} position (token ${tokenId.slice(0, 20)}...)...`);
  console.log('   Signing sell order locally...');

  const order = await client.createMarketOrder({
    tokenID: tokenId,
    side:    clob_side,
    amount:  parseFloat(bet.amount),
  });

  const response = await client.postOrder(order, OrderType.FOK);
  const orderID  = response?.orderID || '';
  if (!orderID && response?.error) {
    throw new Error('CLOB rejected sell: ' + (response.error || JSON.stringify(response)));
  }

  // Mark bet as closed on polyclawster.com
  await apiCall('POST', '/api/agents', {
    action: 'close_bet',
    betId:  parseInt(betId),
    orderID,
  }, config.apiKey).catch(() => {});

  console.log('');
  console.log('✅ Position closed!');
  console.log(`   Order ID: ${orderID}`);
  console.log(`   Status:   ${response?.status || 'submitted'}`);
  return { ok: true, orderID };
}

module.exports = { closePosition, listPositions };

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args   = process.argv.slice(2);
  const getArg = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const isDemo = args.includes('--demo');

  if (args.includes('--list')) {
    listPositions(isDemo).catch(e => { console.error('❌', e.message); process.exit(1); });
  } else {
    const betId = getArg('--bet-id') || getArg('--id');
    if (!betId) {
      console.log('Usage:');
      console.log('  node sell.js --list               # Show open positions');
      console.log('  node sell.js --bet-id 42          # Close position');
      console.log('  node sell.js --bet-id 42 --demo   # Close demo position');
      process.exit(0);
    }
    closePosition({ betId: parseInt(betId), isDemo })
      .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
  }
}
