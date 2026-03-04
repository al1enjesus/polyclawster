/**
 * edge/modules/notify.js — Signal formatter + TG sender
 * Every alert includes: market link + news context (if available)
 */
const { post } = require('./http');
const cfg = require('../config');

async function sendTg(msg) {
  if (!cfg.BOT_TOKEN) { console.log('[TG]', msg.replace(/[*`[\]]/g, '')); return; }
  await post(
    `https://api.telegram.org/bot${cfg.BOT_TOKEN}/sendMessage`,
    {
      chat_id: cfg.CHAT_ID,
      text: msg.substring(0, 4096),
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }
  );
}

function marketLink(market, marketId) {
  if (marketId) return `https://polymarket.com/event/${marketId}`;
  const slug = (market || '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim().replace(/\s+/g, '-')
    .substring(0, 60);
  return `https://polymarket.com/event/${slug}`;
}

function formatSignal(s) {
  const news = s.newsContext ? `\n📰 _${s.newsContext.substring(0, 120)}_` : '';
  const mktUrl = marketLink(s.market || s.title, s.marketId);

  switch (s.type) {

    case 'whale_order':
      return (
        `${s.strength === 'HIGH' ? '🐋🚨' : '🐋'} *КИТ В СТАКАНЕ*\n` +
        `📌 ${(s.market || '').substring(0, 60)}\n` +
        `💰 *${s.side}* @ ${s.price}¢ — один ордер на *$${s.amount}*\n` +
        `🎯 Score: ${s.score.toFixed(1)}/10${news}\n` +
        `🔗 [Рынок](${mktUrl})`
      );

    case 'ob_imbalance':
      return (
        `⚖️ *НАКОПЛЕНИЕ В СТАКАНЕ*\n` +
        `📌 ${(s.market || '').substring(0, 60)}\n` +
        `Сторона *${s.side}* перевес ${s.ratio}x (bid $${s.bidDepth} / ask $${s.askDepth})\n` +
        `🎯 Score: ${s.score.toFixed(1)}/10${news}\n` +
        `🔗 [Рынок](${mktUrl})`
      );

    case 'price_drift':
      return (
        `${parseFloat(s.to) > parseFloat(s.from) ? '📈' : '📉'} *ДРЕЙФ ЦЕНЫ*\n` +
        `📌 ${(s.market || '').substring(0, 60)}\n` +
        `${s.from}¢ → *${s.to}¢* (+${s.drift}pp)\n` +
        `🎯 Score: ${s.score.toFixed(1)}/10${news}\n` +
        `🔗 [Рынок](${mktUrl})`
      );

    case 'vol_spike':
      return (
        `⚡ *VOLUME SPIKE*\n` +
        `📌 ${(s.market || '').substring(0, 60)}\n` +
        `$${s.volume} за последние ~5 мин | Сторона: *${s.side}*\n` +
        `🎯 Score: ${s.score.toFixed(1)}/10${news}\n` +
        `🔗 [Рынок](${mktUrl})`
      );

    case 'smartwallet': {
      const pnlStr = s.totalPnl > 0
        ? `+$${s.totalPnl.toFixed(0)}`
        : (s.totalPnl < 0 ? `-$${Math.abs(s.totalPnl).toFixed(0)}` : '');
      const histLine = s.winRate > 0
        ? `👤 \`${s.addr.substring(0, 10)}...\` | WR:${(s.winRate * 100).toFixed(0)}% ${pnlStr ? '| ' + pnlStr : ''}\n`
        : `🐋 \`${s.addr.substring(0, 10)}...\`\n`;
      return (
        `🧠 *SMART MONEY*\n` +
        histLine +
        `📌 ${(s.title || s.market || 'Unknown').substring(0, 60)}\n` +
        `💰 *${s.outcome}* @ ${(parseFloat(s.price || 0) * 100).toFixed(1)}¢ → *$${s.size}*\n` +
        `🎯 Score: ${s.score.toFixed(1)}/10${news}\n` +
        `🔗 [Рынок](${mktUrl}) | [Профиль](https://polymarket.com/@${s.addr})`
      );
    }

    case 'cross_market':
      return (
        `🔗 *КРОСС-РЫНОК*\n` +
        `📌 Триггер: _${(s.triggerMarket || '').substring(0, 45)}_ → ${s.triggerMove}\n` +
        `📌 Отстаёт: ${(s.lagMarket || '').substring(0, 45)}\n` +
        `Цена ещё не отреагировала, ожидаем +${s.expectedMove}pp\n` +
        `🎯 Score: ${s.score.toFixed(1)}/10${news}\n` +
        `🔗 [Рынок](${marketLink(s.lagMarket)})`
      );

    case 'news_edge':
      return (
        `📰 *NEWS EDGE*\n` +
        `📌 ${(s.market || '').substring(0, 60)}\n` +
        `🗞️ _${(s.headline || '').substring(0, 100)}_\n` +
        `Рынок: ${s.currentPrice}¢ | Ожидаем: *${s.fairPrice}¢* | Edge: +${s.edgePct}pp\n` +
        `🎯 Score: ${s.score.toFixed(1)}/10\n` +
        `🔗 [Рынок](${mktUrl})`
      );

    default:
      return JSON.stringify(s);
  }
}

module.exports = { sendTg, formatSignal };
