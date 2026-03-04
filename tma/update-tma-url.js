/**
 * При перезапуске cloudflared — получает новый URL и обновляет Menu Button бота
 */
const https = require('https');
const fs    = require('fs');
const { execSync } = require('child_process');

const BOT_TOKEN = '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';

function tgPost(method, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let raw = ''; res.on('data', d => raw += d); res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function main() {
  // Get cloudflared URL from its logs
  let cfUrl = null;
  for (let i = 0; i < 10; i++) {
    try {
      const logs = execSync('pm2 logs cloudflared --lines 30 --nostream 2>&1').toString();
      const match = logs.match(/https:\/\/[\w-]+\.trycloudflare\.com/);
      if (match) { cfUrl = match[0]; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!cfUrl) { console.log('❌ Could not get cloudflare URL'); process.exit(1); }
  console.log('📡 TMA URL:', cfUrl);

  // Update index.html
  let html = fs.readFileSync('/workspace/tma/src/index.html', 'utf8');
  html = html.replace(/const API = '.*?';/, `const API = '${cfUrl}';`);
  fs.writeFileSync('/workspace/tma/src/index.html', html);

  // Update bot.js
  let bot = fs.readFileSync('/workspace/tma/bot.js', 'utf8');
  bot = bot.replace(/const TMA_URL\s*=\s*'.*?';/, `const TMA_URL   = '${cfUrl}';`);
  fs.writeFileSync('/workspace/tma/bot.js', bot);

  // Update Telegram Menu Button
  const res = await tgPost('setChatMenuButton', {
    menu_button: { type: 'web_app', text: '📊 Dashboard', web_app: { url: cfUrl } }
  });
  console.log('MenuButton updated:', res.ok ? '✅' : '❌');

  // Restart bot to pick up new URL
  execSync('pm2 restart poly-bot');
  console.log('✅ Bot restarted with new URL');
  console.log('🔗 ' + cfUrl);
}

main().catch(console.error);
