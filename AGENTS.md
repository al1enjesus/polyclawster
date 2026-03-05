# AGENTS.md — PolyClawster

AI-бот для торговли на Polymarket. Telegram Bot + Mini App (TMA) + edge-runner + deposit-watcher.

## Архитектура

```
┌─────────────────────────────────────────────────┐
│                    Telegram                      │
│  Bot (@PolyClawsterBot) ←→ TMA (Mini App)       │
└────────────┬──────────────────┬──────────────────┘
             │                  │
    bot-v2.js (polling)    tma/src/index.html
             │                  │
             └──────┬───────────┘
                    ▼
         ┌──────────────────┐
         │   Supabase DB    │   ← lib/db.js (единая точка доступа)
         │  users, wallets, │
         │  bets, signals   │
         └──────────────────┘
                    ▲
         ┌──────────┴──────────┐
         │                     │
   edge-runner.js      deposit-watcher.js
   (сигналы + авто)    (USDC/POL мониторинг)
```

## Быстрый старт

```bash
# Клонировать
git clone https://github.com/al1enjesus/polyclawster-app.git
cd polyclawster-app && npm i

# Настроить .env
cp .env.example .env  # заполнить BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY

# Запустить
pm2 start tma/bot-v2.js --name polyclawster-bot
pm2 start tma/api/server.js --name polyclawster-api
pm2 start edge-runner.js --name polyclawster-edge
pm2 start deposit-watcher.js --name polyclawster-deposit

# Деплой фронта
npx vercel deploy --prod
```

## Структура репозитория

```
polyclawster-app/
├── api/                    # Vercel serverless API
│   ├── portfolio.js        #   GET /api/portfolio?tgId=...
│   ├── trade.js            #   POST /api/trade (demo + real)
│   ├── wallet-create.js    #   POST /api/wallet/create
│   ├── wallet.js           #   GET /api/wallet?tgId=...
│   ├── signals.js          #   GET /api/signals
│   ├── feed.js             #   GET /api/feed
│   ├── balance.js          #   GET /api/balance?tgId=...
│   ├── demo-bonus.js       #   POST /api/demo-bonus
│   ├── wallet-withdraw.js  #   POST /api/wallet/withdraw
│   ├── wallet-stats.js     #   GET /api/wallet-stats
│   ├── transactions.js     #   GET /api/transactions?tgId=...
│   ├── snapshots.js        #   GET /api/snapshots
│   ├── agents.js           #   GET /api/agents
│   └── chat.js             #   POST /api/chat (AI)
├── lib/                    # Shared библиотеки
│   ├── db.js               #   Supabase клиент (все CRUD)
│   ├── polymarket-trade.js  #   CLOB API торговля
│   ├── clob-proxy.js       #   Proxy для CLOB
│   └── wallet-balance.js   #   Polygonscan баланс
├── tma/                    # Telegram Mini App
│   ├── src/index.html      #   ⭐ ЕДИНСТВЕННЫЙ файл TMA (~5000 строк)
│   ├── bot-v2.js           #   Telegram бот (polling)
│   └── api/
│       ├── server.js       #   Локальный API :3456
│       └── chat.js         #   AI chat handler
├── edge/                   # Edge runner модули
│   ├── index.js            #   Главный runner
│   ├── config.js           #   Конфигурация
│   ├── cron.js             #   Расписание задач
│   ├── portfolio.js        #   Портфолио калькуляция
│   └── modules/
│       ├── sync-balances.js #  Синхронизация балансов
│       └── trade.js        #   Авто-торговля
├── public/                 # Лендинг polyclawster.com
│   ├── index.html          #   Главная страница
│   ├── icons/              #   PWA иконки
│   └── og-image.jpg        #   OG image
├── landing/                # Доп. ассеты лендинга
│   ├── icons/              #   Apple touch + PWA
│   └── *.png               #   AI chat превью
├── deposit-watcher.js      # PM2: мониторинг депозитов
├── edge-runner.js          # PM2: сигналы + авто-ставки
├── data.json               # Кеш сигналов/снепшотов
├── vercel.json             # Vercel конфиг
├── package.json
└── AGENTS.md               # Этот файл
```

## PM2 процессы

| Name | File | Порт | Описание |
|------|------|------|----------|
| `polyclawster-bot` | `tma/bot-v2.js` | — | Telegram бот (polling) |
| `polyclawster-api` | `tma/api/server.js` | 3456 | Локальный API |
| `polyclawster-edge` | `edge-runner.js` | — | Сигналы + авто-ставки |
| `polyclawster-deposit` | `deposit-watcher.js` | — | Депозиты USDC/POL |

## Supabase

**Проект:** `hlcwzuggblsvcofwphza`

