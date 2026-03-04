/**
 * edge/modules/cross.js — Cross-market correlation engine
 * If market A moves → check if correlated market B hasn't reacted yet → signal
 */
const { get } = require('./http');
const { getTokenId, groupByTheme } = require('./markets');
const cfg = require('../config');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Hardcoded correlation pairs [trigger, lagging, direction]
// trigger moves UP → lagging should move in same/opposite direction
const CORRELATIONS = [
  // Iran theme
  { trigger: 'iranian regime fall', lagging: 'pahlavi', dir: 1, desc: 'Если режим падает → Пахлави входит' },
  { trigger: 'iran strike', lagging: 'oil', dir: 1, desc: 'Удар по Ирану → нефть растёт' },
  { trigger: 'khamenei', lagging: 'iranian regime', dir: 1, desc: 'Хаменеи = режим' },
  // Ukraine
  { trigger: 'ukraine ceasefire', lagging: 'russia', dir: -1, desc: 'Перемирие = Россия теряет' },
  { trigger: 'kramatorsk', lagging: 'ceasefire', dir: -1, desc: 'Россия берёт Краматорск = переговоры дальше' },
  // US
  { trigger: 'fed cut', lagging: 'bitcoin', dir: 1, desc: 'ФРС снижает = BTC растёт' },
];

async function getPrice(market) {
  const tokenId = getTokenId(market);
  if (!tokenId) return null;
  await sleep(100);
  const book = await get(`https://clob.polymarket.com/book?token_id=${tokenId}`);
  if (!book?.bids?.length) return null;
  return parseFloat(book.bids[0].price);
}

async function scanCrossMarket(markets, prevPrices) {
  const signals = [];
  const newPrices = { ...prevPrices };

  const themes = groupByTheme(markets);
  const allThemed = Object.values(themes).flat();

  // Get current prices for all themed markets
  for (const m of allThemed.slice(0, 20)) {
    const price = await getPrice(m);
    if (price !== null) newPrices[m.id] = { price, question: m.question };
  }

  // Check correlations
  for (const corr of CORRELATIONS) {
    // Find trigger market
    const trigger = allThemed.find(m => (m.question||'').toLowerCase().includes(corr.trigger));
    const lagging = allThemed.find(m => (m.question||'').toLowerCase().includes(corr.lagging) && m !== trigger);
    if (!trigger || !lagging) continue;

    const triggerNow = newPrices[trigger.id]?.price;
    const laggingNow = newPrices[lagging.id]?.price;
    const triggerPrev = prevPrices[trigger.id]?.price;
    const laggingPrev = prevPrices[lagging.id]?.price;

    if (!triggerNow || !laggingNow || !triggerPrev || !laggingPrev) continue;

    const triggerMove = triggerNow - triggerPrev;
    const laggingMove = laggingNow - laggingPrev;
    const expectedLaggingMove = triggerMove * corr.dir;

    // Trigger moved >3% but lagging hasn't moved in expected direction
    if (Math.abs(triggerMove) > 0.03 && Math.abs(laggingMove) < 0.01) {
      const expectedPrice = laggingNow + expectedLaggingMove;
      signals.push({
        type: 'cross_market',
        triggerMarket: trigger.question,
        triggerMove: `${triggerMove > 0 ? '+' : ''}${(triggerMove*100).toFixed(1)}pp`,
        lagMarket: lagging.question,
        currentPrice: (laggingNow * 100).toFixed(1),
        fairPrice: Math.max(1, Math.min(99, expectedPrice * 100)).toFixed(1),
        expectedMove: (Math.abs(expectedLaggingMove) * 100).toFixed(1),
        desc: corr.desc,
        score: Math.min(10, Math.abs(triggerMove) / 0.03 * 4),
        strength: Math.abs(triggerMove) > 0.06 ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  return { signals, newPrices };
}

module.exports = { scanCrossMarket };
