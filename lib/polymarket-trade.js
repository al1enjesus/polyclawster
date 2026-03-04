/**
 * lib/polymarket-trade.js — Shared CLOB execution module
 * Used by: api/trade.js, edge/modules/trade.js
 *
 * Executes a single Polymarket CLOB market order.
 */
'use strict';
const https = require('https');
const fs    = require('fs');

// Master wallet CLOB credentials (for API key auth)
let CREDS = null;
function getCreds() {
  if (CREDS) return CREDS;
  try {
    CREDS = JSON.parse(fs.readFileSync('/workspace/polymarket-creds.json', 'utf8'));
  } catch (e) {
    console.error('[polymarket-trade] creds read failed:', e.message);
    CREDS = {};
  }
  return CREDS;
}

/**
 * Get the best ask price for a tokenId from CLOB order book
 */
async function getBestAsk(client, tokenId) {
  try {
    const ob = await client.getOrderBook(tokenId);
    const asks = ob.asks || [];
    if (asks.length > 0) return parseFloat(asks[0].price);
  } catch {}
  return null;
}

/**
 * Find tokenId for a market from Gamma API
 */
async function resolveTokenId(slug, conditionId) {
  return new Promise(resolve => {
    const query = encodeURIComponent(slug || conditionId || '');
    const req = https.get({
      hostname: 'gamma-api.polymarket.com',
      path: '/markets?slug=' + query + '&limit=1',
      headers: { 'User-Agent': 'polyclawster/1.0' },
      timeout: 8000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const arr = JSON.parse(d);
          if (Array.isArray(arr) && arr.length > 0) {
            const m = arr[0];
            const tokens = JSON.parse(m.clobTokenIds || '[]');
            // YES token is index 0, NO is index 1
            resolve(tokens[0] || null);
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Execute a CLOB market order
 * @param {Object} opts
 * @param {string} opts.privateKey  - Wallet private key (0x...)
 * @param {string} opts.market      - Market title
 * @param {string} opts.conditionId - Polymarket condition ID
 * @param {string} opts.slug        - Market slug
 * @param {string} opts.side        - 'YES' or 'NO'
 * @param {number} opts.amount      - USDC amount to spend
 * @returns {Object} trade result
 */
async function executeTrade(opts) {
  var { privateKey, market, conditionId, slug, side, amount } = opts;

  // Dynamic require — not available in all environments
  var ClobClient, SignatureType, Side, ethers;
  try {
    var clobPkg = require('@polymarket/clob-client');
    ClobClient    = clobPkg.ClobClient;
    SignatureType = clobPkg.SignatureType;
    Side          = clobPkg.Side;
    ethers        = require('ethers');
  } catch (e) {
    throw new Error('CLOB client not available: ' + e.message);
  }

  const creds = getCreds();
  if (!creds.api) throw new Error('Polymarket API credentials not found');

  // Init wallet and CLOB client
  const wallet = new ethers.Wallet(privateKey);
  const client = new ClobClient(
    'https://clob.polymarket.com',
    137,
    wallet,
    creds.api,
    SignatureType.EOA
  );

  // Resolve token ID
  let tokenId = null;
  if (slug || conditionId) {
    tokenId = await resolveTokenId(slug || conditionId, conditionId);
  }
  if (!tokenId) {
    throw new Error('Could not resolve tokenId for market: ' + (market || slug || conditionId));
  }

  // Get current price
  var price = await getBestAsk(client, tokenId);
  if (!price) price = 0.5;

  // Skip if price > 90¢ (not enough upside)
  if (price > 0.90) {
    throw new Error('Price too high (' + (price * 100).toFixed(0) + '¢) — skipping');
  }

  // Execute market order
  const order = await client.createAndPostMarketOrder(
    {
      tokenID: tokenId,
      side:    side === 'NO' ? Side.BUY : Side.BUY, // always BUY the chosen side token
      amount:  amount,
      price:   Math.min(price + 0.05, 0.97),
    },
    { tickSize: '0.01', negRisk: false }
  );

  if (!order || (!order.success && !order.orderID)) {
    throw new Error('Order rejected: ' + JSON.stringify(order).slice(0, 100));
  }

  return {
    success:   true,
    orderID:   order.orderID || order.orderId || '',
    tokenId:   tokenId,
    price:     price,
    amount:    parseFloat(order.makingAmount || amount),
    tokens:    parseFloat(order.takingAmount || 0),
    side:      side,
    market:    market,
    raw:       order,
  };
}

module.exports = { executeTrade, resolveTokenId, getBestAsk };
