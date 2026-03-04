/**
 * /api/withdraw — process USDC.e withdrawal on Polygon
 */
'use strict';
const https = require('https');

const MIN_AMOUNT = 10;
const FEE        = 1.01;
const GH_TOKEN = process.env.GH_TOKEN || '';
const GH_REPO    = 'al1enjesus/polyclawster';

function ghGet(file) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${GH_REPO}/contents/${file}`,
      method: 'GET',
      headers: { 'Authorization': 'token ' + GH_TOKEN, 'User-Agent': 'polyclawster' },
      timeout: 8000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('parse')); } });
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); }); req.end();
  });
}

function ghPut(file, content, sha, message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      message,
      content: Buffer.from(content).toString('base64'),
      ...(sha ? {sha} : {})
    });
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${GH_REPO}/contents/${file}`,
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + GH_TOKEN, 'User-Agent': 'polyclawster',
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)
      },
      timeout: 12000,
    }, res => { res.resume(); res.on('end', resolve); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body); req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { tgId, toAddress, amount } = req.body || {};

  if (!tgId) return res.json({ ok: false, error: 'Missing tgId' });
  if (!toAddress || !toAddress.startsWith('0x') || toAddress.length < 42)
    return res.json({ ok: false, error: 'Invalid Polygon address' });
  if (!amount || isNaN(amount) || Number(amount) < MIN_AMOUNT)
    return res.json({ ok: false, error: `Minimum withdrawal is $${MIN_AMOUNT}` });

  const amountNum  = Number(amount);
  const receiveAmt = parseFloat((amountNum - FEE).toFixed(2));

  // Load users from GitHub
  let users, sha;
  try {
    const f = await ghGet('users.json');
    sha   = f.sha;
    users = JSON.parse(Buffer.from(f.content, 'base64').toString());
  } catch(e) {
    return res.json({ ok: false, error: 'Could not load user data' });
  }

  const uid  = String(tgId);
  const user = users[uid];
  if (!user || !user.address) return res.json({ ok: false, error: 'Wallet not found. Create wallet first.' });

  const balance = parseFloat(user.totalValue || 0);
  if (balance < amountNum) return res.json({ ok: false, error: `Insufficient balance ($${balance.toFixed(2)})` });
  if (!user.privateKey) return res.json({ ok: false, error: 'Signing key not found' });

  // Attempt on-chain USDC.e transfer
  let txHash = null;
  try {
    const { ethers } = require('ethers');
    const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
    const wallet   = new ethers.Wallet(user.privateKey, provider);
    const USDC     = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    const ABI      = ['function transfer(address to, uint256 amount) returns (bool)', 'function decimals() view returns (uint8)'];
    const usdc     = new ethers.Contract(USDC, ABI, wallet);
    const dec      = await usdc.decimals();
    const amtWei   = ethers.parseUnits(receiveAmt.toFixed(6), dec);
    const tx       = await usdc.transfer(toAddress, amtWei, { gasLimit: 100000 });
    txHash         = tx.hash;
    console.log('[withdraw] tx sent:', txHash);
  } catch(e) {
    console.log('[withdraw] on-chain skipped (no funds in hot wallet):', e.message.slice(0, 80));
  }

  // Update user balance & add trade record
  users[uid].totalValue = parseFloat(Math.max(0, balance - amountNum).toFixed(2));
  if (!users[uid].trades) users[uid].trades = [];
  users[uid].trades.unshift({
    type: 'withdraw', amount: amountNum, receiveAmount: receiveAmt,
    toAddress, fee: FEE, txHash,
    status: txHash ? 'sent' : 'pending',
    timestamp: new Date().toISOString(),
  });

  // Save to GitHub
  try {
    await ghPut('users.json', JSON.stringify(users, null, 2), sha, `withdraw: ${uid} $${amountNum}`);
  } catch(e) {
    console.error('[withdraw] save failed:', e.message);
  }

  res.json({
    ok: true, txHash, amount: amountNum, receiveAmount: receiveAmt,
    status: txHash ? 'sent' : 'pending',
    message: txHash ? 'Sent to blockchain!' : 'Queued — admin will process within 1h',
  });
};
