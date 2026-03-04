/**
 * edge/modules/orderbook.js — CLOB orderbook analysis
 * Signals: whale orders, bid/ask imbalance, price drift, volume spikes
 */
const { get } = require('./http');
const { getTokenId } = require('./markets');
const cfg = require('../config');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function analyzeBook(book) {
  const bids = book.bids || [];
  const asks = book.asks || [];

  const bidDepth = bids.reduce((s, b) => s + parseFloat(b.size || 0) * parseFloat(b.price || 0), 0);
  const askDepth = asks.reduce((s, a) => s + parseFloat(a.size || 0) * parseFloat(a.price || 0), 0);
  const topBid = bids[0] ? parseFloat(bids[0].price) : 0;

  // Mid price = halfway between best bid and best ask
  const bestBid = bids[0] ? parseFloat(bids[0].price) : 0;
  const bestAsk = asks[0] ? parseFloat(asks[0].price) : 1;
  const mid = (bestBid + bestAsk) / 2;

  // Only count orders NEAR market price (within 15% of mid)
  // MM walls at 0.1¢ or 99.9¢ are not signals — they're just liquidity
  const isNearMarket = (price, side) => {
    const p = parseFloat(price);
    return side === 'bid' ? p > mid * 0.85 : p < mid + (1 - mid) * 0.15;
  };

  const bigBids  = bids.filter(b => isNearMarket(b.price,'bid') && parseFloat(b.size||0)*parseFloat(b.price||0) > cfg.OB_BIG);
  const bigAsks  = asks.filter(a => isNearMarket(a.price,'ask') && parseFloat(a.size||0)*parseFloat(a.price||0) > cfg.OB_BIG);
  const whaleBids = bids.filter(b => isNearMarket(b.price,'bid') && parseFloat(b.size||0)*parseFloat(b.price||0) > cfg.OB_WHALE);
  const whaleAsks = asks.filter(a => isNearMarket(a.price,'ask') && parseFloat(a.size||0)*parseFloat(a.price||0) > cfg.OB_WHALE);

  const bidAskRatio = askDepth > 0 ? bidDepth / askDepth : 0;
  const askBidRatio = bidDepth > 0 ? askDepth / bidDepth : 0;

  return { bidDepth, askDepth, topBid, bigBids, bigAsks, whaleBids, whaleAsks, bidAskRatio, askBidRatio };
}

