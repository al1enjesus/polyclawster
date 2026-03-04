/**
 * lib/db.js — Supabase database client
 * Single import for all DB operations across bot, edge, API
 */
'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

const https = require('https');

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'hlcwzuggblsvcofwphza.supabase.co',
      path: '/rest/v1/' + path,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation,resolution=merge-duplicates' : 'return=representation',
      },
      timeout: 8000,
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve(d); }
      });
    });
    r.on('error', reject).on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (payload) r.write(payload);
    r.end();
  });
}

// ── USERS ─────────────────────────────────────────────────────────

async function getUser(tgId) {
  const rows = await req('GET', `users?id=eq.${tgId}&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function upsertUser(data) {
  // Ensure id field is set
  return req('POST', 'users', data);
}

async function updateUser(tgId, data) {
  return req('PATCH', `users?id=eq.${tgId}`, data);
}

async function getAllUsers() {
  return req('GET', 'users?select=*&order=created_at.asc&limit=1000');
}

// ── WALLETS ────────────────────────────────────────────────────────

async function getWallet(tgId) {
  const rows = await req('GET', `wallets?tg_id=eq.${tgId}&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function upsertWallet(tgId, address, privateKeyEnc) {
  // Never store private key — security policy
  // Use upsert (on_conflict) to avoid duplicates
  const payload = { tg_id: parseInt(tgId), address, network: 'polygon' };
  // Only include private_key_enc if explicitly provided and non-null (legacy support)
  if (privateKeyEnc) payload.private_key_enc = privateKeyEnc;
  return req('POST', 'wallets', payload, { upsert: true, onConflict: 'tg_id' });
}

// ── BETS ──────────────────────────────────────────────────────────

async function insertBet(bet) {
  // bet: { tg_id, market, market_id, side, amount, price, is_demo, signal_type, signal_score }
  return req('POST', 'bets', bet);
}

async function getUserBets(tgId, limit = 50) {
  return req('GET', `bets?tg_id=eq.${tgId}&order=created_at.desc&limit=${limit}`);
}

async function updateBet(id, data) {
  return req('PATCH', `bets?id=eq.${id}`, data);
}

async function getOpenBets() {
  return req('GET', 'bets?status=eq.open&order=created_at.desc&limit=200');
}

// ── SIGNALS ───────────────────────────────────────────────────────

async function upsertSignal(sig) {
  return req('POST', 'signals', {
    type: sig.type, score: sig.score, market: sig.market || sig.title || '',
    market_id: sig.marketId, token_id: sig.tokenId, side: sig.side,
    price: sig.price, amount: sig.amount, news_context: sig.newsContext,
    raw: sig, detected_at: new Date().toISOString()
  });
}

async function getSignals(limit = 50, minScore = 0) {
  return req('GET', `signals?score=gte.${minScore}&order=score.desc,detected_at.desc&limit=${limit}`);
}

// ── REFERRALS ─────────────────────────────────────────────────────

async function insertReferral(referrerId, refereeId) {
  return req('POST', 'referrals', {
    referrer_id: referrerId, referee_id: refereeId,
    commission_rate: 0.40
  });
}

async function getReferrals(referrerId) {
  return req('GET', `referrals?referrer_id=eq.${referrerId}&select=*`);
}

// ── PAYOUTS ───────────────────────────────────────────────────────

async function queuePayout(tgId, amount, reason) {
  return req('POST', 'payouts', { tg_id: tgId, amount, reason });
}

async function getPendingPayouts() {
  return req('GET', 'payouts?status=eq.pending&order=created_at.asc&limit=50');
}

async function updatePayout(id, data) {
  return req('PATCH', `payouts?id=eq.${id}`, data);
}

module.exports = {
  // users
  getUser, upsertUser, updateUser, getAllUsers,
  // wallets
  getWallet, upsertWallet,
  // bets
  insertBet, getUserBets, updateBet, getOpenBets,
  // signals
  upsertSignal, getSignals,
  // referrals
  insertReferral, getReferrals,
  // payouts
  queuePayout, getPendingPayouts, updatePayout,
  // raw
  _req: req
};
