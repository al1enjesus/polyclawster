/**
 * PolyClawsterBot v2
 * - Onboarding flow
 * - /connect wallet
 * - Daily digest
 * - Whale alerts to all users
 * - Referral /ref
 * - Group alerts
 */
const fs   = require('fs');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN || '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';
const TMA_URL   = 'https://polyclawster.com/tma.html';
const OWNER_ID  = '399089761';

const { registerWallet, getUser, getActiveUsers, getUserStats, FEE_PCT } = require('../edge/modules/users');

// ── User state machine (onboarding) ──────────────────────────────
const STATE_FILE = '/tmp/poly_bot_states.json';
function loadStates() { try { return JSON.parse(fs.readFileSync(STATE_FILE)); } catch { return {}; } }
function saveStates(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); }
function getState(id) { return loadStates()[String(id)] || null; }
function setState(id, s) { const all = loadStates(); all[String(id)] = s; saveStates(all); }
function clearState(id) { const all = loadStates(); delete all[String(id)]; saveStates(all); }

// Groups tracking
const GROUPS_FILE = '/tmp/poly_groups.json';
function loadGroups() { try { return JSON.parse(fs.readFileSync(GROUPS_FILE)); } catch { return []; } }
function saveGroups(g) { fs.writeFileSync(GROUPS_FILE, JSON.stringify(g)); }

// Referrals
const REFS_FILE = '/workspace/edge/data/referrals.json';
function loadRefs() { try { return JSON.parse(fs.readFileSync(REFS_FILE)); } catch { return {}; } }
function saveRefs(r) { fs.mkdirSync('/workspace/edge/data', {recursive:true}); fs.writeFileSync(REFS_FILE, JSON.stringify(r,null,2)); }

async function tgPost(method, params) {
  const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
  const r = await (await fetch)(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params)
  });
  return r.json();
}

async function sendMsg(chatId, text, extra = {}) {
  return tgPost('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', ...extra });
}

// ── ONBOARDING ───────────────────────────────────────────────────
async function sendWelcome(chatId, firstName, refCode) {
  const user = getUser(chatId);
  const hasWallet = !!user?.address;

  // Track referral
  if (refCode) {
    const refs = loadRefs();
    if (!refs[String(chatId)]) {
      refs[String(chatId)] = { referrer: refCode, ts: Date.now() };
      saveRefs(refs);
      await sendMsg(refCode, `🎉 *New referral!* ${firstName} just joined via your link.`);
    }
  }

  const text = hasWallet
    ? `👋 Welcome back, *${firstName}*!\n\n` +
      `💼 Wallet connected: \`${user.address.slice(0,6)}...${user.address.slice(-4)}\`\n` +
      `📊 Your trades are running on autopilot.\n\n` +
      `_Fee: ${FEE_PCT * 100}% of profits only_`
    : `👋 *Welcome to PolyClawster!*\n\n` +
      `I'm an AI agent that trades Polymarket for you.\n\n` +
      `🧠 *How it works:*\n` +
      `1. Connect your wallet\n` +
      `2. I detect strong signals (score 8+/10)\n` +
      `3. Auto-trade on your behalf\n` +
      `4. You keep 95% of profits\n\n` +
      `*No subscription. 5% fee only on wins.*\n\n` +
      `⬇️ Start by connecting your Polymarket wallet:`;

  const kb = hasWallet
    ? { inline_keyboard: [[
        { text: '📊 Dashboard', web_app: { url: TMA_URL } },
        { text: '📈 My Stats', callback_data: 'my_stats' }
      ], [
        { text: '🔗 Refer & Earn', callback_data: 'ref' }
      ]]}
    : { inline_keyboard: [[
        { text: '🔗 Connect Wallet', callback_data: 'connect_wallet' }
      ], [
        { text: '📊 View Demo Dashboard', web_app: { url: TMA_URL } }
      ]]};

  await sendMsg(chatId, text, { reply_markup: kb });
}

