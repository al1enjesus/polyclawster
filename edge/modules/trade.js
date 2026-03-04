/**
 * edge/modules/trade.js — Auto-execution for strong signals (score 8+)
 *
 * Logic:
 * - Only buys YES on strong signals (score >= SCORE_STRONG)
 * - Skips if already in that market
 * - Max bet: $60, min bet: $15
 * - Requires free cash >= MIN_CASH after bet
 * - Deduplicates: won't buy same market twice per session
 */

const { ClobClient, SignatureType, Side } = require('@polymarket/clob-client');
const { ethers } = require('ethers');
const { get } = require('./http');
const { sendTg } = require('./notify');
const { load, save } = require('./state');
const cfg = require('../config');
const fs = require('fs');

const PK     = 'REMOVED_KEY';
const CREDS  = JSON.parse(fs.readFileSync('/workspace/polymarket-creds.json'));

const MAX_BET    = 60;
const MIN_BET    = 15;
const MIN_CASH   = 25;
const MAX_SPEND  = 120; // max total spend per heartbeat run

async function getClient() {
  const wallet = new ethers.Wallet(PK);
  return new ClobClient(
    'https://clob.polymarket.com',
    137,
    wallet,
    CREDS.api,
    SignatureType.EOA
  );
}

async function getFreeCash(client) {
  try {
    const bal = await client.getBalanceAllowance({ asset_type: 'COLLATERAL' });
    return parseFloat(bal.balance || 0) / 1e6;
  } catch {
    return 0;
  }
}

async function getOpenMarkets() {
  try {
    const positions = JSON.parse(await get(
      `https://data-api.polymarket.com/positions?user=${cfg.MY_WALLET}&limit=100&sizeThreshold=0.01`
    ));
    return new Set(positions.map(p => p.title?.toLowerCase().slice(0, 30)));
  } catch {
    return new Set();
  }
}

/**
 * Find tokenId for a signal — try market slug or search by question text
 */
async function resolveTokenId(signal) {
  if (signal.tokenId) return signal.tokenId;

  // Try to find via gamma API
  try {
    const query = encodeURIComponent(signal.market || signal.title || '');
    const markets = JSON.parse(await get(
      `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20&search=${query}`
    ));
    if (Array.isArray(markets) && markets.length > 0) {
      const m = markets[0];
      const tokens = JSON.parse(m.clobTokenIds || '[]');
      // Return YES token (index 0)
      return tokens[0] || null;
    }
  } catch {}
  return null;
}

/**
 * Execute trades for strong signals
 * @param {Array} signals - signals with score >= SCORE_STRONG
 * @returns {Array} executed trades
 */
async function executeTrades(signals) {
  if (!signals || signals.length === 0) return [];

  const execState = load('/tmp/edge_executed.json', { executed: [] });
  const executed = new Set(execState.executed || []);
  const results = [];
  let totalSpent = 0;

  let client;
  try {
    client = await getClient();
  } catch (e) {
    console.error('[trade] Failed to init client:', e.message);
    return [];
  }

  const freeCash = await getFreeCash(client);
  const openMarkets = await getOpenMarkets();

  console.log(`[trade] Free cash: $${freeCash.toFixed(2)} | Strong signals: ${signals.length}`);

  for (const sig of signals) {
    // Skip if already executed this signal recently
    const sigKey = (sig.market || sig.title || '').slice(0, 40);
    if (executed.has(sigKey)) {
      console.log(`[trade] Skip (already executed): ${sigKey.slice(0, 40)}`);
      continue;
    }

    // Skip if we already have a position in this market
    const marketKey = (sig.market || sig.title || '').toLowerCase().slice(0, 30);
    if ([...openMarkets].some(k => k.includes(marketKey.slice(0, 15)))) {
      console.log(`[trade] Skip (already in market): ${marketKey.slice(0, 30)}`);
      continue;
    }

    // Budget check
    if (totalSpent >= MAX_SPEND) {
      console.log('[trade] Max spend per run reached');
      break;
    }
    if (freeCash - totalSpent < MIN_CASH + MIN_BET) {
      console.log('[trade] Not enough free cash');
      break;
    }

    // Resolve tokenId
    const tokenId = await resolveTokenId(sig);
    if (!tokenId) {
      console.log(`[trade] No tokenId for: ${sigKey.slice(0, 40)}`);
      continue;
    }

    // Determine bet size
    const available = freeCash - totalSpent - MIN_CASH;
    const betSize = Math.min(MAX_BET, Math.max(MIN_BET, Math.round(available * 0.3)));
    if (betSize < MIN_BET) continue;

    // Get current price
    let price = sig.price ? parseFloat(sig.price) : null;
    if (!price) {
      try {
        const ob = await client.getOrderBook(tokenId);
        const bestAsk = ob.asks && ob.asks[0] ? parseFloat(ob.asks[0].price) : null;
        price = bestAsk || 0.5;
      } catch { price = 0.5; }
    }

    // Skip if price is too high (>90¢) — not enough upside
    if (price > 0.90) {
      console.log(`[trade] Skip (price too high ${(price*100).toFixed(0)}¢): ${sigKey.slice(0, 40)}`);
      continue;
    }

    console.log(`[trade] BUYING ${sigKey.slice(0, 40)} | $${betSize} @ ${(price*100).toFixed(0)}¢`);

    try {
      const order = await client.createAndPostMarketOrder(
        { tokenID: tokenId, side: Side.BUY, amount: betSize, price: Math.min(price + 0.05, 0.97) },
        { tickSize: '0.01', negRisk: false }
      );

      if (order.success || order.orderID) {
        const spent = parseFloat(order.makingAmount || betSize);
        const tokens = parseFloat(order.takingAmount || 0);
        totalSpent += spent;
        executed.add(sigKey);

        const result = {
          market: sigKey,
          side: 'YES',
          spent: spent.toFixed(2),
          tokens: tokens.toFixed(1),
          price: (price * 100).toFixed(0) + '¢',
          score: sig.score,
          type: sig.type,
        };
        results.push(result);

        await sendTg(
          `✅ *АВТО-СТАВКА*\n` +
          `📌 ${(sig.market || sig.title || '').slice(0, 60)}\n` +
          `💰 YES @ ${(price * 100).toFixed(0)}¢ — потрачено *$${spent.toFixed(2)}*\n` +
          `🎯 Триггер: ${sig.type} | Score: ${sig.score.toFixed(1)}/10`
        );

        console.log(`[trade] ✅ Done: $${spent.toFixed(2)} spent`);
      } else {
        console.log(`[trade] ❌ Order failed:`, JSON.stringify(order).slice(0, 100));
      }
    } catch (e) {
      console.log(`[trade] ❌ Error: ${e.message?.slice(0, 80)}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  // Save executed set (keep last 50)
  const allExecuted = [...executed].slice(-50);
  save('/tmp/edge_executed.json', { executed: allExecuted, ts: Date.now() });

  return results;
}

module.exports = { executeTrades };
