#!/usr/bin/env node
/**
 * PolyClawster Trade — Non-Custodial Polymarket Trading
 *
 * Demo mode:  calls polyclawster.com API — fast, no gas, $10 demo balance
 * Live mode:  signs orders locally → submits via geo-bypass relay → Polymarket CLOB
 *
 * Usage:
 *   node trade.js --market "bitcoin-100k" --side YES --amount 2 --demo
 *   node trade.js --market "trump-win"    --side NO  --amount 5
 *   node trade.js --condition 0xABC123    --side YES --amount 3
 *
 * How live trading works:
 *   1. Resolve market → get conditionId + tokenYes/tokenNo
 *   2. Load local wallet (EIP-712 signing, wallet stays on this machine)
 *   3. Sign order locally (EIP-712 + HMAC)
 *   4. Submit via polyclawster.com relay (Tokyo, geo-bypass)
 *   5. Relay records trade in Supabase (identified by wallet address)
 */
'use strict';
const https = require('https');
const { loadConfig } = require('./setup');
const { ensureApprovals } = require('./approve');

const API_BASE = 'https://polyclawster.com';

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function postJSON(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    const u       = new URL(url);
    const payload = JSON.stringify(body);
    const req     = https.request({
      hostname: u.hostname,
      path:     u.pathname + (u.search || ''),
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent':     'polyclawster-skill/2.0',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      timeout: 25000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Bad JSON: ' + d.slice(0, 100))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(payload);
    req.end();
  });
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      headers:  { 'User-Agent': 'polyclawster-skill/2.0' },
      timeout:  12000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

// ── Resolve market data ──────────────────────────────────────────────────────
// Returns { conditionId, question, tokenYes, tokenNo }
async function resolveMarket(slug) {
  // polyclawster.com/api/market-lookup wraps Gamma API (handles CORS + caching)
  const url = `${API_BASE}/api/market-lookup?slug=${encodeURIComponent(slug)}`;
  const data = await getJSON(url);
  const mkt = data?.market;
  if (!mkt?.conditionId) throw new Error(`Market not found: "${slug}"`);

  // clobTokenIds is a JSON string: '["tokenYes","tokenNo"]'
  let tokenIds = [];
  try { tokenIds = JSON.parse(mkt.clobTokenIds || '[]'); } catch {}

  return {
    conditionId: mkt.conditionId,
    question:    mkt.question,
    tokenYes:    tokenIds[0] || null,
    tokenNo:     tokenIds[1] || null,
  };
}

// ── Demo trade (no CLOB, no gas) ─────────────────────────────────────────────
async function demoTrade({ market, side, amount, config }) {
  const result = await postJSON(`${API_BASE}/api/agents`, {
    action:  'trade',
    market:  market || '',
    slug:    market || '',
    side:    side.toUpperCase(),
    amount,
    isDemo:  true,
  }, config.apiKey);

  return result;
}

