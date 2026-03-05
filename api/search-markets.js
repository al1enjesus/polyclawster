/**
 * /api/search-markets — Search Polymarket markets via Gamma API
 * GET ?q=bitcoin&limit=10
 * 
 * If q is empty, returns top markets by 24h volume.
 * If q is provided, fetches top ~200 markets and filters by question text.
 */
'use strict';
const https = require('https');

function gammaGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'gamma-api.polymarket.com',
      path,
      headers: { 'User-Agent': 'polyclawster/1.0' },
      timeout: 12000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve([]); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url || '/', 'http://x');
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20') || 20, 100);

  try {
    // Fetch top markets by volume (200 to have enough for filtering)
    const fetchLimit = q ? 200 : limit;
    const raw = await gammaGet(
      `/markets?limit=${fetchLimit}&active=true&closed=false&order=volume24hr&ascending=false`
    );

    if (!Array.isArray(raw)) {
      return res.json({ ok: false, error: 'Gamma API returned unexpected data' });
    }

    // Filter by query if provided
    let filtered = raw;
    if (q) {
      filtered = raw.filter(m => 
        (m.question || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q)
      );
    }

    // Map to clean format
    const markets = filtered.slice(0, limit).map(m => {
      let tokenIds = [];
      try { tokenIds = JSON.parse(m.clobTokenIds || '[]'); } catch {}
      return {
        question: m.question || '',
        slug: m.slug || '',
        conditionId: m.conditionId || '',
        tokenIds,
        bestBid: parseFloat(m.bestBid || 0),
        bestAsk: parseFloat(m.bestAsk || 0),
        volume24hr: parseFloat(m.volume24hr || 0),
        endDate: m.endDate || null,
      };
    });

    return res.json({ ok: true, markets, count: markets.length, query: q || null });
  } catch (e) {
    console.error('[search-markets] error:', e.message);
    return res.json({ ok: false, error: e.message });
  }
};
