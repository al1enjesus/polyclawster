/**
 * deposit-watcher.js — мониторинг входящих USDC на Polygon
 * Запускается рядом с bot.js, проверяет каждые 60 сек
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Polygon USDC contracts — мониторим оба
const USDC_CONTRACTS = [
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e (bridged, старый)
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC (native Circle, новый)
];
const BOT_TOKEN      = '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';
const USERS_PATH     = path.join(__dirname, 'users.json');
// seen txs хранятся в users.json[tgId].seenTxs — персистентно
const CHECK_INTERVAL = 60 * 1000; // 60 sec

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); } catch { return {}; }
}
function saveUsers(u) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(u, null, 2));
}
// seen txs теперь хранятся в users.json — см. checkDeposits()

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname, path }, res => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function tgSend(chatId, text) {
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { res.resume(); res.on('end', resolve); });
    req.on('error', resolve);
    req.write(body); req.end();
  });
}

async function getIncomingTxs(address) {
  const all = [];
  for (const contract of USDC_CONTRACTS) {
    try {
      const data = await httpsGet('api.etherscan.io',
        `/v2/api?chainid=137&module=account&action=tokentx&contractaddress=${contract}&address=${address}&page=1&offset=20&sort=desc&apikey=1PJVGS8SU3PESFS6KIZQHQBJEA1EUHIVT8`
      );
      if (!Array.isArray(data.result)) continue;
      const incoming = data.result.filter(tx => tx.to.toLowerCase() === address.toLowerCase());
      all.push(...incoming);
    } catch(e) {
      console.log('[watcher] fetch error for', contract.slice(0,10), e.message);
    }
  }
  // Дедупликация по hash
  const seen = new Set();
  return all.filter(tx => { if (seen.has(tx.hash)) return false; seen.add(tx.hash); return true; });
}

async function checkDeposits() {
  const users = loadUsers();
  let changed = false;

  for (const [tgId, user] of Object.entries(users)) {
    if (!user.address) continue;
    const txs = await getIncomingTxs(user.address);

    // Seen txs хранятся per-user в users.json — безопасно при рестартах
    if (!user.seenTxs) user.seenTxs = [];
    const seenSet = new Set(user.seenTxs);

    for (const tx of txs) {
      if (seenSet.has(tx.hash)) continue;
      seenSet.add(tx.hash);
      user.seenTxs = [...seenSet].slice(-200); // max 200 per user
      changed = true;

      const amount = Number(tx.value) / 1e6;
      if (amount < 1) continue; // игнорируем пыль

      // Обновляем баланс пользователя
      users[tgId].totalDeposited = (users[tgId].totalDeposited || 0) + amount;
      users[tgId].totalValue     = (users[tgId].totalValue || 0) + amount;
      if (!users[tgId].history) users[tgId].history = [];
      users[tgId].history.push({
        hash: tx.hash,
        type: 'deposit',
        amount,
        timestamp: Number(tx.timeStamp) * 1000,
        explorerUrl: `https://polygonscan.com/tx/${tx.hash}`,
      });

      console.log(`[deposit] +$${amount.toFixed(2)} → tgId:${tgId} | tx:${tx.hash.slice(0,12)}...`);

      // Уведомление пользователю
      await tgSend(Number(tgId),
        `✅ *Депозит получен!*\n\n` +
        `💵 +$${amount.toFixed(2)} USDC\n` +
        `🔗 [Посмотреть транзакцию](https://polygonscan.com/tx/${tx.hash})\n\n` +
        `Баланс обновлён в дашборде.`
      );
    }
  }

  if (changed) {
    saveUsers(users);
  }
}

async function run() {
  console.log('💳 Deposit watcher started');
  while (true) {
    try { await checkDeposits(); } catch(e) { console.error('[watcher] error:', e.message); }
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
  }
}

run();

// ── Signal pusher — каждые 15 минут ──────────────────────────
const { execFile } = require('child_process');
function runSignalPusher() {
  execFile('node', ['/workspace/signal-pusher.js'], (err, stdout, stderr) => {
    if (stdout.trim()) console.log('[pusher]', stdout.trim().slice(0, 120));
    if (err && !stdout) console.log('[pusher] err:', err.message?.slice(0, 60));
  });
}
setInterval(runSignalPusher, 15 * 60 * 1000);
runSignalPusher(); // первый раз сразу