async function handleConnect(chatId) {
  setState(chatId, 'awaiting_key');
  await sendMsg(chatId,
    `🔐 *Connect your Polymarket wallet*\n\n` +
    `Send me your *private key* to enable auto-trading.\n\n` +
    `⚠️ _Your key is stored encrypted on our server. Never share it with anyone else._\n\n` +
    `💡 To get your key:\n` +
    `Polymarket → Profile → Export → Private Key\n\n` +
    `Or create a new wallet and fund it with USDC on Polygon.`,
    { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel' }]] }}
  );
}

async function handlePrivateKey(chatId, key, firstName) {
  clearState(chatId);
  const trimmed = key.trim();

  // Basic validation
  if (!trimmed.match(/^0x[a-fA-F0-9]{64}$/)) {
    await sendMsg(chatId, '❌ Invalid private key format. Should start with `0x` and be 66 chars.\n\nTry again with /connect');
    return;
  }

  await sendMsg(chatId, '⏳ Verifying wallet...');

  const result = registerWallet(chatId, trimmed);
  if (!result.ok) {
    await sendMsg(chatId, `❌ Error: ${result.error}`);
    return;
  }

  await sendMsg(chatId,
    `✅ *Wallet connected!*\n\n` +
    `📍 Address: \`${result.address}\`\n\n` +
    `*What happens next:*\n` +
    `• I'll scan Polymarket every 30 min\n` +
    `• Strong signals (8+/10) → auto-trade\n` +
    `• Max $50 per trade, 20% of balance\n` +
    `• 5% fee on profits only\n\n` +
    `🎯 Make sure your wallet has *USDC on Polygon* to start trading!`,
    { reply_markup: { inline_keyboard: [[
      { text: '📊 Dashboard', web_app: { url: TMA_URL } },
      { text: '🔗 Refer & Earn', callback_data: 'ref' }
    ]]}}
  );
}

// ── REFERRAL ─────────────────────────────────────────────────────
async function handleRef(chatId, username) {
  const link = `https://t.me/PolyClawsterBot?start=ref_${chatId}`;
  const refs  = loadRefs();
  const myRefs = Object.values(refs).filter(r => r.referrer === String(chatId)).length;

  await sendMsg(chatId,
    `🔗 *Your Referral Link*\n\n` +
    `\`${link}\`\n\n` +
    `👥 Friends referred: *${myRefs}*\n\n` +
    `*Rewards:*\n` +
    `• You earn *1%* of your referrals' fees forever\n` +
    `• They get first month with reduced fee (3% instead of 5%)\n\n` +
    `_Share in Polymarket communities, Twitter, anywhere!_`
  );
}

// ── STATS ─────────────────────────────────────────────────────────
async function handleStats(chatId) {
  const stats = getUserStats(chatId);
  if (!stats) {
    await sendMsg(chatId, '📊 No wallet connected yet.\n\nUse /connect to start auto-trading.');
    return;
  }
  await sendMsg(chatId,
    `📈 *Your Trading Stats*\n\n` +
    `💼 Wallet: \`${stats.address.slice(0,8)}...${stats.address.slice(-4)}\`\n` +
    `📊 Trades: ${stats.trades} (${stats.wins}W/${stats.losses}L)\n` +
    `🎯 Win Rate: ${stats.winRate}%\n` +
    `💰 Total Profit: $${stats.totalProfit.toFixed(2)}\n` +
    `💸 Fees Paid: $${stats.totalFees.toFixed(2)}\n` +
    `✅ Net Profit: *$${stats.netProfit.toFixed(2)}*`
  );
}

// ── COMMAND HANDLER ───────────────────────────────────────────────
async function handleCommand(msg) {
  const chatId    = msg.chat.id;
  const text      = msg.text || '';
  const firstName = msg.from?.first_name || 'trader';
  const username  = msg.from?.username || '';
  const isGroup   = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

  if (isGroup) {
    // Group: register + send welcome
    const groups = loadGroups();
    if (!groups.includes(chatId)) { groups.push(chatId); saveGroups(groups); }
    if (text.startsWith('/start') || text.startsWith('/signals') || text.startsWith('/alerts')) {
      await sendMsg(chatId, '📡 *PolyClawster* is active in this group!\n\nI\'ll post strong Polymarket signals here automatically.\n\n👉 DM me to connect your wallet: @PolyClawsterBot');
    }
    return;
  }


  // /start install_skill — from TMA Agents tab
  if (text.includes('install_skill')) {
    const msg = '⚡ *PolyClawster Agent Skill*\n\n'
      + 'Отправь агенту эту команду:\n\n'
      + '`clawhub install polyclawster-agent`\n\n'
      + 'Потом напиши агенту: _торгуй на polymarket_\n\n'
      + '[ClawHub](https://clawhub.com/skills/polyclawster-agent) | [TMA](https://t.me/PolyClawsterBot/app)';
    await sendMsg(chatId, msg, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'ClawHub', url: 'https://clawhub.com/skills/polyclawster-agent' },
          { text: 'Open TMA', url: 'https://t.me/PolyClawsterBot/app' },
        ]]
      }
    });
    return;
  }

  // Extract ref code from /start ref_XXX
  const refMatch = text.match(/\/start\s+ref_(\d+)/);
  const refCode  = refMatch ? refMatch[1] : null;

  // Check if awaiting key input
  const state = getState(chatId);
  if (state === 'awaiting_key' && !text.startsWith('/')) {
    await handlePrivateKey(chatId, text, firstName);
    return;
  }

  if (text.startsWith('/start'))    return sendWelcome(chatId, firstName, refCode);
  if (text.startsWith('/connect'))  return handleConnect(chatId);
  if (text.startsWith('/ref'))      return handleRef(chatId, username);
  if (text.startsWith('/stats') || text.startsWith('/mystats')) return handleStats(chatId);
  if (text.startsWith('/signals') || text.startsWith('/top')) {
    // Pull top signals from API
    try {
      const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
      const r = await (await fetch)('http://127.0.0.1:3456/api/signals');
      const { data } = await r.json();
      const top3 = (data?.signals || []).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,3);
      if (!top3.length) { await sendMsg(chatId, '📡 No signals yet. Scanner runs every 30 min.'); return; }
      const lines = top3.map((s,i) => {
        const icon = s.score >= 8 ? '🔴' : '🟡';
        return `${icon} *${(s.market||s.title||'').slice(0,55)}*\nScore: ${(s.score||0).toFixed(1)}/10 · ${s.side||'YES'}`;
      }).join('\n\n');
      await sendMsg(chatId, `📡 *Top Signals Now*\n\n${lines}`, {
        reply_markup: { inline_keyboard: [[{ text: '📊 Full Dashboard', web_app: { url: TMA_URL } }]] }
      });
    } catch(e) { await sendMsg(chatId, '⚠️ Scanner loading... try again in a moment.'); }
    return;
  }
  if (text.startsWith('/portfolio') || text.startsWith('/pnl')) {
    try {
      const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
      const r = await (await fetch)('http://127.0.0.1:3456/api/portfolio');
      const { data: d } = await r.json();
      await sendMsg(chatId,
        `💼 *AI Portfolio*\n\n` +
        `💰 Value: $${d.totalValue.toFixed(0)}\n` +
        `📈 P&L: +$${d.totalPnl.toFixed(2)} (+${d.pnlPct.toFixed(1)}%)\n` +
        `📊 Positions: ${d.positions.length}`,
        { reply_markup: { inline_keyboard: [[{ text: '📊 Full Dashboard', web_app: { url: TMA_URL } }]] }}
      );
    } catch { await sendMsg(chatId, '⚠️ Portfolio loading...'); }
    return;
  }
  if (text.startsWith('/help') || text.startsWith('/menu')) {
    await sendMsg(chatId,
      `🤖 *PolyClawster Commands*\n\n` +
      `/connect — Link your wallet & enable auto-trade\n` +
      `/stats — Your trading performance\n` +
      `/signals — Top signals right now\n` +
      `/portfolio — AI agent P&L\n` +
      `/ref — Referral link & rewards\n\n` +
      `💡 _Or tap the Dashboard button below_`,
      { reply_markup: { inline_keyboard: [[{ text: '📊 Dashboard', web_app: { url: TMA_URL } }]] }}
    );
  }
}