| Таблица | PK | Ключевые поля |
|---------|----|---------------|
| `users` | `id` (tg_id) | `demo_balance`, `username`, `referred_by`, `onboarded` |
| `wallets` | `id` | `tg_id`, `address`, `private_key_enc` |
| `bets` | `id` | `tg_id`, `market`, `side`, `amount`, `is_demo`, `status` |
| `signals` | `id` | `market`, `score`, `side`, `source` |
| `referrals` | `id` | `referrer_id`, `referred_id` |
| `payouts` | `id` | `tg_id`, `amount`, `tx_hash` |

Все операции через `lib/db.js` (чистый `https`, без SDK).

## Баланс: real vs demo

**Критично: НЕ смешивать!**

| Переменная | Источник | Описание |
|------------|----------|----------|
| `window._realBalance` | Polymarket CLOB | Реальный USDC |
| `window._demoBal` | Supabase `demo_balance` | Demo-деньги |
| `window._inBets` | `/api/transactions` | Сумма в активных ставках |

- Новые юзеры получают **$1 demo** при создании кошелька
- Hero-баланс = `free + inBets` (не только free)
- При торговле: сначала real, потом demo
- Demo показывается фиолетовым с меткой "DEMO BALANCE"

## Депозиты

Принимаем **USDC и POL** на Polygon:
- USDC → зачисляется напрямую
- POL → автосвап в USDC через KyberSwap (deposit-watcher.js)
- Газ: оставляем 0.3 POL на комиссии

## Деплой

```bash
# Vercel (фронт + API)
cd /root/polyclawster-app
npx vercel deploy --token $VERCEL_TOKEN --yes --prod --scope virixl

# Бот
pm2 restart polyclawster-bot

# API
pm2 restart polyclawster-api
```

## OpenClaw Skill (ClawHub)

PolyClawster доступен как **OpenClaw skill** — пользователи устанавливают его через ClawHub и сразу получают агента для торговли на Polymarket.

### Установка скилла

```bash
clawhub install polyclawster-agent
```

### Что делает скилл

- Сканирует Polymarket на сигналы с высокой вероятностью (score 8+/10)
- Отслеживает активность китов и аномалии в ордербуке
- Автоматически размещает ордера через CLOB API
- Шлёт алерты в Telegram при сильных сигналах

### Скрипты скилла

| Скрипт | Назначение |
|--------|------------|
| `scripts/edge.js` | Сканер сигналов |
| `scripts/trade.js` | Размещение ордеров через CLOB |
| `scripts/balance.js` | Проверка баланса кошелька |
| `scripts/setup.js` | Визард начальной настройки |

### Как это работает вместе

1. Пользователь устанавливает скилл → агент получает возможность торговать
2. Заходит в TMA (`t.me/PolyClawsterBot`) → создаёт кошелёк
3. Пополняет USDC/POL → deposit-watcher зачисляет
4. Агент автоматически ставит по сигналам или юзер ставит вручную через TMA
5. Баланс отображается в дашборде (Portfolio + Wallet табы)

### Репозитории

| Репо | Описание | ClawHub |
|------|----------|---------|
| [`polyclawster-app`](https://github.com/al1enjesus/polyclawster-app) | Бот + TMA + API + edge | — |
| [`polyclawster`](https://github.com/al1enjesus/polyclawster) | OpenClaw skill | [`polyclawster-agent`](https://clawhub.com/skills/polyclawster-agent) |

## ⚠️ Важные правила

1. **Один бот = один polling** — никогда не запускать второй экземпляр bot-v2.js (409 Conflict)
2. **Нет дубля tma.html** в корне — Vercel route `/tma.html` → `tma/src/index.html`
3. **Синхронизация API** — изменил `api/*.js` → Vercel deploy; изменил `tma/api/server.js` → pm2 restart
4. **API параметр `tgId`** (camelCase) — `tg_id` возвращает null
5. **Приватные ключи** хранятся plain text в `wallets.private_key_enc` — TODO: шифрование
6. **polymarket-creds.json** — НЕ коммитить (в .gitignore)

## Env vars

| Var | Обязательно | Описание |
|-----|:-----------:|----------|
| `BOT_TOKEN` | ✅ | Telegram bot token |
| `SUPABASE_URL` | ✅ | `https://hlcwzuggblsvcofwphza.supabase.co` |
| `SUPABASE_KEY` | ✅ | Service role JWT |
| `POLY_WALLET_ADDRESS` | ✅ | Master Polygon wallet |
| `POLY_PRIVATE_KEY` | ✅ | Master wallet private key |
| `PERPLEXITY_API_KEY` | — | AI анализ сигналов |
| `HB_PROXY_USER` | — | Residential proxy |
| `HB_PROXY_PASS` | — | Residential proxy |
