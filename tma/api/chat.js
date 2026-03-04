/**
 * AI Chat handler — знает о портфеле, сигналах, рынке
 */
const fs = require('fs');

async function handleChat(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const { message, tgId } = JSON.parse(body || '{}');
        if (!message) { resolve({ reply: 'No message' }); return; }

        // Загружаем контекст
        const data = JSON.parse(fs.readFileSync('/workspace/data.json', 'utf8'));
        const port = data.portfolio;
        const sigs = (data.signals || []).sort((a,b) => (b.score||0)-(a.score||0)).slice(0,5);

        // Строим системный промпт с реальными данными
        const systemPrompt = `You are PolyClawster AI — an expert Polymarket trading assistant with access to live data.

CURRENT AI PORTFOLIO (live):
- Total Value: $${port.totalValue?.toFixed(2)}
- P&L: +$${port.totalPnl?.toFixed(2)} (+${port.pnlPct?.toFixed(1)}%)
- Open Positions: ${port.positions?.length}
- Top positions: ${port.positions?.slice(0,3).map(p => `${p.title?.slice(0,40)} (${p.outcome} ${Math.round((p.curPrice||0)*100)}¢, P&L ${p.cashPnl?.toFixed(2)})`).join('; ')}

TOP SIGNALS RIGHT NOW (scored 0-10):
${sigs.map(s => `- [${s.score?.toFixed(1)}] ${s.market?.slice(0,50)} → ${s.side||'YES'} at ${Math.round((s.price||0)*100)}¢`).join('\n')}

HOW YOU WORK:
- You scan 53 smart money wallets on Polymarket every 30 min
- Score 8+ = strong signal = auto-trade executes
- Performance fee: 5% on profits only
- Max bet: $50 per signal

Answer concisely. If asked about a market, give probability assessment. 
If asked to trade — explain the signal logic. Respond in the language the user writes in.`;

        // Используем OpenAI через наш сервер
        const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
        const cfg = JSON.parse(fs.readFileSync('/config/openclaw.json', 'utf8'));
        const apiKey = cfg.env?.OPENAI_API_KEY;

        const r = await (await fetch)('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            max_tokens: 600,
            temperature: 0.7
          })
        });
        const d = await r.json();
        const reply = d.choices?.[0]?.message?.content;
        if (reply) resolve({ reply });
        else resolve({ reply: 'AI temporarily unavailable. Try again.' });

      } catch(e) {
        console.error('[chat]', e.message);
        resolve({ reply: 'Error: ' + e.message.slice(0,100) });
      }
    });
  });
}

module.exports = { handleChat };
