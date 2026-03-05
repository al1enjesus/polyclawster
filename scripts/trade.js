/**
 * lib/polymarket-trade.js — CLOB trade execution via residential proxy
 *
 * Architecture:
 *  - Each user has their own Polygon wallet (private key in Supabase wallets table)
 *  - Polymarket API keys (key/secret/passphrase) are registered per wallet address
 *  - Master creds in polymarket-creds.json are for the SYSTEM wallet only
 *  - For multi-user: each user needs their own API key derived from their wallet
 *
 * Flow:
 *  1. Build wallet from private key
 *  2. Get/derive CLOB API keys for this wallet
 *  3. Resolve market tokenId from conditionId or slug
 *  4. Build + sign order locally (no network)
 *  5. POST signed order via residential proxy (bypasses datacenter ASN block)
 *
 * Used by: api/trade.js, edge/modules/trade.js
 */
'use strict';
const fs = require('fs');

// ─── Master credentials (system wallet) ──────────────────────────────────────
let _masterCreds = null;
function getMasterCreds() {
  if (_masterCreds) return _masterCreds;
  try {
    _masterCreds = JSON.parse(fs.readFileSync('/workspace/polymarket-creds.json', 'utf8'));
  } catch {
    _masterCreds = { api: {}, wallet: {} };
  }
  return _masterCreds;
}

// ─── Per-wallet API key cache ─────────────────────────────────────────────────
const _apiKeyCache = new Map(); // address → { key, secret, passphrase }

/**
 * Get Polymarket CLOB API key for a wallet.
 * Priority:
 *  1. Cached in memory
 *  2. Master creds if address matches
 *  3. Derive new API key from wallet signature (registers with Polymarket)
 */
async function getApiCredsForWallet(wallet, ClobClient, SignatureType) {
  const addr = wallet.address.toLowerCase();

  // Check memory cache
  if (_apiKeyCache.has(addr)) return _apiKeyCache.get(addr);

  // Check if this is the master wallet
  const master = getMasterCreds();
  if (master.wallet?.address?.toLowerCase() === addr && master.api?.key) {
    const creds = { key: master.api.key, secret: master.api.secret, passphrase: master.api.passphrase };
    _apiKeyCache.set(addr, creds);
    return creds;
  }

  // Derive API key from wallet (this registers a new key with Polymarket)
  console.log('[trade] Deriving new CLOB API key for wallet:', addr.slice(0, 10) + '...');
  const tmpClient = new ClobClient('https://clob.polymarket.com', 137, wallet, {}, SignatureType.EOA);
  const derived = await tmpClient.createOrDeriveApiKey();
  const creds = {
    key:        derived.apiKey || derived.key,
    secret:     derived.secret,
    passphrase: derived.passphrase,
  };

  // Save to master creds file if this is the main wallet (for persistence across restarts)
  _apiKeyCache.set(addr, creds);
  console.log('[trade] API key derived:', creds.key?.slice(0, 8) + '...');
  return creds;
}

// ─── Market resolution ────────────────────────────────────────────────────────
async function findValidToken(client, conditionId, slug) {
  // 1. Try conditionId directly via CLOB
  if (conditionId) {
    try {
      const mkt = await client.getMarket(conditionId);
      if (mkt && mkt.accepting_orders && mkt.tokens?.length > 0) {
        return { mkt, token: mkt.tokens[0], negRisk: !!mkt.neg_risk };
      }
    } catch {}
  }

  // 2. Gamma API lookup
  if (slug || conditionId) {
    try {
      const query = slug
        ? `slug=${encodeURIComponent(slug)}`
        : `condition_id=${encodeURIComponent(conditionId)}`;
      
      const data = await new Promise((res, rej) => {
        const req = require('https').get({
          hostname: 'gamma-api.polymarket.com',
          path: `/markets?${query}&limit=1`,
          headers: { 'User-Agent': 'polyclawster/1.0' },
          timeout: 8000,
        }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch { res([]); } }); });
        req.on('error', rej);
        req.on('timeout', () => { req.destroy(); rej(new Error('timeout')); });
      });
      const arr = Array.isArray(data) ? data : [];
      for (const m of arr) {
        const tokens = JSON.parse(m.clobTokenIds || '[]');
        if (!tokens[0] || m.closed) continue;
        try {
          await client.getTickSize(tokens[0]);
          return { mkt: m, token: { token_id: tokens[0], price: 0.5 }, negRisk: !!m.neg_risk };
        } catch {}
      }
    } catch {}
  }

  return null;
}

