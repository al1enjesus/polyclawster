/**
 * signal-pusher.js — мгновенные пуши юзерам при сильных сигналах (score 8+)
 * Запускается из edge/index.js или cron
 */
'use strict';
const https = require('https');
const fs    = require('fs');

const BOT_TOKEN  = '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';
const USERS_PATH = '/workspace/users.json';
const DATA_PATH  = '/workspace/data.json';
const SEEN_PATH  = '/tmp/pushed_signals.json';

function tgPost(method, data) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + BOT_TOKEN + '/' + method,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', () => resolve({}));
    req.write(body); req.end();
  });
}

async function pushSignals() {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch { return; }

  let users = {};
  try { users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); } catch { return; }

  const strong = (data.signals || []).filter(s => (s.score || 0) >= 8);
  if (!strong.length) return;

  let seen = [];
  try { seen = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')); } catch {}

  const userIds = Object.keys(users).filter(id => users[id].address); // только с кошельком

  for (const sig of strong) {
    const key = (sig.market || sig.title || '').slice(0, 50) + '_' + (sig.score || 0);
    if (seen.includes(key)) continue;

    seen.push(key);
    if (seen.length > 200) seen = seen.slice(-200);

    const score  = (sig.score || 0).toFixed(1);
    const icon   = sig.score >= 9 ? '\ud83d\udd34' : '\ud83d\udfe1';
    const type   = (sig.type || '').replace('_', ' ').toUpperCase();
    const market = (sig.market || sig.title || '').slice(0, 80);
    const side   = sig.side ? ' \u00b7 ' + sig.side : '';
    const news   = sig.newsContext ? '\n_' + sig.newsContext.slice(0, 120) + '_' : '';

    const text =
      icon + ' *SIGNAL ' + score + '/10*' + '\n' +
      '*' + type + '*' + side + '\n\n' +
      '\ud83d\udccc ' + market + news + '\n\n' +
      '[Open PolyClawster](https://t.me/PolyClawsterBot)';

    for (const uid of userIds) {
      try {
        await tgPost('sendMessage', {
          chat_id: uid, text, parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: [[
            { text: '\ud83d\udcca Open Dashboard', web_app: { url: 'https://polyclawster.vercel.app/tma' } }
          ]]}
        });
        await new Promise(r => setTimeout(r, 300));
      } catch {}
    }
    console.log('[pusher] sent signal to', userIds.length, 'users:', key.slice(0, 40));
  }

  fs.writeFileSync(SEEN_PATH, JSON.stringify(seen));
}

pushSignals().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
