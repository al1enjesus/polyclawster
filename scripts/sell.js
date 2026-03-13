#!/usr/bin/env node
/**
 * PolyClawster Sell — close an open position
 *
 * Demo:  marks bet as closed on polyclawster.com, simulates return
 * Live:  signs SELL order locally → submits via relay → Polymarket CLOB
 *
 * Usage:
 *   node sell.js --list               # Show open positions
 *   node sell.js --bet-id 42          # Close position by bet ID
 *   node sell.js --bet-id 42 --demo   # Close demo position
 */
'use strict';
const { loadConfig, getSigningKey, apiRequest, API_BASE } = require('./setup');

function api(method, path, body, apiKey) {
  return apiRequest(method, `${API_BASE}${path}`, body, apiKey ? { 'X-Api-Key': apiKey } : {});
}

// ── List open positions ───────────────────────────────────────────────────────
async function listPositions(isDemo) {
  const config = loadConfig();
  if (!config?.agentId) throw new Error('Not configured. Run: node scripts/setup.js --auto');

  const portfolio = await api('GET', '/api/agents?action=portfolio', null, config.apiKey);
  if (!portfolio?.ok) throw new Error(portfolio?.error || 'Failed to load portfolio');

  const bets = (portfolio.openBets || []).filter(b => !!b.is_demo === !!isDemo);

  if (!bets.length) {
    console.log(`No open ${isDemo ? 'demo' : 'live'} positions.`);
    return [];
  }

  console.log(`📊 Open ${isDemo ? 'demo ' : ''}positions:`);
  bets.forEach(b => {
    console.log(`  [${b.id}] ${b.side} $${parseFloat(b.amount).toFixed(2)} @ ${parseFloat(b.price).toFixed(2)} — ${(b.market || '?').slice(0, 60)}`);
  });

  return bets;
}

// ── Close a position ──────────────────────────────────────────────────────────
async function closePosition({ betId, isDemo }) {
  const config = loadConfig();
  if (!config?.agentId) throw new Error('Not configured. Run: node scripts/setup.js --auto');

  console.log(`🔄 Closing ${isDemo ? 'demo ' : ''}position #${betId}...`);

  // ── Demo close: call close_bet on agents API ────────────────────────────
  if (isDemo) {
    const r = await api('POST', '/api/agents', {
      action: 'close_bet',
      betId:  parseInt(betId),
      isDemo: true,
    }, config.apiKey);
    if (!r?.ok) throw new Error(r?.error || 'Failed to close demo position');
    console.log(`✅ Demo position closed! Return: $${parseFloat(r.returnAmount || 0).toFixed(2)} (PnL: ${r.pnl >= 0 ? '+' : ''}$${parseFloat(r.pnl || 0).toFixed(2)})`);
    return r;
  }

  // ── Live close: sign SELL order locally → submit via relay ──────────────
  if (!(getSigningKey(config))) throw new Error('Wallet not configured. Run: node scripts/setup.js --auto');
  if (!config.clobApiKey || !config.clobSig) throw new Error('No CLOB creds. Run: node scripts/setup.js --derive-clob');

  // Get bet details from polyclawster.com
  const portfolio = await api('GET', '/api/agents?action=portfolio', null, config.apiKey);
  if (!portfolio?.ok) throw new Error(portfolio?.error || 'Failed to load portfolio');

  const bet = (portfolio.openBets || []).find(b => b.id === parseInt(betId));
  if (!bet) throw new Error(`Bet #${betId} not found or already closed`);

  // market_id may store conditionId (0x...) or actual tokenId
  // If conditionId, resolve the actual tokenId from CLOB
  let tokenId = bet.token_id || bet.market_id;
  if (tokenId && tokenId.startsWith('0x')) {
    console.log('   Resolving tokenId from conditionId via CLOB...');
    try {
      const mkt = await apiRequest('GET', config.clobRelayUrl + '/markets/' + tokenId);
      if (mkt?.tokens) {
        const sideUpper = (bet.side || 'YES').toUpperCase();
        const tk = mkt.tokens.find(t => t.outcome.toUpperCase() === sideUpper);
        if (tk) {
          tokenId = tk.token_id;
          console.log('   Resolved ' + sideUpper + ' token');
        }
      }
    } catch(e) { console.log('   Resolution failed:', e.message); }
  }
  if (!tokenId || tokenId.length < 10) {
    throw new Error('No tokenId stored for this bet — cannot sell. You may need to sell manually on Polymarket.');
  }

  const { ethers } = await import('ethers');
  const { ClobClient, SignatureType, OrderType, Side } = await import('@polymarket/clob-client');

  const wallet = new ethers.Wallet(getSigningKey(config));
  const creds  = {
    key:        config.clobApiKey,
    secret:     config.clobSig,
    passphrase: config.clobPass,
  };
  const client = new ClobClient(config.clobRelayUrl, 137, wallet, creds, SignatureType.EOA);

  // To close a position: SELL the outcome tokens we hold
  const buyAmount = parseFloat(bet.amount || 0);
  const buyPrice  = parseFloat(bet.price || 0.5);
  const shares    = buyAmount / buyPrice;

  console.log(`   Selling ${bet.side} tokens (${shares.toFixed(4)} shares)...`);
  console.log(`   Token: ${tokenId.slice(0, 20)}...`);
  console.log('   Signing sell order locally...');

  const order = await client.createMarketOrder({
    tokenID: tokenId,
    side:    Side.SELL,
    amount:  shares,
  });

  console.log('   Submitting via relay...');
  const response = await client.postOrder(order, OrderType.FOK);
  const orderID  = response?.orderID || response?.orderId || '';

  if (!orderID && (response?.error || response?.errorMsg)) {
    throw new Error('CLOB rejected sell: ' + (response.error || response.errorMsg || JSON.stringify(response)));
  }

  const returnEstimate = +(shares * (response?.avgPrice || buyPrice)).toFixed(4);

  // Mark bet as closed on polyclawster.com
  await api('POST', '/api/agents', {
    action:  'close_bet',
    betId:   parseInt(betId),
    orderID,
    returnAmount: returnEstimate,
  }, config.apiKey).catch(e => {
    console.warn('   ⚠️ Failed to update bet status:', e.message);
  });

  console.log('');
  console.log('✅ Position closed!');
  console.log(`   Order ID: ${orderID}`);
  console.log(`   Status:   ${response?.status || 'submitted'}`);
  return { ok: true, orderID, status: response?.status };
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
      console.log('  node sell.js --list --demo        # Show open demo positions');
      console.log('  node sell.js --bet-id 42          # Close live position');
      console.log('  node sell.js --bet-id 42 --demo   # Close demo position');
      process.exit(0);
    }
    closePosition({ betId: parseInt(betId), isDemo })
      .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
  }
}
