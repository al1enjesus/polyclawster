/**
 * edge/modules/auto-swap.js — Auto-swap POL → USDC on Polygon
 *
 * When POL arrives to a user wallet:
 *  1. Keep MIN_POL for gas (~0.5 POL)
 *  2. Swap the rest POL → USDC via KyberSwap (Uniswap V3 route)
 *  3. USDC stays in wallet ready for Polymarket deposit
 *
 * Also handles deposit to Polymarket CTF if USDC > MIN_DEPOSIT.
 *
 * Uses KyberSwap aggregator (no API key needed, best route automatically).
 */
'use strict';
const https = require('https');

const KYBER_API  = 'https://aggregator-api.kyberswap.com/polygon/api/v1';
const KYBER_ROUTER = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'; // KyberSwap router on Polygon
const USDC_n     = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e (Polymarket collateral)
const NATIVE_POL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const MIN_POL_KEEP  = 0.3;  // always keep this much POL for gas
const MIN_POL_SWAP  = 1.0;  // minimum POL to swap (below this = not worth it)
const MIN_USDC_DEPOSIT = 5; // minimum USDC to deposit into Polymarket

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

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'User-Agent': 'polyclawster/1.0', ...headers },
      timeout: 10000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload); req.end();
  });
}

/**
 * Get KyberSwap quote for POL → USDC
 * @param {number} polAmount - amount of POL to swap
 * @returns {Object|null} route summary
 */
async function getSwapQuote(polAmount) {
  const amountIn = BigInt(Math.floor(polAmount * 1e18)).toString();
  const res = await httpGet(
    `${KYBER_API}/routes?tokenIn=${NATIVE_POL}&tokenOut=${USDC_n}&amountIn=${amountIn}`
  );
  if (!res?.data?.routeSummary) return null;
  return res.data.routeSummary;
}

/**
 * Build swap transaction via KyberSwap
 */
async function buildSwapTx(routeSummary, walletAddress, slippageBps = 50) {
  const res = await httpPost(`${KYBER_API}/route/build`, {
    routeSummary,
    recipient: walletAddress,
    sender: walletAddress,
    slippageTolerance: slippageBps,
    deadline: Math.floor(Date.now() / 1000) + 300, // 5 min
  });
  return res?.data;
}

/**
 * Execute POL → USDC swap for a wallet
 * @param {string} privateKey - wallet private key
 * @returns {Object} { success, txHash, polSwapped, usdcReceived }
 */
async function swapPolToUsdc(privateKey) {
  const { ethers } = require('ethers');

  // Use local ethers v5
  const ethersLib = require('/workspace/node_modules/ethers');
  const provider = new ethersLib.providers.StaticJsonRpcProvider(
    { url: 'https://polygon-bor-rpc.publicnode.com', skipFetchSetup: true },
    { name: 'polygon', chainId: 137 }
  );
  const wallet = new ethersLib.Wallet(privateKey, provider);
  const address = wallet.address;

  // Check POL balance
  const polBalRaw = await provider.getBalance(address);
  const polBal = parseFloat(ethersLib.utils.formatEther(polBalRaw));
  console.log(`[swap] POL balance: ${polBal.toFixed(4)}`);

  const polToSwap = polBal - MIN_POL_KEEP;
  if (polToSwap < MIN_POL_SWAP) {
    console.log(`[swap] Not enough POL to swap (${polBal.toFixed(4)} - keep ${MIN_POL_KEEP} = ${polToSwap.toFixed(4)} < min ${MIN_POL_SWAP})`);
    return { success: false, reason: 'insufficient_pol', polBalance: polBal };
  }

  // Get quote
  console.log(`[swap] Getting quote for ${polToSwap.toFixed(4)} POL → USDC`);
  const quote = await getSwapQuote(polToSwap);
  if (!quote) return { success: false, reason: 'quote_failed' };

  const usdcExpected = parseInt(quote.amountOut) / 1e6;
  console.log(`[swap] Quote: ${polToSwap.toFixed(4)} POL → ${usdcExpected.toFixed(4)} USDC`);

  // Build tx
  const txData = await buildSwapTx(quote, address);
  if (!txData?.data) return { success: false, reason: 'build_failed' };

  // Send tx
  const gasLimit = txData.gas || 300000;
  // Get current gas price with buffer (Polygon needs min 25+ gwei tip)
  let maxFeePerGas, maxPriorityFeePerGas;
  try {
    const feeData = await provider.getFeeData();
    maxPriorityFeePerGas = ethersLib.utils.parseUnits('30', 'gwei');
    maxFeePerGas = feeData.maxFeePerGas?.mul ? feeData.maxFeePerGas.mul(150).div(100) : maxPriorityFeePerGas.mul(2);
  } catch { maxPriorityFeePerGas = ethersLib.utils.parseUnits('30','gwei'); maxFeePerGas = ethersLib.utils.parseUnits('100','gwei'); }

  const tx = await wallet.sendTransaction({
    to: KYBER_ROUTER,
    data: txData.data,
    value: BigInt(Math.floor(polToSwap * 1e18)).toString(),
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    type: 2,
  });

  console.log(`[swap] TX sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[swap] ✅ Confirmed in block ${receipt.blockNumber}`);

  // Check new USDC balance
  const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
  const usdcContract = new ethersLib.Contract(USDC_n, usdcAbi, provider);
  const usdcBal = await usdcContract.balanceOf(address);
  const usdcFinal = parseFloat(usdcBal.toString()) / 1e6;

  return {
    success: true,
    txHash: receipt.transactionHash,
    polSwapped: polToSwap,
    usdcReceived: usdcExpected,
    usdcBalance: usdcFinal,
  };
}

/**
 * Check all user wallets for POL and auto-swap if enough
 */
async function checkAndSwapAll() {
  require('dotenv').config({ path: '/workspace/.env' });
  const db = require('../../lib/db');
  const ethersLib = require('/workspace/node_modules/ethers');
  const provider = new ethersLib.providers.StaticJsonRpcProvider(
    { url: 'https://polygon-bor-rpc.publicnode.com', skipFetchSetup: true },
    { name: 'polygon', chainId: 137 }
  );

  const wallets = await db._req('GET', 'wallets?select=*&limit=100');
  if (!Array.isArray(wallets)) return;

  for (const w of wallets) {
    if (!w.private_key_enc) continue;
    try {
      const polRaw = await provider.getBalance(w.address);
      const pol = parseFloat(ethersLib.utils.formatEther(polRaw));
      if (pol < MIN_POL_SWAP + MIN_POL_KEEP) continue;

      console.log(`[swap] User ${w.tg_id}: ${pol.toFixed(4)} POL — swapping`);
      const result = await swapPolToUsdc(w.private_key_enc);
      if (result.success) {
        console.log(`[swap] ✅ ${w.tg_id}: ${result.polSwapped.toFixed(2)} POL → ${result.usdcReceived.toFixed(2)} USDC`);
      }
    } catch (e) {
      console.error(`[swap] Error for ${w.tg_id}:`, e.message?.slice(0, 80));
    }
  }
}

module.exports = { swapPolToUsdc, getSwapQuote, checkAndSwapAll };

if (require.main === module) {
  checkAndSwapAll().catch(e => { console.error(e.message); process.exit(1); });
}
