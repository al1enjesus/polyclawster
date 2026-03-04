/**
 * /api/trade — place a trade on Polymarket via user's wallet
 * POST { tgId, market, conditionId, slug, side, amount, [isDemo] }
 *
 * Flow:
 *  1. Validate user from Supabase (users table)
 *  2. Get wallet from Supabase (wallets table — has private_key_enc)
 *  3. Check available balance vs open bets
 *  4. Execute CLOB order via lib/polymarket-trade.js
 *  5. Record in Supabase bets table
 *  6. Return honest status
 *
 * Balance model:
 *  - "Available" = freeUsdc (CLOB collateral, NOT positions value)
 *  - Positions are locked as conditional tokens, not spendable
 *  - To free up cash: sell positions on Polymarket first
 */
'use strict';
const db     = require('../lib/db');
const fs     = require('fs');
const crypto = require('crypto');

const MIN_TRADE = 1; // $1 minimum

// Master wallet creds — used when user's wallet matches system wallet
function getMasterApiCreds() {
  try {
    const c = JSON.parse(fs.readFileSync('/workspace/polymarket-creds.json', 'utf8'));
    return c.api || null;
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const body        = req.body || {};
    const tgId        = String(body.tgId || '');
    const market      = body.market       || '';
    const conditionId = body.conditionId  || '';
    const slug        = body.slug         || '';
    const side        = (body.side        || 'YES').toUpperCase();
    const amount      = parseFloat(body.amount || 0);
    const signalScore = parseFloat(body.signalScore || 0);
    const isDemo      = body.isDemo === true || body.isDemo === 'true';

    if (!tgId || !amount) return res.json({ ok: false, error: 'Missing tgId or amount' });
    if (amount < MIN_TRADE) return res.json({ ok: false, error: 'Minimum trade is $' + MIN_TRADE });

    // ── 1. Load user ────────────────────────────────────────────
    const user = await db.getUser(tgId);
    if (!user) return res.json({ ok: false, error: 'User not found. Open the app first.' });

    // ── 2. Demo bet path ────────────────────────────────────────
    if (isDemo) {
      const curDemo = parseFloat(user.demo_balance || 0);
      if (curDemo < amount) {
        return res.json({ ok: false, error: 'Insufficient demo balance ($' + curDemo.toFixed(2) + ')' });
      }
      await db.insertBet({
        tg_id: parseInt(tgId), market: market.slice(0, 200), market_id: conditionId || null,
        side, amount, price: 0, status: 'open', is_demo: true,
        signal_type: null, signal_score: signalScore || null,
      }).catch(e => console.error('[trade] demo insertBet fail:', e.message));
      await db.updateUser(tgId, { demo_balance: Math.max(0, curDemo - amount) })
        .catch(e => console.error('[trade] demo_balance update fail:', e.message));
      return res.json({
        ok: true, executed: true, status: 'demo', isDemo: true,
        newBalance: Math.max(0, curDemo - amount),
        message: 'Demo ' + side + ' $' + amount + ' on "' + market.slice(0, 50) + '"',
      });
    }

    // ── 3. Get wallet with private key ──────────────────────────
    const wallet = await db.getWallet(tgId);
    if (!wallet?.address) {
      return res.json({ ok: false, error: 'Wallet not found. Create one first.' });
    }

    const privateKey = wallet.private_key_enc || null;
    if (!privateKey) {
      return res.json({
        ok: false,
        error: 'Wallet private key not available. Contact support.',
      });
    }

    // ── 4. Get API creds (master if wallet matches, else derive) ─
    const masterCreds = getMasterApiCreds();
    const masterWallet = (() => {
      try {
        return JSON.parse(fs.readFileSync('/workspace/polymarket-creds.json', 'utf8')).wallet?.address?.toLowerCase();
      } catch { return null; }
    })();
    const apiCreds = (masterCreds && masterWallet === wallet.address.toLowerCase()) ? masterCreds : null;
    // If apiCreds=null, polymarket-trade.js will derive keys automatically

    // ── 5. Check CLOB free balance ──────────────────────────────
    // Don't check Supabase total_deposited — it may be stale.
    // polymarket-trade.js checks actual CLOB balance and throws if insufficient.

    // ── 6. Execute trade ────────────────────────────────────────
    let tradeResult    = null;
    let executionError = null;

    try {
      const polyTrade = require('../lib/polymarket-trade');
      tradeResult = await polyTrade.executeTrade({
        privateKey, market, conditionId, slug, side, amount,
        apiCreds, // null = will auto-derive
      });
      console.log('[trade] CLOB executed:', tradeResult.orderID);
    } catch (e) {
      executionError = e.message;
      console.error('[trade] CLOB execution failed:', e.message);
    }

    // ── 7. Record bet ───────────────────────────────────────────
    const betStatus = tradeResult ? 'open' : 'queued';
    await db.insertBet({
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
    }).catch(e => console.error('[trade] insertBet failed:', e.message));

    // ── 8. Return result ────────────────────────────────────────
    if (tradeResult?.success || tradeResult?.orderID) {
      return res.json({
        ok: true, executed: true, status: 'open',
        message: `${side} $${amount} executed on "${market.slice(0, 50)}"`,
        trade: tradeResult,
      });
    }

    // Queued or failed
    return res.json({
      ok:       true,
      executed: false,
      status:   'queued',
      message:  'Ставка принята, будет исполнена когда освободится баланс',
      reason:   executionError || 'Unknown error',
      hint:     executionError?.includes('Insufficient') 
        ? 'У тебя 0 свободных USDC. Все средства в открытых позициях. Закрой часть позиций на Polymarket, чтобы освободить USDC.'
        : null,
      trade: {
        id: crypto.randomBytes(8).toString('hex'),
        tgId, market, conditionId, slug, side, amount, signalScore,
        status: 'queued', createdAt: new Date().toISOString(),
      },
    });

  } catch (e) {
    console.error('[trade] unhandled:', e.message);
    res.json({ ok: false, error: e.message });
  }
};
