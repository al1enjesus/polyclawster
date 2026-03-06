/**
 * /api/demo-bonus — grant $1 demo balance to new users
 * POST { tgId }
 * Now uses Supabase instead of users.json
 */
'use strict';
const db = require('../lib/db');

const DEMO_AMOUNT = 1.00;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.json({ ok: false, error: 'POST only' }); return; }

  const tgId = parseInt((req.body || {}).tgId || 0);
  if (!tgId) { res.json({ ok: false, error: 'no tgId' }); return; }

  try {
    const user = await db.getUser(tgId);

    if (user && (parseFloat(user.demo_balance || 0) > 0 || parseFloat(user.total_deposited || 0) > 0 || user.demo_claimed)) {
      res.json({ ok: true, granted: false, demoBalance: parseFloat(user.demo_balance || 0), reason: 'already_granted' });
      return;
    }

    // Upsert user with demo balance
    await db.upsertUser({
      id: tgId,
      demo_balance: DEMO_AMOUNT,
      onboarded: false,
      credits: user ? user.credits : 20,
    });

    res.json({ ok: true, granted: true, demoBalance: DEMO_AMOUNT });
  } catch (e) {
    console.error('[demo-bonus]', e.message);
    res.json({ ok: false, error: e.message });
  }
};
