# MEMORY.md — Рабочая память по PolyClawster

## Архитектура кошельков

### Создание кошелька
- При `/start` или `create_wallet` → `ethers.Wallet.createRandom()`
- **Без seed phrase** — только приватный ключ
- Кошелёк сохраняется в Supabase: `wallets` таблица (`tg_id`, `address`, `private_key_enc`)
- `private_key_enc` — хранится **plain text** (TODO: шифрование), поле NOT NULL
- Юзер получает **$1 demo** при создании (`demo_balance: 1.00`)

### Мастер-кошелёк (System Wallet)
- **Адрес:** `0xd58BE7E2Ac45ac822adFab5C1845e8016679a5eA`
- Приватный ключ в `.env` → `POLY_PRIVATE_KEY`
- API credentials в `polymarket-creds.json` (НЕ коммитится)
- Используется edge-runner'ом для авто-торговли
- CLOB API key **зарегистрирован** и сохранён в `polymarket-creds.json`

### Per-User API Keys
- Каждый юзер может получить свой Polymarket CLOB API key
- `getApiCredsForWallet()` → derive от подписи кошелька → регистрирует ключ в Polymarket
- Кешируется в памяти (`_apiKeyCache`)
- Если адрес == мастер → берёт из `polymarket-creds.json`

### Баланс
- **Real balance** (`window._realBalance`): из Polymarket CLOB API
- **Demo balance** (`window._demoBal`): из Supabase `users.demo_balance`
- **In Bets** (`window._inBets`): сумма активных ставок из `/api/transactions`
- Hero-баланс = `free + inBets` (не только free!)
- При торговле: сначала real, потом demo

### Получение баланса (lib/wallet-balance.js)
1. CLOB API (если есть privateKey + apiCreds) → free USDC collateral
2. Polymarket data-api → открытые позиции (CTF tokens)
3. Polygon RPC (fallback) → on-chain USDC (USDC.e + native)
- **Важно:** баланс on-chain может быть 0, даже если деньги "в" Polymarket — они в CTF контракте

## Торговля (lib/polymarket-trade.js)

### Flow
1. Build wallet from private key (ethers)
2. Get/derive CLOB API keys
3. Resolve market tokenId (conditionId → CLOB → Gamma API fallback)
4. Check free balance (CLOB API)
5. Build + sign order locally
6. POST signed order через **residential proxy** (bypass datacenter ASN block)

### Proxy (lib/clob-proxy.js)
- Polymarket блокирует datacenter IP (Vercel, Hetzner, AWS) на POST /order
- Используется Decodo (human-browser skill) residential proxy
- Порт 10001 (sticky session), страна US
- `HB_PROXY_USER` / `HB_PROXY_PASS` в .env
- Fallback: trial из human-browser skill

### Order Types
- FOK (Fill or Kill) по умолчанию
- Limit price = best ask + 0.05 (max 1 - tickSize)
- Side: BUY YES или BUY NO (выбор token index 0 или 1)

## Deposit Watcher (deposit-watcher.js)

- PM2 процесс, проверяет каждые 60 сек
- **USDC** → зачисляется напрямую
- **POL** → автосвап через KyberSwap → USDC
- Оставляет 0.3 POL на газ, минимум для свапа 1.0 POL
- Уведомляет юзера в Telegram

## Edge Runner (edge-runner.js + edge/)

### Цикл: каждые 20 минут
1. Risk management → scan risk
2. Check resolutions (tracker) → закрытые ставки
3. Sync balances → обновление балансов всех юзеров
4. Auto-swap → POL→USDC если накопился
5. Scan markets → top markets с Polymarket
6. Scan orderbooks → whale orders, volume spikes
7. Discover wallets → smart money tracking
8. Cross-market analysis
9. News edge → Perplexity AI анализ
10. Score signals → 0-10 score
11. Execute trades → авто-ставки на сигналы 7.5+
12. Push data.json → GitHub → Vercel reads it

### Конфигурация (edge/config.js)
- OB_BIG: $5k+ order = interesting
- OB_WHALE: $20k+ = whale
- OB_IMBALANCE: 3:1 bid/ask ratio
- SW_MIN_WR: 58%+ win rate для smart wallets
- SW_MIN_CLOSED: 8+ закрытых позиций
- SW_MIN_BET: $150+ средняя ставка

### Signal Scoring
- 8-10 → STRONG (отправляется сразу)
- 5-7 → MEDIUM (top 3 из группы)
- <5 → WEAK (только лог)

## Supabase

- **Project ID:** `hlcwzuggblsvcofwphza`
- **Без SDK** — чистый `https` через `lib/db.js`
- Все CRUD через REST API с service role JWT

