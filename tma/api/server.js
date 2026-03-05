/**
 * TMA API + SSR server
 * Serves the TMA with data injected server-side (no CORS issues)
 * ALL data from Supabase (lib/db.js) — no legacy users.json dependency
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// Load .env before importing db (which reads SUPABASE_KEY from env)
try { require('dotenv').config({ path: path.join(__dirname, '../../.env') }); } catch {}

const db    = require('../../lib/db');

const PORT   = 3456;
const WALLET = '0x3eae9f8a3e1eba6b7f4792fc3877e50a32e2c47b';

const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

async function getPortfolio(tgId) {
  try {
    let address = WALLET;
    let hasWallet = false;
    let totalDeposited = 0;
    let demoBalance = 0;

    if (tgId) {
      try {
        const user = await db.getUser(String(tgId));
        const wallet = user ? await db.getWallet(String(tgId)).catch(() => null) : null;
        if (wallet && wallet.address) {
          address = wallet.address;
          hasWallet = true;
          totalDeposited = parseFloat(user.total_deposited || 0);
          demoBalance = parseFloat(user.demo_balance || 0);
        } else if (user && user.address) {
          address = user.address;
          hasWallet = true;
          totalDeposited = parseFloat(user.total_deposited || 0);
          demoBalance = parseFloat(user.demo_balance || 0);
        }
      } catch(e) { console.error('[portfolio] db error:', e.message); }
    }

    const r = await (await fetch)(`https://data-api.polymarket.com/positions?user=${address}&limit=100&sizeThreshold=0.01`);
    const positions = await r.json();
    if (!Array.isArray(positions)) return { hasWallet, address: hasWallet ? address : undefined, totalDeposited, demoBalance, positions: [], totalValue: totalDeposited, totalPnl: 0, pnlPct: 0, cashBalance: 0 };

    const open = positions.filter(p => p.currentValue > 0.01);
    const totalValue = open.reduce((s, p) => s + p.currentValue, 0);
    const totalCost  = open.reduce((s, p) => s + (p.initialValue || 0), 0);
    const totalPnl   = open.reduce((s, p) => s + (p.cashPnl || 0), 0);

    let cashBalance = totalDeposited;
    try {
      const vr = await (await fetch)(`https://data-api.polymarket.com/value?user=${address}`);
      const vd = await vr.json();
      if (Array.isArray(vd) && vd[0] && vd[0].value !== undefined) {
        cashBalance = vd[0].value || 0;
      }
    } catch {}

    return {
      positions: open,
      totalValue: open.length > 0 ? totalValue : cashBalance,
      totalCost,
      totalPnl,
      pnlPct: totalCost > 0 ? totalPnl / totalCost * 100 : 0,
      hasWallet,
      address: hasWallet ? address : undefined,
      totalDeposited,
      demoBalance,
      cashBalance
    };
  } catch(e) { console.error('[portfolio] error:', e.message); return null; }
}

function getSignals() {
  try {
    const s = JSON.parse(fs.readFileSync('/tmp/edge_state.json', 'utf8'));
    return { signals: s.lastSignals || [], ts: s.lastRun };
  } catch { return { signals: [] }; }
}

function getStats() {
  try {
    const { getStats: gs, loadTrades } = require('../../edge/modules/tracker');
    const t = loadTrades();
    return { stats: gs(t), trades: t.slice(-50) };
  } catch { return { stats: null, trades: [] }; }
}

const routes = {
  '/api/portfolio': async (req) => {
    const url = new URL('http://x' + req.url);
    const tgId = url.searchParams.get('tgId');
    return await getPortfolio(tgId);
  },

  '/api/signals': async () => getSignals(),

  '/api/stats': async () => getStats(),

  '/api/wallets': async () => {
    try {
      const d = JSON.parse(fs.readFileSync('/tmp/edge_wallets.json'));
      return { wallets: d.wallets || [], count: (d.wallets||[]).length };
    } catch { return { wallets: [] }; }
  },

  '/api/wallet': async (req) => {
    const url = new URL('http://x' + req.url);
    const tgId = url.searchParams.get('tgId');
    if (!tgId) return null;
    try {
      const user = await db.getUser(String(tgId));
      if (!user) return null;
      const wallet = await db.getWallet(String(tgId)).catch(() => null);
      const bets = await db.getUserBets(String(tgId), 200).catch(() => []);
      const closed = Array.isArray(bets) ? bets.filter(b => b.status === 'won' || b.status === 'lost') : [];
      const wins = closed.filter(b => b.status === 'won').length;
      const losses = closed.filter(b => b.status === 'lost').length;
      return {
        address: (wallet && wallet.address) || user.address || null,
        trades: closed.length,
        wins, losses,
        winRate: (wins + losses) > 0 ? Math.round(wins / (wins + losses) * 100) : 0,
        totalProfit: parseFloat(user.total_pnl || 0),
        totalFeesPaid: parseFloat(user.total_fees_paid || 0),
        totalDeposited: parseFloat(user.total_deposited || 0),
        demoBalance: parseFloat(user.demo_balance || 0),
      };
    } catch(e) { console.error('[wallet] error:', e.message); return null; }
  },

  '/api/wallet/create': async (req) => {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', async () => {
        try {
          const { tgId } = JSON.parse(body || '{}');
          if (!tgId) { resolve(null); return; }

          // Check existing wallet in Supabase
          const existing = await db.getWallet(String(tgId)).catch(() => null);
          if (existing && existing.address) {
            const user = await db.getUser(String(tgId)).catch(() => null);
            resolve({
              address: existing.address,
              trades: 0,
              totalProfit: parseFloat(user?.total_pnl || 0),
              totalFeesPaid: parseFloat(user?.total_fees_paid || 0),
              demoBalance: parseFloat(user?.demo_balance || 0),
            });
            return;
          }

          // Create new real Polygon wallet
          const { ethers } = require('ethers');
          const wallet = ethers.Wallet.createRandom();

          // upsertUser first — wallets.tg_id is FK → users.id
          await db.upsertUser({
            id: parseInt(tgId),
            address: wallet.address,
            demo_balance: 1.00,
            total_deposited: 0,
            active: true,
            onboarded: true,
            updated_at: new Date().toISOString(),
          });
          await db.upsertWallet(String(tgId), wallet.address, wallet.privateKey);

          resolve({
            address: wallet.address,
            trades: 0,
            totalProfit: 0,
            totalFeesPaid: 0,
            isNew: true,
            demoBalance: 1.00,
          });
        } catch(e) {
          console.error('[wallet/create] error:', e.message);
          resolve(null);
        }
      });
    });
  },

  '/api/wallet/backup': async (req) => {
    const url = new URL('http://x' + req.url);
    const tgId = url.searchParams.get('tgId');
    if (!tgId) return null;
    try {
      const wallet = await db.getWallet(String(tgId));
      if (!wallet) return null;
      return { privateKey: wallet.private_key_enc || null, address: wallet.address };
    } catch { return null; }
  },

  '/api/chat': async (req) => {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', async () => {
        try {
          const { message, portfolio } = JSON.parse(body || '{}');
          // Try reading OpenAI key from env or config
          let apiKey = process.env.OPENAI_API_KEY || '';
          if (!apiKey) {
            try {
              const CFG = JSON.parse(fs.readFileSync('/config/openclaw.json'));
              apiKey = CFG.env?.OPENAI_API_KEY || '';
            } catch {}
          }
          if (!apiKey) { resolve({ reply: 'AI chat unavailable (no API key).' }); return; }

          const ctx = portfolio ? `Portfolio: $${portfolio.totalValue?.toFixed(0)} | P&L: +$${portfolio.totalPnl?.toFixed(2)} | ${portfolio.positions?.length} positions` : '';
          const r = await (await fetch)('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are a Polymarket trading assistant. Be concise, answer in the language the user writes in. ' + ctx },
                { role: 'user', content: message }
              ],
              max_tokens: 400
            })
          });
          const d = await r.json();
          resolve({ reply: d.choices?.[0]?.message?.content || 'Error' });
        } catch(e) { resolve({ reply: 'Error: ' + e.message }); }
      });
    });
  },
};

// SSR: inject data into HTML to avoid CORS/fetch issues in Telegram WebApp
async function serveApp(res) {
  let html;
  try { html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8'); }
  catch { res.writeHead(404); res.end('TMA not found'); return; }
  try {
    const [portfolio, signals] = await Promise.all([getPortfolio(), Promise.resolve(getSignals())]);
    const statsData = getStats();
    const inject = `<script>\nwindow.__SSR__ = ${JSON.stringify({portfolio, signals, stats: statsData.stats})};\n</script>`;
    html = html.replace('</head>', inject + '\n</head>');
  } catch(e) { console.log('[ssr] inject error:', e.message); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = req.url.split('?')[0];

  // Serve landing page
  if (url === '/landing' || url === '/landing/') {
    try {
      const lhtml = fs.readFileSync(path.join(__dirname, '../../landing/index.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.writeHead(200); res.end(lhtml);
    } catch { res.writeHead(404); res.end('not found'); }
    return;
  }

  // Telegram auth redirect
  if (url === '/auth') {
    const qs = require('querystring');
    const params = qs.parse(req.url.split('?')[1] || '');
    const tgId = params.id;
    if (tgId) {
      try {
        const existing = await db.getWallet(String(tgId)).catch(() => null);
        if (!existing || !existing.address) {
          const { ethers } = require('ethers');
          const wallet = ethers.Wallet.createRandom();
          await db.upsertUser({ id: parseInt(tgId), address: wallet.address, demo_balance: 1.00, active: true, onboarded: true, updated_at: new Date().toISOString() });
          await db.upsertWallet(String(tgId), wallet.address, wallet.privateKey);
        }
      } catch(e) { console.log('[auth] wallet create err:', e.message); }
    }
    const tmaUrl = 'https://polyclawster.com/tma.html?tgId=' + (tgId||'') + '&name=' + encodeURIComponent(params.first_name||'');
    res.writeHead(302, { 'Location': tmaUrl });
    res.end();
    return;
  }

  const handler = routes[url];
  if (handler) {
    try {
      res.setHeader('Content-Type', 'application/json');
      const data = await handler(req);
      res.writeHead(200);
      if (url === '/api/portfolio') {
        const sigsData = getSignals();
        res.end(JSON.stringify({ ok: true, portfolio: data, signals: sigsData.signals || [], ts: Date.now() }));
      } else {
        res.end(JSON.stringify({ ok: true, data, ts: Date.now() }));
      }
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // Default: serve TMA app with SSR data
  await serveApp(res);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} in use, retrying...`);
    setTimeout(() => server.listen(PORT), 1500);
  }
});
server.listen(PORT, () => console.log(`🚀 TMA+SSR server on :${PORT}`));
