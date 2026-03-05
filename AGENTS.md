# AGENTS.md — PolyClawster

AI-бот для Polymarket. Telegram bot + Mini App (TMA) + edge-runner для автоставок.

## Архитектура

```
Telegram ←→ bot-v2.js (polling, PM2)
                ↕
TMA (index.html) ←→ Vercel API routes ←→ Supabase
                ↕
edge-runner.js → сигналы + авто-ставки (PM2)
deposit-watcher.js → мониторинг депозитов POL/USDC (PM2)
```

## Стек

- **DB**: Supabase (hlcwzuggblsvcofwphza) — таблицы: users, wallets, bets, signals, referrals, payouts
- **Фронт**: один HTML файл `tma/src/index.html` (TMA, ~5000 строк)
- **API**: Vercel serverless functions (`api/*.js`)
- **Бот**: Node.js polling (`tma/bot-v2.js`)
- **Деплой фронта**: Vercel (`polyclawster.com`)
- **Деплой бэка**: PM2 на VPS

## Структура файлов

### `tma/src/index.html` — ЕДИНСТВЕННЫЙ файл TMA
Фронтенд Telegram Mini App. Все табы, стили, JS в одном файле.
- **Табы**: Portfolio, Signals, Stats, Wallet, Agents, Chat
- **Ключевые переменные**:
  - `window._realBalance` — реальный USDC баланс (с Polymarket)
  - `window._demoBal` — demo-баланс (из Supabase, синхронизируется в localStorage `pc_demo_balance`)
  - `window._userWallet` — адрес кошелька
  - `window._hasDeposited` — были ли реальные депозиты
- **НИКОГДА** не создавай дубль `tma.html` в корне. Vercel route `/tma.html` → `tma/src/index.html`

### `tma/bot-v2.js` — Telegram бот
- Polling mode, PM2 process `polyclawster-bot`
- Команды: /start, /wallet, /balance, /stats, /ref
- Авто-создание кошелька (ethers.Wallet.createRandom)
- Реферальная система
- **ОДИН экземпляр** — никогда не запускать второй (409 Conflict)

### `tma/api/server.js` — локальный API сервер
- Порт 3456, PM2 process `polyclawster-api`
- Те же эндпоинты что на Vercel, но для локальной отладки
- Обязательно синхронизировать с `api/*.js` на Vercel

### `api/*.js` — Vercel serverless functions
| Файл | Роут | Описание |
|------|------|----------|
| `portfolio.js` | `/api/portfolio` | Портфолио юзера: баланс, позиции, сигналы |
| `trade.js` | `/api/trade` | Ставки (demo + real через CLOB) |
| `wallet-create.js` | `/api/wallet/create` | Создание кошелька (ethers) |
| `wallet.js` | `/api/wallet` | Данные кошелька |
| `balance.js` | `/api/balance` | Баланс USDC |
| `signals.js` | `/api/signals` | Список сигналов |
| `feed.js` | `/api/feed` | Лента событий |
| `demo-bonus.js` | `/api/demo-bonus` | Выдача demo-бонуса |
| `wallet-withdraw.js` | `/api/wallet/withdraw` | Вывод USDC |
| `wallet-stats.js` | `/api/wallet-stats` | Статистика кошелька |

### `lib/db.js` — Supabase клиент
- Чистый `https` модуль, без SDK
- Все операции: getUser, upsertUser, getWallet, upsertWallet, insertBet, etc.
- Используется ВЕЗДЕ: bot, API, edge, deposit-watcher
- **Env**: `SUPABASE_URL`, `SUPABASE_KEY` (service_role)

### `lib/polymarket-trade.js` — торговля через CLOB
- Polymarket CLOB API для размещения ордеров
- Поддержка master wallet (polymarket-creds.json) и user wallets

### `lib/wallet-balance.js` — баланс кошелька
- Polygonscan API для проверки USDC балансов

