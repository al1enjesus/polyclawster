/**
 * deposit-watcher.js — мониторинг депозитов + авто-своп POL→USDC
 *
 * Каждые 60 сек:
 *  1. Проверяет входящий USDC на все кошельки → уведомляет юзера
 *  2. Проверяет входящий POL → автоматически свапает в USDC → уведомляет юзера
 *
 * Полный flow "кинь POL — бот всё сделает":
 *  POL пришёл → swap → USDC на кошельке → готов к ставкам
 */
'use strict';
require('dotenv').config();
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const db     = require('./lib/db');

// ── Config ────────────────────────────────────────────────────────────────────
const USDC_CONTRACTS = [
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e (bridged)
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC native (Circle)
];
const BOT_TOKEN      = process.env.BOT_TOKEN || '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';
const ETHERSCAN_KEY  = '1PJVGS8SU3PESFS6KIZQHQBJEA1EUHIVT8';
const CHECK_INTERVAL = 60 * 1000; // 60 sec

const MIN_POL_KEEP   = 1.5;   // оставляем на газ (1.0 целевой + ~0.5 на газ самого свапа)
const MIN_POL_SWAP   = 5.0;   // минимум для свапа (~$1.25+, чтобы газ окупался)
const KYBER_API      = 'https://aggregator-api.kyberswap.com/polygon/api/v1';
const KYBER_ROUTER   = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5';
const NATIVE_POL     = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const USDC_NATIVE    = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e (Polymarket)

// ── Helpers ───────────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'polyclawster/1.0' } }, res => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'User-Agent': 'polyclawster/1.0' },
      timeout: 10000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', reject).on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload); req.end();
  });
}

async function tgSend(chatId, text, extra = {}) {
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra });
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { res.resume(); res.on('end', resolve); });
    req.on('error', resolve);
    req.write(body); req.end();
  });
}

function rpc(method, params) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  return new Promise((res, rej) => {
    const r = https.request({
      hostname: 'polygon-bor-rpc.publicnode.com', path: '/', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 8000,
    }, resp => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => { try { res(JSON.parse(d).result); } catch { rej(); } }); });
    r.on('error', rej).on('timeout', () => { r.destroy(); rej(new Error('timeout')); });
    r.write(body); r.end();
  });
}

// ── USDC deposit monitoring ───────────────────────────────────────────────────
async function getIncomingUsdcTxs(address) {
  const all = [];
  for (const contract of USDC_CONTRACTS) {
    try {
      const data = await httpsGet(
        `https://api.etherscan.io/v2/api?chainid=137&module=account&action=tokentx` +
        `&contractaddress=${contract}&address=${address}&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_KEY}`
      );
      if (!Array.isArray(data.result)) continue;
      all.push(...data.result.filter(tx => tx.to.toLowerCase() === address.toLowerCase()));
    } catch {}
  }
  const seen = new Set();
  return all.filter(tx => { if (seen.has(tx.hash)) return false; seen.add(tx.hash); return true; });
}

// ── POL swap ─────────────────────────────────────────────────────────────────
async function swapPolToUsdc(privateKey, address) {
  const ethers = require('/workspace/node_modules/ethers');
  const provider = new ethers.providers.StaticJsonRpcProvider(
    { url: 'https://polygon-bor-rpc.publicnode.com', skipFetchSetup: true },
    { name: 'polygon', chainId: 137 }
  );
  const wallet = new ethers.Wallet(privateKey, provider);

  const polRaw = await provider.getBalance(address);
  const polBal = parseFloat(ethers.utils.formatEther(polRaw));
  const polToSwap = polBal - MIN_POL_KEEP;

  if (polToSwap < MIN_POL_SWAP) return null;

  console.log(`[swap] ${address.slice(0,10)}... ${polBal.toFixed(3)} POL → swapping ${polToSwap.toFixed(3)}`);

  // Get quote
  const amountIn = BigInt(Math.floor(polToSwap * 1e18)).toString();
  const quoteRes = await httpsGet(`${KYBER_API}/routes?tokenIn=${NATIVE_POL}&tokenOut=${USDC_NATIVE}&amountIn=${amountIn}`);
  const routeSummary = quoteRes?.data?.routeSummary;
  if (!routeSummary) throw new Error('No quote from KyberSwap');

  const usdcExpected = parseInt(routeSummary.amountOut) / 1e6;

  // Build tx
  const buildRes = await httpsPost(`${KYBER_API}/route/build`, {
    routeSummary,
    recipient: address,
    sender: address,
    slippageTolerance: 50, // 0.5%
    deadline: Math.floor(Date.now() / 1000) + 300,
  });
  if (!buildRes?.data?.data) throw new Error('Failed to build swap tx');

  // Send tx
  const feeData = await provider.getFeeData();
  const maxPriorityFeePerGas = ethers.utils.parseUnits('30','gwei');
  const maxFeePerGas = feeData.maxFeePerGas?.mul ? feeData.maxFeePerGas.mul(150).div(100) : ethers.utils.parseUnits('100','gwei');

  const tx = await wallet.sendTransaction({
    to: KYBER_ROUTER,
    data: buildRes.data.data,
    value: amountIn,
    gasLimit: buildRes.data.gas || 400000,
    maxFeePerGas,
    maxPriorityFeePerGas,
    type: 2,
  });

  console.log(`[swap] TX: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[swap] ✅ Confirmed block ${receipt.blockNumber} | ~${usdcExpected.toFixed(2)} USDC`);

  return { txHash: receipt.transactionHash, polSwapped: polToSwap, usdcReceived: usdcExpected };
}

