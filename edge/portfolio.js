#!/usr/bin/env node
/**
 * edge/portfolio.js — Portfolio status reporter
 * Sends a brief P&L snapshot to Telegram
 * Compares vs last snapshot to detect changes
 */

const fs = require('fs');
const { sendTg } = require('./modules/notify');
const { load, save } = require('./modules/state');

const WALLET = '0x3eae9f8a3e1eba6b7f4792fc3877e50a32e2c47b';
const SNAPSHOT_FILE = '/tmp/portfolio_snapshot.json';

async function fetchJSON(url) {
  const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
  const res = await (await fetch)(url);
  return res.json();
}

async function main() {
  const positions = await fetchJSON(
    `https://data-api.polymarket.com/positions?user=${WALLET}&limit=100&sizeThreshold=0.01`
  );

  if (!Array.isArray(positions)) {
    console.log('[portfolio] No positions data');
    return;
  }

  const open = positions.filter(p => p.currentValue > 0.01);
  const totalValue = open.reduce((s, p) => s + p.currentValue, 0);
  const totalCost  = open.reduce((s, p) => s + (p.initialValue || 0), 0);
  const totalPnl   = open.reduce((s, p) => s + (p.cashPnl || 0), 0);
  const pnlPct     = totalCost > 0 ? (totalPnl / totalCost * 100) : 0;

  // Load last snapshot
  const last = load(SNAPSHOT_FILE, { totalPnl: null, totalValue: null });

  const pnlChanged = last.totalPnl !== null && Math.abs(totalPnl - last.totalPnl) > 2;
  const newResolved = last.totalValue !== null && (last.totalValue - totalValue) > 10;

  // Save new snapshot
  save(SNAPSHOT_FILE, { totalPnl, totalValue, ts: Date.now() });

  // Build message
  const pnlSign = totalPnl >= 0 ? '+' : '';
  const sorted = open.sort((a, b) => (b.cashPnl || 0) - (a.cashPnl || 0));

  const lines = sorted.map(p => {
    const pnl = p.cashPnl || 0;
    const pnlStr = (pnl >= 0 ? '+' : '') + pnl.toFixed(2);
    const price = ((p.curPrice || 0) * 100).toFixed(0) + '¢';
    return `${pnl >= 0 ? '🟢' : '🔴'} ${p.title.slice(0, 38)} | ${p.outcome} @ ${price} | ${pnlStr}`;
  }).join('\n');

  const msg =
    `📊 *Polymarket Portfolio*\n` +
    `💼 ${open.length} позиций | $${totalValue.toFixed(0)} | P&L: *${pnlSign}$${totalPnl.toFixed(2)} (${pnlSign}${pnlPct.toFixed(1)}%)*\n\n` +
    lines.slice(0, 600);

  // Only send if changed significantly OR forced
  const force = process.argv.includes('--force');
  if (force || pnlChanged || newResolved) {
    await sendTg(msg);
    console.log('[portfolio] Sent update, P&L:', totalPnl.toFixed(2));
  } else {
    console.log('[portfolio] No significant change, skipping TG send');
    console.log('P&L: ' + pnlSign + '$' + totalPnl.toFixed(2));
  }
}

main().catch(e => console.error('[portfolio] Error:', e.message));
