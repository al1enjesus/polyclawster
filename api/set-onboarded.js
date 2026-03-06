/**
 * /api/set-onboarded — mark user as having completed onboarding
 * POST { tgId }
 */
'use strict';
const db = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const tgId = String(body.tgId || '').trim();
    if (!tgId) return res.json({ ok: false, error: 'tgId required' });

    const user = await db.getUser(tgId);
    if (user) {
      await db.updateUser(tgId, { onboarded: true });
    }
    // If user doesn't exist yet (no wallet created) — that's ok, 
    // wallet-create.js always sets onboarded:true anyway

    return res.json({ ok: true });
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
};
