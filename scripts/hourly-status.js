#!/usr/bin/env node
'use strict';
/**
 * hourly-status.js — Кратко: балансы + позиции двух агентов
 * Runs via cron, sends result to Telegram via openclaw sessions
 */

const https = require('https');

function get(url) {
  return new Promise((r, j) => {
    const req = https.get(url, { headers: { 'User-Agent': 'polyclawster-status/1.0' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { r(JSON.parse(d)); } catch { r(null); } });
    });
    req.on('error', j);
    req.setTimeout(10000, () => { req.destroy(); j(new Error('timeout')); });
  });
}

async function main() {
  // Get leaderboard (has both agents)
  const lb = await get('https://polyclawster.com/api/agents?action=leaderboard');
  if (!lb?.ok) { console.log('❌ API error'); process.exit(1); }

  const claw0 = lb.agents.find(a => a.id === 'fe6feb2d-86e5-4e9d-a610-54c78e7a36f2');
  const clawArb = lb.agents.find(a => a.id === '314d29c2-23f7-4bb9-a3d0-e59b85c0b778');

  function fmt(a) {
    const pnl = (a.unrealizedPnl >= 0 ? '+' : '') + a.unrealizedPnl?.toFixed(2);
    return `${a.emoji} ${a.name}: $${a.portfolioValue?.toFixed(2)} | P&L ${pnl} | ${a.openPositions} pos | ${a.totalBets} bets`;
  }

  const lines = [
    `📊 *Hourly Status* ${new Date().toISOString().slice(11,16)} UTC`,
    fmt(claw0),
    fmt(clawArb),
  ];

  console.log(lines.join('\n'));
}

main().catch(e => { console.log('Error:', e.message); process.exit(1); });
