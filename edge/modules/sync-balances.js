/**
 * edge/modules/sync-balances.js — Sync user balances from Polymarket to Supabase
 *
 * For each user with a wallet address:
 *  1. Get real positions value from data-api.polymarket.com
 *  2. Get free USDC from CLOB (if private key available)
 *  3. Update Supabase total_pnl, total_value, updated_at
 *
 * Run from heartbeat or manually.
 */
'use strict';
const https = require('https');
const db    = require('../../lib/db');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'polyclawster/1.0' }, timeout: 8000 }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function syncUserBalance(user) {
  if (!user.address) return;

  try {
    const addr = user.address.toLowerCase();

    // Get open positions
    const positions = await httpGet(`https://data-api.polymarket.com/positions?user=${addr}&limit=100&sizeThreshold=0`);
    if (!Array.isArray(positions)) return;

    const totalPnl   = positions.reduce((s, p) => s + (p.cashPnl || 0), 0);
    const totalValue = positions.reduce((s, p) => s + (p.currentValue || 0), 0);

    // Only update if something changed (avoid noisy writes)
    const prevPnl = parseFloat(user.total_pnl || 0);
    if (Math.abs(totalPnl - prevPnl) < 0.01 && Math.abs(totalValue - parseFloat(user.total_value || 0)) < 0.01) {
      return;
    }

    await db.updateUser(user.id, {
      total_pnl:   parseFloat(totalPnl.toFixed(4)),
      total_value: parseFloat(totalValue.toFixed(4)),
    });

    console.log(`[sync] ${user.id} (${addr.slice(0,10)}) PnL: $${totalPnl.toFixed(2)} | Value: $${totalValue.toFixed(2)}`);
  } catch (e) {
    console.error(`[sync] Error for ${user.id}:`, e.message);
  }
}

async function syncAll() {
  const users = await db.getAllUsers();
  if (!Array.isArray(users)) { console.log('[sync] No users'); return; }

  const withWallet = users.filter(u => u.address);
  console.log(`[sync] Syncing ${withWallet.length} users with wallets`);

  // Process in parallel batches of 3
  for (let i = 0; i < withWallet.length; i += 3) {
    const batch = withWallet.slice(i, i + 3);
    await Promise.all(batch.map(syncUserBalance));
    if (i + 3 < withWallet.length) await new Promise(r => setTimeout(r, 500));
  }

  console.log('[sync] Done');
}

module.exports = { syncAll, syncUserBalance };

// Run directly
if (require.main === module) {
  require('dotenv').config({ path: '/workspace/.env' });
  syncAll().catch(e => { console.error(e.message); process.exit(1); });
}
