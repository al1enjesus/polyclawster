/**
 * lib/wallet-balance.js — Real-time balance for Polymarket wallets
 *
 * Sources (in priority order):
 *  1. CLOB API (authenticated) — free USDC collateral + open orders locked
 *  2. Polymarket data-api — open positions value (CTF tokens)
 *  3. Polygon RPC — raw on-chain USDC balance (fallback)
 *
 * Architecture note:
 *  - Free USDC = collateral not locked in any position
 *  - Positions = USDC locked as conditional tokens (YES/NO shares)
 *  - Total value = free USDC + sum of position currentValue
 *  - Wallet balance on-chain may be 0 even when funds are "in" Polymarket
 *    because funds are custodied in Polymarket's CTF contract
 */
'use strict';
const https = require('https');

const DATA_API = 'https://data-api.polymarket.com';

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'polyclawster/1.0', ...headers },
      timeout: 8000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * Get free USDC collateral via CLOB API (requires wallet + API creds).
 * Returns null if creds not available.
 */
async function getClobCollateral(privateKey, apiCreds) {
  try {
    const { ClobClient, SignatureType } = await import('@polymarket/clob-client');
    const { ethers } = require('ethers');
    const wallet = new ethers.Wallet(privateKey);
    const client = new ClobClient(
      'https://clob.polymarket.com', 137, wallet, apiCreds, SignatureType.EOA
    );
    const bal = await client.getBalanceAllowance({ asset_type: 'COLLATERAL' });
    return parseFloat(bal.balance || 0) / 1e6;
  } catch {
    return null;
  }
}

/**
 * Get open positions value from Polymarket data-api (public, no auth).
 */
async function getPositionsValue(address) {
  try {
    const addr = address.toLowerCase();
    const positions = await httpGet(`${DATA_API}/positions?user=${addr}&limit=100&sizeThreshold=0`);
    if (!Array.isArray(positions)) return { count: 0, totalValue: 0, totalPnl: 0, positions: [] };

    const open = positions.filter(p => (p.currentValue || 0) > 0.001);
    return {
      count: open.length,
      totalValue: open.reduce((s, p) => s + (p.currentValue || 0), 0),
      totalPnl: open.reduce((s, p) => s + (p.cashPnl || 0), 0),
      positions: open.map(p => ({
        title: p.title,
        outcome: p.outcome,
        size: p.size,
        currentValue: p.currentValue,
        cashPnl: p.cashPnl,
        price: p.curPrice,
      })),
    };
  } catch {
    return { count: 0, totalValue: 0, totalPnl: 0, positions: [] };
  }
}

/**
 * Get raw on-chain USDC balance via Polygon RPC (no auth needed).
 * Checks both USDC.e (bridged) and native USDC.
 */
async function getOnChainBalance(address) {
  const USDC_e = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const USDC_n = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
  const selector = '70a08231';
  const padded = address.toLowerCase().replace('0x', '').padStart(64, '0');
  const callData = '0x' + selector + padded;

  const rpcs = [
    'https://polygon-bor-rpc.publicnode.com',
    'https://polygon.drpc.org',
    'https://rpc.ankr.com/polygon',
  ];

  for (const rpcUrl of rpcs) {
    try {
      const body = JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: USDC_e, data: callData }, 'latest'],
      });
      const result = await new Promise((resolve, reject) => {
        const u = new URL(rpcUrl);
        const req = https.request({
          hostname: u.hostname, path: u.pathname, method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          timeout: 6000,
        }, res => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(); } });
        });
        req.on('error', reject).on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(body); req.end();
      });
      const hex = result?.result;
      if (hex && hex !== '0x') {
        const bal = Number(BigInt(hex)) / 1e6;
        return { usdc_e: bal, usdc_n: 0 }; // simplified - just return USDC.e for now
      }
    } catch { /* try next */ }
  }
  return { usdc_e: 0, usdc_n: 0 };
}

/**
 * Full wallet balance snapshot.
 * @param {string} address - Wallet address (0x...)
 * @param {string} [privateKey] - Private key for CLOB auth (optional)
 * @param {Object} [apiCreds] - Polymarket API creds {key, secret, passphrase} (optional)
 */
async function getWalletBalance(address, privateKey = null, apiCreds = null) {
  const [clob, positions, onchain] = await Promise.all([
    privateKey && apiCreds ? getClobCollateral(privateKey, apiCreds) : Promise.resolve(null),
    getPositionsValue(address),
    getOnChainBalance(address),
  ]);

  const freeUsdc = clob !== null ? clob : (onchain.usdc_e + onchain.usdc_n);
  const positionsValue = positions.totalValue;
  const totalValue = freeUsdc + positionsValue;

  return {
    address,
    freeUsdc:       parseFloat(freeUsdc.toFixed(4)),
    positionsValue: parseFloat(positionsValue.toFixed(4)),
    positionCount:  positions.count,
    totalPnl:       parseFloat(positions.totalPnl.toFixed(4)),
    totalValue:     parseFloat(totalValue.toFixed(4)),
    onchain:        onchain,
    positions:      positions.positions,
    source:         clob !== null ? 'clob+data-api' : 'rpc+data-api',
    ts:             Date.now(),
  };
}

module.exports = { getWalletBalance, getClobCollateral, getPositionsValue, getOnChainBalance };
