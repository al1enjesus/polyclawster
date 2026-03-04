/**
 * /api/wallet-stats — статистика смарт-кошелька с Polymarket
 * GET ?addr=0x...
 * Возвращает: winRate, totalPnl, openPnl, realizedPnl, positions count
 */
'use strict';
const https = require('https');

function polyGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://data-api.polymarket.com' + path);
    https.get({
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { 'User-Agent': 'polyclawster/1.0' },
      timeout: 7000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve([]); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'max-age=60'); // кеш 1 мин

  const addr = (req.query && req.query.addr)
    || new URL(req.url || '/', 'http://x').searchParams.get('addr');

  if (!addr || !addr.startsWith('0x')) {
    return res.json({ ok: false, error: 'addr required' });
  }

  try {
    // Загрузить позиции
    const positions = await polyGet(`/positions?user=${addr}&limit=500&sizeThreshold=0`);
    if (!Array.isArray(positions)) {
      return res.json({ ok: false, error: 'No data from Polymarket' });
    }

    // Считаем статистику
    let openPnl = 0;
    let realizedPnl = 0;
    let wins = 0;
    let losses = 0;

    positions.forEach(p => {
      const cp = parseFloat(p.cashPnl || 0);
      const rp = parseFloat(p.realizedPnl || 0);
      openPnl += cp;
      realizedPnl += rp;
      // Считаем win/loss по текущим позициям (curPrice как индикатор)
      const curPrice = parseFloat(p.curPrice || 0);
      if (curPrice >= 0.5) wins++;
      else if (curPrice < 0.5 && curPrice > 0) losses++;
    });

    const totalPnl = openPnl + realizedPnl;
    const totalPositions = positions.length;
    const winRate = (wins + losses) > 0 ? wins / (wins + losses) : null;
    const totalValue = positions.reduce((s, p) => s + parseFloat(p.currentValue || 0), 0);

    return res.json({
      ok: true,
      addr,
      stats: {
        winRate,          // 0..1 или null
        winRatePct: winRate !== null ? Math.round(winRate * 100) : null,
        totalPnl: parseFloat(totalPnl.toFixed(2)),
        openPnl: parseFloat(openPnl.toFixed(2)),
        realizedPnl: parseFloat(realizedPnl.toFixed(2)),
        totalValue: parseFloat(totalValue.toFixed(2)),
        totalPositions,
        wins,
        losses,
      }
    });
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
};