// ─── Main execute function ────────────────────────────────────────────────────
/**
 * Execute a trade on Polymarket CLOB.
 *
 * @param {Object} opts
 * @param {string}  opts.privateKey   - Wallet private key (0x...)
 * @param {string}  opts.market       - Market title (for logging)
 * @param {string}  opts.conditionId  - Polymarket condition ID (0x...)
 * @param {string}  [opts.slug]       - Market slug (fallback lookup)
 * @param {string}  opts.side         - 'YES' or 'NO'
 * @param {number}  opts.amount       - USDC amount to spend
 * @param {Object}  [opts.apiCreds]   - Pre-loaded API creds (skip derivation)
 * @returns {Promise<Object>} trade result
 */
async function executeTrade({ privateKey, market, conditionId, slug, side, amount, apiCreds }) {
  if (!privateKey) throw new Error('Private key required');
  if (!amount || amount <= 0) throw new Error('Invalid amount: ' + amount);

  const sideUpper = (side || 'YES').toUpperCase();

  // Dynamic import (ES module)
  let ClobClient, SignatureType, Side, createL2Headers;
  try {
    const pkg = await import('@polymarket/clob-client');
    ClobClient      = pkg.ClobClient;
    SignatureType   = pkg.SignatureType;
    Side            = pkg.Side;
    createL2Headers = pkg.createL2Headers;
  } catch (e) {
    throw new Error('CLOB client not available: ' + e.message);
  }
  const { ethers } = require('ethers');

  // ── 1. Build wallet
  const wallet = new ethers.Wallet(privateKey);
  console.log(`[trade] Wallet: ${wallet.address.slice(0, 10)}... | Side: ${sideUpper} | Amount: $${amount}`);

  // ── 2. Get API creds for this wallet
  const creds = apiCreds || await getApiCredsForWallet(wallet, ClobClient, SignatureType);
  if (!creds?.key) throw new Error('Polymarket API credentials not available for wallet ' + wallet.address);

  // ── 3. Init read-only CLOB client (direct, no proxy needed for reads)
  const client = new ClobClient(
    'https://clob.polymarket.com', 137, wallet, creds, SignatureType.EOA
  );

  // ── 4. Check free balance
  let freeBalance = 0;
  try {
    const bal = await client.getBalanceAllowance({ asset_type: 'COLLATERAL' });
    freeBalance = parseFloat(bal.balance || 0) / 1e6;
    console.log(`[trade] Free USDC balance: $${freeBalance.toFixed(4)}`);
  } catch (e) {
    console.warn('[trade] Balance check failed:', e.message);
  }

  if (freeBalance < amount) {
    throw new Error(
      `Insufficient free USDC. Available: $${freeBalance.toFixed(2)}, needed: $${amount}. ` +
      `Note: funds locked in open positions are not available for new bets. ` +
      `Wallet: ${wallet.address}`
    );
  }

  // ── 5. Resolve market token
  const resolved = await findValidToken(client, conditionId, slug);
  if (!resolved) {
    throw new Error('No active CLOB market found for: ' + (market || slug || conditionId));
  }

  const { mkt, token, negRisk } = resolved;
  let finalTokenId = token.token_id;

  // For NO side — use token index 1
  if (sideUpper === 'NO' && mkt.tokens?.length >= 2) {
    finalTokenId = mkt.tokens[1].token_id;
  }

  // ── 6. Get market parameters
  const tickSize = await client.getTickSize(finalTokenId);
  const feeRate  = await client.getFeeRateBps(finalTokenId);

  // ── 7. Get best price
  let price = parseFloat(token.price || 0.5);
  try {
    const ob = await client.getOrderBook(finalTokenId);
    if (ob.asks?.[0]) price = parseFloat(ob.asks[0].price);
  } catch {}
  const limitPrice = Math.min(price + 0.05, 1 - parseFloat(tickSize || '0.01'));

  console.log(`[trade] Token: ${finalTokenId.slice(0, 20)}... | Price: ${limitPrice} | negRisk: ${negRisk}`);

  // ── 8. Build signed order
  const signedOrder = await client.createMarketOrder({
    tokenID:    finalTokenId,
    side:       Side.BUY,
    amount,
    price:      limitPrice,
    feeRateBps: feeRate,
  }, { tickSize, negRisk });

  // ── 9. POST via residential proxy
  const clobProxy = require('./clob-proxy');
  await clobProxy.ensureProxy();

  const payload = {
    deferExec: false,
    order: {
      salt:          signedOrder.salt,
      maker:         signedOrder.maker,
      signer:        signedOrder.signer,
      taker:         signedOrder.taker,
      tokenId:       signedOrder.tokenId,
      makerAmount:   signedOrder.makerAmount,
      takerAmount:   signedOrder.takerAmount,
      side:          signedOrder.side,
      expiration:    signedOrder.expiration,
      nonce:         signedOrder.nonce,
      feeRateBps:    signedOrder.feeRateBps,
      signatureType: signedOrder.signatureType,
      signature:     signedOrder.signature,
    },
    owner:     creds.key,
    orderType: 'FOK',
  };

  const bodyStr = JSON.stringify(payload);
  const l2h = await createL2Headers(wallet, creds, {
    method: 'POST', requestPath: '/order', body: bodyStr,
  });

  const resp = await clobProxy.clobRequest({
    method: 'POST', path: '/order', headers: l2h, body: bodyStr,
  });

  console.log(`[trade] CLOB response: ${resp.status}`, JSON.stringify(resp.data).slice(0, 150));

  // ── 10. Handle response
  if (resp.status === 400 && String(resp.data?.error || '').includes('not enough balance')) {
    throw new Error(`Insufficient USDC in Polymarket. Free: $${freeBalance.toFixed(2)}, needed: $${amount}`);
  }
  if (resp.status === 403) {
    throw new Error('Geoblock 403 — proxy IP flagged. Will retry automatically.');
  }
  if (resp.status >= 400 || (!resp.data?.orderID && !resp.data?.orderId && !resp.data?.success)) {
    throw new Error(`CLOB error (${resp.status}): ${JSON.stringify(resp.data).slice(0, 150)}`);
  }

  return {
    success:   true,
    orderID:   resp.data.orderID || resp.data.orderId || '',
    tokenId:   finalTokenId,
    price:     limitPrice,
    amount,
    side:      sideUpper,
    market,
    freeBalance,
    negRisk,
    raw:       resp.data,
  };
}

