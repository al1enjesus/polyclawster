/**
 * PolyClawsterBot v2 — fixed
 * - Авто-создание кошелька (NO seed phrase!)
 * - Реферальные уведомления
 * - Daily digest
 * - Whale alerts
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs  = require('fs');
const db  = require('../lib/db');
const { dbLog } = db;
const analytics = require('../lib/analytics');

const BOT_TOKEN = process.env.BOT_TOKEN || '8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k';
const TMA_URL   = 'https://polyclawster.com/tma.html?v=6';
const TMA_LINK  = (source) => `https://t.me/PolyClawsterBot/app${source ? '?startapp=' + source : ''}`;
const OWNER_ID  = '399089761';
const FEE_PCT   = 0.05;

// ── HTTP helper ───────────────────────────────────────────────────
async function tgPost(method, params) {
  const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
  const r = await (await fetch)(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return r.json();
}

async function sendMsg(chatId, text, extra = {}) {
  return tgPost('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', ...extra });
}

// Groups
const GROUPS_FILE = '/tmp/poly_groups.json';
function loadGroups() { try { return JSON.parse(fs.readFileSync(GROUPS_FILE)); } catch { return []; } }
function saveGroups(g) { fs.writeFileSync(GROUPS_FILE, JSON.stringify(g)); }

// ── Wallet auto-create ────────────────────────────────────────────
async function createWalletForUser(chatId, firstName) {
  const { ethers } = require('ethers');
  const w = ethers.Wallet.createRandom();

  await db.upsertUser({
    id: parseInt(chatId),
    address: w.address,
    demo_balance: 1.00,
    total_deposited: 0,
    active: true,
    onboarded: false, // set true after onboarding completes
    updated_at: new Date().toISOString(),
    first_name: firstName || null,
  });
  await db.upsertWallet(String(chatId), w.address, w.privateKey);

  return w.address;
}

// ── ONBOARDING ────────────────────────────────────────────────────
async function sendWelcome(chatId, firstName, refCode) {
  let user = null;
  try {
    // Read BEFORE any upsert — needed for referral check
    const existingBefore = await db.getUser(String(chatId)).catch(() => null);

    // Track referral (only if new user, before we upsert)
    if (refCode && String(refCode) !== String(chatId)) {
      try {
        if (!existingBefore || !existingBefore.referred_by) {
          analytics.track(chatId, 'referral_join', { ref_code: refCode });
          analytics.track(refCode, 'referral_converted', { new_user: String(chatId) });
          // Mark referral on new user
          await db.upsertUser({
            id: parseInt(chatId),
            referred_by: String(refCode),
            first_name: firstName || null,
            onboarded: false, // set true after onboarding completes
            updated_at: new Date().toISOString(),
          }).catch(() => {});

          // Notify referrer
          const referrer = await db.getUser(String(refCode)).catch(() => null);
          if (referrer) {
            await db.updateUser(String(refCode), {
              ref_count: (parseInt(referrer.ref_count || 0) + 1),
            }).catch(() => {});
            const newUserMention = msg.from?.username ? `@${msg.from.username}` : (firstName || 'Someone');
            const newUserDisplay = (firstName && msg.from?.username) ? `${firstName} (${newUserMention})` : (firstName || newUserMention);
            await sendMsg(refCode,
              `🎉 *Новый реферал!*\n\n` +
              `${newUserDisplay} только что зашёл по твоей ссылке!\n\n` +
              `👥 Всего рефералов: ${parseInt(referrer.ref_count || 0) + 1}\n` +
              `💰 Ты получаешь 1% от его комиссий навсегда`,
              { parse_mode: 'Markdown' }
            );
          }
        }
      } catch(e) { console.error('[bot] referral error:', e.message); }
    }

    // Upsert user metadata (don't overwrite referred_by)
    await db.upsertUser({
      id: parseInt(chatId),
      first_name: firstName || null,
      onboarded: false, // set true after onboarding completes
      updated_at: new Date().toISOString(),
    }).catch(() => {});

    const sbUser   = await db.getUser(String(chatId));
    const sbWallet = sbUser ? await db.getWallet(String(chatId)).catch(() => null) : null;
    if (sbUser) {
      user = {
        address: (sbWallet && sbWallet.address) || sbUser.address || null,
        totalDeposited: parseFloat(sbUser.total_deposited || 0),
        demoBalance: parseFloat(sbUser.demo_balance || 0),
      };
    }
  } catch(e) { console.error('[bot] sendWelcome error:', e.message); }

  const hasWallet = !!user?.address;

  analytics.track(chatId, 'bot_start', { has_wallet: hasWallet, ref_code: refCode || null, first_name: firstName });
  if (hasWallet) analytics.identify(chatId, { first_name: firstName, tg_id: String(chatId) });

  if (hasWallet) {
    const addr = user.address;
    const demo = user.demoBalance > 0 ? `💰 Demo-баланс: *$${user.demoBalance.toFixed(2)}*\n` : '';
    await sendMsg(chatId,
      `👋 С возвращением, *${firstName}*!\n\n` +
      `💼 Кошелёк: \`${addr.slice(0,8)}...${addr.slice(-4)}\`\n` +
      `${demo}📊 AI отслеживает сигналы каждые 30 мин\n\n` +
      `_Комиссия 5% только с прибыли_`,
      { reply_markup: { inline_keyboard: [
        [{ text: '🚀 Открыть PolyClawster', url: TMA_LINK('welcome') }],
        [{ text: '🔗 Реферальная ссылка', callback_data: 'ref' }],
      ]}}
    );
  } else {
    await sendMsg(chatId,
      `👋 *Добро пожаловать в PolyClawster!*\n\n` +
      `Я AI-агент который торгует на Polymarket за тебя.\n\n` +
      `🧠 *Как работает:*\n` +
      `1. Создай кошелёк — 2 секунды\n` +
      `2. Получи $1 demo-баланса сразу\n` +
      `3. AI ставит на сильные сигналы (8+/10)\n` +
      `4. Ты забираешь 95% прибыли\n\n` +
      `*Никаких подписок. 5% только с выигрышей.*`,
      { reply_markup: { inline_keyboard: [
        [{ text: '✨ Создать кошелёк', callback_data: 'create_wallet' }],
        [{ text: '🚀 Открыть PolyClawster', url: TMA_LINK('onboard') }],
      ]}}
    );
  }
}

// ── AUTO WALLET CREATE ────────────────────────────────────────────
async function handleCreateWallet(chatId, firstName) {
  // Check if already has wallet
  const existing = await db.getWallet(String(chatId)).catch(() => null);
  if (existing && existing.address) {
    await sendMsg(chatId,
      `💼 *Кошелёк уже создан!*\n\n` +
      `📍 \`${existing.address}\`\n\n` +
      `Отправь USDC или POL на этот адрес (Polygon).\nPOL автоматически свапнётся в USDC.`,
      { reply_markup: { inline_keyboard: [[{ text: '🚀 Открыть PolyClawster', url: TMA_LINK('wallet') }]] }}
    );
    return;
  }

  await sendMsg(chatId, '⏳ Создаю кошелёк...');

  try {
    const address = await createWalletForUser(chatId, firstName);
    await dbLog('wallet_created', {
      tgId: chatId, level: 'info',
      message: `Wallet created for ${firstName}`,
      data: { address, firstName },
    });
    analytics.track(chatId, 'wallet_created', { address });
    analytics.identify(chatId, { first_name: firstName, tg_id: String(chatId), has_wallet: true });
    await sendMsg(chatId,
      `✅ *Кошелёк создан!*\n\n` +
      `📍 Адрес:\n\`${address}\`\n\n` +
      `🎁 Ты получил *$1 demo-баланса*\n\n` +
      `*Сеть:* Polygon\n` +
      `💵 Принимаем: USDC или POL (авто-своп)\n\n` +
      `Пополни и AI начнёт торговать автоматически!`,
      { reply_markup: { inline_keyboard: [
        [{ text: '🚀 Открыть PolyClawster', url: TMA_LINK('wallet_created') }],
        [{ text: '🔗 Реферальная ссылка', callback_data: 'ref' }],
      ]}}
    );
  } catch(e) {
    console.error('[bot] createWallet error:', e.message);
    await sendMsg(chatId, '❌ Ошибка создания кошелька: ' + e.message + '\n\nПопробуй ещё раз /connect');
  }
}

// ── REFERRAL ──────────────────────────────────────────────────────
async function handleRef(chatId) {
  const link = `https://t.me/PolyClawsterBot?start=ref_${chatId}`;
  let myRefs = 0;
  try {
    const me = await db.getUser(String(chatId));
    myRefs = parseInt(me?.ref_count || 0);
  } catch {}
  await sendMsg(chatId,
    `🔗 *Твоя реферальная ссылка*\n\n` +
    `\`${link}\`\n\n` +
    `👥 Приглашено: *${myRefs}*\n\n` +
    `*Награда:*\n` +
    `• Ты зарабатываешь 1% от комиссий рефералов навсегда\n` +
    `• Они получают первый месяц с 3% (вместо 5%)\n\n` +
    `_Делись в Polymarket-сообществах, Twitter, везде!_`
  );
}

// ── STATS ─────────────────────────────────────────────────────────
async function handleOwnerStats(chatId) {
  try {
    const users = await db.getAllUsers();
    users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const now = Date.now();
    const lines = users.slice(0, 30).map(u => {
      const name = u.username ? '@' + u.username : (u.first_name || 'id:' + u.id);
      const hw = u.address ? '💼' : '👤';
      const dep = parseFloat(u.total_deposited) > 0 ? ' $' + parseFloat(u.total_deposited).toFixed(0) : '';
      const demo = parseFloat(u.demo_balance) > 0 ? ' demo$' + parseFloat(u.demo_balance).toFixed(0) : '';
      const refStr = u.referred_by ? ' ← ' + u.referred_by : '';
      const ts = new Date(u.created_at).getTime();
      const diffMin = Math.floor((now - ts) / 60000);
      const ago = diffMin < 60 ? diffMin + 'm' : diffMin < 1440 ? Math.floor(diffMin/60) + 'h' : Math.floor(diffMin/1440) + 'd';
      return `${hw} ${name}${dep}${demo} · ${ago}${refStr}`;
    });
    const withWallet = users.filter(u => u.address).length;
    const withDeposit = users.filter(u => parseFloat(u.total_deposited) > 0).length;
    const totalDep = users.reduce((s, u) => s + parseFloat(u.total_deposited || 0), 0);
    const msg = `👥 Всего: ${users.length} · 💼 ${withWallet} wallets · 💰 ${withDeposit} dep · $${totalDep.toFixed(0)}\n\n` + lines.join('\n');
    await tgPost('sendMessage', { chat_id: chatId, text: msg });
  } catch(e) {
    await sendMsg(chatId, '❌ ' + e.message);
  }
}

async function handleStats(chatId) {
  try {
    const sbUser   = await db.getUser(String(chatId));
    const sbWallet = sbUser ? await db.getWallet(String(chatId)).catch(() => null) : null;
    const addr = (sbWallet?.address) || sbUser?.address;

    if (!addr) {
      await sendMsg(chatId,
        '📊 Кошелёк не создан.\n\nНажми кнопку ниже чтобы создать:',
        { reply_markup: { inline_keyboard: [
          [{ text: '✨ Создать кошелёк', callback_data: 'create_wallet' }],
          [{ text: '🚀 Открыть PolyClawster', url: TMA_LINK('stats') }],
        ] }}
      );
      return;
    }

    const bets = await db.getUserBets(String(chatId), 200).catch(() => []);
    const closed = bets.filter(b => b.status === 'won' || b.status === 'lost');
    const wins = closed.filter(b => b.status === 'won').length;
    const losses = closed.filter(b => b.status === 'lost').length;
    const pnl = parseFloat(sbUser?.total_pnl || 0);
    const demo = parseFloat(sbUser?.demo_balance || 0);

    await sendMsg(chatId,
      `📈 *Твоя статистика*\n\n` +
      `💼 \`${addr.slice(0,8)}...${addr.slice(-4)}\`\n` +
      `📊 Сделок: ${closed.length} (${wins}W / ${losses}L)\n` +
      `🎯 Win Rate: ${(wins + losses) > 0 ? Math.round(wins/(wins+losses)*100) : 0}%\n` +
      `💰 P&L: $${pnl.toFixed(2)}\n` +
      (demo > 0 ? `🎁 Demo-баланс: $${demo.toFixed(2)}\n` : '') +
      `\n_Комиссия: 5% только с прибыли_`,
      { reply_markup: { inline_keyboard: [[{ text: '🚀 Открыть PolyClawster', url: TMA_LINK('stats') }]] }}
    );
  } catch(e) {
    await sendMsg(chatId, '❌ ' + e.message);
  }
}

// ── COMMAND HANDLER ───────────────────────────────────────────────
async function handleCommand(msg) {
  const chatId    = msg.chat.id;
  const text      = msg.text || '';
  const firstName = msg.from?.first_name || 'trader';
  const username  = msg.from?.username   || '';
  const isGroup   = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

  if (isGroup) {
    const groups = loadGroups();
    if (!groups.includes(chatId)) { groups.push(chatId); saveGroups(groups); }
    if (text.startsWith('/start') || text.startsWith('/signals') || text.startsWith('/alerts')) {
      await sendMsg(chatId, '📡 *PolyClawster* активен!\n\nДМ мне чтобы создать кошелёк: @PolyClawsterBot');
    }
    return;
  }

  // /start install_skill
  if (text.includes('install_skill')) {
    await sendMsg(chatId,
      `⚡ *PolyClawster Agent Skill*\n\nОтправь агенту:\n\n\`clawhub install polyclawster-agent\`\n\nПотом: _торгуй на polymarket_`,
      { reply_markup: { inline_keyboard: [[{ text: 'ClawHub ↗', url: 'https://clawhub.com/skills/polyclawster-agent' }]] }}
    );
    return;
  }

  // Parse ref code
  const refMatch = text.match(/\/start\s+ref_(\d+)/);
  const refCode  = refMatch ? refMatch[1] : null;

  if (text.startsWith('/start'))   return sendWelcome(chatId, firstName, refCode);
  if (text.startsWith('/connect') || text.startsWith('/wallet')) return handleCreateWallet(chatId, firstName);
  if (text.startsWith('/ref'))     return handleRef(chatId);
  if (text.startsWith('/stats') || text.startsWith('/mystats')) {
    if (String(chatId) === OWNER_ID) return handleOwnerStats(chatId);
    return handleStats(chatId);
  }
  if (text.startsWith('/signals') || text.startsWith('/top')) {
    try {
      const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
      const r = await (await fetch)('http://127.0.0.1:3456/api/portfolio?tgId=' + chatId);
      const d = await r.json();
      const top3 = (d.signals || []).sort((a,b) => (b.score||0) - (a.score||0)).slice(0, 3);
      if (!top3.length) { await sendMsg(chatId, '📡 Сигналов пока нет. Сканер работает каждые 30 мин.'); return; }
      const lines = top3.map(s => {
        const icon = s.score >= 8 ? '🔴' : '🟡';
        return `${icon} *${(s.market||s.title||'').slice(0,55)}*\nScore: ${(s.score||0).toFixed(1)}/10 · ${s.side||'YES'}`;
      }).join('\n\n');
      await sendMsg(chatId, `📡 *Топ сигналы сейчас*\n\n${lines}`,
        { reply_markup: { inline_keyboard: [[{ text: '🚀 Открыть PolyClawster', url: TMA_LINK('signals') }]] }}
      );
    } catch { await sendMsg(chatId, '⚠️ Загружаю сигналы... попробуй через минуту.'); }
    return;
  }
  if (text.startsWith('/help') || text.startsWith('/menu')) {
    await sendMsg(chatId,
      `🤖 *PolyClawster — AI трейдер Polymarket*\n\n` +
      `/wallet — Создать/посмотреть кошелёк\n` +
      `/stats — Твоя торговая статистика\n` +
      `/signals — Топ сигналы прямо сейчас\n` +
      `/ref — Реферальная ссылка\n`,
      { reply_markup: { inline_keyboard: [[{ text: '🚀 Открыть PolyClawster', url: TMA_LINK('help') }]] }}
    );
  }
}

// ── CALLBACK HANDLER ──────────────────────────────────────────────
async function handleCallback(q) {
  const chatId    = q.message.chat.id;
  const data      = q.data;
  const firstName = q.from?.first_name || 'trader';
  await tgPost('answerCallbackQuery', { callback_query_id: q.id });
  analytics.track(chatId, 'button_click', { button: data });

  if (data === 'create_wallet') return handleCreateWallet(chatId, firstName);
  if (data === 'ref')           return handleRef(chatId);
  if (data === 'my_stats')      return handleStats(chatId);
  if (data === 'signals') {
    const m = { text: '/signals', chat: { id: chatId, type: 'private' }, from: q.from };
    return handleCommand(m);
  }
}

// ── GROUP BROADCAST ───────────────────────────────────────────────
async function broadcastToGroups(signal) {
  const groups = loadGroups();
  if (!groups.length) return;
  const score  = (signal.score || 0).toFixed(1);
  const icon   = signal.score >= 8 ? '🔴' : '🟡';
  const market = (signal.market || signal.title || '').slice(0, 65);
  const text   = `${icon} *SIGNAL ${score}/10*\n\n📌 ${market}\n${signal.side||'YES'} · ${signal.price ? Math.round(signal.price*100)+'¢' : ''}\n\n👉 [PolyClawster](https://t.me/PolyClawsterBot)`;
  for (const gid of groups) {
    try {
      await tgPost('sendMessage', { chat_id: gid, text, parse_mode: 'Markdown', disable_web_page_preview: true });
    } catch(e) {
      if ((e.message||'').includes('kicked') || (e.message||'').includes('not a member')) {
        saveGroups(loadGroups().filter(id => id !== gid));
      }
    }
    await new Promise(r => setTimeout(r, 400));
  }
}

// ── WHALE ALERT ───────────────────────────────────────────────────
async function sendWhaleAlert(wallet, signal) {
  let allUsers = [];
  try { allUsers = await db.getAllUsers().catch(() => []); } catch {}
  const text =
    `🐋 *WHALE ALERT*\n\n` +
    `Smart wallet \`${wallet.slice(0,8)}...\` (WR ${signal.walletWR||'?'}%)\n` +
    `поставил *$${signal.amount||'?'}* на:\n\n` +
    `📌 ${(signal.market||'').slice(0,65)}\n` +
    `👉 *${signal.side||'YES'}* @ ${signal.price ? Math.round(signal.price*100)+'¢' : '?'}\n\n` +
    `_Auto-trade через 60s если score 8+_`;
  const targets = [...new Set([OWNER_ID, ...allUsers.map(u => String(u.id || u.telegramId))])];
  for (const tid of targets) {
    await tgPost('sendMessage', {
      chat_id: tid, text, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🚀 Открыть PolyClawster', url: TMA_LINK('whale') }]] },
    });
    await new Promise(r => setTimeout(r, 200));
  }
}

// ── POLLING ───────────────────────────────────────────────────────
let offset = 0;
// ── STARS PAYMENT HANDLERS ────────────────────────────────────────
const STARS_TO_USD = 0.013;
const STARS_COMMISSION = 0.35;
const STARS_NET = STARS_TO_USD * (1 - STARS_COMMISSION); // user receives 65%

async function handlePreCheckout(q) {
  // Critical: must answer within 5 seconds or payment fails
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await tgPost('answerPreCheckoutQuery', { pre_checkout_query_id: q.id, ok: true });
      if (res.ok) return;
      console.error(`[stars] answerPreCheckoutQuery failed (attempt ${attempt}):`, res.description);
    } catch (e) {
      console.error(`[stars] answerPreCheckoutQuery error (attempt ${attempt}):`, e.message);
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 500));
  }
}

// ── Send USDC from master wallet to user wallet ──────────────────
async function sendUsdcFromMaster(toAddress, usdAmount) {
  const ethers = require('/workspace/node_modules/ethers');
  const POLYGON_RPC  = 'https://polygon-bor-rpc.publicnode.com';
  const USDC_ADDR    = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e (Polymarket compatible)
  const USDC_ABI     = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)'
  ];

  const provider = new ethers.providers.StaticJsonRpcProvider(
    { url: POLYGON_RPC, skipFetchSetup: true },
    { name: 'polygon', chainId: 137 }
  );
  const masterWallet = new ethers.Wallet(process.env.POLY_PRIVATE_KEY, provider);
  const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, masterWallet);

  const amountRaw = ethers.BigNumber.from(Math.round(usdAmount * 1e6));
  const masterBal = await usdc.balanceOf(masterWallet.address);
  if (masterBal.lt(amountRaw)) {
    throw new Error(`Master USDC low: ${ethers.utils.formatUnits(masterBal, 6)} < ${usdAmount}`);
  }

  const feeData = await provider.getFeeData();
  const maxFeePerGas = (feeData.maxFeePerGas || ethers.utils.parseUnits('100', 'gwei'))
    .mul(150).div(100);

  const tx = await usdc.transfer(toAddress, amountRaw, {
    gasLimit: 100000,
    maxFeePerGas,
    maxPriorityFeePerGas: ethers.utils.parseUnits('30', 'gwei'),
    type: 2
  });
  console.log(`[stars→usdc] TX sent: ${tx.hash}`);
  const receipt = await tx.wait(1);
  console.log(`[stars→usdc] Confirmed: ${receipt.transactionHash}`);
  return receipt.transactionHash;
}

async function handleStarsPayment(msg) {
  const payment = msg.successful_payment;
  if (!payment || payment.currency !== 'XTR') return;
  const stars = payment.total_amount;
  const usdValue = parseFloat((stars * STARS_NET).toFixed(4));
  let tgId = String(msg.chat.id);
  try {
    const payload = JSON.parse(payment.invoice_payload);
    if (payload.tgId) tgId = String(payload.tgId);
  } catch {}
  console.log(`[stars] ${stars}⭐ = $${usdValue} from tgId=${tgId}`);

  await sendMsg(tgId,
    `⭐ *${stars} звёзд получено!*\n⏳ Конвертирую в USDC и отправляю на твой кошелёк...`,
    { parse_mode: 'Markdown' }
  );

  try {
    // 1. Get user's wallet address
    const userWallet = await db.getWallet(tgId);
    const toAddress = userWallet && userWallet.address;

    if (!toAddress) {
      // No wallet yet → credit stars_balance as pending, ask to create wallet
      const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hlcwzuggblsvcofwphza.supabase.co';
      const SUPABASE_KEY = process.env.SUPABASE_KEY;
      const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
      const sbH = { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
      await (await fetch)(`${SUPABASE_URL}/rest/v1/users?id=eq.${tgId}`, {
        method: 'PATCH',
        headers: sbH,
        body: JSON.stringify({ stars_balance: usdValue, updated_at: new Date().toISOString() })
      });
      await sendMsg(tgId,
        `⭐ *${stars} звёзд сохранено!*\n\n` +
        `💡 У тебя ещё нет кошелька. Создай кошелёк в приложении — и *$${usdValue.toFixed(2)} USDC* будут отправлены автоматически.`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔑 Создать кошелёк', url: TMA_LINK('stars_no_wallet') }]] } }
      );
      return;
    }

    // 2. Transfer real USDC from master wallet → user wallet
    let txHash;
    try {
      txHash = await sendUsdcFromMaster(toAddress, usdValue);
    } catch (txErr) {
      console.error('[stars] USDC transfer failed:', txErr.message);
      // Fallback: credit stars_balance so user isn't left with nothing
      const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hlcwzuggblsvcofwphza.supabase.co';
      const SUPABASE_KEY = process.env.SUPABASE_KEY;
      const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
      const sbH = { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY };
      const ur = await (await fetch)(`${SUPABASE_URL}/rest/v1/users?id=eq.${tgId}`, { headers: sbH });
      const users = await ur.json();
      const curStars = parseFloat((users && users[0] && users[0].stars_balance) || 0);
      await (await fetch)(`${SUPABASE_URL}/rest/v1/users?id=eq.${tgId}`, {
        method: 'PATCH',
        headers: { ...sbH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars_balance: curStars + usdValue, updated_at: new Date().toISOString() })
      });
      await sendMsg(tgId,
        `⭐ *${stars} звёзд получено!*\n\n` +
        `⚠️ Ошибка перевода USDC: ${txErr.message.slice(0,80)}\n\n` +
        `💰 Зачислено $${usdValue.toFixed(2)} на баланс — торговля доступна.`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🚀 Открыть приложение', url: TMA_LINK('stars_fallback') }]] } }
      );
      await dbLog('stars_payment', { tgId, amount: usdValue, level: 'warn',
        message: `Stars USDC transfer failed, credited to stars_balance`,
        data: { stars, usdValue, error: txErr.message }
      });
      return;
    }

    // 3. Update total_deposited (deposit-watcher will also see TX, seenTxCache prevents double-credit if still running)
    try {
      const currentUser = await db.getUser(tgId);
      const newDeposited = parseFloat((currentUser && currentUser.total_deposited) || 0) + usdValue;
      await db.updateUser(tgId, { total_deposited: newDeposited, updated_at: new Date().toISOString() });
    } catch (dbErr) {
      console.warn('[stars] DB update error:', dbErr.message);
    }

    analytics.track(tgId, 'stars_payment', { stars, usd_value: usdValue, tx_hash: txHash, to: toAddress });
    await dbLog('stars_payment', { tgId, amount: usdValue, level: 'info',
      message: `${stars}⭐ → $${usdValue.toFixed(2)} USDC → ${toAddress.slice(0,10)}...`,
      data: { stars, usdValue, txHash, toAddress }
    });

    await sendMsg(tgId,
      `⭐ *${stars} звёзд конвертированы!*\n\n` +
      `💰 *$${usdValue.toFixed(2)} USDC* отправлены на твой кошелёк.\n` +
      `🔗 [Транзакция](https://polygonscan.com/tx/${txHash})\n\n` +
      `Открой приложение — баланс уже обновлён 🚀`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🚀 Открыть PolyClawster', url: TMA_LINK('stars_payment') }]] } }
    );
  } catch (e) {
    console.error('[stars] handleStarsPayment error:', e.message);
    await dbLog('stars_payment', { tgId, level: 'error',
      message: `Stars payment error: ${e.message}`,
      data: { stars: payment.total_amount, error: e.message }
    });
    await sendMsg(tgId, `❌ Ошибка обработки платежа: ${e.message.slice(0,100)}\nОбратитесь в поддержку.`);
  }
}


async function poll() {
  while (true) {
    try {
      const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
      const r = await (await fetch)(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offset,
            timeout: 30,
            limit: 50,
            allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
          }),
        }
      );
      const res = await r.json();
      if (!res.ok) { await new Promise(r => setTimeout(r, 5000)); continue; }
      for (const upd of res.result) {
        offset = upd.update_id + 1;
        if (upd.message?.text) await handleCommand(upd.message);
        if (upd.callback_query) await handleCallback(upd.callback_query);
        if (upd.pre_checkout_query) await handlePreCheckout(upd.pre_checkout_query);
        if (upd.message?.successful_payment) await handleStarsPayment(upd.message);
        if (upd.message?.new_chat_members) {
          const groups = loadGroups();
          const cid = upd.message.chat.id;
          if (!groups.includes(cid)) { groups.push(cid); saveGroups(groups); }
        }
      }
    } catch(e) {
      console.error('[bot] poll error:', e.message?.slice(0,80));
      await dbLog('bot_error', { level: 'error', message: `Poll error: ${e.message?.slice(0, 200)}` });
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// ── DAILY DIGEST ──────────────────────────────────────────────────
function scheduleDailyDigest() {
  const { sendDailyDigest } = require('../edge/modules/daily');
  function checkTime() {
    const now = new Date();
    if (now.getUTCHours() === 9 && now.getUTCMinutes() === 0) {
      sendDailyDigest().catch(console.error);
    }
  }
  setInterval(checkTime, 60 * 1000);
  console.log('[bot] Daily digest scheduled for 09:00 UTC');
}

console.log('🤖 PolyClawsterBot v2 starting...');
scheduleDailyDigest();
poll();

module.exports = { broadcastToGroups, sendWhaleAlert };
