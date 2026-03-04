/**
 * /api/trade — place a trade on Polymarket via user's wallet
 * POST { tgId, market, conditionId, slug, side, amount }
 *
 * Flow:
 *  1. Validate user + wallet from Supabase
 *  2. Check balance (total_deposited + total_pnl - existing bets)
 *  3. Execute CLOB order via lib/polymarket-trade.js
 *  4. Record in Supabase bets table
 */
'use strict';
const db     = require('../lib/db');
const crypto = require('crypto');

const MIN_TRADE = 1; // $1 minimum

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    var body = req.body || {};
    var tgId       = body.tgId;
    var market     = body.market     || '';
    var conditionId = body.conditionId || '';
    var slug       = body.slug        || '';
    var side       = (body.side       || 'YES').toUpperCase();
    var amount     = parseFloat(body.amount || 0);
    var signalScore = parseFloat(body.signalScore || 0);

    if (!tgId || !amount) return res.json({ ok: false, error: 'Missing tgId or amount' });
    if (amount < MIN_TRADE) return res.json({ ok: false, error: 'Minimum trade is $' + MIN_TRADE });

    // ── 1. Load user from Supabase ──────────────────────────────
    var user = await db.getUser(tgId);
    if (!user) return res.json({ ok: false, error: 'User not found. Open the app first.' });

    var wallet = await db.getWallet(tgId);
    if (!wallet || !wallet.address) {
      return res.json({ ok: false, error: 'Wallet not found. Create one first.' });
    }

    // ── 1b. Handle demo bets ──────────────────────────────────
    var isDemo = body.isDemo === true || body.isDemo === 'true';
    if (isDemo) {
      // Demo bets: record in bets table AND deduct from demo_balance in users
      var demoBetRecord = {
        tg_id:        parseInt(tgId),
        market:       market.slice(0, 200),
        market_id:    conditionId || null,
        side:         side,
        amount:       amount,
        price:        0,
        status:       'open',
        is_demo:      true,
        signal_type:  null,
        signal_score: signalScore || null,
      };
      try { await db.insertBet(demoBetRecord); } catch(e) { console.error('[trade] demo insertBet fail:', e.message); }

      // Deduct from demo_balance in users table
      try {
        var demoUser = await db.getUser(tgId);
        if (demoUser) {
          var curDemo = parseFloat(demoUser.demo_balance || 0);
          var newDemo = Math.max(0, curDemo - amount);
          await db.updateUser(tgId, { demo_balance: newDemo });
        }
      } catch(e) { console.error('[trade] demo_balance update fail:', e.message); }

      return res.json({
        ok: true,
        isDemo: true,
        message: 'Demo bet: ' + side + ' $' + amount + ' on "' + market.slice(0, 40) + '"',
      });
    }

    // ── 2. Check available balance ──────────────────────────────
    var deposited = parseFloat(user.total_deposited || 0);
    var pnl       = parseFloat(user.total_pnl       || 0);
    var totalValue = deposited + pnl;

    // Get sum of open bets to avoid double-spending
    var openBets = await db.getUserBets(tgId, 200);
    var openAmount = 0;
    if (Array.isArray(openBets)) {
      openBets.forEach(function(b) {
        if (b.status === 'open' && !b.is_demo) openAmount += parseFloat(b.amount || 0);
      });
    }

    var available = totalValue - openAmount;
    if (available < amount) {
      return res.json({
        ok: false,
        error: 'Insufficient balance. Available: $' + available.toFixed(2) + ' (Total: $' + totalValue.toFixed(2) + ', In bets: $' + openAmount.toFixed(2) + ')'
      });
    }

    // ── 3. Try real CLOB execution ──────────────────────────────
    var tradeResult = null;
    var executionError = null;
    // private_key_enc not stored in DB (security policy).
    // Fallback: load from polymarket-creds.json for matching address
    var privateKey = wallet.private_key_enc;
    if (!privateKey) {
      // Try env vars (Vercel production)
      if (process.env.POLY_PRIVATE_KEY && process.env.POLY_WALLET_ADDRESS &&
          wallet.address && process.env.POLY_WALLET_ADDRESS.toLowerCase() === wallet.address.toLowerCase()) {
        privateKey = process.env.POLY_PRIVATE_KEY;
        console.log('[trade] using env wallet key for', wallet.address.slice(0,10));
      }
      // Fallback: local creds file (dev)
      if (!privateKey) {
        try {
          var masterCreds = JSON.parse(require('fs').readFileSync('/workspace/polymarket-creds.json', 'utf8'));
          if (masterCreds.wallet && masterCreds.wallet.privateKey &&
              masterCreds.wallet.address && wallet.address &&
              masterCreds.wallet.address.toLowerCase() === wallet.address.toLowerCase()) {
            privateKey = masterCreds.wallet.privateKey;
            console.log('[trade] using local creds wallet key for', wallet.address.slice(0,10));
          }
        } catch(e) {}
      }
    }

    if (privateKey) {
      try {
        var polyTrade = require('../lib/polymarket-trade');
        tradeResult = await polyTrade.executeTrade({
          privateKey:  privateKey,
          market:      market,
          conditionId: conditionId,
          slug:        slug,
          side:        side,
          amount:      amount,
        });
      } catch (e) {
        executionError = e.message;
        console.error('[trade] CLOB execution failed:', e.message);
      }
    } else {
      executionError = 'No private key in wallet (encrypted key missing)';
    }

    // ── 4. Record bet in Supabase ───────────────────────────────
    var betRecord = {
      tg_id:        parseInt(tgId),
      market:       market.slice(0, 200),
      market_id:    conditionId || null,
      side:         side,
      amount:       amount,
      price:        tradeResult ? parseFloat(tradeResult.price || 0) : 0,
      status:       tradeResult ? 'open' : 'queued',
      is_demo:      false,
      signal_type:  null,
      signal_score: signalScore || null,
    };

    try {
      await db.insertBet(betRecord);
    } catch (e) {
      console.error('[trade] db.insertBet failed:', e.message);
    }

    if (tradeResult && (tradeResult.success || tradeResult.orderID)) {
      return res.json({
        ok: true,
        message: side + ' $' + amount + ' on "' + market.slice(0, 40) + '" executed',
        trade: tradeResult,
        executed: true,
      });
    }

    // Return queued (edge runner will pick it up)
    return res.json({
      ok: true,
      message: 'Trade queued: ' + side + ' $' + amount + ' on "' + market.slice(0, 40) + '"',
      trade: {
        id:         crypto.randomBytes(8).toString('hex'),
        tgId:       String(tgId),
        market:     market,
        conditionId: conditionId,
        slug:       slug,
        side:       side,
        amount:     amount,
        signalScore: signalScore,
        status:     'queued',
        createdAt:  new Date().toISOString(),
      },
      executed: false,
      note: executionError ? ('Queued — ' + executionError) : 'Trade will execute within 1 minute via AI agent.',
    });

  } catch (e) {
    console.error('[trade]', e.message);
    res.json({ ok: false, error: e.message });
  }
};
