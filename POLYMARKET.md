# Polymarket Trading Bot

## Архитектура

```
polymarket-bot.js          ← Главный оркестратор
├── polymarket-smartmoney.js  ← Следит за умными трейдерами
├── polymarket-marketmaker.js ← Пассивный заработок на спреде
├── polymarket-ws.js          ← WebSocket real-time фид
├── polymarket-monitor.js     ← Алерты на спайки цен
└── polymarket-config.json    ← Конфигурация
```

## Кошелёк
- Адрес: `0x3eAe9f8a3E1EBA6B7F4792fC3877E50A32e2C47B`
- Сеть: Polygon (MATIC)
- Токен: USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)
- Ключи: `/workspace/polymarket-creds.json` (не коммитить!)

## Запуск

```bash
# Боевой режим
node polymarket-bot.js

# Тестовый режим (без реальных ставок)
node polymarket-bot.js --dry-run

# Статус позиций
node polymarket-bot.js --status

# Только алерты (без торговли)
node polymarket-monitor.js

# Слежка за умными деньгами
node polymarket-smartmoney.js
```

## Стратегии

### 1. Smart Money Tracker
Следит за проверенными трейдерами каждые 30 сек:
- **HourlyTrader** — торгует BTC/ETH/SOL/XRP Up/Down на часовых таймфреймах
- **IranWhale** — инсайдерские ставки на политические события

Настройка в `polymarket-config.json`:
```json
"smartMoney": {
  "copyTrading": false,    // true = автоматически копировать
  "minTradeSize": 100,     // минимальная сделка для алерта
  "maxCopyUSDC": 20        // максимум на копируемую ставку
}
```

### 2. Price Monitor (Spike Alerts)
Детектирует резкие изменения цен (>15% за цикл):
- Исключает спорт автоматически
- Алертит на Safe Bets (95%+ вероятность, закрытие <72ч)
- Запускается каждые 60 секунд

### 3. Market Maker (экспериментальный)
Выставляет лимитные ордера с обеих сторон на рынках с наградами:
- Зарабатывает спред + ежедневные USDC rewards
- Цель: $5-15/день на $200-400 капитале
- Требует отдельного тестирования

## Технические детали

### Proxy
Все запросы к Polymarket идут через Decodo residential proxy (NL):
```js
await getTrial(); // получить credentials
// Автоматически патчит https.request
```

### CLOB API
- Host: https://clob.polymarket.com
- Auth: EIP-712 подпись (L1) + HMAC API key (L2)
- Важно: `negRisk: false` для большинства рынков (проверять поле `neg_risk`)
- Токен: USDC.e (не нативный USDC!)

### Известные ограничения
- Polymarket блокирует datacenter IP → нужен residential proxy
- FOK ордера требуют ликвидности в стакане
- negRisk рынки используют другой контракт (0xC5d5...)
- Рынки Up/Down уже закрытые возвращают false

## Трекаемые кошельки

| Имя | Адрес | Стиль |
|-----|-------|-------|
| HourlyTrader | 0xf247584e41117bbbe4cc06e4d2c95741792a5216 | Крипто Up/Down, часовые |
| IranWhale | 0x2974bd0059e48f215c391882976e0f1b4c8c9c23 | Политика, инсайд |

## Управление рисками
- Максимум 15% капитала на одну ставку
- Максимум 5 открытых позиций
- Дневной лимит потерь: $50
- Автостоп при достижении лимита

## Что нужно для HFT (следующий уровень)
1. WebSocket подписка вместо polling (latency <100ms)
2. Rust клиент (`Polymarket/rs-clob-client`) для скорости
3. Dedicated нода Polygon RPC (не публичная)
4. VPS в Амстердаме (ближе к серверам Polymarket)
5. Постоянный residential proxy (не trial)

## История ставок
| Дата | Событие | Сумма | Результат |
|------|---------|-------|-----------|
| 2026-02-28 | Rihanna YES | $5 | Ожидание |
| 2026-02-28 | San Jose UNDER | $15 | Ожидание |
| 2026-02-28 | Khamenei YES (Feb28) | $39 | Ожидание |
| 2026-02-28 | Khamenei YES (Mar31) | $20 | Ожидание |
