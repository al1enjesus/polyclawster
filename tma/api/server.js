/**
 * TMA API + SSR server
 * Serves the TMA with data injected server-side (no CORS issues)
 */
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { getStats, loadTrades } = require('../../edge/modules/tracker');

const PORT   = 3456;
const WALLET = '0x3eae9f8a3e1eba6b7f4792fc3877e50a32e2c47b';

const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

async function getPortfolio(tgId) {
  try {
    // Determine which address to query
    let address = WALLET;
    let userData = null;
    let hasWallet = false;
    let totalDeposited = 0;
    let demoBalance = 0;

    if (tgId) {
      try {
        const { getUser } = require('../../edge/modules/users');
        const u = getUser(String(tgId));
        if (u && u.address) {
          address = u.address;
          hasWallet = true;
          totalDeposited = u.totalDeposited || 0;
          userData = u;
        }
      } catch(e) { /* fallback to WALLET */ }
    }

    const r = await (await fetch)(`https://data-api.polymarket.com/positions?user=${address}&limit=100&sizeThreshold=0.01`);
    const positions = await r.json();
    if (!Array.isArray(positions)) return { hasWallet, address, totalDeposited, positions: [], totalValue: totalDeposited, totalPnl: 0, pnlPct: 0 };
    
    const open = positions.filter(p => p.currentValue > 0.01);
    const totalValue = open.reduce((s, p) => s + p.currentValue, 0);
    const totalCost  = open.reduce((s, p) => s + (p.initialValue || 0), 0);
    const totalPnl   = open.reduce((s, p) => s + (p.cashPnl || 0), 0);
    
    // Also fetch cash balance from Polymarket
    let cashBalance = totalDeposited; // default to deposited amount
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
      cashBalance
    };
  } catch(e) { return null; }
}

function getSignals() {
  try {
    const s = JSON.parse(fs.readFileSync('/tmp/edge_state.json', 'utf8'));
    return { signals: s.lastSignals || [], ts: s.lastRun };
  } catch { return { signals: [] }; }
}

