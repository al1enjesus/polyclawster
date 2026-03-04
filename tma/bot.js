/**
 * tma/bot.js — PolyClawsterBot Telegram handler
 * Polling + referral + wallet commands + group broadcast
 */
'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BOT_TOKEN  = process.env.BOT_TOKEN || '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';
const TMA_URL    = 'https://polyclawster.vercel.app/tma.html';
const USERS_PATH = '/workspace/users.json';
const DATA_PATH  = '/workspace/data.json';

let offset = 0;

// ── utils ──────────────────────────────────────────────────────
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); } catch { return {}; }
}
function saveUsers(u) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(u, null, 2));
  syncUsersToGitHub(u).catch(e => console.log('[bot] gh sync failed:', e.message));
}

const GH_TOKEN_BOT = process.env.GH_TOKEN || '';
const GH_REPO_BOT  = 'al1enjesus/polyclawster';

async function syncUsersToGitHub(users) {
  const content = JSON.stringify(users, null, 2);
  const sha = await new Promise((resolve) => {
    const r = https.request({
      hostname:'api.github.com', path:`/repos/${GH_REPO_BOT}/contents/users.json`,
      method:'GET', headers:{'Authorization':'token '+GH_TOKEN_BOT,'User-Agent':'polyclawster-bot'}, timeout:8000
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d).sha);}catch{resolve(null);} }); });
    r.on('error',()=>resolve(null)); r.on('timeout',()=>{r.destroy();resolve(null);}); r.end();
  });
  const body = JSON.stringify({ message: 'users: bot update', content: Buffer.from(content).toString('base64'), ...(sha?{sha}:{}) });
  await new Promise((resolve, reject) => {
    const r = https.request({
      hostname:'api.github.com', path:`/repos/${GH_REPO_BOT}/contents/users.json`,
      method:'PUT', headers:{'Authorization':'token '+GH_TOKEN_BOT,'User-Agent':'polyclawster-bot','Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}, timeout:12000
    }, res => { res.resume(); res.on('end',resolve); });
    r.on('error',reject); r.on('timeout',()=>{r.destroy();reject(new Error('timeout'));});
    r.write(body); r.end();
  });
  console.log('[bot] users.json synced to GitHub ✅');
}
function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch { return {}; }
}

function tgPost(method, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/' + method,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendMsg(chatId, text, extra = {}) {
  return tgPost('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', ...extra });
}

// ── referral ───────────────────────────────────────────────────
function applyReferral(newId, refId) {
  if (String(newId) === String(refId)) return false;
  const users = loadUsers();
  const nk = String(newId), rk = String(refId);
  // Не применяем дважды
  if (users[nk]?.referredBy) return false;
  // Реферер должен существовать
  if (!users[rk]) return false;
  // Создаём нового юзера если нет
  if (!users[nk]) {
    users[nk] = { telegramId: nk, createdAt: new Date().toISOString() };
  }
  users[nk].referredBy = rk;
  users[rk].refCount = (users[rk].refCount || 0) + 1;
  saveUsers(users);
  return true;
}

// Создаёт/обновляет запись юзера при /start
function ensureUser(fromObj) {
  const users = loadUsers();
  const uid = String(fromObj.id);
  if (!users[uid]) {
    users[uid] = {
      telegramId: uid,
      username: fromObj.username || null,
      firstName: fromObj.first_name || null,
      createdAt: new Date().toISOString(),
    };
    saveUsers(users);
  } else if (fromObj.username && !users[uid].username) {
    users[uid].username = fromObj.username;
    users[uid].firstName = fromObj.first_name || users[uid].firstName;
    saveUsers(users);
  }
  return users[uid];
}

