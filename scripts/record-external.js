#!/usr/bin/env node
/**
 * record-external.js — Report an on-chain trade to PolyClawster leaderboard
 *
 * For agents who trade directly on Polymarket (without relay) but want
 * their history to appear on polyclawster.com with full copy-trade support.
 *
 * Requires: EXTERNAL_AGENT_PROTOCOL.md feature to be enabled server-side.
 *
 * Usage:
 *   node scripts/record-external.js \
 *     --tx 0xabc123...           \   # Polygon transaction hash
 *     --market "Trump ends ops?" \   # Market question
 *     --side NO                  \   # YES or NO
 *     --amount 5                 \   # USDC spent
 *     --price 0.935              \   # Entry price
 *     --basket B1                \   # B1/B2/B3 (optional)
 *     --confidence 82            \   # 0-100 signal score (optional)
 *     --reason "High NO, 19d"    \   # Entry reason (optional)
 *     --news-source "BBC World"  \   # News trigger source (optional)
 *
 * Or auto-sync all recent trades from data-api.polymarket.com:
 *   node scripts/record-external.js --sync
 */
'use strict';

const https = require('https');
const path  = require('path');
const fs    = require('fs');
const { ethers } = require('ethers');

const API_BASE = 'https://polyclawster.com';
const DATA_API = 'https://data-api.polymarket.com';

function loadConfig() {
  const p = path.join(process.env.HOME || '/root', '.polyclawster', 'config.json');
  if (!fs.existsSync(p)) throw new Error('Not configured. Run: node scripts/setup.js --auto');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'polyclawster-external/1.0' }, timeout: 12000 }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', reject).on('timeout', function () { this.destroy(); reject(new Error('timeout')); });
  });
}

function postJSON(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'polyclawster-external/1.0',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      timeout: 15000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Invalid JSON')); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

function getArg(args, name) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : null;
}

async function recordSingleTrade(config, wallet, opts) {
  const { txHash, market, side, amount, price, basket, confidence, reason, newsSource, conditionId } = opts;

  if (!txHash) throw new Error('--tx required');
  if (!market)  throw new Error('--market required');
  if (!side)    throw new Error('--side required (YES or NO)');

  // Sign ownership proof
  const ownershipSig = await wallet.signMessage('polyclawster-register');

  console.log(`📡 Reporting trade to PolyClawster...`);
  console.log(`   ${side} @ ${price || '?'} — ${market.slice(0, 50)}`);
  console.log(`   TX: ${txHash.slice(0, 20)}...`);

  const result = await postJSON(`${API_BASE}/api/agents`, {
    action: 'record_external',
    apiKey: config.apiKey,
    txHash,
    walletAddress: wallet.address,
    ownershipSig,
    market,
    conditionId: conditionId || '',
    side: side.toUpperCase(),
    amount: parseFloat(amount || 0),
    price: parseFloat(price || 0),
    isOpen: true,
    basket: basket || '',
    confidence: confidence ? parseInt(confidence) : null,
    entry_reason: reason || '',
    news_source: newsSource || null,
  }, config.apiKey);

  if (result?.ok) {
    console.log(`✅ Recorded! Bet #${result.betId} — verified: ${result.verified}`);
  } else {
    // Graceful degradation: feature not yet server-side
    if (result?.error?.includes('unknown action')) {
      console.log(`ℹ️  Server doesn't support record_external yet.`);
      console.log(`   See EXTERNAL_AGENT_PROTOCOL.md for the proposed backend changes.`);
      console.log(`   Falling back to demo trade recording...`);
      // Fallback: record as demo with same metadata
      const fallback = await postJSON(`${API_BASE}/api/agents`, {
        action: 'trade', apiKey: config.apiKey,
        market, side: side.toUpperCase(),
        amount: 0.5, price: parseFloat(price || 0), isDemo: true,
        basket: basket || '', reason: reason || '',
      }, config.apiKey);
      if (fallback?.ok) {
        console.log(`   ↳ Fallback demo bet #${fallback.betId} recorded.`);
      } else {
        console.log(`   ↳ Fallback failed: ${fallback?.error}`);
      }
    } else {
      console.error(`❌ Error: ${result?.error}`);
    }
  }

  return result;
}

async function syncAllTrades(config, wallet) {
  console.log(`🔄 Syncing all trades from data-api.polymarket.com...`);
  console.log(`   Wallet: ${wallet.address}`);
  console.log('');

  // Get activity from Polymarket
  const allActivity = [];
  for (let offset = 0; offset < 300; offset += 50) {
    const d = await httpsGet(`${DATA_API}/activity?user=${wallet.address}&limit=50&offset=${offset}`);
    if (!d || !d.length) break;
    allActivity.push(...d.filter(a => a.type === 'TRADE'));
    if (d.length < 50) break;
  }

  console.log(`📊 Found ${allActivity.length} trades on-chain`);

  // Get market names from positions
  const positions = await httpsGet(`${DATA_API}/positions?user=${wallet.address}&limit=50`) || [];
  console.log(`📈 Open positions: ${positions.length}`);
  console.log('');

  // Record each unique trade
  const seen = new Set();
  let recorded = 0;
  let failed = 0;

  for (const trade of allActivity.slice(0, 50)) {  // limit to recent 50
    const txHash = trade.transactionHash;
    if (seen.has(txHash)) continue;
    seen.add(txHash);

    const ownershipSig = await wallet.signMessage('polyclawster-register');
    const side = parseFloat(trade.size) > 0 ? 'YES' : 'NO';

    const result = await postJSON(`${API_BASE}/api/agents`, {
      action: 'record_external',
      apiKey: config.apiKey,
      txHash,
      walletAddress: wallet.address,
      ownershipSig,
      conditionId: trade.conditionId || '',
      side,
      amount: Math.abs(parseFloat(trade.usdcSize || 0)),
      price: parseFloat(trade.price || 0),
      isOpen: true,
      placedAt: new Date((trade.timestamp || 0) * 1000).toISOString(),
    }, config.apiKey);

    if (result?.ok || result?.error?.includes('duplicate')) {
      recorded++;
      process.stdout.write('.');
    } else {
      failed++;
      if (result?.error?.includes('unknown action')) {
        console.log('\n⚠️  Server does not support record_external yet.');
        console.log('   See EXTERNAL_AGENT_PROTOCOL.md for the feature proposal.');
        break;
      }
    }
  }

  console.log(`\n\n✅ Sync complete: ${recorded} recorded, ${failed} failed`);
}

async function main() {
  const args = process.argv.slice(2);

  const config = loadConfig();
  if (!config?.privateKey) throw new Error('Private key not in config. Run setup with --key');

  const wallet = new ethers.Wallet(config.privateKey);
  console.log(`🔑 Wallet: ${wallet.address}`);

  if (args.includes('--sync')) {
    return syncAllTrades(config, wallet);
  }

  return recordSingleTrade(config, wallet, {
    txHash:      getArg(args, 'tx'),
    market:      getArg(args, 'market'),
    conditionId: getArg(args, 'condition-id'),
    side:        getArg(args, 'side'),
    amount:      getArg(args, 'amount'),
    price:       getArg(args, 'price'),
    basket:      getArg(args, 'basket'),
    confidence:  getArg(args, 'confidence'),
    reason:      getArg(args, 'reason'),
    newsSource:  getArg(args, 'news-source'),
  });
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
