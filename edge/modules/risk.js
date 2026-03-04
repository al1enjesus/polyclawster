/**
 * edge/modules/risk.js — Position risk manager
 * Auto take-profit at 92¢+ and stop-loss at -60%
 */

const { ClobClient, SignatureType, Side } = require('@polymarket/clob-client');
const { ethers } = require('ethers');
const { get } = require('./http');
const { sendTg } = require('./notify');
const { load, save } = require('./state');
const cfg = require('../config');
const fs = require('fs');

const PK    = '0x18bf911507bda6372ff5aafa60439d2e27b7308267293f03eca629f9ff1f2289';
const CREDS = JSON.parse(fs.readFileSync('/workspace/polymarket-creds.json'));

const TAKE_PROFIT_PRICE = 0.92;   // sell when price >= 92¢
const STOP_LOSS_PCT     = -0.60;  // sell when P&L <= -60% of cost
const RISK_STATE        = '/tmp/risk_state.json';

async function getClient() {
  const wallet = new ethers.Wallet(PK);
  return new ClobClient('https://clob.polymarket.com', 137, wallet, CREDS.api, SignatureType.EOA);
}

async function scanRisk() {
  const riskState = load(RISK_STATE, { closed: [] });
  const closed = new Set(riskState.closed || []);

  let positions;
  try {
    positions = JSON.parse(await get(
      `https://data-api.polymarket.com/positions?user=${cfg.MY_WALLET}&limit=100&sizeThreshold=0.01`
    ));
  } catch (e) {
    console.log('[risk] Failed to fetch positions:', e.message);
    return [];
  }

  const actions = [];

  for (const p of positions) {
    if (closed.has(p.asset)) continue;
    if (!p.size || p.size < 1) continue;

    const price    = parseFloat(p.curPrice || 0);
    const costBasis = parseFloat(p.initialValue || 0);
    const pnlPct   = costBasis > 0 ? (p.cashPnl || 0) / costBasis : 0;
    const title    = (p.title || '').slice(0, 50);

    let reason = null;
    let action = null;

    // Take profit
    if (price >= TAKE_PROFIT_PRICE) {
      reason = `TP: цена ${(price*100).toFixed(0)}¢ >= 92¢`;
      action = 'SELL_ALL';
    }

    // Stop loss
    if (pnlPct <= STOP_LOSS_PCT) {
      reason = `SL: P&L ${(pnlPct*100).toFixed(0)}% <= -60%`;
      action = 'SELL_ALL';
    }

    if (!action) continue;

    console.log(`[risk] ${action}: ${title} | ${reason}`);

    try {
      const client = await getClient();
      const sellPrice = Math.max(0.01, price - 0.03);
      const r = await client.createAndPostMarketOrder(
        { tokenID: p.asset, side: Side.SELL, amount: p.size, price: sellPrice },
        { tickSize: '0.01', negRisk: p.negativeRisk || false }
      );

      if (r.success || r.orderID) {
        const got = parseFloat(r.makingAmount || 0);
        closed.add(p.asset);
        actions.push({ title, reason, got });

        const emoji = action === 'SELL_ALL' && price >= TAKE_PROFIT_PRICE ? '🟢' : '🔴';
        await sendTg(
          `${emoji} *АВТО-ВЫХОД*\n` +
          `📌 ${title}\n` +
          `📋 ${reason}\n` +
          `💵 Получено: *$${got.toFixed(2)}*`
        );
        console.log(`[risk] Closed: $${got.toFixed(2)}`);
      }
    } catch (e) {
      console.log(`[risk] Sell error: ${e.message?.slice(0, 80)}`);
    }

    await new Promise(r => setTimeout(r, 800));
  }

  save(RISK_STATE, { closed: [...closed], ts: Date.now() });
  return actions;
}

module.exports = { scanRisk };
