/**
 * /api/stars-invoice — create Telegram Stars invoice link
 * POST { tgId, stars }  (1 star ≈ $0.013 USD, minimum 1 star)
 */
'use strict';
const https = require('https');

const BOT_TOKEN = process.env.BOT_TOKEN || '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';

// Stars → USD rate (Telegram sets 1 XTR = ~$0.013)
// We take 35% commission, user receives 65%
const STARS_TO_USD = 0.013;
const COMMISSION = 0.35;
const STARS_NET = STARS_TO_USD * (1 - COMMISSION); // ~$0.00845 per star after fee

function tgPost(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 8000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', reject).on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.json({ ok: false, error: 'POST only' });

  const { tgId, stars = 100 } = req.body || {};
  if (!tgId) return res.json({ ok: false, error: 'no tgId' });

  const starsAmount = Math.max(1, Math.min(10000, parseInt(stars)));
  const usdValue = (starsAmount * STARS_TO_USD).toFixed(2);

  try {
    const result = await tgPost('createInvoiceLink', {
      title: 'PolyClawster пополнение',
      description: `${starsAmount} ⭐ → $${usdValue} USDC на торговый баланс (комиссия 35%)`,
      payload: JSON.stringify({ tgId: String(tgId), stars: starsAmount, type: 'deposit' }),
      currency: 'XTR',
      prices: [{ label: 'Пополнение баланса', amount: starsAmount }],
    });

    if (result && result.ok) {
      return res.json({ ok: true, link: result.result, stars: starsAmount, usdValue });
    } else {
      return res.json({ ok: false, error: result?.description || 'invoice creation failed' });
    }
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
};