// ── Live trade (local signing → relay → Polymarket CLOB) ─────────────────────
async function liveTrade({ market, conditionId, tokenIdYes, tokenIdNo, side, amount, config }) {
  if (!config.agentKey && !config.privateKey) {
    throw new Error('Wallet not configured. Run: node scripts/setup.js --auto');
  }
  if (!config.clobApiKey || !config.clobApiSecret) {
    throw new Error('No CLOB credentials. Run: node scripts/setup.js --derive-clob');
  }

  const { ethers } = await import('ethers');

  const POLYGON_RPC  = 'https://polygon-bor-rpc.publicnode.com';
  const USDC_E_ADDR  = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const USDC_N_ADDR  = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
  const WMATIC_ADDR  = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  const SWAP_ROUTER  = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';

  const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
  ];

  const provider     = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
  const signerWallet = new ethers.Wallet(config.agentKey || config.privateKey, provider);
  const usdce        = new ethers.Contract(USDC_E_ADDR, ERC20_ABI, signerWallet);
  const amountNeeded = ethers.utils.parseUnits(amount.toString(), 6);

  // ── Swap to USDC.e if balance is low ──────────────────────────────
  let usdceBal = await usdce.balanceOf(signerWallet.address);

  if (usdceBal.lt(amountNeeded)) {
    const gasPrice = await provider.getGasPrice();
    const txOpts   = { gasLimit: 300000, gasPrice: gasPrice.mul(2), type: 0 };

    // Try native USDC → USDC.e first
    const usdcNative = new ethers.Contract(USDC_N_ADDR, ERC20_ABI, signerWallet);
    const nativeBal  = await usdcNative.balanceOf(signerWallet.address);
    if (nativeBal.gt(0)) {
      console.log('   Swapping USDC → USDC.e...');
      const routerAbi = ['function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) external payable returns (uint256)'];
      const router = new ethers.Contract(SWAP_ROUTER, routerAbi, signerWallet);
      const swapCap = ethers.utils.parseUnits('1000000000', 6);
      const allowed = await usdcNative.allowance(signerWallet.address, SWAP_ROUTER);
      if (allowed.lt(nativeBal)) {
        await (await usdcNative.approve(SWAP_ROUTER, swapCap, txOpts)).wait();
      }
      await (await router.exactInputSingle({
        tokenIn: USDC_N_ADDR, tokenOut: USDC_E_ADDR, fee: 100,
        recipient: signerWallet.address, amountIn: nativeBal,
        amountOutMinimum: nativeBal.mul(99).div(100), sqrtPriceLimitX96: 0,
      }, txOpts)).wait();
      usdceBal = await usdce.balanceOf(signerWallet.address);
      console.log('   USDC.e: $' + ethers.utils.formatUnits(usdceBal, 6));
    }

    // Try POL → USDC.e if still short
    if (usdceBal.lt(amountNeeded)) {
      const polBal     = await provider.getBalance(signerWallet.address);
      const keepForGas = ethers.utils.parseEther('1');
      if (polBal.gt(keepForGas.add(ethers.utils.parseEther('0.5')))) {
        const swapAmt = polBal.sub(keepForGas);
        console.log('   Swapping ' + parseFloat(ethers.utils.formatEther(swapAmt)).toFixed(2) + ' POL → USDC.e...');
        const multicallAbi = ['function multicall(uint256,bytes[]) external payable returns (bytes[])'];
        const iface = new ethers.utils.Interface([
          'function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) returns (uint256)',
          'function wrapETH(uint256)',
        ]);
        const router2 = new ethers.Contract(SWAP_ROUTER, multicallAbi, signerWallet);
        await (await router2.multicall(
          Math.floor(Date.now() / 1000) + 300,
          [
            iface.encodeFunctionData('wrapETH', [swapAmt]),
            iface.encodeFunctionData('exactInputSingle', [{
              tokenIn: WMATIC_ADDR, tokenOut: USDC_E_ADDR, fee: 500,
              recipient: signerWallet.address, amountIn: swapAmt,
              amountOutMinimum: 0, sqrtPriceLimitX96: 0,
            }]),
          ],
          { ...{ gasLimit: 300000, gasPrice: (await provider.getGasPrice()).mul(2), type: 0 }, value: swapAmt }
        )).wait();
        usdceBal = await usdce.balanceOf(signerWallet.address);
        console.log('   USDC.e: $' + ethers.utils.formatUnits(usdceBal, 6));
      }
    }

    if (usdceBal.lt(amountNeeded)) {
      throw new Error('Insufficient USDC.e ($' + ethers.utils.formatUnits(usdceBal, 6) + '). Send POL to ' + signerWallet.address);
    }
  }

  // ── Ensure Polymarket exchange authorizations (delegated to approve.js) ──
  await ensureApprovals(signerWallet, provider, ethers);

  const { ClobClient, SignatureType, OrderType, Side } = await import('@polymarket/clob-client');

  // Reconstruct local wallet for order signing (never transmitted)
  const wallet = new ethers.Wallet(config.agentKey || config.privateKey);

  // CLOB credentials (used for L2 HMAC signing — computed locally by ClobClient)
  const creds = {
    key:        config.clobApiKey,
    secret:     config.clobApiSecret,
    passphrase: config.clobApiPassphrase,
  };

  // ClobClient pointed at relay for geo-bypass
  // - API calls: agent → relay (Tokyo) → clob.polymarket.com
  // - EIP-712 signing: done locally by wallet private key
  // - HMAC signing: done locally by creds.secret
  // - Private key: NEVER sent to relay or anywhere else
  const client = new ClobClient(config.clobRelayUrl, 137, wallet, creds, SignatureType.EOA, wallet.address);
  // Refresh CLOB balance cache
  try { await client.updateBalanceAllowance({ asset_type: "COLLATERAL" }); } catch {}

  // Resolve tokenId for the side we want to trade
  // Priority: 1) direct tokenId from signal, 2) CLOB lookup by conditionId, 3) Gamma lookup by slug
  const sideUpper = side.toUpperCase();
  let tokenId;

  if (tokenIdYes || tokenIdNo) {
    // Fast path: signal already includes token IDs — no extra API call needed
    tokenId = sideUpper === 'NO' ? tokenIdNo : tokenIdYes;
    if (!tokenId) throw new Error(`Signal missing tokenId${sideUpper === 'NO' ? 'No' : 'Yes'}`);
    console.log('   Token ID from signal (no lookup needed)');
  } else if (conditionId) {
    // Fetch market from CLOB via relay
    console.log('   Resolving market from CLOB...');
    const mkt = await client.getMarket(conditionId).catch(() => null);
    if (!mkt?.tokens) throw new Error('Market not found on CLOB: ' + conditionId);
    const yesToken = mkt.tokens.find(t => t.outcome === 'Yes');
    const noToken  = mkt.tokens.find(t => t.outcome === 'No');
    tokenId = sideUpper === 'NO' ? noToken?.token_id : yesToken?.token_id;
    if (!tokenId) throw new Error('Could not resolve tokenId from CLOB market');
  } else {
    // Resolve via polyclawster.com → Gamma API
    console.log('   Resolving market from Gamma...');
    const mkt = await resolveMarket(market);
    tokenId = sideUpper === 'NO' ? mkt.tokenNo : mkt.tokenYes;
    if (!tokenId) throw new Error(`No tokenId for ${sideUpper} on "${market}"`);
    console.log(`   Market: ${mkt.question}`);
  }

  console.log(`   Token ID: ${tokenId.slice(0, 20)}...`);

  // Polymarket CLOB order mechanics:
  //   - To bet YES: BUY the YES token (tokenYes, Side.BUY)
  //   - To bet NO:  BUY the NO token  (tokenNo,  Side.BUY)
  // Both sides are BUY orders — you're buying outcome tokens.
  // SELL is only for closing/exiting an existing position.
  console.log('   Signing order locally (private key stays on your machine)...');
  const order = await client.createMarketOrder({
    tokenID: tokenId,
    side:    Side.BUY,   // Always BUY — we select which token (YES/NO) via tokenId
    amount,
  });

  // Submit signed order via relay
  // FOK = Fill-or-Kill: either fully fills or cancels (no partial fills)
  console.log('   Submitting via relay (Tokyo, geo-bypass)...');
  const response = await client.postOrder(order, OrderType.FOK);

  const orderID = response?.orderID || response?.orderId || '';
  if (!orderID && (response?.error || response?.errorMsg)) {
    throw new Error('CLOB rejected order: ' + (response.error || response.errorMsg || JSON.stringify(response)));
  }

  return {
    ok:      !!orderID,
    orderID,
    status:  response?.status || 'submitted',
    error:   response?.error  || null,
  };
}