// ── commands ───────────────────────────────────────────────────
async function handleCommand(msg) {
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();
  const from   = msg.from || {};
  const cmd    = text.split(' ')[0].replace('@PolyClawsterBot', '').toLowerCase();

  // /start
  if (cmd === '/start') {
    const param = text.split(' ')[1] || '';
    if (param.startsWith('ref_')) {
      const refId = param.replace('ref_', '');
      ensureUser(from);
      const applied = applyReferral(from.id, refId);
      // Уведомляем реферера если реф сработал
      if (applied) {
        const name = from.username ? '@' + from.username : (from.first_name || 'Someone');
        sendMsg(refId,
          '\u{1F389} *New referral!*\n\n' +
          name + ' just joined via your link!\n\n' +
          '\u{1F4B0} You earn *40% of all commissions* from their trades.\n' +
          '_Paid automatically when they profit._'
        ).catch(() => {});
      }
      await sendMsg(chatId,
        '\u{1F44B} *Welcome to PolyClawster!*\n\n' +
        (applied ? '\u{1F381} *You were invited by a friend*\nYou\'ll get a $10 bonus on your first deposit!\n\n' : '') +
        'AI agent trading on Polymarket prediction markets.\n\n' +
        '📊 *What you can do:*\n' +
        '• View live trading signals\n' +
        '• Track smart money wallets\n' +
        '• Let AI trade for you\n\n' +
        'Start by creating your wallet or explore the dashboard:',
        { reply_markup: { inline_keyboard: [
          [{ text: '\u{1F680} Create Wallet Free', callback_data: 'create_wallet' }],
          [{ text: '\u{1F4CA} Open Dashboard', web_app: { url: TMA_URL } }]
        ]}}
      );
      return;
    }
    ensureUser(from);
    await sendMsg(chatId,
      '\u{1F44B} *Welcome to PolyClawster!*\n\n' +
      'AI agent trading on Polymarket prediction markets.\n\n' +
      '📊 *What you can do:*\n' +
      '• View live trading signals\n' +
      '• Track smart money wallets\n' +
      '• Let AI trade for you\n\n' +
      'Start by creating your wallet or explore:',
      { reply_markup: { inline_keyboard: [
        [{ text: '\u{1F680} Create Wallet Free', callback_data: 'create_wallet' }],
        [{ text: '\u{1F4CA} Open Dashboard', web_app: { url: TMA_URL } }],
        [{ text: '\u{1F4E1} Signals', callback_data: 'signals' },
         { text: '\u{1F381} Referral', callback_data: 'ref' }]
      ]}}
    );
    return;
  }

  // /portfolio
  if (cmd === '/portfolio') {
    const d = loadData();
    const positions = d.positions || [];
    if (!positions.length) { await sendMsg(chatId, '\u{1F4CA} No positions yet.'); return; }
    const totalPnl = d.totalPnl || 0;
    const totalVal = d.totalValue || 0;
    const pnlSign  = totalPnl >= 0 ? '+' : '';
    const lines = positions.sort((a,b) => b.currentValue - a.currentValue).slice(0, 8).map(p => {
      const pnl  = p.cashPnl || 0;
      const icon = pnl >= 0 ? '\u{1F7E2}' : '\u{1F534}';
      return icon + ' ' + (p.title || '').slice(0, 40) + ' | ' + (p.outcome || '') +
             ' @ ' + ((p.curPrice || 0) * 100).toFixed(0) + '\u00A2 | ' +
             (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(2);
    }).join('\n');
    await sendMsg(chatId,
      '\u{1F4CA} *Portfolio*\n' +
      positions.length + ' positions | $' + totalVal.toFixed(0) +
      ' | *' + pnlSign + '$' + totalPnl.toFixed(2) + '*\n\n' + lines,
      { reply_markup: { inline_keyboard: [[{ text: '\u{1F4CA} Full Dashboard', web_app: { url: TMA_URL } }]] }}
    );
    return;
  }

  // /signals
  if (cmd === '/signals') {
    const d = loadData();
    const sigs = (d.signals || []).slice(0, 5);
    if (!sigs.length) { await sendMsg(chatId, '\u{1F4E1} No active signals right now.'); return; }
    const lines = sigs.map(s => {
      const icon = (s.score || 0) >= 8 ? '\u{1F534}' : '\u{1F7E1}';
      return icon + ' Score ' + (s.score || 0).toFixed(1) + '/10 | ' + (s.market || s.title || '').slice(0, 50);
    }).join('\n');
    await sendMsg(chatId, '\u{1F4E1} *Signals*\n\n' + lines);
    return;
  }

  // /wallet
  if (cmd === '/wallet') {
    const users = loadUsers();
    const user  = users[String(from.id)];
    if (!user || !user.address) {
      await sendMsg(chatId, '\u{1F4BC} You don\'t have a wallet yet.\n\nCreate one instantly — it\'s free:',
        { reply_markup: { inline_keyboard: [
          [{ text: '\u{1F680} Create Wallet Free', callback_data: 'create_wallet' }],
          [{ text: '\u{1F4CA} Open Dashboard', web_app: { url: TMA_URL } }]
        ]}}
      );
    } else {
      const bal = (user.totalValue || 0).toFixed(2);
      const pnl = (user.totalPnl   || 0);
      const ps  = pnl >= 0 ? '+' : '';
      await sendMsg(chatId,
        '\u{1F4BC} *Your Wallet*\n\n' +
        '\u{1F4B0} Balance: *$' + bal + '*\n' +
        '\u{1F4C8} P&L: *' + ps + '$' + pnl.toFixed(2) + '*\n' +
        '\u{1F517} `' + user.address + '`\n\n' +
        '_Polygon network \u00B7 USDC.e_',
        { reply_markup: { inline_keyboard: [[{ text: '\u{1F4CA} Open Dashboard', web_app: { url: TMA_URL } }]] }}
      );
    }
    return;
  }

  // /ref /referral
  if (cmd === '/ref' || cmd === '/referral') {
    const users   = loadUsers();
    const user    = users[String(from.id)] || {};
    const count   = user.refCount   || 0;
    const earned  = user.refEarned  || 0;
    const refLink = 'https://t.me/PolyClawsterBot?start=ref_' + from.id;
    await sendMsg(chatId,
      '\u{1F381} *Referral Program*\n\n' +
      'Invite friends \u2014 earn $10 for each who deposits.\n\n' +
      '\u{1F4CA} Your stats:\n' +
      '\u2022 Invited: *' + count + '* friends\n' +
      '\u2022 Earned: *$' + earned.toFixed(2) + '*\n\n' +
      '\u{1F517} Your link:\n`' + refLink + '`',
      { reply_markup: { inline_keyboard: [[{ text: '\u{1F4CA} Open Dashboard', web_app: { url: TMA_URL } }]] }}
    );
    return;
  }

  // /stats
  if (cmd === '/stats') {
    const d = loadData();
    const s = d.stats;
    if (!s) { await sendMsg(chatId, '\u{1F4CA} No closed positions yet.'); return; }
    await sendMsg(chatId,
      '\u{1F4CA} *Stats*\n' +
      'Trades: ' + s.total + ' | WR: *' + s.winRate + '%* (' + s.wins + 'W/' + s.losses + 'L)\n' +
      'Total P&L: *' + (s.totalPnl > 0 ? '+' : '') + '$' + s.totalPnl + '*\n' +
      'ROI: *' + s.roi + '%*\n' +
      'Avg win: +$' + s.avgWin
    );
    return;
  }


  // /create_wallet — создаёт кошелёк прямо из бота
  if (cmd === '/create_wallet' || cmd === '/createwallet') {
    const users = loadUsers();
    const uid   = String(from.id);
    if (users[uid]?.address) {
      const u = users[uid];
      await sendMsg(chatId,
        '\u{1F4BC} *Your Wallet*\n\n' +
        '\u{1F517} `' + u.address + '`\n' +
        '\u{1F4B0} Balance: *$' + (u.totalValue||0).toFixed(2) + '*\n' +
        '\u{1F4C8} P&L: *' + ((u.totalPnl||0)>=0?'+':'') + '$' + (u.totalPnl||0).toFixed(2) + '*\n\n' +
        '_Polygon \u00B7 USDC.e_',
        { reply_markup: { inline_keyboard: [[{ text: '\u{1F4CA} Open Dashboard', web_app: { url: TMA_URL } }]] }}
      );
      return;
    }
    // Создаём кошелёк
    await sendMsg(chatId, '\u23F3 Creating your wallet...');
    const crypto = require('crypto');
    let address, privKeyHex;
    try {
      const privKeyBytes = crypto.randomBytes(32);
      privKeyHex = privKeyBytes.toString('hex');
      try {
        const { ethers } = require('ethers');
        address = new ethers.Wallet('0x' + privKeyHex).address;
      } catch {
        const hash = crypto.createHash('sha256').update(privKeyBytes).digest('hex');
        address = '0x' + hash.slice(0, 40);
      }
    } catch(e) {
      await sendMsg(chatId, '\u274C Error creating wallet: ' + e.message);
      return;
    }
    users[uid] = {
      telegramId: uid, address, privateKey: '0x' + privKeyHex,
      totalDeposited: 0, totalValue: 0, totalPnl: 0, totalProfit: 0,
      totalFeesPaid: 0, trades: [], active: true,
      createdAt: new Date().toISOString(),
    };
    saveUsers(users);
    await sendMsg(chatId,
      '\u2705 *Wallet created!*\n\n' +
      '\u{1F517} `' + address + '`\n\n' +
      '_Polygon network \u00B7 USDC.e_\n\n' +
      'Send USDC.e to this address to deposit.\nMinimum deposit: *$10*',
      { reply_markup: { inline_keyboard: [[{ text: '\u{1F4CA} Open Dashboard', web_app: { url: TMA_URL } }]] }}
    );
    return;
  }

  // /dashboard
  if (cmd === '/dashboard') {
    await sendMsg(chatId, '\u{1F4CA} Open Dashboard:',
      { reply_markup: { inline_keyboard: [[{ text: '\u{1F4CA} PolyClawster Dashboard', web_app: { url: TMA_URL } }]] }}
    );
    return;
  }
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  await tgPost('answerCallbackQuery', { callback_query_id: query.id });
  const fakeMsg = { chat: { id: chatId }, from: query.from, text: '/' + query.data };
  await handleCommand(fakeMsg);
}

// ── Group join ─────────────────────────────────────────────────
const GROUPS_FILE = '/workspace/edge/db/bot_groups.json';
function loadGroups() { try { return JSON.parse(fs.readFileSync(GROUPS_FILE)); } catch { return []; } }
function saveGroups(g) { fs.writeFileSync(GROUPS_FILE, JSON.stringify(g)); }

async function handleGroupJoin(msg) {
  const chatId = msg.chat?.id;
  if (!chatId) return;
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    const groups = loadGroups();
    if (!groups.includes(chatId)) {
      groups.push(chatId);
      saveGroups(groups);
      await tgPost('sendMessage', {
        chat_id: chatId,
        text: '\u{1F44B} *PolyEdge is active!*\n\nI will send signal alerts here when AI detects strong Polymarket opportunities (score 8+).',
        parse_mode: 'Markdown'
      });
    }
  }
}

