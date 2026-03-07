/**
 * /api/transactions — история транзакций пользователя
 * GET ?tgId=...
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const ETHERSCAN_KEY = '1PJVGS8SU3PESFS6KIZQHQBJEA1EUHIVT8'; // Etherscan V2 supports all chains

async function getTxHistory(address) {
  // Используем Polygonscan API для получения ERC-20 transfers
  return new Promise((resolve) => {
    const url = `/v2/api?chainid=137&module=account&action=tokentx&contractaddress=${USDC_CONTRACT}&address=${address}&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_KEY}`;
    const req = https.get({ hostname: 'api.etherscan.io', path: url }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try {
          const j = JSON.parse(raw);
          resolve(j.result || []);
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(8000, () => { req.destroy(); resolve([]); });
  });
}

const db = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { tgId } = req.query;
  if (!tgId) return res.json({ ok: false, error: 'no tgId' });

  try {
    // ── Ставки из Supabase ──
    var bets = [];
    try {
      var rawBets = await db.getUserBets(tgId, 50);
      if (Array.isArray(rawBets)) {
        bets = rawBets.map(function(b) {
          return {
            id:        b.id,
            market:    b.market || '',
            market_id: b.market_id || '',
            side:      b.side || 'YES',
            amount:    parseFloat(b.amount || 0),
            price:     parseFloat(b.price || 0),
            status:    b.status || 'open',
            is_demo:   !!b.is_demo,
            pnl:       parseFloat(b.pnl || 0),
            signal_score: b.signal_score || 0,
            created_at: b.created_at,
          };
        });
      }
    } catch(e) {}

    // ── On-chain TX история (USDC/POL Polygon) ──
    var txs = [];
    try {
      var user = await db.getUser(tgId);
      if (user && user.address) {
        var raw = await getTxHistory(user.address.toLowerCase());
        txs = raw.slice(0, 20).map(function(tx) {
          var value = Number(tx.value) / 1e6;
          var isIn  = tx.to.toLowerCase() === user.address.toLowerCase();
          return {
            hash:  tx.hash,
            type:  isIn ? 'deposit' : 'withdraw',
            amount: value,
            timestamp: Number(tx.timeStamp) * 1000,
            explorerUrl: 'https://polygonscan.com/tx/' + tx.hash,
            source: 'onchain',
          };
        });
      }
    } catch(e) {}

    // ── Stars-пополнения из bot_logs ──
    try {
      var logs = await db.getLogs({ type: 'stars_payment', tgId: tgId, limit: 20 });
      if (Array.isArray(logs)) {
        var starsTxs = logs.map(function(log) {
          return {
            hash: null,
            type: 'deposit',
            amount: parseFloat(log.amount || 0),
            timestamp: new Date(log.created_at).getTime(),
            explorerUrl: null,
            source: 'stars',
            label: '⭐ Stars ' + (log.message || ''),
          };
        });
        txs = txs.concat(starsTxs);
        // Сортируем по дате desc
        txs.sort(function(a, b) { return b.timestamp - a.timestamp; });
      }
    } catch(e) {}

    res.json({
      ok:   true,
      bets: bets,
      data: { transactions: txs, bets: bets },
    });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
};
