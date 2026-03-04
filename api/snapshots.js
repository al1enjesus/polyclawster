/**
 * /api/snapshots — balance history for sparkline
 * GET ?tgId=...&hours=24
 * Returns: { ok, snapshots: [{ts, val, pnl}], current: {val, pnl} }
 *
 * Data source priority:
 *  1. GitHub users.json (pushed by edge runner every 20min)
 *  2. Synthetic from Supabase user data (fallback)
 */
'use strict';
const https = require('https');
const db    = require('../lib/db');

const GH_TOKEN = process.env.GH_TOKEN || '';
const GH_REPO  = 'al1enjesus/polyclawster-app';

function ghGet(file) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/repos/' + GH_REPO + '/contents/' + file,
      method: 'GET',
      headers: { 'Authorization': 'token ' + GH_TOKEN, 'User-Agent': 'polyclawster' },
      timeout: 7000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.from(JSON.parse(d).content, 'base64').toString())); }
        catch (e) { reject(new Error('parse: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const params = new URL(req.url || '/', 'http://x').searchParams;
  const tgId = (req.query && req.query.tgId) || params.get('tgId') || '';
  const hours = parseInt((req.query && req.query.hours) || params.get('hours') || '24', 10);
  const cutoff = Date.now() - hours * 3600 * 1000;

  if (!tgId) return res.json({ ok: false, error: 'tgId required', snapshots: [] });

  // ── 1. Try GitHub users.json ──────────────────────────────────
  let userData = null;
  let source = 'none';
  try {
    const users = await ghGet('users.json');
    userData = users && users[String(tgId)];
    if (userData) source = 'github';
  } catch (e) {
    console.log('[snapshots] GitHub read failed:', e.message);
  }

  // ── 2. Fallback: Supabase user record ─────────────────────────
  if (!userData) {
    try {
      const sbUser = await db.getUser(tgId);
      if (sbUser) {
        userData = {
          totalValue:    sbUser.total_deposited + (sbUser.total_pnl || 0),
          totalPnl:      sbUser.total_pnl || 0,
          totalDeposited: sbUser.total_deposited || 0,
          snapshots:     [],
        };
        source = 'supabase';
      }
    } catch (e) {
      console.log('[snapshots] Supabase fallback failed:', e.message);
    }
  }

  if (!userData) {
    return res.json({ ok: false, error: 'user not found', snapshots: [] });
  }

  const current = {
    val: parseFloat(userData.totalValue || 0),
    pnl: parseFloat(userData.totalPnl   || 0),
  };

  // Filter snapshots to requested time window
  const allSnaps = (userData.snapshots || []).filter(function(s) { return s.ts > cutoff; });

  if (!allSnaps.length) {
    // Synthesize: flat line at current value
    const synthetic = [];
    for (var i = 0; i <= 6; i++) {
      synthetic.push({
        ts:  Date.now() - (6 - i) * hours / 6 * 3600 * 1000,
        val: current.val,
        pnl: current.pnl,
      });
    }
    return res.json({ ok: true, snapshots: synthetic, current: current, synthetic: true, source: source });
  }

  // Add current as last point
  const snapshots = allSnaps.concat([{ ts: Date.now(), val: current.val, pnl: current.pnl }]);

  res.json({ ok: true, snapshots: snapshots, current: current, synthetic: false, source: source });
};
