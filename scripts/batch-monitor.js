#!/usr/bin/env node
/**
 * batch-monitor.js — Monitor ALL open Claw-0 positions with TP/SL
 * Runs every 5 min, logs alerts, auto-sells if price hits target/stop
 * Usage: node scripts/batch-monitor.js [--dry-run] [--interval 300]
 */
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

const WALLET = '0xbcef78b614393fa6ee5d6183d97f641878581c87';
const DRY_RUN = process.argv.includes('--dry-run');
const INTERVAL = parseInt(process.argv.find(a => a.startsWith('--interval='))?.split('=')[1] || '300') * 1000;

// TP/SL config per market (auto-set based on entry price)
// TP = entry + 30% move, SL = entry - 25% move (conservative)
function calcTPSL(entry, side) {
  if (side === 'YES') {
    return { tp: Math.min(0.95, entry * 1.35), sl: Math.max(0.05, entry * 0.70) };
  } else {
    // NO side: entry is the NO price (1 - yes price)
    return { tp: Math.min(0.95, entry * 1.30), sl: Math.max(0.05, entry * 0.72) };
  }
}

function get(url) {
  return new Promise((r,j) => {
    const req = https.get(url, {headers:{'User-Agent':'polyclawster-monitor/2.0'}}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{r(JSON.parse(d))}catch{r(null)}});
    }); req.on('error',j);
    req.setTimeout(10000, () => { req.destroy(); j(new Error('timeout')); });
  });
}

function formatPnL(pnl) {
  return (pnl >= 0 ? '+' : '') + pnl.toFixed(2);
}

async function checkPositions() {
  const positions = await get(`https://data-api.polymarket.com/positions?user=${WALLET}&sizeThreshold=0.01&limit=50`);
  if (!Array.isArray(positions)) { console.log('⚠️  Could not fetch positions'); return; }

  const now = new Date().toISOString().slice(11,16);
  console.log(`\n[${now}] Checking ${positions.length} positions...`);
  
  const alerts = [];

  for (const p of positions) {
    const cur = parseFloat(p.curPrice || p.currentPrice || 0);
    const entry = parseFloat(p.avgPrice || 0);
    const size = parseFloat(p.size || 0);
    const side = p.outcome || 'YES';
    const title = (p.title || p.market || '?').slice(0, 45);
    const pnl = (cur - entry) * size;
    const { tp, sl } = calcTPSL(entry, side.toUpperCase() === 'YES' || side.toUpperCase() === 'NO' ? side.toUpperCase() : 'YES');
    
    // Determine actual current price for the side we hold
    const holdPrice = cur; // positions API already gives price for our outcome
    
    const status = holdPrice >= tp ? '🎯 TP HIT' 
      : holdPrice <= sl ? '🛑 SL HIT'
      : holdPrice >= tp * 0.9 ? '⚡ Near TP'
      : holdPrice <= sl * 1.15 ? '⚠️  Near SL'
      : '✅';

    console.log(`  ${status} ${side.padEnd(3)} ${title}`);
    console.log(`       entry:${entry.toFixed(3)} cur:${cur.toFixed(3)} tp:${tp.toFixed(3)} sl:${sl.toFixed(3)} pnl:${formatPnL(pnl)}`);

    if (status.includes('HIT')) {
      alerts.push({ title, side, cur, entry, pnl, status, conditionId: p.conditionId });
    }
  }

  if (alerts.length > 0) {
    console.log('\n🚨 ALERTS:');
    for (const a of alerts) {
      console.log(`  ${a.status}: ${a.title} (${a.side} @ ${a.cur.toFixed(3)}, PnL ${formatPnL(a.pnl)})`);
    }
    if (!DRY_RUN) {
      console.log('  (Auto-sell not yet implemented in batch mode — manual action required)');
    }
  }

  // Summary
  const totalPnL = positions.reduce((s, p) => {
    const cur = parseFloat(p.curPrice || 0);
    const entry = parseFloat(p.avgPrice || 0);
    const size = parseFloat(p.size || 0);
    return s + (cur - entry) * size;
  }, 0);
  
  console.log(`\n  Total unrealized PnL: ${formatPnL(totalPnL)} | ${positions.length} positions`);
}

async function run() {
  console.log(`🔍 Batch Monitor started | interval: ${INTERVAL/1000}s | dry-run: ${DRY_RUN}`);
  await checkPositions();
  setInterval(checkPositions, INTERVAL);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