const routes = {
  '/api/portfolio': async (req) => { const url = new URL('http://x' + req.url); const tgId = url.searchParams.get('tgId'); return await getPortfolio(tgId); },
  '/api/signals':   async () => getSignals(),
  '/api/stats':     async () => { const t = loadTrades(); return { stats: getStats(t), trades: t.slice(-50) }; },
  '/api/wallets':   async () => { try { const d = JSON.parse(fs.readFileSync('/tmp/edge_wallets.json')); return { wallets: d.wallets || [], count: (d.wallets||[]).length }; } catch { return { wallets: [] }; } },


  '/auth': async (req) => {
    // Telegram Login Widget callback
    // После авторизации Telegram редиректит сюда с параметрами
    // Мы создаём кошелёк и редиректим в TMA
    return '__REDIRECT__';
  },
  '/api/wallet': async (req) => {
    const url = new URL('http://x' + req.url);
    const tgId = url.searchParams.get('tgId');
    if (!tgId) return null;
    try {
      const { getUser, getUserStats } = require('../../edge/modules/users');
      const u = getUser(tgId);
      if (!u) return null;
      const stats = getUserStats(tgId);
      return { address: u.address, ...stats };
    } catch { return null; }
  },
  '/api/wallet/create': async (req) => {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', () => {
        try {
          const { tgId } = JSON.parse(body || '{}');
          const { getUser, registerWallet } = require('../../edge/modules/users');
          const existing = getUser(tgId);
          if (existing) { resolve({ address: existing.address, trades: existing.trades?.length || 0, totalProfit: existing.totalProfit || 0, totalFeesPaid: existing.totalFeesPaid || 0 }); return; }
          const { ethers } = require('ethers');
          const wallet = ethers.Wallet.createRandom();
          const result = registerWallet(tgId, wallet.privateKey);
          if (result.ok) resolve({ address: result.address, trades: 0, totalProfit: 0, totalFeesPaid: 0, isNew: true });
          else resolve(null);
        } catch(e) { resolve(null); }
      });
    });
  },
  '/api/wallet/backup': async (req) => {
    const url = new URL('http://x' + req.url);
    const tgId = url.searchParams.get('tgId');
    if (!tgId) return null;
    try {
      const { getUser } = require('../../edge/modules/users');
      const u = getUser(tgId);
      if (!u) return null;
      return { privateKey: u.privateKey, address: u.address };
    } catch { return null; }
  },
  '/api/chat': async (req) => {
    const { handleChat } = require('./chat');
    return handleChat(req);
  },
    '/api/wallet': async (req) => {
    const url = new URL('http://x' + req.url);
    const tgId = url.searchParams.get('tgId');
    if (!tgId) return null;
    try {
      const { getUser, getUserStats } = require('../../edge/modules/users');
      const u = getUser(tgId);
      if (!u) return null;
      const stats = getUserStats(tgId);
      return { address: u.address, ...stats };
    } catch { return null; }
  },
  '/api/wallet/create': async (req) => {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', () => {
        try {
          const { tgId } = JSON.parse(body || '{}');
          const { getUser, registerWallet } = require('../../edge/modules/users');
          const existing = getUser(tgId);
          if (existing) { resolve({ address: existing.address, trades: existing.trades?.length || 0, totalProfit: existing.totalProfit || 0, totalFeesPaid: existing.totalFeesPaid || 0 }); return; }
          const { ethers } = require('ethers');
          const wallet = ethers.Wallet.createRandom();
          const result = registerWallet(tgId, wallet.privateKey);
          if (result.ok) resolve({ address: result.address, trades: 0, totalProfit: 0, totalFeesPaid: 0, isNew: true });
          else resolve(null);
        } catch(e) { resolve(null); }
      });
    });
  },
  '/api/wallet/backup': async (req) => {
    const url = new URL('http://x' + req.url);
    const tgId = url.searchParams.get('tgId');
    if (!tgId) return null;
    try {
      const { getUser } = require('../../edge/modules/users');
      const u = getUser(tgId);
      if (!u) return null;
      return { privateKey: u.privateKey, address: u.address };
    } catch { return null; }
  },
  '/api/chat':      async (req) => new Promise((resolve) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const { message, portfolio } = JSON.parse(body || '{}');
        const CFG = JSON.parse(fs.readFileSync('/config/openclaw.json'));
        const ctx = portfolio ? `Portfolio: $${portfolio.totalValue?.toFixed(0)} | P&L: +$${portfolio.totalPnl?.toFixed(2)} | ${portfolio.positions?.length} positions` : '';
        const r = await (await fetch)('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + CFG.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
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
  }),
};

// SSR: inject data into HTML to avoid CORS/fetch issues in Telegram WebApp
async function serveApp(res) {
  let html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  try {
    const [portfolio, signals] = await Promise.all([getPortfolio(), Promise.resolve(getSignals())]);
    const stats = (() => { try { const t = loadTrades(); return getStats(t); } catch { return null; } })();
    // Inject as window globals before </head>
    const inject = `<script>
window.__SSR__ = ${JSON.stringify({portfolio, signals, stats})};
</script>`;
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
      const lhtml = fs.readFileSync('/workspace/landing/index.html', 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.writeHead(200); res.end(lhtml);
    } catch { res.writeHead(404); res.end('not found'); }
    return;
  }

  // Handle Telegram auth redirect
  if (url === '/auth') {
    const qs = require('querystring');
    const params = qs.parse(req.url.split('?')[1] || '');
    const tgId = params.id;
    if (tgId) {
      try {
        const { getUser, registerWallet } = require('../../edge/modules/users');
        const existing = getUser(tgId);
        if (!existing) {
          const { ethers } = require('ethers');
          const wallet = ethers.Wallet.createRandom();
          registerWallet(tgId, wallet.privateKey);
        }
      } catch(e) { console.log('[auth] wallet create err:', e.message); }
    }
    // Redirect to TMA with user data
    const tmaUrl = 'https://polyclawster.vercel.app/tma.html?tgId=' + (tgId||'') + '&name=' + encodeURIComponent(params.first_name||'');
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
      // /api/portfolio returns flat shape: { ok, portfolio, signals }
      if (url === '/api/portfolio') {
        const sigsData = getSignals();
        res.end(JSON.stringify({
          ok: true,
          portfolio: data,
          signals: sigsData.signals || [],
          ts: Date.now()
        }));
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
