/**
 * /api/wallet — данные кошелька юзера из Supabase
 * GET ?tgId=xxx
 */
'use strict';
const db = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const tgId = (req.query && req.query.tgId)
    || new URL(req.url || '/', 'http://x').searchParams.get('tgId');

  if (!tgId) return res.json({ ok: false, error: 'no tgId' });

  try {
    const user = await db.getUser(tgId);
    if (!user) return res.json({ ok: false, error: 'user not found' });

    const wallet = await db.getWallet(tgId).catch(() => null);
    const address = (wallet && wallet.address) || user.address || null;
    const network = (wallet && wallet.network) || 'polygon';

    const totalDeposited = parseFloat(user.total_deposited || 0);
    const totalPnl = parseFloat(user.total_pnl || 0);
    const totalValue = totalDeposited + totalPnl; // estimated current value

    return res.json({
      ok: true,
      data: {
        address,
        network,
        tgId: String(tgId),
        username: user.username || null,
        totalDeposited,
        totalPnl,
        totalValue,
        demoBalance: parseFloat(user.demo_balance || 0),
        hasWallet: !!address,
        trades: (user.trades || 0),
      }
    });
  } catch(e) {
    return res.json({ ok: false, error: e.message });
  }
};