// ── Broadcast ─────────────────────────────────────────────────
const SEEN_FILE = '/workspace/edge/db/bot_broadcast_seen.json';

async function broadcastToGroups() {
  const groups = loadGroups();
  if (!groups.length) return;
  try {
    const data   = loadData();
    const strong = (data.signals || []).filter(s => (s.score || 0) >= 8);
    if (!strong.length) return;

    const top = strong[0];
    let seen = [];
    try { seen = JSON.parse(fs.readFileSync(SEEN_FILE)); } catch {}
    const key = (top.market || top.title || '').slice(0, 40) + (top.score || 0);
    if (seen.includes(key)) return;
    seen.push(key);
    if (seen.length > 50) seen = seen.slice(-50);
    fs.writeFileSync(SEEN_FILE, JSON.stringify(seen));

    const score = top.score || 0;
    const icon  = score >= 8 ? '\u{1F534}' : '\u{1F7E1}';
    const type  = (top.type || '').replace('_', ' ').toUpperCase();
    const mkt   = (top.market || top.title || '').slice(0, 70);
    const side  = top.side ? ' \u00B7 ' + top.side : '';
    const text  =
      icon + ' *POLYEDGE SIGNAL* \u00B7 Score ' + score.toFixed(1) + '/10\n' +
      '*' + type + '*' + side + '\n\n' +
      '\u{1F4CC} ' + mkt + '\n' +
      (top.newsContext ? '_' + top.newsContext.slice(0, 100) + '_\n' : '') +
      '\n[Open PolyClawster](https://t.me/PolyClawsterBot)';

    for (const gid of groups) {
      try {
        await tgPost('sendMessage', { chat_id: gid, text, parse_mode: 'Markdown', disable_web_page_preview: true });
        await new Promise(r => setTimeout(r, 500));
      } catch(e) {
        if ((e.message || '').includes('kicked') || (e.message || '').includes('not a member')) {
          saveGroups(loadGroups().filter(id => id !== gid));
        }
      }
    }
    console.log('[broadcast] sent to', groups.length, 'groups:', key.slice(0, 40));
  } catch(e) { console.log('[broadcast] err:', e.message?.slice(0, 60)); }
}

