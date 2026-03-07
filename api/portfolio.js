/**
 * /api/portfolio — personalized portfolio per tgId
 * - Returns user wallet info + bets from Supabase
 * - No longer bundles signals (TMA fetches /api/signals separately)
 */
'use strict';
const db    = require('../lib/db');
const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const tgId = (req.query?.tgId || new URL(req.url || '/', 'http://x').searchParams.get('tgId') || '').trim();

  try {
    // ── Load user from Supabase ──
    let user = null;
    if (tgId) {
      try { user = await db.getUser(tgId); } catch {}
    }

    // ── Build portfolio ──
    let portfolio;

    if (user) {
      const totalDeposited = parseFloat(user.total_deposited || 0);
      const totalPnl       = parseFloat(user.total_pnl || 0);
      const demoBalance    = parseFloat(user.demo_balance || 0);

      // Fetch live Polymarket positions if wallet exists
      let livePositions = [];
      let liveValue = 0;
      if (user.address) {
        try {
          const posUrl = `https://data-api.polymarket.com/positions?user=${user.address}&limit=100&sizeThreshold=0.01`;
          const posRes = await new Promise((resolve) => {
            const u = new URL(posUrl);
            https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'polyclawster' }, timeout: 5000 }, res => {
              let d = ''; res.on('data', c => d += c);
              res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
            }).on('error', () => resolve([])).on('timeout', () => resolve([]));
          });
          if (Array.isArray(posRes)) {
            livePositions = posRes.filter(p => (p.currentValue || 0) > 0.01);
            liveValue = livePositions.reduce((s, p) => s + (p.currentValue || 0), 0);
          }
        } catch {}
      }

      // Load bets from Supabase
      let userBets = [];
      try {
        userBets = await db.getUserBets(tgId, 50);
        if (!Array.isArray(userBets)) userBets = [];
      } catch {}

      portfolio = {
        totalValue: liveValue > 0 ? liveValue : (totalDeposited + totalPnl),
        totalDeposited,
        totalPnl,
        pnlPct: totalDeposited > 0 ? parseFloat(((totalPnl / totalDeposited) * 100).toFixed(2)) : 0,
        positions: livePositions,
        hasWallet: !!(user.address),
        address: user.address || null,
        demoBalance,
        starsBalance: parseFloat(user.stars_balance || 0),
        onboarded: user.onboarded === true || user.onboarded === 1,
        credits: parseInt(user.credits || 0),
        bets: userBets,
        activeBets: userBets.filter(b => b.status === 'open' || b.status === 'queued'),
      };
    } else {
      // New / unknown user
      portfolio = {
        totalValue: 0,
        totalDeposited: 0,
        totalPnl: 0,
        pnlPct: 0,
        positions: [],
        hasWallet: false,
        address: null,
        demoBalance: 0,
        starsBalance: 0,
        credits: 0,
        bets: [],
        activeBets: [],
        onboarded: false,
        isNewUser: true,
      };
    }

    res.json({
      ok: true,
      tgId: tgId || null,
      portfolio,
      signals: [],  // TMA fetches /api/signals separately
      updated: new Date().toISOString(),
      data: { portfolio, signals: [] },
    });

  } catch (fatalErr) {
    console.error('[portfolio] fatal:', fatalErr.message);
    try { res.status(500).json({ ok: false, error: fatalErr.message }); } catch {}
  }
};
