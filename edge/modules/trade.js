/**
 * edge/modules/trade.js — Auto-execution for strong signals (score 8+)
 *
 * Architecture:
 *  - Uses system wallet (polymarket-creds.json) for auto-trading
 *  - Only trades when free USDC is available (not locked in positions)
 *  - Max bet: $60, min bet: $15
 *  - Requires MIN_CASH free USDC remaining after bet
 *  - Deduplicates: won't buy same market twice per session
 *
 * Wallet note:
 *  - System wallet = 0x3eAe9f8a... (polymarket-creds.json)
 *  - Funds must be FREE USDC (CLOB collateral), not in open positions
 *  - If balance 0: sell positions on Polymarket to free USDC
 */
'use strict';
const fs   = require('fs');
const { sendTg } = require('./notify');
const { load, save } = require('./state');
const cfg  = require('../config');

const CREDS_FILE = '/workspace/polymarket-creds.json';
const CREDS  = JSON.parse(fs.readFileSync(CREDS_FILE));
const PK     = CREDS.wallet?.privateKey || CREDS.private_key ||
               '0x18bf911507bda6372ff5aafa60439d2e27b7308267293f03eca629f9ff1f2289';

const MAX_BET    = 60;
const MIN_BET    = 15;
const MIN_CASH   = 25;  // keep at least this much free
const MAX_SPEND  = 120; // max per heartbeat run

async function getClient() {
  const { ClobClient, SignatureType } = await import('@polymarket/clob-client');
  const { ethers } = require('ethers');
  const wallet = new ethers.Wallet(PK);
  return new ClobClient('https://clob.polymarket.com', 137, wallet, CREDS.api, SignatureType.EOA);
}

/**
 * Get free USDC collateral from CLOB.
 * IMPORTANT: This is NOT the same as wallet balance.
 * Funds in open positions are NOT included here.
 */
async function getFreeCash(client) {
  try {
    const bal = await client.getBalanceAllowance({ asset_type: 'COLLATERAL' });
    const free = parseFloat(bal.balance || 0) / 1e6;
    return free;
  } catch (e) {
    console.error('[trade] Balance check failed:', e.message);
    return 0;
  }
}

async function getOpenMarketTitles() {
  try {
    const https = require('https');
    const addr = cfg.MY_WALLET;
    const positions = await new Promise((res, rej) => {
      https.get(
        `https://data-api.polymarket.com/positions?user=${addr}&limit=100&sizeThreshold=0.01`,
        { headers: { 'User-Agent': 'polyclawster/1.0' } },
        r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch { res([]); } }); }
      ).on('error', rej);
    });
    return new Set((Array.isArray(positions) ? positions : []).map(p => (p.title || '').toLowerCase().slice(0, 30)));
  } catch {
    return new Set();
  }
}

async function resolveTokenId(client, signal) {
  if (signal.tokenId) return signal.tokenId;

  if (signal.conditionId) {
    try {
      const mkt = await client.getMarket(signal.conditionId);
      if (mkt?.tokens?.[0]) return mkt.tokens[0].token_id;
    } catch {}
  }

  try {
    const https = require('https');
    const query = encodeURIComponent(signal.market || signal.title || '');
    const markets = await new Promise((res, rej) => {
      https.get(
        `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20&search=${query}`,
        { headers: { 'User-Agent': 'polyclawster/1.0' } },
        r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch { res([]); } }); }
      ).on('error', rej);
    });
    if (Array.isArray(markets) && markets.length > 0) {
      const tokens = JSON.parse(markets[0].clobTokenIds || '[]');
      return tokens[0] || null;
    }
  } catch {}
  return null;
}

/**
 * Execute trades for strong signals.
 * @param {Array} signals — signals with score >= SCORE_STRONG
 * @returns {Array} executed trades
 */