module.exports = { executeTrade, findValidToken, getMasterCreds, getApiCredsForWallet };

// ─── CLI Interface ────────────────────────────────────────────────────────────
if (require.main === module) {
  const path = require('path');
  const https = require('https');

  const args = process.argv.slice(2);
  function getArg(name) {
    const idx = args.indexOf('--' + name);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
  }

  const marketArg = getArg('market');
  const side = (getArg('side') || 'YES').toUpperCase();
  const amount = parseFloat(getArg('amount') || '0');

  if (!marketArg || !amount) {
    console.log('PolyClawster Trade');
    console.log('');
    console.log('Usage:');
    console.log('  node trade.js --market <slug-or-conditionId> --side YES --amount 5');
    console.log('');
    console.log('Options:');
    console.log('  --market   Market slug or conditionId (required)');
    console.log('  --side     YES or NO (default: YES)');
    console.log('  --amount   USDC amount to bet (required)');
    console.log('');
    console.log('The wallet is loaded from ~/.polyclawster/config.json');
    console.log('Run "node setup.js --auto" first to create a wallet.');
    process.exit(1);
  }

  (async () => {
    // Load wallet config
    const configPath = path.join(process.env.HOME || '/root', '.polyclawster', 'config.json');
    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      console.error('No wallet config found. Run: node setup.js --auto');
      process.exit(1);
    }

    if (!config.wallet?.privateKey) {
      console.error('No private key in config. Use manual setup: node setup.js --wallet 0x...');
      process.exit(1);
    }

    // Determine if market arg is a slug or conditionId
    const isConditionId = marketArg.startsWith('0x') && marketArg.length > 20;
    let conditionId = isConditionId ? marketArg : null;
    let slug = isConditionId ? null : marketArg;

    // If slug, look up via Gamma API to get conditionId
    if (slug) {
      console.log(`Looking up market: ${slug}...`);
      try {
        const data = await new Promise((resolve, reject) => {
          https.get({
            hostname: 'gamma-api.polymarket.com',
            path: `/markets?slug=${encodeURIComponent(slug)}&limit=1`,
            headers: { 'User-Agent': 'polyclawster/1.0' },
            timeout: 10000,
          }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
              try { resolve(JSON.parse(d)); }
              catch { resolve([]); }
            });
          }).on('error', reject);
        });
        if (Array.isArray(data) && data[0]?.conditionId) {
          conditionId = data[0].conditionId;
          console.log(`Found: ${data[0].question}`);
          console.log(`ConditionId: ${conditionId}`);
        }
      } catch (e) {
        console.warn('Gamma lookup failed:', e.message);
      }
    }

    console.log(`\nPlacing ${side} bet of $${amount} on ${marketArg}...`);

    try {
      const result = await executeTrade({
        privateKey: config.wallet.privateKey,
        market: marketArg,
        conditionId,
        slug,
        side,
        amount,
        apiCreds: config.api?.key ? config.api : undefined,
      });

      console.log('\n✅ Trade executed!');
      console.log(`   Order ID: ${result.orderID}`);
      console.log(`   Side:     ${result.side}`);
      console.log(`   Amount:   $${result.amount}`);
      console.log(`   Price:    ${result.price.toFixed(4)}`);
      console.log(`   Token:    ${result.tokenId.slice(0, 20)}...`);
    } catch (e) {
      console.error('\n❌ Trade failed:', e.message);
      process.exit(1);
    }
  })();
}
