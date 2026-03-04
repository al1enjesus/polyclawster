/**
 * /api/portfolio — personalized per tgId
 * - If tgId known → returns user's own wallet balance + personal positions (from users.json)
 * - Always returns global signals from data.json
 */
'use strict';
const db    = require('../lib/db');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const GH_TOKEN = process.env.GH_TOKEN || '';
const GH_REPO  = 'al1enjesus/polyclawster-app';

const OWNER_ID = '399089761'; // owner sees real positions from data.json

function ghGet(file) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${GH_REPO}/contents/${file}`,
      method: 'GET',
      headers: { 'Authorization': 'token ' + GH_TOKEN, 'User-Agent': 'polyclawster' },
      timeout: 7000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.from(JSON.parse(d).content, 'base64').toString())); }
        catch { reject(new Error('parse')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

module.exports = async (req, res) => {
  try {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const tgId = req.query?.tgId || new URL(req.url || '/', 'http://x').searchParams.get('tgId') || '';

  // ── Load global data (signals + owner portfolio) ──
  let globalData = null;
  try { globalData = await ghGet('data.json'); } catch {}
  if (!globalData) {
    try { globalData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data.json'), 'utf8')); } catch {}
  }

  // Try persistent signals history first, fallback to data.json
  let signals = [];
  try {
    const hist = await ghGet('edge/db/signals_history.json');
    if (Array.isArray(hist) && hist.length > 0) {
      signals = hist.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
  } catch {}
  if (signals.length === 0) {
    signals = (globalData?.signals || []).sort((a, b) => (b.score || 0) - (a.score || 0));
  }
  const updated = globalData?.updated || null;

  // ── Load user data from Supabase ──
  const uid = String(tgId);
  let user = null;
  if (tgId) {
    try { user = await db.getUser(tgId); } catch {}
  }
  // Fallback: try GitHub users.json for backward compat
  if (!user && tgId) {
    try {
      const users = await ghGet('users.json');
      const u = users[String(tgId)];
      if (u) user = {
        id: tgId, address: u.address,
        total_deposited: u.totalDeposited, total_pnl: u.totalPnl,
        demo_balance: u.demoBalance, ref_count: u.refCount,
        total_value: u.totalValue, username: u.username
      };
    } catch {}
  }

  // ── Build personalized portfolio ──
  let portfolio = null;

  if (uid === OWNER_ID && globalData?.portfolio) {
    // Owner: merge live Polymarket positions with user DB fields
    portfolio = Object.assign({}, globalData.portfolio, {
      hasWallet: !!(user ? user.address : true),
      address: user ? user.address : null,
      demoBalance: user ? parseFloat(user.demo_balance || 0) : 0,
      totalDeposited: user ? parseFloat(user.total_deposited || 0) : 0,
      demoBonusGranted: true,
    });
  } else if (user) {
    // Regular user: build from wallet data
    const totalDeposited = parseFloat(user.total_deposited || user.totalDeposited || 0);
    const totalPnl      = parseFloat(user.total_pnl || user.totalPnl      || 0);
    // total_value = deposited + pnl (estimated current balance)
    // Falls back to totalDeposited if no pnl tracked yet
    const totalValue    = parseFloat(user.total_value || user.totalValue || 0) 
                          || (totalDeposited > 0 ? totalDeposited + totalPnl : 0);
    const pnlPct        = totalDeposited > 0 ? ((totalPnl / totalDeposited) * 100) : 0;
    const demoBalance   = parseFloat(user.demo_balance || user.demoBalance || 0);

    // Fetch live Polymarket balance if user has wallet
    let livePositions = [];
    let liveValue = 0;
    if (user.address) {
      try {
        const posUrl = `https://data-api.polymarket.com/positions?user=${user.address}&limit=100&sizeThreshold=0.01`;
        const posRes = await new Promise((resolve, reject) => {
          const u = new URL(posUrl);
          https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: {'User-Agent':'polyclawster'}, timeout: 5000 }, res => {
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
      totalValue: liveValue > 0 ? liveValue : totalValue,
      totalDeposited,
      totalPnl,
      pnlPct: parseFloat(pnlPct.toFixed(2)),
      positions: livePositions,
      hasWallet: !!(user.address),
      address: user.address || null,
      demoBalance,
      demoBonusGranted: !!user.demoBonusGranted,
      bets: userBets,
      activeBets: userBets.filter(b => b.status === 'open' || b.status === 'queued'),
    };
  } else {
    // Unknown user: empty state (demo bonus will be granted via /api/demo-bonus)
    portfolio = {
      totalValue: 0,
      totalDeposited: 0,
      totalPnl: 0,
      pnlPct: 0,
      positions: [],
      hasWallet: false,
      address: null,
      demoBalance: 0,
      demoBonusGranted: false,
    };
  }

  res.json({
    ok: true,
    tgId: uid || null,
    isOwner: uid === OWNER_ID,
    signals,
    portfolio,
    updated,
    data: { signals, portfolio, updated },
  });
  } catch(fatalErr) {
    console.error('portfolio fatal:', fatalErr.message);
    try { res.status(500).json({ ok: false, error: fatalErr.message }); } catch {}
  }
};