// ── CALLBACK HANDLER ──────────────────────────────────────────────
async function handleCallback(q) {
  const chatId = q.message.chat.id;
  const data   = q.data;
  await tgPost('answerCallbackQuery', { callback_query_id: q.id });

  if (data === 'connect_wallet')   return handleConnect(chatId);
  if (data === 'ref')              return handleRef(chatId, q.from?.username);
  if (data === 'my_stats')         return handleStats(chatId);
  if (data === 'cancel')           { clearState(chatId); await sendMsg(chatId, '❌ Cancelled.'); }
  if (data === 'signals')          { const m = { text: '/signals', chat: { id: chatId, type: 'private' }, from: q.from }; await handleCommand(m); }
}

// ── GROUP BROADCAST ───────────────────────────────────────────────
async function broadcastToGroups(signal) {
  const groups = loadGroups();
  if (!groups.length) return;
  const score  = (signal.score || 0).toFixed(1);
  const icon   = signal.score >= 8 ? '🔴' : '🟡';
  const market = (signal.market || signal.title || '').slice(0, 65);
  const text   =
    `${icon} *SIGNAL ${score}/10*\n\n` +
    `📌 ${market}\n` +
    `${signal.side || 'YES'} · ${signal.price ? Math.round(signal.price*100)+'¢' : ''}\n\n` +
    `👉 [Trade on PolyClawster](https://t.me/PolyClawsterBot)`;
  for (const gid of groups) {
    try {
      await tgPost('sendMessage', { chat_id: gid, text, parse_mode: 'Markdown', disable_web_page_preview: true });
    } catch(e) {
      if (e.message?.includes('kicked') || e.message?.includes('not a member')) {
        saveGroups(loadGroups().filter(id => id !== gid));
      }
    }
    await new Promise(r => setTimeout(r, 400));
  }
}