async function scanOrderbooks(markets, prevState) {
  const signals = [];
  const newState = { ...prevState };

  // Only markets with REAL odds (15–85%) AND non-trivial liquidity
  // Skip already-resolved/near-resolved markets (99%/1%) — those are MM walls, not signals
  const isRealOdds = m => {
    const prices = JSON.parse(m.outcomePrices || '[]');
    return prices.some(p => { const pct = parseFloat(p) * 100; return pct > 12 && pct < 88; });
  };
  const targets = markets
    .filter(m => parseFloat(m.liquidity || 0) > 5000 && isRealOdds(m))
    .slice(0, 40);

  // First run — no prevState → just build baseline, skip signals
  const isFirstRun = Object.keys(prevState).length === 0;
  if (isFirstRun) {
    console.log('[OB] First run — building baseline, no signals sent');
  }

  for (const m of targets) {
    const tokenId = getTokenId(m);
    if (!tokenId) continue;
    await sleep(120);

    const book = await get(`https://clob.polymarket.com/book?token_id=${tokenId}`);
    if (!book?.bids) continue;

    const analysis = analyzeBook(book);
    const prev = prevState[tokenId] || {};
    newState[tokenId] = {
      bidDepth: analysis.bidDepth, askDepth: analysis.askDepth,
      lastPrice: analysis.topBid,
      whaleBids: analysis.whaleBids.length, whaleAsks: analysis.whaleAsks.length,
      ts: Date.now()
    };

    // ── SIGNAL: New whale order appeared ──────────────────────────────────
    if (!isFirstRun && analysis.whaleBids.length > (prev.whaleBids || 0)) {
      const maxW = Math.max(...analysis.whaleBids.map(b => parseFloat(b.size||0)*parseFloat(b.price||0)));
      signals.push({
        type: 'whale_order', side: 'YES', market: m.question,
        price: (analysis.topBid * 100).toFixed(1),
        amount: maxW.toFixed(0),
        score: Math.min(10, 3 + maxW / cfg.OB_WHALE * 7),
        strength: maxW > 50_000 ? 'HIGH' : 'MEDIUM',
      });
    }
    if (!isFirstRun && analysis.whaleAsks.length > (prev.whaleAsks || 0)) {
      const maxW = Math.max(...analysis.whaleAsks.map(a => parseFloat(a.size||0)*parseFloat(a.price||0)));
      signals.push({
        type: 'whale_order', side: 'NO', market: m.question,
        price: ((1 - analysis.topBid) * 100).toFixed(1),
        amount: maxW.toFixed(0),
        score: Math.min(10, 3 + maxW / cfg.OB_WHALE * 7),
        strength: maxW > 50_000 ? 'HIGH' : 'MEDIUM',
      });
    }

    // ── SIGNAL: Bid/ask imbalance — only when RATIO INCREASED vs last run ────
    const prevBidRatio = prev.bidAskRatio || 0;
    const prevAskRatio = prev.askBidRatio || 0;
    newState[tokenId].bidAskRatio = analysis.bidAskRatio;
    newState[tokenId].askBidRatio = analysis.askBidRatio;

    if (!isFirstRun && analysis.bidAskRatio > cfg.OB_IMBALANCE && analysis.bidDepth > 15_000
      && analysis.bidAskRatio > prevBidRatio * 1.2) { // Ratio grew by 20%+ = new accumulation
      signals.push({
        type: 'ob_imbalance', side: 'YES', market: m.question,
        price: (analysis.topBid * 100).toFixed(1),
        bidDepth: analysis.bidDepth.toFixed(0), askDepth: analysis.askDepth.toFixed(0),
        ratio: analysis.bidAskRatio.toFixed(1),
        score: Math.min(10, analysis.bidAskRatio * 1.5),
        strength: analysis.bidAskRatio > 6 ? 'HIGH' : 'MEDIUM',
      });
    }
    if (!isFirstRun && analysis.askBidRatio > cfg.OB_IMBALANCE && analysis.askDepth > 15_000
      && analysis.askBidRatio > prevAskRatio * 1.2) {
      signals.push({
        type: 'ob_imbalance', side: 'NO', market: m.question,
        price: ((1-analysis.topBid) * 100).toFixed(1),
        bidDepth: analysis.bidDepth.toFixed(0), askDepth: analysis.askDepth.toFixed(0),
        ratio: analysis.askBidRatio.toFixed(1),
        score: Math.min(10, analysis.askBidRatio * 1.5),
        strength: analysis.askBidRatio > 6 ? 'HIGH' : 'MEDIUM',
      });
    }

    // ── SIGNAL: Price drift from last run ─────────────────────────────────
    if (!isFirstRun && prev.lastPrice) {
      const drift = analysis.topBid - prev.lastPrice;
      if (Math.abs(drift) > cfg.PRICE_DRIFT) {
        signals.push({
          type: 'price_drift', side: drift > 0 ? 'YES' : 'NO',
          market: m.question,
          from: (prev.lastPrice * 100).toFixed(1), to: (analysis.topBid * 100).toFixed(1),
          drift: (Math.abs(drift) * 100).toFixed(1),
          score: Math.min(10, Math.abs(drift) / cfg.PRICE_DRIFT * 3),
          strength: Math.abs(drift) > 0.08 ? 'HIGH' : 'MEDIUM',
        });
      }
    }
  }

  return { signals, newState };
}

// Volume spike: large trades in last ~500 trade window
async function scanVolumeSpikes(prevVolumes) {
  const signals = [];
  const trades = await get('https://data-api.polymarket.com/trades?limit=500');
  if (!Array.isArray(trades)) return { signals, newVolumes: prevVolumes };

  const marketVol = {};
  for (const t of trades) {
    const size = (t.size || 0) * (t.price || 0);
    if (size < 200) continue;
    const mkt = t.market || t.conditionId;
    if (!mkt) continue;
    if (!marketVol[mkt]) marketVol[mkt] = { total: 0, sides: {}, title: t.title };
    marketVol[mkt].total += size;
    const side = t.outcome || t.side;
    marketVol[mkt].sides[side] = (marketVol[mkt].sides[side] || 0) + size;
  }

  for (const [mkt, info] of Object.entries(marketVol)) {
    if (info.total < cfg.VOL_SPIKE) continue;
    const prev = prevVolumes[mkt] || 0;
    if (info.total <= prev * 1.5) continue; // Уже было

    // Определяем доминирующую сторону
    const dominantSide = Object.entries(info.sides).sort((a,b) => b[1]-a[1])[0]?.[0] || 'YES';
    signals.push({
      type: 'vol_spike',
      market: info.title,
      marketId: mkt,
      volume: info.total.toFixed(0),
      side: dominantSide,
      score: Math.min(10, info.total / cfg.VOL_SPIKE * 4),
      strength: info.total > cfg.VOL_SPIKE * 3 ? 'HIGH' : 'MEDIUM',
    });
  }

  return { signals, newVolumes: marketVol };
}

module.exports = { scanOrderbooks, scanVolumeSpikes };
