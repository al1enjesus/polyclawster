# PolyClawster — Architecture

## Overview

PolyClawster = AI agent that trades Polymarket. Two deployment targets:

| Component | Runs on | Purpose |
|-----------|---------|---------|
| **Vercel** (polyclawster.com) | Vercel serverless | Landing page, TMA frontend, API functions |
| **VPS** (PM2 on vmi3057396) | This server | Bot polling, edge scanner, local API server |

## Components

### 🌐 Vercel (polyclawster.com)
Static files + serverless API functions:

```
public/index.html      → polyclawster.com/          (landing page)
public/app/index.html  → polyclawster.com/app        (SPA dashboard)
tma.html               → polyclawster.com/tma.html   (Telegram Mini App)
tma/src/index.html     → polyclawster.com/tma        (TMA alt entry)
skill.html             → polyclawster.com/skill      (skill page)

api/portfolio.js       → /api/portfolio
api/signals.js         → /api/signals
api/trade.js           → /api/trade
api/wallet-create.js   → /api/wallet/create
api/wallet-withdraw.js → /api/wallet/withdraw
api/balance.js         → /api/balance
api/chat.js            → /api/chat
api/feed.js            → /api/feed
api/agents.js          → /api/agents
api/demo-bonus.js      → /api/demo-bonus
api/wallet-stats.js    → /api/wallet-stats
```

**Env vars** (Vercel dashboard):
- `SUPABASE_URL`, `SUPABASE_KEY` — database
- `POLY_PRIVATE_KEY` — system wallet (encrypted by Vercel)
- `POLY_WALLET_ADDRESS` — public address
- `GH_TOKEN` — for data sync
- `HB_PROXY_*` — proxy for trading

### 🤖 VPS (PM2 processes)

```
pm2: polyclawster-bot   → tma/bot-v2.js      (Telegram bot, polling mode)
pm2: polyclawster-edge  → edge-runner.js      (Edge scanner, every 20 min)
pm2: polyclawster-api   → tma/api/server.js   (Local API :3456, SSR for TMA)
```

**Bot** (`tma/bot-v2.js`):
- Telegram polling, commands: /start /connect /stats /signals /portfolio /ref /help
- Onboarding flow (wallet connect)
- User data in Supabase
- Whale alerts broadcast
- Group support
- Daily digest (09:00 UTC)

**Edge Scanner** (`edge-runner.js` → `edge/index.js`):
- Runs every 20 min
- 5-stage pipeline: Markets → Orderbook → Wallets → Cross-market → News
- Auto-trades signals score 8+/10
- Pushes data.json to GitHub (for Vercel static reads)
- Sends Telegram alerts for strong signals

**Local API** (`tma/api/server.js` on :3456):
- SSR data injection for TMA
- /api/portfolio, /api/signals, /api/stats, /api/wallets
- /api/chat (AI chat via OpenAI)
- Used by bot for /signals and /portfolio commands

### 💾 Database (Supabase)

All persistent data in Supabase (`hlcwzuggblsvcofwphza.supabase.co`):

Tables: `users`, `wallets`, `bets`, `signals`, `referrals`, `payouts`

Client: `lib/db.js` — raw HTTPS requests, no SDK dependency.

### 📦 ClawHub Skill

Separate repo `al1enjesus/polyclawster` — published as OpenClaw skill on ClawHub.
Contains: `SKILL.md` + `scripts/` (edge.js, trade.js, balance.js, setup.js, clob-proxy.js)
Users install via `clawhub install polyclawster-agent`.

## File Layout

```
polyclawster-app/
├── api/                    # Vercel serverless functions
├── public/                 # Vercel static (landing + SPA)
├── tma/
│   ├── bot.js              # Bot v1 (legacy)
│   ├── bot-v2.js           # Bot v2 (active, PM2)
│   ├── api/
│   │   ├── server.js       # Local API + SSR server (:3456)
│   │   └── chat.js         # AI chat handler
│   └── src/index.html      # TMA source
├── edge/
│   ├── index.js            # Main scanner orchestrator
│   ├── config.js           # Central config
│   ├── edge-runner.js      # PM2 daemon (20 min interval)
│   └── modules/            # Scanner modules
│       ├── markets.js      # Polymarket API
│       ├── orderbook.js    # Orderbook analysis
│       ├── wallets.js      # Smart wallet tracking
│       ├── cross.js        # Cross-market correlations
│       ├── news.js         # News edge (Perplexity)
│       ├── trade.js        # Auto-execution (CLOB)
│       ├── risk.js         # Risk management
│       ├── tracker.js      # Position tracking
│       ├── notify.js       # Telegram notifications
│       ├── state.js        # File-based state
│       ├── signals-store.js# Signals history
│       ├── daily.js        # Daily digest
│       ├── sync-balances.js# Balance sync
│       ├── auto-swap.js    # Auto-swap USDC
│       ├── autotrader.js   # Autotrader logic
│       ├── users.js        # Legacy user management
│       └── http.js         # HTTP helper
├── lib/
│   └── db.js               # Supabase client
├── landing/                # Landing page assets
├── skills-dist/            # Skill package for ClawHub
├── tma.html                # TMA entry (Vercel static)
├── data.json               # Auto-synced portfolio data
├── users.json              # Auto-synced user data
├── vercel.json             # Vercel routing config
└── package.json
```

## Env Vars (VPS .env)

```
BOT_TOKEN=           # Telegram bot token
SUPABASE_URL=        # Supabase project URL
SUPABASE_KEY=        # Supabase anon key
GH_TOKEN=            # GitHub PAT for data sync
PERPLEXITY_API_KEY=  # News edge
POLYMARKET_PRIVATE_KEY=  # System wallet (optional, for auto-trade)
```

## Deploy

### Vercel (frontend + API)
```bash
cd /root/polyclawster-app
git push origin main   # auto-deploys via Vercel GitHub integration
```

### VPS (bot + edge + API)
```bash
cd /root/polyclawster-app
git pull origin main
pm2 restart polyclawster-bot polyclawster-edge polyclawster-api
```

## ⚠️ Known Issues

1. `edge/modules/trade.js` hardcodes `/workspace/polymarket-creds.json` path
2. `tma/api/server.js` has duplicate route definitions (/api/wallet, /api/wallet/create, /api/wallet/backup, /api/chat)
3. `edge-runner.js` pushes `users.json` to GitHub every 20 min (noisy commits)
4. Bot uses `node-fetch` via dynamic import (could use native fetch on Node 22)
5. `edge/config.js` reads `/config/openclaw.json` for BOT_TOKEN — won't exist on VPS
