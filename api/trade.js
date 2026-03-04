/**
 * /api/trade — place a trade on Polymarket via user's wallet
 * POST { tgId, market, conditionId, slug, side, amount, [isDemo] }
 *
 * Flow:
 *  1. Validate user + wallet from Supabase
 *  2. Check available balance (deposited + pnl − open bets)
 *  3. Execute CLOB order via lib/polymarket-trade.js
 *  4. Record in Supabase bets table
 *  5. Return { ok, executed, status, ... } — always honest about execution state
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
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const body       = req.body || {};
    const tgId       = body.tgId;
    const market     = body.market      || '';
    const conditionId = body.conditionId || '';
    const slug       = body.slug        || '';
    const side       = (body.side       || 'YES').toUpperCase();
    const amount     = parseFloat(body.amount  || 0);
    const signalScore = parseFloat(body.signalScore || 0);
    const isDemo     = body.isDemo === true || body.isDemo === 'true';

    if (!tgId || !amount) return res.json({ ok: false, error: 'Missing tgId or amount' });
    if (amount < MIN_TRADE) return res.json({ ok: false, error: 'Minimum trade is $' + MIN_TRADE });

    // ── 1. Load user from Supabase ──────────────────────────────
    const user = await db.getUser(tgId);
    if (!user) return res.json({ ok: false, error: 'User not found. Open the app first.' });

    const wallet = await db.getWallet(tgId);
    if (!wallet || !wallet.address) {
      return res.json({ ok: false, error: 'Wallet not found. Create one first.' });
    }

    // ── 2. Demo bet path ────────────────────────────────────────
    if (isDemo) {
      const curDemo = parseFloat(user.demo_balance || 0);
      if (curDemo < amount) {
        return res.json({ ok: false, error: 'Insufficient demo balance ($' + curDemo.toFixed(2) + ')' });
      }
      const newDemo = Math.max(0, curDemo - amount);

      const betRecord = {
        tg_id:        parseInt(tgId),
        market:       market.slice(0, 200),
        market_id:    conditionId || null,
        side,
        amount,
        price:        0,
        status:       'open',
        is_demo:      true,
        signal_type:  null,
        signal_score: signalScore || null,
      };

      try { await db.insertBet(betRecord); } catch (e) {
        console.error('[trade] demo insertBet fail:', e.message);
      }
      try { await db.updateUser(tgId, { demo_balance: newDemo }); } catch (e) {
        console.error('[trade] demo_balance update fail:', e.message);
      }

      return res.json({
        ok:          true,
        executed:    true,
        status:      'demo',
        isDemo:      true,
        newBalance:  newDemo,
        message:     'Demo ' + side + ' $' + amount + ' on "' + market.slice(0, 50) + '"',
      });
    }

    // ── 3. Real trade: balance check ────────────────────────────
    const deposited  = parseFloat(user.total_deposited || 0);
    const pnl        = parseFloat(user.total_pnl       || 0);
    const totalValue = deposited + pnl;

    const openBets = await db.getUserBets(tgId, 200);
    const openAmount = Array.isArray(openBets)
      ? openBets.reduce((s, b) => (b.status === 'open' && !b.is_demo) ? s + parseFloat(b.amount || 0) : s, 0)
      : 0;

    const available = totalValue - openAmount;
    if (available < amount) {
      return res.json({
        ok: false,
        error: 'Insufficient balance. Available: $' + available.toFixed(2)
             + ' (Total: $' + totalValue.toFixed(2)
             + ', In bets: $' + openAmount.toFixed(2) + ')',
      });
    }

    // ── 4. Resolve private key ──────────────────────────────────
    // Priority: wallet.private_key_enc → env var → local creds file
    let privateKey = wallet.private_key_enc || null;

    if (!privateKey && process.env.POLY_PRIVATE_KEY && process.env.POLY_WALLET_ADDRESS) {
      if (wallet.address && process.env.POLY_WALLET_ADDRESS.toLowerCase() === wallet.address.toLowerCase()) {
        privateKey = process.env.POLY_PRIVATE_KEY;
        console.log('[trade] key source: env var');
      }
    }
    if (!privateKey) {
      try {
        const masterCreds = JSON.parse(require('fs').readFileSync('/workspace/polymarket-creds.json', 'utf8'));
        if (
          masterCreds.wallet?.privateKey && masterCreds.wallet?.address && wallet.address &&
          masterCreds.wallet.address.toLowerCase() === wallet.address.toLowerCase()
        ) {
          privateKey = masterCreds.wallet.privateKey;
          console.log('[trade] key source: local creds file');
        }
      } catch (e) { /* no local file in prod */ }
    }

    // ── 5. Try CLOB execution ───────────────────────────────────
    let tradeResult    = null;
    let executionError = null;

    if (privateKey) {
      try {
        const polyTrade = require('../lib/polymarket-trade');
        tradeResult = await polyTrade.executeTrade({
          privateKey, market, conditionId, slug, side, amount,
        });
        console.log('[trade] CLOB executed:', tradeResult.orderID);
      } catch (e) {
        executionError = e.message;
        console.error('[trade] CLOB execution failed:', e.message);
      }
    } else {
      executionError = 'No private key available for wallet ' + wallet.address;
      console.warn('[trade]', executionError);
    }

    // ── 6. Record bet in Supabase ───────────────────────────────
    const betStatus = tradeResult ? 'open' : 'queued';
    const betRecord = {
      tg_id:        parseInt(tgId),
      market:       market.slice(0, 200),
      market_id:    conditionId || null,
      side,
      amount,
      price:        tradeResult ? parseFloat(tradeResult.price || 0) : 0,
      status:       betStatus,
      is_demo:      false,
      signal_type:  null,
      signal_score: signalScore || null,
    };

    try { await db.insertBet(betRecord); } catch (e) {
      console.error('[trade] db.insertBet failed:', e.message);
    }

    // ── 7. Return honest status ─────────────────────────────────
    if (tradeResult && (tradeResult.success || tradeResult.orderID)) {
      return res.json({
        ok:       true,
        executed: true,
        status:   'open',
        message:  side + ' $' + amount + ' executed on "' + market.slice(0, 50) + '"',
        trade:    tradeResult,
      });
    }

    // Queued — edge runner will pick it up
    return res.json({
      ok:       true,
      executed: false,
      status:   'queued',
      message:  'Ставка принята, исполняется через агента (~1 мин)',
      reason:   executionError || 'No private key',
      trade: {
        id:          crypto.randomBytes(8).toString('hex'),
        tgId:        String(tgId),
        market,
        conditionId,
        slug,
        side,
        amount,
        signalScore,
        status:      'queued',
        createdAt:   new Date().toISOString(),
      },
    });

  } catch (e) {
    console.error('[trade] unhandled:', e.message);
    res.json({ ok: false, error: e.message });
  }
};
