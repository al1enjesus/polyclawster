/**
 * /api/signals — returns persistent signal history
 * GET ?limit=50&minScore=0
 */
'use strict';
const db = require('../lib/db');
const https = require('https');

const GH_TOKEN = process.env.GH_TOKEN || '';
const GH_REPO  = 'al1enjesus/polyclawster';

async function ghGet(file) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${GH_REPO}/contents/${file}`,
      method: 'GET',
      headers: { 'Authorization': 'token ' + GH_TOKEN, 'User-Agent': 'polyclawster' },
      timeout: 7000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.from(JSON.parse(d).content, 'base64').toString())); }
        catch { reject(new Error('parse')); }
      });
    });
    req.on('error', reject).on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const url    = new URL(req.url || '/', 'http://x');
  const limit  = parseInt(url.searchParams.get('limit') || '50');
  const minScore = parseFloat(url.searchParams.get('minScore') || '0');

  try {
    // Try Supabase signals first (live, persistent)
    let signals = [];
    try {
      const sbSigs = await db.getSignals(limit, minScore);
      if (Array.isArray(sbSigs) && sbSigs.length > 0) {
        signals = sbSigs.map(s => ({ ...(s.raw || {}), ...s, id: undefined, raw: undefined }));
      }
    } catch {}

    // Fallback: signals_history.json from GitHub
    if (signals.length === 0) {
      try {
        signals = await ghGet('edge/db/signals_history.json');
      } catch {
        const data = await ghGet('data.json');
        signals = data.signals || [];
      }
    }

    if (!Array.isArray(signals)) signals = [];

    // Filter and sort
    signals = signals
      .filter(s => (s.score || 0) >= minScore)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);

    res.json({ ok: true, count: signals.length, signals });
  } catch (e) {
    res.json({ ok: false, error: e.message, signals: [] });
  }
};
