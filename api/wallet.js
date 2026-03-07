/**
 * /api/wallet — данные кошелька юзера
 * GET ?tgId=xxx
 *
 * Returns:
 *  - address, network
 *  - totalValue, totalPnl, totalDeposited (from Supabase — snapshot)
 *  - freeUsdc (CLOB collateral — real-time)
 *  - positionsValue (open bets value — real-time)
 *  - polBalance (POL/MATIC for gas — real-time)
 *  - demoBalance
 */
'use strict';
const db      = require('../lib/db');
const https   = require('https');

function rpcCall(data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: 'polygon-bor-rpc.publicnode.com', path: '/', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 6000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d).result); } catch { resolve(null); } });
    });
    req.on('error', reject).on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body); req.end();
  });
}

async function getPolBalance(address) {
  try {
    const r = await rpcCall({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] });
    return r ? Number(BigInt(r)) / 1e18 : 0;
  } catch { return 0; }
}

async function getUsdcBalance(address) {
  // Check both USDC.e (Polymarket) and native USDC (Circle)
  const contracts = [
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e (bridged, Polymarket)
    '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // native USDC (Circle)
  ];
  const sel = '70a08231';
  const pad = address.toLowerCase().replace('0x', '').padStart(64, '0');
  let total = 0;
  for (const addr of contracts) {
    try {
      const r = await rpcCall({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: addr, data: '0x' + sel + pad }, 'latest'] });
      if (r && r !== '0x') total += Number(BigInt(r)) / 1e6;
    } catch {}
  }
  return total;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const params = new URL(req.url || '/', 'http://x').searchParams;
  let tgId = (req.query && req.query.tgId) || params.get('tgId');
  const addrQuery = (req.query && req.query.address) || params.get('address');

  // If address provided instead of tgId, look up wallet by address
  if (!tgId && addrQuery) {
    try {
      const allWallets = await db.getAllWallets();
      const found = Array.isArray(allWallets) && allWallets.find(
        w => w.address && w.address.toLowerCase() === addrQuery.toLowerCase()
      );
      if (found) tgId = String(found.tg_id);
    } catch {}
  }

  if (!tgId) return res.json({ ok: false, error: 'no tgId or address' });

  const debug = (req.query?.debug || new URL(req.url||'/', 'http://x').searchParams.get('debug')) === '1';

  try {
    const [user, wallet] = await Promise.all([
      db.getUser(tgId),
      db.getWallet(tgId).catch(() => null),
    ]);

    if (!user) return res.json({ ok: false, error: 'user not found' });

    const address = wallet?.address || user.address || null;

    // Real-time on-chain balances (parallel)
    const [polBalance, usdcOnChain] = address
      ? await Promise.all([getPolBalance(address), getUsdcBalance(address)])
      : [0, 0];

    // CLOB free balance — only if we have creds
    let freeUsdc = 0;
    let positionsValue = 0;
    let positionCount = 0;
    const clobErrors = [];

    if (address && wallet?.private_key_enc) {
      try {
        const { getWalletBalance } = require('../lib/wallet-balance');
        const fs = require('fs');
        let apiCreds = null;
        try {
          const master = JSON.parse(fs.readFileSync('/workspace/polymarket-creds.json', 'utf8'));
          if (master.wallet?.address?.toLowerCase() === address.toLowerCase()) apiCreds = master.api;
        } catch {}
        const bal = await getWalletBalance(address, wallet.private_key_enc, apiCreds);
        freeUsdc = bal.freeUsdc;
        positionsValue = bal.positionsValue;
        positionCount = bal.positionCount;
      } catch (e) {
        clobErrors.push('CLOB balance: ' + e.message?.slice(0, 60));
      }
    }

    const totalDeposited = parseFloat(user.total_deposited || 0);
    const totalPnl       = parseFloat(user.total_pnl || 0);
    const totalValue     = freeUsdc + positionsValue || (totalDeposited + totalPnl);

    const data = {
      address,
      network:         wallet?.network || 'polygon',
      tgId:            String(tgId),
      username:        user.username || null,
      // On-chain
      polBalance:      parseFloat(polBalance.toFixed(6)),
      usdcOnChain:     parseFloat(usdcOnChain.toFixed(4)),
      // Polymarket
      freeUsdc:        parseFloat(freeUsdc.toFixed(4)),
      positionsValue:  parseFloat(positionsValue.toFixed(4)),
      positionCount,
      // Snapshots (Supabase)
      totalDeposited,
      totalPnl,
      totalValue:      parseFloat(totalValue.toFixed(4)),
      demoBalance:     parseFloat(user.demo_balance || 0),
      starsBalance:    parseFloat(user.stars_balance || 0),
      hasWallet:       !!address,
      trades:          user.trades || 0,
      // Debug
      ...(debug ? { _debug: { clobErrors, walletInDb: !!wallet, userInDb: !!user } } : {}),
    };

    return res.json({ ok: true, data });
  } catch(e) {
    return res.json({ ok: false, error: e.message, ...(debug ? { _stack: e.stack?.slice(0, 500) } : {}) });
  }
};
