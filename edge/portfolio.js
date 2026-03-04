#!/usr/bin/env node
/**
 * edge/portfolio.js — Real-time portfolio status
 *
 * Checks:
 *  1. CLOB free USDC (spendable)
 *  2. Open positions value (locked in bets)
 *  3. Historical P&L from CLOB trades
 *
 * Sends Telegram message only if:
 *  - P&L changed > $2 since last check
 *  - Position was resolved (value dropped significantly)
 *  - --force flag passed
 *
 * Architecture:
 *  - System wallet = 0x3eAe9f8a... (polymarket-creds.json)
 *  - Free USDC ≠ total portfolio value
 *  - Open positions are locked as conditional tokens (CTF)
 */
'use strict';
require('dotenv').config({ path: '/workspace/.env' });

const fs   = require('fs');
const { sendTg } = require('./modules/notify');
const { load, save } = require('./modules/state');

const CREDS_FILE = '/workspace/polymarket-creds.json';
const SNAPSHOT   = '/tmp/portfolio_snapshot.json';

async function main() {
  const creds = JSON.parse(fs.readFileSync(CREDS_FILE));
  const addr  = creds.wallet.address;
  const pk    = creds.wallet.privateKey || 'REMOVED_KEY';

  const { getWalletBalance } = require('../lib/wallet-balance');
  const bal = await getWalletBalance(addr, pk, creds.api);

  const last = load(SNAPSHOT, { totalPnl: null, totalValue: null, freeUsdc: null });
  const force = process.argv.includes('--force');

  const pnlChanged   = last.totalPnl   !== null && Math.abs(bal.totalPnl   - last.totalPnl)   > 2;
  const valueChanged = last.totalValue !== null && Math.abs(bal.totalValue  - last.totalValue) > 10;
  const cashChanged  = last.freeUsdc   !== null && Math.abs(bal.freeUsdc   - last.freeUsdc)   > 5;

  save(SNAPSHOT, { totalPnl: bal.totalPnl, totalValue: bal.totalValue, freeUsdc: bal.freeUsdc, ts: Date.now() });

  const pnlSign = bal.totalPnl >= 0 ? '+' : '';
  console.log(`[portfolio] Free: $${bal.freeUsdc.toFixed(2)} | Positions: $${bal.positionsValue.toFixed(2)} (${bal.positionCount}) | PnL: ${pnlSign}$${bal.totalPnl.toFixed(2)}`);

  if (!force && !pnlChanged && !valueChanged && !cashChanged) {
    console.log('[portfolio] No significant change, skip TG');
    return;
  }

  const posLines = (bal.positions || [])
    .sort((a, b) => (b.cashPnl || 0) - (a.cashPnl || 0))
    .slice(0, 5)
    .map(p => {
      const pnlSign = (p.cashPnl || 0) >= 0 ? '📈' : '📉';
      return `${pnlSign} ${(p.title || '').slice(0, 45)}\n   ${p.outcome} @ ${((p.price||0)*100).toFixed(0)}¢ → $${(p.currentValue||0).toFixed(2)}`;
    }).join('\n');

  const msg =
    `💼 *Портфолио Polymarket*\n\n` +
    `💵 Свободно: *$${bal.freeUsdc.toFixed(2)}*\n` +
    `📊 В позициях: *$${bal.positionsValue.toFixed(2)}* (${bal.positionCount} шт)\n` +
    `📈 P&L: *${pnlSign}$${bal.totalPnl.toFixed(2)}*\n\n` +
    (posLines ? posLines + '\n' : '_Открытых позиций нет_\n') +
    `\n_Source: ${bal.source}_`;

  await sendTg(msg);
  console.log('[portfolio] Sent update');
}

main().catch(e => { console.error('[portfolio] Error:', e.message); process.exit(1); });