// ── Main entry point (used by auto.js and CLI) ──────────────────────────────
async function executeTrade({ market, conditionId, tokenIdYes, tokenIdNo, side, amount, isDemo }) {
  const config = loadConfig();
  if (!config?.agentId) throw new Error('Not configured. Run: node scripts/setup.js --auto');

  const sideUpper = (side || 'YES').toUpperCase();
  const amt       = parseFloat(amount);
  if (!amt || amt < 0.5) throw new Error('Invalid amount (min $0.5)');
  if (!market && !conditionId) throw new Error('--market or --condition required');

  console.log(`📤 ${isDemo ? 'DEMO' : 'LIVE'} trade: ${sideUpper} $${amt} on "${market || conditionId}"`);

  if (isDemo) {
    const r = await demoTrade({ market, side: sideUpper, amount: amt, config });
    if (!r.ok) throw new Error(r.error || 'Demo trade failed');
    console.log('');
    console.log('✅ Demo trade placed!');
    console.log(`   Market:  ${r.market || market}`);
    console.log(`   Side:    ${r.side || sideUpper}`);
    console.log(`   Amount:  $${r.amount || amt}`);
    console.log(`   Price:   ${r.price || '?'}`);
    console.log(`   Bet ID:  ${r.betId}`);
    return r;
  }

  // Live trade
  const r = await liveTrade({ market, conditionId, tokenIdYes, tokenIdNo, side: sideUpper, amount: amt, config });
  if (!r.ok) throw new Error(r.error || 'Live trade failed');

  console.log('');
  console.log('✅ Live trade placed!');
  console.log(`   Order ID: ${r.orderID}`);
  console.log(`   Status:   ${r.status}`);
  console.log('   (Trade auto-recorded on polyclawster.com via relay)');
  return r;
}

module.exports = { executeTrade, resolveMarket };

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args   = process.argv.slice(2);
  const getArg = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

  const market      = getArg('--market') || getArg('--slug');
  const conditionId = getArg('--condition') || getArg('--cid');
  const side        = getArg('--side') || 'YES';
  const amount      = getArg('--amount') || getArg('--amt');
  const isDemo      = args.includes('--demo');

  if ((!market && !conditionId) || !amount) {
    console.log('Usage:');
    console.log('  node trade.js --market "bitcoin-100k" --side YES --amount 5 --demo');
    console.log('  node trade.js --market "trump-win"    --side NO  --amount 10');
    console.log('  node trade.js --condition 0xABC...    --side YES --amount 3');
    console.log('');
    console.log('Live: signs locally, submits via geo-bypass relay. Private key stays on your machine.');
    console.log('Demo: $10 free balance, no real funds needed.');
    process.exit(0);
  }

  executeTrade({ market, conditionId, side, amount: parseFloat(amount), isDemo })
    .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
}