// ── WHALE ALERT ───────────────────────────────────────────────────
async function sendWhaleAlert(wallet, signal) {
  const users = getActiveUsers();
  const text  =
    `🐋 *WHALE ALERT*\n\n` +
    `Smart wallet \`${wallet.slice(0,8)}...\` (WR ${signal.walletWR || '?'}%)\n` +
    `just bet *$${signal.amount || '?'}* on:\n\n` +
    `📌 ${(signal.market || '').slice(0,65)}\n` +
    `👉 *${signal.side || 'YES'}* at ${signal.price ? Math.round(signal.price*100)+'¢' : '?'}\n\n` +
    `_Auto-trade will execute in 60s if score 8+_`;

  // Send to all registered users + owner
  const targets = [...new Set([OWNER_ID, ...users.map(u => String(u.telegramId))])];
  for (const tid of targets) {
    await tgPost('sendMessage', {
      chat_id: tid, text, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '⚡ Copy Trade Now', callback_data: `copy_${signal.conditionId}` },
        { text: '📊 Dashboard', web_app: { url: TMA_URL } }
      ]]}
    });
    await new Promise(r => setTimeout(r, 200));
  }
}

// ── POLLING LOOP ──────────────────────────────────────────────────
let offset = 0;
async function poll() {
  while (true) {
    try {
      const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
      const r = await (await fetch)(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30&limit=50`
      );
      const res = await r.json();
      if (!res.ok) { await new Promise(r => setTimeout(r, 5000)); continue; }

      for (const upd of res.result) {
        offset = upd.update_id + 1;
        // Handle text input (including private key)
        if (upd.message?.text) {
          const state = getState(upd.message.chat.id);
          if (state === 'awaiting_key' && !upd.message.text.startsWith('/')) {
            await handlePrivateKey(upd.message.chat.id, upd.message.text, upd.message.from?.first_name);
          } else if (upd.message.text.startsWith('/')) {
            await handleCommand(upd.message);
          }
        }
        if (upd.callback_query)        await handleCallback(upd.callback_query);
        if (upd.message?.new_chat_members) {
          const groups = loadGroups();
          const cid = upd.message.chat.id;
          if (!groups.includes(cid)) { groups.push(cid); saveGroups(groups); }
        }
      }
    } catch(e) {
      console.error('[bot] poll error:', e.message?.slice(0,80));
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// ── DAILY DIGEST SCHEDULER ────────────────────────────────────────
function scheduleDailyDigest() {
  const { sendDailyDigest } = require('../edge/modules/daily');
  // Run at 9:00 UTC every day
  function checkTime() {
    const now = new Date();
    if (now.getUTCHours() === 9 && now.getUTCMinutes() === 0) {
      sendDailyDigest().catch(console.error);
    }
  }
  setInterval(checkTime, 60 * 1000);
  console.log('[bot] Daily digest scheduled for 09:00 UTC');
}

// ── START ─────────────────────────────────────────────────────────
console.log('🤖 PolyClawsterBot v2 starting...');
scheduleDailyDigest();
poll();

module.exports = { broadcastToGroups, sendWhaleAlert };
