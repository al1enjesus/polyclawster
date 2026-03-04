/**
 * /api/chat — AI chat proxy via Perplexity sonar
 * POST { messages: [{role, content}], tgId }
 */
'use strict';
const https = require('https');

const PPLX_KEY = process.env.PPLX_KEY || '';
const MODEL    = 'sonar';

const SYSTEM_PROMPT = `You are PolyEdge AI — a prediction market assistant specialized in Polymarket.
You help users understand prediction markets, analyze probabilities, and make informed trading decisions.
You have access to real-time web search to find current events and market news.
Keep responses concise and actionable. When discussing markets, mention current prices if known.
Format: use short paragraphs, no markdown headers. Be direct.`;

function pplxRequest(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 400,
      temperature: 0.2,
      search_recency_filter: 'day',
    });

    const req = https.request({
      hostname: 'api.perplexity.ai',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + PPLX_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 20000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error('parse error: ' + d.slice(0, 100))); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { messages = [], tgId } = req.body || {};
    if (!messages.length) { res.json({ ok: false, error: 'No messages' }); return; }

    // Keep last 10 messages for context
    const trimmed = messages.slice(-10).map(m => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 1000),
    }));

    const result = await pplxRequest(trimmed);
    const reply  = result?.choices?.[0]?.message?.content || '';

    if (!reply) throw new Error('Empty response from AI');

    res.json({ ok: true, reply, model: MODEL });

  } catch (e) {
    console.error('[chat]', e.message);
    res.json({ ok: false, error: e.message });
  }
};