// ── Polling ────────────────────────────────────────────────────
async function poll() {
  try {
    const res = await tgPost('getUpdates', { offset, limit: 10, timeout: 20 });
    if (!res.ok) { await new Promise(r => setTimeout(r, 3000)); return; }
    for (const upd of res.result) {
      offset = upd.update_id + 1;
      if (upd.message?.text?.startsWith('/')) await handleCommand(upd.message);
      if (upd.callback_query) await handleCallback(upd.callback_query);
      if (upd.message?.new_chat_members?.some(m => m.username === 'PolyClawsterBot')) {
        await handleGroupJoin(upd.message);
      }
    }
  } catch(e) {
    console.log('[bot] poll error:', (e.message || '').slice(0, 60));
    await new Promise(r => setTimeout(r, 3000));
  }
}

setInterval(broadcastToGroups, 30 * 60 * 1000);

console.log('\u{1F916} PolyClawsterBot started');
(async () => { while(true) await poll(); })();

// ═══ INTERNAL HTTP API (for Vercel serverless to write users.json) ═══
const http = require('http');
const INTERNAL_SECRET = 'pc_internal_8xK2mN9p';

const apiServer = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end('{}'); return; }
  if (req.method !== 'POST')    { res.writeHead(405); res.end('{"ok":false}'); return; }

  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    try {
      const { secret, action, tgId, data } = JSON.parse(body);
      if (secret !== INTERNAL_SECRET) { res.writeHead(403); res.end('{"ok":false,"error":"forbidden"}'); return; }

      const users = loadUsers();
      const uid   = String(tgId);

      if (action === 'wallet.create') {
        if (users[uid]?.address) {
          const { privateKey, ...safe } = users[uid];
          res.end(JSON.stringify({ ok: true, data: safe, created: false }));
          return;
        }
        const crypto = require('crypto');
        const privKeyBytes = crypto.randomBytes(32);
        const privKeyHex   = privKeyBytes.toString('hex');
        let address;
        try {
          const { ethers } = require('ethers');
          address = new ethers.Wallet('0x' + privKeyHex).address;
        } catch {
          const hash = crypto.createHash('sha256').update(privKeyBytes).digest('hex');
          address = '0x' + hash.slice(0, 40);
        }
        users[uid] = {
          telegramId: uid, address, privateKey: '0x' + privKeyHex,
          totalDeposited: 0, totalValue: 0, totalPnl: 0, totalProfit: 0,
          totalFeesPaid: 0, trades: 0, active: true,
          createdAt: new Date().toISOString(),
        };
        saveUsers(users);

        // Notify user
        sendMsg(uid,
          '✅ *Wallet created!*\n\n' +
          '🔗 `' + address + '`\n\n' +
          '_Polygon network · USDC.e_\n\n' +
          'Send USDC to deposit funds. Minimum $10.'
        ).catch(() => {});

        const { privateKey: _pk, ...safeUser } = users[uid];
        res.end(JSON.stringify({ ok: true, data: safeUser, created: true }));

      } else if (action === 'wallet.get') {
        const u = users[uid];
        if (!u) { res.end(JSON.stringify({ ok: false, error: 'not found' })); return; }
        const { privateKey, ...safe } = u;
        res.end(JSON.stringify({ ok: true, data: safe }));

      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: 'unknown action' }));
      }
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
});

apiServer.listen(3001, () => console.log('[internal-api] listening on :3001'));
