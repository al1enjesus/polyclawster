/**
 * lib/polymarket-trade.js — Shared CLOB execution module
 * Used by: api/trade.js, edge/modules/trade.js
 *
 * Executes a single Polymarket CLOB market order.
 */
'use strict';
const https = require('https');
const fs    = require('fs');

// Master wallet CLOB credentials (from env vars or local file)
let CREDS = null;
function getCreds() {
  if (CREDS) return CREDS;
  if (process.env.POLY_API_KEY) {
    CREDS = {
      api: {
        key:        process.env.POLY_API_KEY,
        secret:     process.env.POLY_API_SECRET,
        passphrase: process.env.POLY_API_PASSPHRASE,
      },
      wallet: {
        address:    process.env.POLY_WALLET_ADDRESS,
        privateKey: process.env.POLY_PRIVATE_KEY,
      }
    };
    return CREDS;
  }
  try {
    CREDS = JSON.parse(fs.readFileSync('/workspace/polymarket-creds.json', 'utf8'));
  } catch (e) {
    console.error('[polymarket-trade] creds read failed:', e.message);
    CREDS = {};
  }
  return CREDS;
}

/**
 * Get best ask price for a tokenId from CLOB order book
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
 * Find tokenId for a market from Gamma API (fallback)
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
 * Check if market is still tradeable via Gamma API
 * Returns { active, endDate, question }
 */
async function getMarketMeta(conditionId, slug) {
  return new Promise(resolve => {
    const query = conditionId
      ? '/markets?condition_id=' + encodeURIComponent(conditionId) + '&limit=1'
      : '/markets?slug=' + encodeURIComponent(slug || '') + '&limit=1';
    const req = https.get({
      hostname: 'gamma-api.polymarket.com',
      path: query,
      headers: { 'User-Agent': 'polyclawster/1.0' },
      timeout: 8000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const arr = JSON.parse(d);
          if (Array.isArray(arr) && arr.length > 0) {
            const m = arr[0];
            resolve({
              active:   m.active !== false && m.closed !== true,
              endDate:  m.endDate || null,
              question: m.question || null,
            });
          } else {
            resolve({ active: true }); // assume active if can't check
          }
        } catch { resolve({ active: true }); }
      });
    });
    req.on('error', () => resolve({ active: true }));
    req.on('timeout', () => { req.destroy(); resolve({ active: true }); });
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
  const { privateKey, market, conditionId, slug, side, amount } = opts;
  const sideUpper = (side || 'YES').toUpperCase();

  // Dynamic import — @polymarket/clob-client is ES Module
  let ClobClient, SignatureType, Side, ethers;
  try {
    const clobPkg = await import('@polymarket/clob-client');
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

  // ── 1. Resolve tokenId via CLOB getMarket ──────────────────────
  let tokenId    = null;
  let tokenPrice = null;
  let isNegRisk  = false;

  if (conditionId) {
    try {
      const mkt = await client.getMarket(conditionId);
      if (mkt && mkt.tokens && mkt.tokens.length > 0) {
        // YES = index 0, NO = index 1
        const token = (sideUpper === 'NO') ? (mkt.tokens[1] || mkt.tokens[0]) : mkt.tokens[0];
        tokenId    = token.token_id;
        tokenPrice = parseFloat(token.price || 0);
        isNegRisk  = !!mkt.neg_risk;
        console.log('[trade] tokenId:', tokenId.slice(0, 20) + '...', 'price:', tokenPrice, 'negRisk:', isNegRisk);
      }
    } catch (e) {
      console.error('[trade] getMarket error:', e.message);
    }
  }

  // Fallback: Gamma API slug lookup
  if (!tokenId && (slug || conditionId)) {
    tokenId = await resolveTokenId(slug || conditionId, conditionId);
  }

  if (!tokenId) {
    throw new Error('Could not resolve tokenId for: ' + (market || slug || conditionId));
  }

  // ── 2. Get live price from order book ─────────────────────────
  let price = tokenPrice;
  if (!price || price <= 0) {
    price = await getBestAsk(client, tokenId);
  }
  if (!price || price <= 0) {
    price = 0.5; // safe fallback for illiquid markets
  }

  // ── 3. Market validity check ───────────────────────────────────
  // Don't use price thresholds — check actual market status instead.
  // Price 0.99 on NO side is perfectly valid (e.g. "Bitcoin to $40K" = NO at 99¢)
  if (conditionId || slug) {
    const meta = await getMarketMeta(conditionId, slug);
    if (!meta.active) {
      throw new Error('Market is closed or resolved: ' + (market || slug));
    }
  }

  // ── 4. Build signed market order ──────────────────────────────
  // createMarketOrder = build + sign locally (no network call)
  // Then post via residential proxy to bypass datacenter geoblock
  const limitPrice = Math.min(price + 0.05, 0.99);

  const signedOrder = await client.createMarketOrder(
    {
      tokenID: tokenId,
      side:    Side.BUY, // always BUY the chosen side token
      amount:  amount,
      price:   limitPrice,
    },
    { tickSize: '0.01', negRisk: isNegRisk }
  );

  if (!signedOrder) {
    throw new Error('Failed to build signed order for ' + tokenId);
  }

  // ── 5. Post via residential proxy ─────────────────────────────
  // Polymarket blocks datacenter IPs; residential proxy bypasses ASN block.
  let orderResp, usedProxy = false;
  try {
    const clobProxy = require('./clob-proxy');
    await clobProxy.ensureProxy();
    // Build L2 auth headers using CLOB client internals
    const { createL2Headers } = await import('@polymarket/clob-client');
    const l2Headers = await createL2Headers(wallet, creds.api, { method: 'POST', requestPath: '/order', body: signedOrder });
    orderResp = await clobProxy.clobRequest({
      method:  'POST',
      path:    '/order',
      headers: l2Headers,
      body:    JSON.stringify(signedOrder),
    });
    usedProxy = true;
    console.log('[trade] Proxy POST /order status:', orderResp.status);
  } catch (proxyErr) {
    console.warn('[trade] Proxy failed:', proxyErr.message, '— falling back to direct CLOB');
    // Fallback: direct (will geoblock on datacenter, but try anyway)
    try {
      orderResp = { status: 200, data: await client.postOrder(signedOrder) };
    } catch (directErr) {
      throw new Error('Both proxy and direct CLOB failed. Proxy: ' + proxyErr.message + ' | Direct: ' + directErr.message);
    }
  }

  const order = orderResp.data;
  if (orderResp.status === 403) {
    throw new Error('Geoblock 403 — proxy IP may be flagged. Retry later.');
  }
  if (orderResp.status >= 400 || (!order.success && !order.orderID && !order.orderId)) {
    throw new Error('Order rejected by CLOB (' + orderResp.status + '): ' + JSON.stringify(order).slice(0, 150));
  }

  return {
    success:  true,
    orderID:  order.orderID || order.orderId || '',
    tokenId:  tokenId,
    price:    price,
    amount:   parseFloat(order.makingAmount || amount),
    tokens:   parseFloat(order.takingAmount || 0),
    side:     sideUpper,
    market:   market,
    negRisk:  isNegRisk,
    raw:      order,
  };
}

module.exports = { executeTrade, resolveTokenId, getBestAsk, getMarketMeta };
