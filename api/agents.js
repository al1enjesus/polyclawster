/**
 * /api/agents — PolyClawster agent leaderboard
 * Uses workspace_agents table in Supabase
 * 
 * GET  ?action=leaderboard&limit=20
 * POST { action:'register', tgId, name, emoji, strategy }
 * POST { action:'update_pnl', tgId, totalPnl, winRate, totalBets }
 * GET  ?action=my&tgId=123
 */
'use strict';
const db = require('../lib/db');

const WS_ID = 'c27df7f2-8d7e-4d92-97ec-55efd78c6feb'; // PolyClawster workspace

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const url    = new URL(req.url || '/', 'http://x');
  const action = req.method === 'GET'
    ? (url.searchParams.get('action') || 'leaderboard')
    : ((req.body || {}).action || 'register');

  try {
    if (action === 'leaderboard') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const rows = await db._req('GET',
        `workspace_agents?workspace_id=eq.${WS_ID}&order=created_at.asc&limit=${limit}&select=id,display_name,name,tools,skills,credits_used,created_at`
      );
      const agents = (Array.isArray(rows) ? rows : []).map(a => {
        const tools = (a.tools || []).map(t => typeof t === 'string' ? JSON.parse(t) : t);
        const meta = tools.find(t => t.type === 'polymarket_trader') || {};
        return {
          id: a.id,
          display_name: a.display_name || a.name,
          name: a.display_name || a.name,
          emoji: meta.emoji || 'bot',
          strategy: meta.strategy || '',
          total_pnl: parseFloat(meta.pnl || meta.total_pnl || 0),
          win_rate: parseFloat(meta.win_rate || 0),
          total_bets: parseInt(meta.bets || meta.total_bets || 0),
          tg_id: meta.tg_id || null,
          is_public: meta.is_public !== false,
          created_at: a.created_at,
        };
      }).filter(a => a.is_public).sort((a, b) => b.total_pnl - a.total_pnl);

      return res.json({ ok: true, agents });
    }

    if (action === 'register') {
      const { tgId, name, emoji, strategy } = req.body || {};
      if (!tgId || !name) return res.json({ ok: false, error: 'tgId and name required' });

      const rows = await db._req('POST', 'workspace_agents', {
        workspace_id: WS_ID,
        name: String(tgId),
        display_name: (name || '').slice(0, 40),
        role: 'assistant',
        provider: 'polymarket',
        model: 'polyclawster-v1',
        status: 'configured',
        tools: [{
          type: 'polymarket_trader',
          tg_id: parseInt(tgId),
          total_pnl: 0,
          win_rate: 0,
          total_bets: 0,
          emoji: (emoji || 'bot').replace(/[^\w]/g, '').slice(0, 10),
          strategy: (strategy || '').slice(0, 200),
          is_public: true,
        }],
        skills: ['polyclawster-agent'],
      });
      const agent = Array.isArray(rows) ? rows[0] : null;
      return res.json({ ok: true, agent, message: 'Agent "' + name + '" registered! ' });
    }

    if (action === 'update_pnl') {
      const { tgId, totalPnl, winRate, totalBets } = req.body || {};
      if (!tgId) return res.json({ ok: false, error: 'tgId required' });

      // Get existing agent
      const rows = await db._req('GET',
        `workspace_agents?workspace_id=eq.${WS_ID}&name=eq.${tgId}&limit=1&select=id,tools`
      );
      if (!Array.isArray(rows) || !rows[0]) return res.json({ ok: false, error: 'agent not found' });

      const agent = rows[0];
      const tools = (agent.tools || []).map(t => {
        if (t.type === 'polymarket_trader') {
          return { ...t, total_pnl: parseFloat(totalPnl || 0), win_rate: parseFloat(winRate || 0), total_bets: parseInt(totalBets || 0) };
        }
        return t;
      });

      await db._req('PATCH', `workspace_agents?id=eq.${agent.id}`, { tools });
      return res.json({ ok: true });
    }

    if (action === 'my') {
      const tgId = url.searchParams.get('tgId') || (req.body || {}).tgId;
      if (!tgId) return res.json({ ok: false, error: 'tgId required' });
      const rows = await db._req('GET',
        `workspace_agents?workspace_id=eq.${WS_ID}&name=eq.${tgId}&select=id,display_name,tools,created_at&limit=5`
      );
      return res.json({ ok: true, agents: Array.isArray(rows) ? rows : [] });
    }

    res.json({ ok: false, error: 'unknown action' });
  } catch (e) {
    console.error('[agents]', e.message);
    res.json({ ok: false, error: e.message });
  }
};