async function executeTrades(signals) {
  if (!signals?.length) return [];

  const execState = load('/tmp/edge_executed.json', { executed: [] });
  const executed  = new Set(execState.executed || []);
  const results   = [];
  let totalSpent  = 0;

  let client;
  try {
    client = await getClient();
  } catch (e) {
    console.error('[trade] Client init failed:', e.message);
    return [];
  }

  const freeCash     = await getFreeCash(client);
  const openMarkets  = await getOpenMarketTitles();

  console.log(`[trade] Free USDC: $${freeCash.toFixed(2)} | Signals: ${signals.length}`);

  if (freeCash < MIN_BET + MIN_CASH) {
    console.log(`[trade] Insufficient free USDC ($${freeCash.toFixed(2)}). Positions may have all funds locked.`);
    return [];
  }

  for (const sig of signals) {
    const sigKey = (sig.market || sig.title || '').slice(0, 40);

    if (executed.has(sigKey)) {
      console.log(`[trade] Skip (already executed): ${sigKey}`);
      continue;
    }

    const marketKey = sigKey.toLowerCase();
    if ([...openMarkets].some(k => k.includes(marketKey.slice(0, 15)))) {
      console.log(`[trade] Skip (already in market): ${marketKey}`);
      continue;
    }

    if (totalSpent >= MAX_SPEND) { console.log('[trade] Max spend reached'); break; }

    const availableNow = freeCash - totalSpent - MIN_CASH;
    if (availableNow < MIN_BET) { console.log('[trade] Not enough free cash'); break; }

    const tokenId = await resolveTokenId(client, sig);
    if (!tokenId) { console.log(`[trade] No tokenId: ${sigKey}`); continue; }

    let price = sig.price ? parseFloat(sig.price) : null;
    if (!price) {
      try {
        const ob = await client.getOrderBook(tokenId);
        price = ob.asks?.[0] ? parseFloat(ob.asks[0].price) : 0.5;
      } catch { price = 0.5; }
    }

    if (price > 0.90) {
      console.log(`[trade] Skip (price ${(price*100).toFixed(0)}¢ too high): ${sigKey}`);
      continue;
    }

    const betSize = Math.min(MAX_BET, Math.max(MIN_BET, Math.round(availableNow * 0.3)));
    if (betSize < MIN_BET) continue;

    console.log(`[trade] BUYING ${sigKey} | $${betSize} @ ${(price*100).toFixed(0)}¢`);

    try {
      const { Side } = await import('@polymarket/clob-client');
      const order = await client.createAndPostMarketOrder(
        { tokenID: tokenId, side: Side.BUY, amount: betSize, price: Math.min(price + 0.05, 0.97) },
        { tickSize: '0.01', negRisk: false }
      );

      if (order.success || order.orderID) {
        const spent  = parseFloat(order.makingAmount || betSize);
        const tokens = parseFloat(order.takingAmount || 0);
        totalSpent += spent;
        executed.add(sigKey);

        results.push({ market: sigKey, side: 'YES', spent: spent.toFixed(2), tokens: tokens.toFixed(1), price: (price*100).toFixed(0) + '¢', score: sig.score, type: sig.type });

        await sendTg(
          `✅ *АВТО-СТАВКА*\n📌 ${(sig.market || sig.title || '').slice(0,60)}\n` +
          `💰 YES @ ${(price*100).toFixed(0)}¢ — *$${spent.toFixed(2)}*\n` +
          `🎯 ${sig.type} | Score: ${sig.score?.toFixed(1)}/10`
        );
        console.log(`[trade] ✅ Spent: $${spent.toFixed(2)}`);
      } else {
        console.log(`[trade] ❌ Order failed:`, JSON.stringify(order).slice(0, 100));
      }
    } catch (e) {
      console.log(`[trade] ❌ Error: ${e.message?.slice(0, 80)}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  save('/tmp/edge_executed.json', { executed: [...executed].slice(-50), ts: Date.now() });
  return results;
}

module.exports = { executeTrades };
