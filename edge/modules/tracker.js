/**
 * edge/modules/tracker.js — Resolution & win rate tracker
 * Detects closed positions, logs outcomes, calculates stats
 */

const { get } = require('./http');
const { load, save } = require('./state');
const { sendTg } = require('./notify');
const cfg = require('../config');
const fs = require('fs');

const TRACKER_FILE = '/workspace/edge/data/trades.json';

function ensureDir() {
  const dir = '/workspace/edge/data';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadTrades() {
  ensureDir();
  try { return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8')); } catch { return []; }
}

function saveTrades(trades) {
  ensureDir();
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(trades, null, 2));
}

async function checkResolutions() {
  const trades = loadTrades();
  const knownAssets = new Set(trades.map(t => t.asset));

  let positions;
  try {
    positions = JSON.parse(await get(
      `https://data-api.polymarket.com/positions?user=${cfg.MY_WALLET}&limit=100&sizeThreshold=0`
    ));
  } catch { return; }

  // Detect new closed positions (redeemable = true and size > 0)
  for (const p of positions) {
    if (!p.redeemable && parseFloat(p.curPrice) > 0.01) continue; // still open

    const existing = trades.find(t => t.asset === p.asset);
    if (existing && existing.closed) continue; // already tracked

    const costBasis = parseFloat(p.initialValue || 0);
    const finalValue = parseFloat(p.currentValue || 0);
    const pnl = finalValue - costBasis;
    const won = pnl > 0;

    const trade = {
      asset:      p.asset,
      title:      p.title,
      outcome:    p.outcome,
      costBasis:  costBasis.toFixed(2),
      finalValue: finalValue.toFixed(2),
      pnl:        pnl.toFixed(2),
      pnlPct:     costBasis > 0 ? ((pnl / costBasis) * 100).toFixed(1) : '0',
      won,
      closedAt:   new Date().toISOString(),
      closed:     true,
    };

    if (!existing) {
      trades.push(trade);
    } else {
      Object.assign(existing, trade);
    }

    console.log(`[tracker] Closed: ${p.title?.slice(0, 40)} | ${won ? 'WIN' : 'LOSS'} $${pnl.toFixed(2)}`);
  }

  // Also record open positions we haven't seen yet
  for (const p of positions) {
    if (knownAssets.has(p.asset)) continue;
    if (parseFloat(p.currentValue) < 0.5) continue;

    trades.push({
      asset:     p.asset,
      title:     p.title,
      outcome:   p.outcome,
      costBasis: parseFloat(p.initialValue || 0).toFixed(2),
      openedAt:  new Date().toISOString(),
      closed:    false,
    });
  }

  saveTrades(trades);
  return getStats(trades);
}

function getStats(trades) {
  if (!trades) trades = loadTrades();
  const closed = trades.filter(t => t.closed);
  if (closed.length === 0) return null;

  const wins   = closed.filter(t => t.won).length;
  const losses = closed.filter(t => !t.won).length;
  const winRate = (wins / closed.length * 100).toFixed(1);
  const totalPnl = closed.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
  const totalCost = closed.reduce((s, t) => s + parseFloat(t.costBasis || 0), 0);
  const roi = totalCost > 0 ? (totalPnl / totalCost * 100).toFixed(1) : '0';

  const avgWin  = wins > 0
    ? (closed.filter(t => t.won).reduce((s, t) => s + parseFloat(t.pnl), 0) / wins).toFixed(2)
    : 0;
  const avgLoss = losses > 0
    ? (closed.filter(t => !t.won).reduce((s, t) => s + parseFloat(t.pnl), 0) / losses).toFixed(2)
    : 0;

  return { wins, losses, winRate, totalPnl: totalPnl.toFixed(2), roi, avgWin, avgLoss, total: closed.length };
}

function formatStats(stats) {
  if (!stats) return '📊 Нет закрытых позиций ещё.';
  return (
    `📊 *Performance Stats*\n` +
    `Сделок: ${stats.total} | WR: *${stats.winRate}%* (${stats.wins}W / ${stats.losses}L)\n` +
    `Общий P&L: *${stats.totalPnl > 0 ? '+' : ''}$${stats.totalPnl}* | ROI: *${stats.roi}%*\n` +
    `Средний выигрыш: +$${stats.avgWin} | Средний убыток: $${stats.avgLoss}`
  );
}

module.exports = { checkResolutions, getStats, formatStats, loadTrades };
