/**
 * Edge scanner cron — runs every 30 minutes
 */
const { execSync } = require('child_process');
const fs = require('fs');
const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));

async function updateDataJson() {
  const WALLET = '0x6f314d7d2f50808cec1d26c1092e7729d9378d75';
  try {
    const pos = await (await fetch(`https://data-api.polymarket.com/positions?user=${WALLET}&limit=100&sizeThreshold=0.01`)).json();
    const open = pos.filter(p => p.currentValue > 0.01);
    const totalPnl   = open.reduce((s,p) => s + (p.cashPnl||0), 0);
    const totalValue = open.reduce((s,p) => s + (p.currentValue||0), 0);
    const totalCost  = open.reduce((s,p) => s + (p.initialValue||0), 0);
    const pnlPct     = totalCost > 0 ? totalPnl/totalCost*100 : 0;
    let signals = [];
    try { signals = JSON.parse(fs.readFileSync('/tmp/edge_state.json')).lastSignals || []; } catch {}
    fs.writeFileSync('/workspace/data.json', JSON.stringify({
      portfolio: { positions: open, totalValue, totalCost, totalPnl, pnlPct },
      signals, updated: new Date().toISOString()
    }));
    console.log(`[cron] data.json updated: ${open.length} positions, P&L +$${totalPnl.toFixed(2)}, ${signals.length} signals`);
  } catch(e) { console.error('[cron] data.json error:', e.message); }
}

async function runCycle() {
  console.log('[cron] Starting edge scan cycle:', new Date().toISOString());
  try {
    require('./index.js');
  } catch(e) { console.error('[cron] edge scan error:', e.message); }
  await updateDataJson();
}

// Run immediately, then every 30 min
runCycle();
setInterval(runCycle, 30 * 60 * 1000);
console.log('[cron] Edge scanner scheduled every 30min');

// Auto-sync users.json to repo root so Vercel has fresh wallet data
async function syncUsersJson() {
  try {
    const src = '/workspace/edge/data/users.json';
    const dst = '/workspace/users.json';
    const { execSync } = require('child_process');
    require('fs').copyFileSync(src, dst);
    // Push to GitHub
    execSync(`cd /workspace && git add users.json && git diff --cached --quiet || git commit -m "sync: users.json update" && git push origin master:main`, { stdio: 'pipe' });
    console.log('[cron] users.json synced to GitHub');
  } catch(e) { console.log('[cron] users.json sync skipped:', e.message.slice(0,80)); }
}

// Run sync every 10 minutes
setInterval(syncUsersJson, 10 * 60 * 1000);
