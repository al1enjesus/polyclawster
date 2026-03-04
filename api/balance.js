/**
 * /api/balance — Real wallet balance from Polymarket + on-chain
 * GET ?address=0x... [&tgId=xxx]
 *
 * Returns:
 *  - freeUsdc: spendable USDC (CLOB collateral)
 *  - positionsValue: value locked in open bets
 *  - totalValue: free + positions
 *  - positions: open bet list
 */
'use strict';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const params = req.query || new URL(req.url || '/', 'http://x').searchParams;
  const address = (typeof params.get === 'function' ? params.get('address') : params.address) || '';
  const tgId    = (typeof params.get === 'function' ? params.get('tgId')    : params.tgId)    || '';

  if (!address || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
    // Try to get address from tgId
    if (tgId) {
      try {
        const db = require('../lib/db');
        const wallet = await db.getWallet(tgId);
        if (wallet?.address) {
          req.query = req.query || {};
          req.query.address = wallet.address;
          return module.exports(req, res);
        }
      } catch {}
    }
    return res.json({ ok: false, error: 'Invalid or missing address' });
  }

  try {
    const { getWalletBalance } = require('../lib/wallet-balance');

    // For authenticated balance (includes CLOB free USDC):
    // Only if tgId provided and private key available
    let privateKey = null;
    let apiCreds   = null;
    if (tgId) {
      try {
        const db = require('../lib/db');
        const fs = require('fs');
        const w = await db.getWallet(tgId);
        if (w?.private_key_enc) {
          privateKey = w.private_key_enc;
          // Check if master creds match
          const master = JSON.parse(fs.readFileSync('/workspace/polymarket-creds.json', 'utf8'));
          if (master.wallet?.address?.toLowerCase() === address.toLowerCase()) {
            apiCreds = master.api;
          }
        }
      } catch {}
    }

    const balance = await getWalletBalance(address, privateKey, apiCreds);
    res.json({
      ok:             true,
      address:        address,
      freeUsdc:       balance.freeUsdc,
      positionsValue: balance.positionsValue,
      positionCount:  balance.positionCount,
      totalPnl:       balance.totalPnl,
      totalValue:     balance.totalValue,
      positions:      balance.positions,
      source:         balance.source,
      ts:             balance.ts,
      // Legacy compat
      balance:        balance.totalValue,
      symbol:         'USDC',
      network:        'Polygon',
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
