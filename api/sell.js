/**
 * /api/sell — sell/close a bet position
 * POST { tgId, betId, isDemo, returnAmount }
 * 
 * Demo: closes bet, returns amount to demo_balance
 * Real: executes sell order via CLOB (TODO)
 */
'use strict';
const db = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  try {
    const body = req.body || {};
    const tgId = String(body.tgId || '');
    const betId = parseInt(body.betId || 0);
    const isDemo = body.isDemo === true || body.isDemo === 'true';
    const returnAmount = parseFloat(body.returnAmount || 0);

    if (!tgId || !betId) return res.json({ ok: false, error: 'Missing tgId or betId' });

    // Get user
    const user = await db.getUser(tgId);
    if (!user) return res.json({ ok: false, error: 'User not found' });

    // Get bet - verify ownership
    const bets = await db.getUserBets(tgId);
    const bet = (bets || []).find(b => b.id === betId);
    if (!bet) return res.json({ ok: false, error: 'Bet not found' });
    if (bet.status !== 'open' && bet.status !== 'queued') {
      return res.json({ ok: false, error: 'Bet is not active (status: ' + bet.status + ')' });
    }

    if (isDemo || bet.is_demo) {
      // Demo sell: update bet status + return to demo_balance
      const curDemo = parseFloat(user.demo_balance || 0);
      const newDemo = Math.max(0, curDemo + returnAmount);

      await db.updateBet(betId, { status: 'cancelled', payout: returnAmount, resolved_at: new Date().toISOString() });
      await db.updateUser(tgId, { demo_balance: +newDemo.toFixed(2) });

      return res.json({
        ok: true,
        status: 'cancelled',
        returnAmount: +returnAmount.toFixed(2),
        newDemoBalance: +newDemo.toFixed(2),
        pnl: +(returnAmount - parseFloat(bet.amount || 0)).toFixed(2),
      });
    }

    // Real sell — TODO: execute via CLOB
    return res.json({ ok: false, error: 'Real position selling not yet implemented' });

  } catch (e) {
    console.error('[sell] error:', e.message);
    res.json({ ok: false, error: e.message });
  }
};
