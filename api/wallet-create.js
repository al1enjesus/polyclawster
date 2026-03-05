/**
 * /api/wallet/create — creates Polygon wallet via ethers + stores in Supabase
 * POST { tgId }
 * Works both as Vercel serverless function and from server.js route
 */
require('dotenv').config();
const https = require('https');
const db = require('../lib/db');

const BOT_TOKEN = process.env.BOT_TOKEN || '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';

function generateWallet() {
  const { ethers } = require('ethers');
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, privateKey: wallet.privateKey };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.json({ ok: false, error: 'POST only' }); return; }

  const { tgId } = req.body || {};
  if (!tgId) return res.json({ ok: false, error: 'no tgId' });

  try {
    // Check existing wallet in Supabase
    const existingWallet = await db.getWallet(String(tgId)).catch(() => null);
    if (existingWallet && existingWallet.address) {
      const existingUser = await db.getUser(String(tgId)).catch(() => null);
      return res.json({
        ok: true,
        data: {
          address: existingWallet.address,
          network: 'polygon',
          demoBalance: parseFloat(existingUser?.demo_balance || 0),
          trades: 0,
          totalProfit: parseFloat(existingUser?.total_pnl || 0),
          totalFeesPaid: parseFloat(existingUser?.total_fees_paid || 0),
        },
        created: false,
        ts: Date.now(),
      });
    }

    // Create new wallet
    const { address, privateKey } = generateWallet();

    // Save to Supabase: user first (FK), then wallet
    await db.upsertUser({
      id: parseInt(tgId),
      address,
      demo_balance: 1.00,
      total_deposited: 0,
      active: true,
      onboarded: true,
      updated_at: new Date().toISOString(),
    });
    await db.upsertWallet(String(tgId), address, privateKey);

    // Notify user via Telegram
    const tgMsg = JSON.stringify({
      chat_id: tgId,
      text: '✅ *Wallet created!*\n\n🔗 `' + address + '`\n\n_Polygon network · USDC.e_\n\nSend USDC to this address to deposit funds.',
      parse_mode: 'Markdown',
    });
    await new Promise(resolve => {
      const r = https.request({
        hostname: 'api.telegram.org',
        path: '/bot' + BOT_TOKEN + '/sendMessage',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(tgMsg) },
      }, res => { res.resume(); res.on('end', resolve); });
      r.on('error', () => resolve());
      r.write(tgMsg);
      r.end();
    });

    res.json({
      ok: true,
      data: {
        address,
        network: 'polygon',
        tgId,
        demoBalance: 1.00,
        isNew: true,
        trades: 0,
        totalProfit: 0,
        totalFeesPaid: 0,
      },
      created: true,
      ts: Date.now(),
    });
  } catch (e) {
    console.error('[wallet-create] error:', e.message);
    res.json({ ok: false, error: e.message });
  }
};
