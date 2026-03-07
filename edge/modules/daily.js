/**
 * Daily digest — sends morning briefing to all users
 */
const { getActiveUsers } = require('./users');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN || '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';

async function tg(method, params) {
  const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
  const r = await (await fetch)(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return r.json();
}

function getSignals() {
  try {
    const s = JSON.parse(fs.readFileSync('/tmp/edge_state.json', 'utf8'));
    return (s.lastSignals || []).sort((a,b) => (b.score||0) - (a.score||0)).slice(0, 3);
  } catch { return []; }
}

function formatSignal(s, i) {
  const icons = ['🥇','🥈','🥉'];
  const score = (s.score || 0).toFixed(1);
  const market = (s.market || s.title || '').slice(0, 55);
  const side = s.side || 'YES';
  const price = s.price ? `${Math.round(s.price * 100)}¢` : '';
  return `${icons[i]} *${market}*\n   ${side} ${price} · Score ${score}/10`;
}

async function sendDailyDigest() {
  const signals  = getSignals();
  const users    = getActiveUsers();
  const date     = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const strong   = signals.filter(s => (s.score||0) >= 8).length;

  // Also get AI portfolio P&L
  let pnlLine = '';
  try {
    const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
    const r = await (await fetch)('http://127.0.0.1:3456/api/portfolio');
    const { data } = await r.json();
    if (data) pnlLine = `\n💼 *AI Portfolio:* +$${data.totalPnl.toFixed(2)} (+${data.pnlPct.toFixed(1)}%)`;
  } catch {}

  const sigText = signals.length
    ? signals.map((s,i) => formatSignal(s,i)).join('\n\n')
    : '_No signals yet — scanner running..._';

  const text =
    `🌅 *PolyClawster Daily — ${date}*${pnlLine}\n\n` +
    `📡 *Top Signals Today:*\n\n${sigText}\n\n` +
    (strong > 0 ? `⚡ *${strong} STRONG signal${strong>1?'s':''} — auto-trade active*\n\n` : '') +
    `_Signals update every 30 min · Open dashboard for details_`;

  // Send to all registered users
  let sent = 0;
  for (const user of users) {
    try {
      await tg('sendMessage', {
        chat_id: user.telegramId,
        text,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '📊 Dashboard', web_app: { url: 'https://polyclawster.vercel.app/tma.html' } },
          { text: '📡 All Signals', callback_data: 'signals' }
        ]]}
      });
      sent++;
    } catch(e) { console.log('[daily] failed for', user.telegramId, e.message); }
    await new Promise(r => setTimeout(r, 200));
  }

  // Also send to owner always
  const OWNER = '399089761';
  if (!users.find(u => String(u.telegramId) === OWNER)) {
    await tg('sendMessage', {
      chat_id: OWNER, text, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '📊 Dashboard', web_app: { url: 'https://polyclawster.vercel.app/tma.html' } }
      ]]}
    });
  }

  console.log(`[daily] Sent to ${sent} users + owner`);
  return sent;
}

module.exports = { sendDailyDigest };

// Run directly: node daily.js
if (require.main === module) sendDailyDigest().catch(console.error);