// ── POL monitoring ────────────────────────────────────────────────────────────
async function checkAndSwapPol(tgId, user) {
  if (!user.address || !user.privateKey) return;

  try {
    const polRaw = await rpc('eth_getBalance', [user.address, 'latest']);
    const polBal = polRaw ? Number(BigInt(polRaw)) / 1e18 : 0;

    if (polBal < MIN_POL_SWAP + MIN_POL_KEEP) return; // not enough

    // Check cooldown (don't spam swaps)
    if (Date.now() - (lastPolSwap[tgId] || 0) < 5 * 60 * 1000) return; // 5 min cooldown

    const notifyId = tgId === 'master' ? 399089761 : Number(tgId);
    const walletLabel = tgId === 'master' ? '🔑 Master wallet' : '';
    await tgSend(notifyId,
      `🔄 ${walletLabel}*Получено ${polBal.toFixed(2)} POL!*\n` +
      `Свапаю в USDC автоматически... (~30 сек)`
    );

    const result = await swapPolToUsdc(user.privateKey, user.address);
    if (!result) return;

    lastPolSwap[tgId] = Date.now();

    await tgSend(notifyId,
      `✅ ${walletLabel}*Своп выполнен!*\n\n` +
      `🔄 ${result.polSwapped.toFixed(2)} POL → *$${result.usdcReceived.toFixed(2)} USDC*\n` +
      `🔗 [Транзакция](https://polygonscan.com/tx/${result.txHash})\n\n` +
      `💰 Баланс пополнен, можно ставить!`
    );

    return result;
  } catch(e) {
    console.error(`[swap] Error for ${tgId}:`, e.message?.slice(0, 80));
  }
}

// ── In-memory caches (reset on restart) ──────────────────────────────────────
const seenTxCache   = {};   // tgId → Set of seen tx hashes
const lastPolSwap   = {};   // tgId → timestamp of last swap

// ── Main loop ─────────────────────────────────────────────────────────────────
async function checkDeposits() {
  // Check master wallet (polymarket-creds.json) — swap POL → USDC if needed
  try {
    const master = JSON.parse(require('fs').readFileSync('/workspace/polymarket-creds.json', 'utf8'));
    if (master.wallet?.address && master.wallet?.privateKey) {
      await checkAndSwapPol('master', { address: master.wallet.address, privateKey: master.wallet.privateKey });
    }
  } catch (e) { console.warn('[deposit] master wallet check error:', e.message); }

  // Load all wallets from Supabase
  const wallets = await db.getAllWallets();
  if (!Array.isArray(wallets) || wallets.length === 0) return;

  // Build lookup: address (lowercase) → tg_id
  const addrToUser = {};
  for (const w of wallets) {
    if (w.address) addrToUser[w.address.toLowerCase()] = String(w.tg_id);
  }

  for (const w of wallets) {
    if (!w.address) continue;
    const tgId = String(w.tg_id);
    const userObj = { address: w.address };

    // 1. Check POL → auto-swap (needs privateKey from wallet record)
    if (w.private_key_enc) {
      await checkAndSwapPol(tgId, { address: w.address, privateKey: w.private_key_enc });
    }

    // 2. Check USDC deposits
    let txs;
    try { txs = await getIncomingUsdcTxs(w.address); }
    catch { continue; }

    if (!seenTxCache[tgId]) seenTxCache[tgId] = new Set();
    const seenSet = seenTxCache[tgId];

    for (const tx of txs) {
      if (seenSet.has(tx.hash)) continue;
      seenSet.add(tx.hash);

      const amount = Number(tx.value) / 1e6;
      if (amount < 1) continue;

      try {
        const currentUser = await db.getUser(tgId);
        const newDeposited = parseFloat(currentUser?.total_deposited || 0) + amount;
        await db.updateUser(tgId, { total_deposited: newDeposited, updated_at: new Date().toISOString() });
      } catch(e) {
        console.error(`[deposit] Supabase update error for ${tgId}:`, e.message);
      }

      console.log(`[deposit] +$${amount.toFixed(2)} USDC → tgId:${tgId} | tx:${tx.hash.slice(0,12)}...`);

      await tgSend(Number(tgId),
        `✅ *Депозит получен!*\n\n` +
        `💵 +$${amount.toFixed(2)} USDC\n` +
        `🔗 [Посмотреть транзакцию](https://polygonscan.com/tx/${tx.hash})\n\n` +
        `Баланс обновлён в дашборде.`
      );
    }
  }
}

async function run() {
  console.log('💳 Deposit watcher started (USDC + POL auto-swap)');
  while (true) {
    try { await checkDeposits(); } catch(e) { console.error('[watcher] error:', e.message); }
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
  }
}

run();


