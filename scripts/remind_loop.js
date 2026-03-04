const https = require('https');

const BOT_TOKEN = '8242939132:AAEAjPh5KRukhjF84XhNZPSuEswde_Tvems';
const CHAT_ID = '399089761';
const INTERVAL_MS = 5 * 60 * 1000; // 5 минут

function sendMessage(text) {
  const data = JSON.stringify({ chat_id: CHAT_ID, text });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  };
  const req = https.request(options);
  req.on('error', (e) => console.error('Error:', e.message));
  req.write(data);
  req.end();
  console.log(`[${new Date().toISOString()}] Sent reminder`);
}

console.log('Reminder bot started. Every 5 min.');
setInterval(() => sendMessage('Эй, как дела? 👋'), INTERVAL_MS);
