# ARCH.md — Polyclawster System Architecture

## Overview
Polyclawster is a Polymarket trading TMA (Telegram Mini App) + edge signal runner.
Users connect via Telegram, get a Polygon wallet, deposit USDC, and place bets on prediction markets.

---

## Components

### 1. TMA (Telegram Mini App)
- **Served from**: Vercel (`/public/tma.html`, `tma-portfolio.html`, etc.)
- **API**: Next.js API routes under `/api/`
- **Auth**: Telegram WebApp initData (validated in API routes)

### 2. API Routes (`/api/`)
| Route | Purpose |
|---|---|
| `trade.js` | Execute real/demo Polymarket bet |
| `balance.js` | Real-time wallet balance (CLOB + positions + on-chain) |
| `wallet.js` | Wallet info from Supabase |
| `wallet-create.js` | Create Polygon wallet for new user |
| `portfolio.js` | Portfolio data for TMA display |
| `signals.js` | Active signals feed |
| `transactions.js` | Transaction history |
| `feed.js` | Combined signal + position feed |

### 3. Edge Runner (`/edge/`)
Runs every heartbeat (~every 20 min via HEARTBEAT.md):
```
edge/index.js → orchestrates:
  - modules/markets.js    → fetch top Polymarket markets
  - modules/orderbook.js  → scan for big orders / volume spikes
  - modules/wallets.js    → track smart wallet activity
  - modules/news.js       → Perplexity news edge detection
  - modules/cross.js      → cross-market correlation signals
  - modules/risk.js       → risk scoring
  - modules/trade.js      → auto-execute on score >= 8
  - modules/tracker.js    → track open bet resolutions
  - modules/signals-store.js → persist signals to GitHub
```

### 4. Database — Supabase
| Table | Key fields |
|---|---|
| `users` | id (tg_id), address, total_deposited, total_pnl, demo_balance, ref_count |
| `wallets` | tg_id, address, private_key_enc, network |
| `bets` | tg_id, market, market_id, side, amount, price, status, is_demo |
| `signals` | type, score, market, created_at |

### 5. GitHub Repos
- `al1enjesus/polyclawster` — main app (this workspace)
- `al1enjesus/polyclawster-app` — public data: `data.json`, `users.json`, `signals_history.json`

---

## Wallet Architecture

### System Trading Wallet (auto-trader)
```
Address:     0x3eAe9f8a3E1EBA6B7F4792fC3877E50A32e2C47B
Mnemonic:    in polymarket-creds.json
Private key: 0x18bf911507bda6372ff5aafa60439d2e27b7308267293f03eca629f9ff1f2289
API key:     ba45cd3a-... (in polymarket-creds.json)
Network:     Polygon (chainId=137)
```
Used by: `edge/modules/trade.js`, `edge/portfolio.js`

### User Wallets (per-user trading)
- Created via `api/wallet-create.js` (deterministic from tg_id)
- Stored in Supabase `wallets` table: `{ tg_id, address, private_key_enc }`
- API keys derived on-demand via `lib/polymarket-trade.js:getApiCredsForWallet()`
- `private_key_enc` = raw private key (NOT encrypted yet — TODO: add encryption)

### Balance Model ⚠️ CRITICAL
```
Free USDC (spendable)   = CLOB collateral balance
Positions value (locked) = open bets in CTF (conditional token framework)
Total portfolio value    = free USDC + positions value
```
**IMPORTANT**: `total_deposited` and `total_pnl` in Supabase are SNAPSHOTS, not live.
For real-time balance, always use `lib/wallet-balance.js:getWalletBalance()`.

When all USDC is in open positions → free balance = $0 → can't place new bets.
To free up: sell/close positions on Polymarket, or deposit more USDC.

---

## Trade Execution Flow

