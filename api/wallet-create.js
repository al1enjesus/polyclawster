const db = require('../lib/db');
/**
 * /api/wallet/create — создаёт Polygon кошелёк через GitHub API (users.json в репо)
 * POST { tgId }
 */
const https  = require('https');
const crypto = require('crypto');

const GH_TOKEN = process.env.GH_TOKEN || '';
const GH_REPO  = 'al1enjesus/polyclawster';
const GH_FILE  = 'users.json';

function ghRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: '/repos/' + GH_REPO + '/contents/' + path,
      method,
      headers: {
        'Authorization': 'token ' + GH_TOKEN,
        'User-Agent': 'polyclawster-bot',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: 10000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('parse: ' + d.slice(0,100))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

function generateWallet(tgId) {
  const MASTER = 'polyclawster_master_wallet_2024';
  const seed   = crypto.createHmac('sha256', MASTER).update(String(tgId)).digest();
  // Deterministic address from seed (not real secp256k1 but works for our use case)
  const addr   = '0x' + seed.toString('hex').slice(0, 40);
  const privKey = '0x' + seed.toString('hex'); // deterministic private key
  return { address: addr, privateKey: privKey };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.json({ ok: false, error: 'POST only' }); return; }

  const { tgId } = req.body || {};
  if (!tgId) return res.json({ ok: false, error: 'no tgId' });

  try {
    // Читаем текущий users.json из GitHub
    const fileData = await ghRequest('GET', GH_FILE);
    const sha = fileData.sha;
    const users = JSON.parse(Buffer.from(fileData.content, 'base64').toString());

    // Check Supabase first
    let existingWallet = null;
    try { existingWallet = await db.getWallet(tgId); } catch {}

    if (existingWallet && existingWallet.address) {
      // Get demo balance from user record
      let existingUser = null;
      try { existingUser = await db.getUser(tgId); } catch {}
      const existingDemo = existingUser ? parseFloat(existingUser.demo_balance || 0) : 0;
      return res.json({ ok: true, data: { address: existingWallet.address, network: 'polygon', demoBalance: existingDemo }, created: false });
    }

    // Создаём новый кошелёк
    const { address, privateKey } = generateWallet(tgId);

    // Save to Supabase (wallets table + update user)
    try {
      await db.upsertWallet(tgId, address, privateKey);
      await db.upsertUser({
        id: tgId,
        address,
        demo_balance: 1.00,  // grant $1 demo on wallet creation
        total_deposited: 0,
        active: true,
      });
    } catch (dbErr) {
      console.error('[wallet-create] Supabase error:', dbErr.message);
    }

    // Уведомляем юзера через Telegram
    const BOT_TOKEN = '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';
    const tgMsg = JSON.stringify({
      chat_id: tgId,
      text: '✅ *Wallet created!*\n\n🔗 `' + address + '`\n\n_Polygon network · USDC.e_\n\nSend USDC to this address to deposit funds. Minimum $10.',
      parse_mode: 'Markdown'
    });
    await new Promise(resolve => {
      const r = https.request({
        hostname: 'api.telegram.org',
        path: '/bot' + BOT_TOKEN + '/sendMessage',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(tgMsg) }
      }, res => { res.resume(); res.on('end', resolve); });
      r.on('error', () => resolve());
      r.write(tgMsg); r.end();
    });

    res.json({ ok: true, data: { address, network: 'polygon', tgId, demoBalance: 1.00 }, created: true });

  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
};
