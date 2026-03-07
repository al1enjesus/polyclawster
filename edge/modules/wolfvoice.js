/**
 * edge/modules/wolfvoice.js
 * Wolf of Wall Street–style voice signal generator + OpenAI TTS + Telegram sendVoice
 *
 * Flow:
 *   generateWolfText(signal) → string (long dramatic pitch)
 *   sendVoiceSignal(signal, chatId) → generates text → TTS → sendVoice to Telegram
 */

'use strict';

const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

const BOT_TOKEN   = process.env.BOT_TOKEN   || '';
const OPENAI_KEY  = process.env.OPENAI_API_KEY || '';

// ─── Text templates (Wolf of Wall Street style) ─────────────────────────────

function generateWolfText(s) {
  const market = (s.market || s.title || s.triggerMarket || s.headline || 'этот рынок')
    .replace(/[*_`]/g, '')
    .substring(0, 80);

  const side   = (s.side || s.outcome || 'YES').toUpperCase();
  const score  = (s.score || 0).toFixed(1);

  switch (s.type) {

    case 'whale_order': {
      const amt   = s.amount ? `$${Number(s.amount).toLocaleString('en')}` : 'крупную сумму';
      const price = s.price  ? `${s.price} центов` : '';
      const other = side === 'YES' ? 'NO' : 'YES';
      return `Слушай, я сейчас скажу тебе кое-что важное. Прямо сейчас — не вчера, не час назад, а прямо в эту минуту — в стакане на Polymarket появился ордер на ${amt}. Одна позиция. Один человек. Сторона ${side}${price ? ` по ${price}` : ''}. Ты думаешь, это случайность? Нет. Киты не бросают такие деньги наугад. Это называется умные деньги. Это люди, у которых есть информация, которой нет у нас с тобой. И они только что показали нам направление. Рынок: ${market}. Наш алгоритм оценил этот сигнал на ${score} из десяти. Это один из лучших сигналов за сегодня. Пока все остальные сидят и ждут — умные заходят прямо сейчас. Вопрос только один: ты на стороне ${side} или будешь смотреть, как другие зарабатывают?`;
    }

    case 'ob_imbalance': {
      const ratio = s.ratio ? `в ${s.ratio} раза` : 'значительно';
      const bid   = s.bidDepth ? `$${Number(s.bidDepth).toLocaleString('en')}` : '';
      const ask   = s.askDepth ? `$${Number(s.askDepth).toLocaleString('en')}` : '';
      return `Хорошо, вот что происходит прямо сейчас. В стакане на этом рынке покупатели давят ${ratio} сильнее продавцов. ${bid && ask ? `Биды на ${bid}, аски на ${ask}. ` : ''}Это называется накопление. Когда крупные игроки собирают позицию — они не кричат об этом. Они тихо скупают, пока цена низкая. А потом цена двигается — и все кто был снаружи кусают локти. Рынок: ${market}. Сторона ${side} сейчас под давлением покупателей. Наш алгоритм говорит ${score} из десяти. Я видел этот паттерн много раз. Он работает. Накопление предшествует движению. И это движение — вопрос времени.`;
    }

    case 'price_drift': {
      const from = s.from ? `${s.from} центов` : '';
      const to   = s.to   ? `${s.to} центов` : '';
      const drift = s.drift ? `${s.drift} процентных пунктов` : '';
      const dir  = parseFloat(s.to) > parseFloat(s.from) ? 'вверх' : 'вниз';
      return `Смотри что происходит. Цена на этом рынке тихо ползёт ${dir}. ${from && to ? `С ${from} до ${to}. ` : ''}${drift ? `${drift} за последний цикл. ` : ''}Большинство людей этого не замечают — они смотрят в другое место. Но наш алгоритм видит всё. И вот что я тебе скажу: такие тихие движения — это не шум. Это след. Кто-то что-то знает и заходит постепенно, чтобы не двигать цену резко. Рынок: ${market}. Тренд на ${side}. Оценка сигнала: ${score} из десяти. Если ты ждёшь идеального момента — он прямо сейчас.`;
    }

    case 'vol_spike': {
      const vol = s.volume ? `$${Number(s.volume).toLocaleString('en')}` : 'большие объёмы';
      return `Стоп. Посмотри на это. ${vol} прошло через этот рынок за последние несколько минут. Это не обычный день. Это взрыв активности. Когда объём резко растёт — это значит что кто-то очень уверен в том, что делает. Не один человек — несколько. И все они ставят на ${side}. Рынок: ${market}. Объём говорит сам за себя. Наш алгоритм ставит ${score} из десяти. Я видел такие спайки перед самыми большими движениями. Сейчас окно открыто. Через час оно может закрыться.`;
    }

    case 'smartwallet': {
      const wr     = s.winRate ? `${(s.winRate * 100).toFixed(0)} процентов` : '';
      const pnl    = s.totalPnl && s.totalPnl > 0 ? `плюс $${s.totalPnl.toFixed(0)} за всё время` : '';
      const size   = s.size   ? `$${Number(s.size).toLocaleString('en')}` : 'крупную сумму';
      const addr   = s.addr   ? s.addr.substring(0, 8) + '...' : 'умный кошелёк';
      const price  = s.price  ? `по ${(parseFloat(s.price)*100).toFixed(1)} центов` : '';
      return `Послушай внимательно. Есть кошелёк — ${addr}. ${wr ? `Процент правильных ставок: ${wr}. ` : ''}${pnl ? `Общий заработок: ${pnl}. ` : ''}Это не удача. Это система. Это человек — или команда — которая понимает эти рынки лучше остальных. И вот что он сделал только что: зашёл на ${size} ${price ? price + ' ' : ''}на сторону ${side}. Рынок: ${market}. Когда такой кошелёк делает ставку — умные люди следуют за ним. Наш алгоритм: ${score} из десяти. Это не просто сигнал. Это подсказка от лучших игроков на рынке.`;
    }

    case 'news_edge': {
      const headline    = s.headline    ? s.headline.substring(0, 100) : 'вышла важная новость';
      const curPrice    = s.currentPrice ? `${s.currentPrice} центов` : '';
      const fairPrice   = s.fairPrice   ? `${s.fairPrice} центов` : '';
      const edge        = s.edgePct     ? `плюс ${s.edgePct} процентных пунктов` : '';
      return `Вот что только что упало мне на стол. Новость: ${headline}. Рынок ещё не отреагировал. Понимаешь, что это значит? Это называется информационный арбитраж. Рынок медленный. Новость уже есть — а цена ещё старая. ${curPrice && fairPrice ? `Сейчас ${curPrice}. Справедливая цена с учётом новости — ${fairPrice}. ${edge ? `Потенциал: ${edge}. ` : ''}` : ''}Такие окна живут минуты. Не часы — минуты. Потом все всё увидят, цена прыгнет и момент уйдёт. Рынок: ${market}. Сторона ${side}. Алгоритм: ${score} из десяти. Это редкость. Пользуйся.`;
    }

    case 'cross_market': {
      const trigger = (s.triggerMarket || '').substring(0, 60);
      const lag     = (s.lagMarket     || '').substring(0, 60);
      const move    = s.expectedMove ? `плюс ${s.expectedMove} пунктов` : '';
      return `Смотри, вот что интересно. Один рынок уже двинулся. ${trigger ? `${trigger} — уже отреагировал. ` : ''}А вот другой — ${lag ? lag + ' — ' : ''}ещё нет. Рынки связаны. Они движутся вместе — просто с задержкой. Это называется кросс-корреляция. И вот прямо сейчас второй рынок отстаёт. ${move ? `Ожидаемое движение: ${move}. ` : ''}Это не гадание — это математика. Наш алгоритм поймал этот разрыв и оценил его на ${score} из десяти. Рынок который отстаёт: ${market}. Сторона ${side}. Когда разрыв закроется — а он закроется — те кто зашёл первыми окажутся в плюсе.`;
    }

    default: {
      return `Слушай, у меня для тебя есть сигнал. Рынок: ${market}. Сторона ${side}. Наш алгоритм оценил его на ${score} из десяти — это сильный сигнал. Такие возможности не висят вечно. Рынок двигается, и те кто действуют быстро — зарабатывают. Открой приложение и посмотри детали прямо сейчас.`;
    }
  }
}

// ─── OpenAI TTS ─────────────────────────────────────────────────────────────

async function textToSpeech(text) {
  if (!OPENAI_KEY) throw new Error('No OPENAI_API_KEY');

  const body = JSON.stringify({
    model: 'tts-1',
    voice: 'onyx',       // глубокий брокерский голос
    input: text.substring(0, 4096),
    response_format: 'mp3',
    speed: 1.05,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/audio/speech',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`OpenAI TTS ${res.statusCode}: ${Buffer.concat(chunks).toString().slice(0,200)}`));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('TTS timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── Telegram sendVoice (multipart) ─────────────────────────────────────────

async function sendVoiceTg(chatId, audioBuffer, caption) {
  if (!BOT_TOKEN) throw new Error('No BOT_TOKEN');

  const boundary = '----TGVoiceBoundary' + Date.now();
  const filename  = 'signal.mp3';

  // Build multipart/form-data manually
  const captionPart = caption
    ? `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption.substring(0,1024)}\r\n`
    : '';
  const parseModePart = caption
    ? `--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nMarkdown\r\n`
    : '';

  const pre = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n` +
    captionPart +
    parseModePart +
    `--${boundary}\r\nContent-Disposition: form-data; name="voice"; filename="${filename}"\r\nContent-Type: audio/mpeg\r\n\r\n`
  );
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([pre, audioBuffer, post]);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendVoice`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      timeout: 30000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.ok) resolve(j);
          else reject(new Error('TG sendVoice: ' + JSON.stringify(j)));
        } catch { reject(new Error('TG sendVoice parse error: ' + d.slice(0,200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('sendVoice timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Send Wolf-style voice signal to a Telegram chat.
 * @param {object} signal  - signal object from edge runner
 * @param {string} chatId  - Telegram chat_id
 * @param {string} [caption] - optional short caption under the voice (markdown)
 */
async function sendVoiceSignal(signal, chatId, caption) {
  try {
    const text = generateWolfText(signal);
    console.log(`[wolfvoice] Generating TTS (${text.length} chars)...`);
    const audio = await textToSpeech(text);
    console.log(`[wolfvoice] TTS done (${audio.length} bytes). Sending voice...`);
    await sendVoiceTg(chatId, audio, caption || null);
    console.log(`[wolfvoice] ✅ Voice sent to ${chatId}`);
  } catch (e) {
    console.error(`[wolfvoice] ❌ Failed: ${e.message?.slice(0, 120)}`);
    // Never throw — don't break the main signal flow
  }
}

module.exports = { generateWolfText, sendVoiceSignal };
