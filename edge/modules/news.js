/**
 * edge/modules/news.js — News → market price gap detection
 * Pulls Perplexity news, finds markets where price doesn't reflect reality
 */
const { get } = require('./http');
const { post } = require('./http');
const { isSports } = require('./markets');
const cfg = require('../config');

async function fetchNews(topics = ['Iran war', 'Khamenei successor', 'US Israel ceasefire', 'Ukraine Russia']) {
  const query = topics.join(', ');
  const resp = await post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: 'sonar',
      messages: [{
        role: 'user',
        content: `Breaking news today about: ${query}.
List each major development in ONE line: [topic] headline. Be very brief.
Focus only on facts that could move prediction market prices.
Max 8 items.`
      }],
      search_recency_filter: 'day',
    },
    { Authorization: `Bearer ${cfg.PPLX_KEY}` }
  );
  return resp?.choices?.[0]?.message?.content || '';
}

async function findNewsEdge(markets, news) {
  if (!news) return [];
  const signals = [];

  // Simple keyword matching between news and market questions
  const newsLines = news.split('\n').filter(l => l.trim().length > 20);

  for (const line of newsLines) {
    const lineLower = line.toLowerCase();

    for (const m of markets) {
      if (isSports(m.question)) continue;
      const q = (m.question || '').toLowerCase();

      // Find if this news is relevant to this market
      const overlap = q.split(' ').filter(w => w.length > 4 && lineLower.includes(w)).length;
      if (overlap < 2) continue;

      const prices = JSON.parse(m.outcomePrices || '[]');
      const currentPrice = parseFloat(prices[0] || 0);
      if (currentPrice < 0.05 || currentPrice > 0.95) continue; // Skip already resolved

      // Determine if news is bullish or bearish for YES
      const bullishWords = ['confirms', 'falls', 'collapses', 'ceasefire', 'deal', 'agree', 'win', 'victory', 'succeed'];
      const bearishWords = ['denies', 'rejects', 'fails', 'continues', 'escalates', 'refuses'];

      const isBullish = bullishWords.some(w => lineLower.includes(w));
      const isBearish = bearishWords.some(w => lineLower.includes(w));
      if (!isBullish && !isBearish) continue;

      const expectedShift = isBullish ? 0.10 : -0.10;
      const fairPrice = Math.max(0.02, Math.min(0.98, currentPrice + expectedShift));
      const edgePct = Math.abs(fairPrice - currentPrice) * 100;

      if (edgePct > 5) {
        signals.push({
          type: 'news_edge',
          market: m.question,
          headline: line.trim(),
          currentPrice: (currentPrice * 100).toFixed(1),
          fairPrice: (fairPrice * 100).toFixed(1),
          side: isBullish ? 'YES' : 'NO',
          edgePct: edgePct.toFixed(0),
          score: Math.min(10, edgePct / 5 * 3 + overlap),
          strength: edgePct > 12 ? 'HIGH' : 'MEDIUM',
        });
      }
    }
  }

  // Deduplicate by market
  const seen = new Set();
  return signals.filter(s => { if (seen.has(s.market)) return false; seen.add(s.market); return true; });
}

module.exports = { fetchNews, findNewsEdge };
