/**
 * edge/modules/profile-lookup.js — Look up Polymarket profile by username
 *
 * Polymarket uses proxy wallets (Safe-like contracts) per user.
 * Username → proxy wallet address → positions, balance
 */
'use strict';
const https = require('https');

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'polyclawster/1.0', ...headers },
      timeout: 8000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * Look up a Polymarket user profile by proxy wallet address.
 * Returns portfolio stats.
 */
async function getProfileByAddress(address) {
  const addr = address.toLowerCase();
  const [positions, trades, value] = await Promise.all([
    httpGet(`https://data-api.polymarket.com/positions?user=${addr}&limit=100&sizeThreshold=0`).catch(() => []),
    httpGet(`https://data-api.polymarket.com/trades?user=${addr}&limit=20`).catch(() => []),
    httpGet(`https://data-api.polymarket.com/value?user=${addr}`).catch(() => null),
  ]);

  const openPositions = Array.isArray(positions) ? positions.filter(p => (p.currentValue || 0) > 0.001) : [];

  return {
    address: addr,
    positionCount:  openPositions.length,
    totalValue:     openPositions.reduce((s, p) => s + (p.currentValue || 0), 0),
    totalPnl:       openPositions.reduce((s, p) => s + (p.cashPnl || 0), 0),
    tradeCount:     Array.isArray(trades) ? trades.length : 0,
    positions:      openPositions,
    rawValue:       Array.isArray(value) ? value[0]?.value : 0,
  };
}

module.exports = { getProfileByAddress };