### `edge-runner.js` / `edge/` — периодические задачи
- PM2 process `polyclawster-edge`
- Модули в `edge/modules/`:
  - `sync-balances.js` — синхронизация балансов из блокчейна в Supabase
  - `trade.js` — авто-торговля по сигналам
- Конфиг: `edge/config.js`
- Запускается каждые 30 мин

### `deposit-watcher.js` — мониторинг депозитов
- PM2 process `polyclawster-deposit`
- Каждые 60 сек проверяет входящие USDC и POL
- POL автоматически свапается в USDC через KyberSwap
- Уведомляет юзера в Telegram при получении депозита

## PM2 процессы

| Name | File | Описание |
|------|------|----------|
| `polyclawster-bot` | `tma/bot-v2.js` | Telegram бот (polling) |
| `polyclawster-api` | `tma/api/server.js` | Локальный API :3456 |
| `polyclawster-edge` | `edge-runner.js` | Сигналы + авто-ставки |
| `polyclawster-deposit` | `deposit-watcher.js` | Мониторинг депозитов |

## Деплой

```bash
# Vercel (фронт + API)
cd /root/polyclawster-app
npx vercel deploy --token $VERCEL_TOKEN --yes --prod

# Бот (после изменений в bot-v2.js)
pm2 restart polyclawster-bot

# API (после изменений в server.js)
pm2 restart polyclawster-api
```

## Env vars (.env)

| Var | Описание |
|-----|----------|
| `BOT_TOKEN` | Telegram bot token |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase service_role JWT |
| `GH_TOKEN` | GitHub PAT (legacy, не используется) |
| `PERPLEXITY_API_KEY` | Для AI-анализа сигналов |

## Supabase таблицы

| Таблица | PK | Описание |
|---------|-----|----------|
| `users` | `id` (tg_id) | Юзеры: баланс, реферал, onboarded |
| `wallets` | `id` | Кошельки: address, private_key_enc, tg_id |
| `bets` | `id` | Ставки: market, side, amount, is_demo, status |
| `signals` | `id` | Сигналы от whale tracker |
| `referrals` | `id` | Реферальные связи |
| `payouts` | `id` | Выплаты |

## Баланс — real vs demo

**Критично: НЕ смешивать real и demo балансы!**

- `window._realBalance` = реальные USDC (totalValue из Polymarket CLOB)
- `window._demoBal` = demo-доллары (из Supabase users.demo_balance)
- При торговле: сначала проверяем real, потом demo
- Hero-баланс: показываем real → deposited → demo (в порядке приоритета)
- Новые юзеры получают $1 demo при создании кошелька

## Депозиты

Принимаем **USDC и POL** на Polygon:
- USDC зачисляется напрямую
- POL автоматически свапается в USDC через KyberSwap (deposit-watcher.js)
- Газ: оставляем 0.3 POL на комиссии

## ⚠️ Грабли

1. **Один бот — один polling**: никогда не запускать второй экземпляр bot-v2.js
2. **tma.html дубль**: НЕ создавать `tma.html` в корне — route в vercel.json указывает на `tma/src/index.html`
3. **Синхронизация API**: при изменении `api/*.js` — деплоить Vercel. При изменении `tma/api/server.js` — pm2 restart
4. **Demo balance**: `_userValue` убран, использовать `_realBalance` и `_demoBal` отдельно
5. **Telegram кеш**: TMA кешируется агрессивно. Добавлен `?v=N` в URL и no-cache meta
6. **polymarket-creds.json**: master wallet credentials, НЕ коммитить

## Файлы которые можно удалить

Легаси/мусор в корне (не используются, можно удалить):
- `discord_*.js` — попытки Discord логина
- `solve_*.js` — hcaptcha солверы
- `bypass_qrator.js`, `real_browser.js`, `test_ac.js`
- `tma/bot.js` — старый бот (заменён bot-v2.js)
- `tma/src/index.html.bak*` — бэкапы
- `users.json` — legacy (всё в Supabase)