### Таблицы
| Таблица | PK | Ключевые поля |
|---------|----|---------------|
| `users` | `id` (tg_id) | `demo_balance`, `username`, `referred_by`, `onboarded`, `ref_count` |
| `wallets` | `id` | `tg_id`, `address`, `private_key_enc`, `network` |
| `bets` | `id` | `tg_id`, `market`, `market_id`, `side`, `amount`, `is_demo`, `status` |
| `signals` | `id` | `market`, `score`, `side`, `source`, `token_id`, `market_id` |
| `referrals` | `id` | `referrer_id`, `referee_id`, `commission_rate` (0.40) |
| `payouts` | `id` | `tg_id`, `amount`, `reason`, `status`, `tx_hash` |

## PM2 Процессы

| Name | File | Port | Description |
|------|------|------|-------------|
| `polyclawster-bot` | `tma/bot-v2.js` | — | Telegram бот (polling) |
| `polyclawster-api` | `tma/api/server.js` | 3456 | Локальный API |
| `polyclawster-edge` | `edge-runner.js` | — | Сигналы + авто-ставки |
| `polyclawster-deposit` | `deposit-watcher.js` | — | Депозиты USDC/POL |

## Деплой

- **Vercel** (фронт + serverless API): `npx vercel deploy --token $VERCEL_TOKEN --yes --prod --scope virixl`
- **PM2** (бот + edge + deposit): `pm2 restart <name>`
- **GitHub push** от edge-runner: обновляет `data.json` для Vercel

## Важные правила (напоминание)

1. Один бот = один polling (409 Conflict если два)
2. API параметр `tgId` (camelCase), НЕ `tg_id`
3. TMA route: `/tma.html` → `tma/src/index.html`
4. `polymarket-creds.json` НЕ коммитить
5. Комиссия 5% только с прибыли (`FEE_PCT = 0.05`)
6. Реферальная комиссия: 1% (ранее 40% в таблице?)
7. Фильтр маркетов: спорт/крипто excluded (config.SPORTS)

## Интеграции настроены
- ✅ Telegram Bot (@PolyClawsterBot)
- ✅ Supabase DB
- ✅ Polymarket CLOB API
- ✅ Residential proxy (Decodo/human-browser)
- ✅ KyberSwap (POL→USDC swap)
- ✅ Vercel deploy
- ✅ GitHub push (data.json auto-sync)
- ✅ Polygon RPC (balance checks)
- ✅ Gamma API (market lookup)
- ✅ Perplexity AI (news analysis)

## TODO — Активные задачи

### 🔴 Починить оплату звёздами (Stars Payment)
**Проблема:** Нужно проверить и починить flow оплаты Telegram Stars.
**Текущее состояние:**
- `api/stars-invoice.js` — создаёт инвойс через `createInvoiceLink` → возвращает link
- `tma/src/index.html` → `buyStars(stars)` — вызывает `/api/stars-invoice`, открывает через `tg.openInvoice(link, callback)`
- `tma/bot-v2.js` → `handlePreCheckout()` + `handleStarsPayment()` — обрабатывает `pre_checkout_query` и `successful_payment`
- Stars зачисляются в `demo_balance` (НЕ real!) — строка 427-428 bot-v2.js
- **Потенциальная проблема #1:** `getUpdates` НЕ передаёт `allowed_updates` — Telegram может не слать `pre_checkout_query`
- **Потенциальная проблема #2:** Stars зачисляются в `demo_balance`, а юзер платит реальные деньги — нужно уточнить логику
- **Потенциальная проблема #3:** Нет retry / error handling если `answerPreCheckoutQuery` не дошёл

### 🔴 Починить пополнение юзерского кошелька (Deposit)
**Проблема:** Нужно проверить и починить deposit flow.
**Текущее состояние:**
- Crypto deposit: юзер шлёт USDC/POL на свой Polygon адрес
- `deposit-watcher.js` (PM2) — проверяет каждые 60 сек через Polygonscan API
- POL → автосвап через KyberSwap → USDC
- **PM2 процессы НЕ запущены** (pm2 list пуст!) — ничего не работает
- TMA deposit sheet: 2 таба — Crypto (QR + адрес) и Stars
- `_loadDepositAddr()` — подгружает адрес кошелька через `/api/wallet?tgId=`
- `copyDepositAddr()` — копирование
- Нужно поднять PM2 процессы и проверить весь flow

## Инфраструктура: два сервера

### Этот workspace (OpenClaw)
- Код, git, Vercel deploy
- **НЕТ** PM2, **НЕТ** .env с секретами бота
- Для серверных задач → составляю ТЗ, Илья копирует агенту на другом сервере

### Другой сервер (PM2 + бот)
- PM2 процессы: `polyclawster-bot`, `polyclawster-api`, `polyclawster-edge`, `polyclawster-deposit`
- `.env` с BOT_TOKEN, SUPABASE_KEY, POLY_PRIVATE_KEY и т.д.
- Бот на чистом Node.js (НЕ Next.js)
- Прямого доступа нет — работаю через ТЗ для тамошнего агента