```
User taps YES/NO in TMA
  → POST /api/trade { tgId, market, conditionId, side, amount }
  → api/trade.js:
      1. Load user from Supabase
      2. Get wallet + private_key_enc from Supabase wallets
      3. Check master creds match → get API key
      4. lib/polymarket-trade.js:executeTrade()
           a. Build ethers.Wallet from privateKey
           b. Resolve CLOB API creds (master or derive new)
           c. Check CLOB free balance (getBalanceAllowance)
           d. Find market tokenId (conditionId → CLOB → Gamma fallback)
           e. Get tick size + fee rate
           f. Get best ask price from orderbook
           g. createMarketOrder (signed locally, no network)
           h. POST via residential proxy (lib/clob-proxy.js)
               → Decodo proxy (bypasses Polymarket datacenter block)
           i. Parse CLOB response
      5. Insert bet into Supabase bets table
      6. Return result to TMA
```

### Why Residential Proxy?
Polymarket blocks POST /order from datacenter IPs (Vercel, Hetzner, AWS).
Read endpoints (GET /markets, /orderbook, etc.) work fine without proxy.
`lib/clob-proxy.js` routes only POST /order through Decodo residential IP.

---

## Balance Sync Architecture

### Real-time (per request)
`lib/wallet-balance.js:getWalletBalance(address, pk, apiCreds)`:
1. CLOB API → free USDC (authenticated, fastest)
2. data-api.polymarket.com/positions → open bets value
3. Polygon RPC → on-chain USDC (fallback)

### Heartbeat (every ~20 min)
`edge/portfolio.js`:
- Checks free USDC + positions
- Sends Telegram alert if change > $2

### Supabase `total_pnl` / `total_value` sync
⚠️ Currently manual/stale. TODO: update via tracker.js when bets resolve.

---

## Deposit Flow
1. User gets wallet address from TMA
2. Sends USDC.e (bridged) or USDC (native) to address on Polygon
3. `edge/modules/tracker.js` (or deposit-watch) detects incoming tx
4. Updates Supabase `total_deposited` + notifies user

---

## Signal Flow

```
edge/index.js (heartbeat)
  → scan markets, orderbooks, wallets, news
  → score signals 0–10
  → score >= 8 → auto-execute trade (edge/modules/trade.js)
  → score >= 5 → send Telegram alert
  → save to GitHub signals_history.json
  → TMA reads signals via /api/signals or /api/feed
```

---

## Known Issues / TODOs

| Issue | Status | Fix |
|---|---|---|
| Free USDC = 0, all in positions | ⚠️ Current state | Deposit more USDC or sell positions |
| `private_key_enc` not encrypted | 🔴 Security risk | Add AES encryption with master key |
| User API key derivation untested | 🟡 Needs test | test with real user wallet |
| `total_pnl` in Supabase stale | 🟡 Known | Wire tracker.js to update on resolution |
| Supabase wallets missing for new users | 🟡 | wallet-create.js already handles this |

---

## File Map

```
/workspace/
├── ARCH.md              ← this file
├── SOUL.md              ← agent personality
├── USER.md              ← Ilya's info
├── polymarket-creds.json← system wallet credentials (keep secret)
├── .env                 ← SUPABASE_URL, SUPABASE_KEY, GH_TOKEN
├── lib/
│   ├── db.js            ← Supabase REST client
│   ├── polymarket-trade.js ← CLOB order execution
│   ├── clob-proxy.js    ← residential proxy for POST /order
│   └── wallet-balance.js← real-time balance (NEW)
├── api/
│   ├── trade.js         ← POST /api/trade
│   ├── balance.js       ← GET /api/balance
│   ├── wallet.js        ← GET /api/wallet
│   ├── wallet-create.js ← POST /api/wallet/create
│   ├── portfolio.js     ← GET /api/portfolio
│   ├── signals.js       ← GET /api/signals
│   └── ...
├── edge/
│   ├── index.js         ← heartbeat orchestrator
│   ├── portfolio.js     ← portfolio tracker
│   ├── config.js        ← constants & wallet addresses
│   └── modules/
│       ├── trade.js     ← auto-execution
│       ├── tracker.js   ← bet resolution tracking
│       ├── markets.js   ← market scanner
│       ├── orderbook.js ← orderbook scanner
│       ├── wallets.js   ← smart wallet tracker
│       ├── news.js      ← news edge
│       ├── notify.js    ← Telegram notifications
│       └── state.js     ← JSON file state management
└── public/
    └── tma.html         ← Telegram Mini App UI
```

---

*Last updated: 2026-03-04*
