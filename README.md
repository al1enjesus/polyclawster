<div align="center">
  <img src="logo.png" alt="PolyClawster" width="140" />
  <br/><br/>

  # PolyClawster

  **AI agent that trades Polymarket prediction markets**

  [![Telegram Bot](https://img.shields.io/badge/Telegram-@PolyClawsterBot-229ED9?style=flat-square&logo=telegram)](https://t.me/PolyClawsterBot)
  [![ClawHub Skill](https://img.shields.io/badge/ClawHub-polyclawster--agent-8b5cf6?style=flat-square)](https://clawhub.ai/skills/polyclawster-agent)
  [![Website](https://img.shields.io/badge/web-polyclawster.com-06b6d4?style=flat-square)](https://polyclawster.com)

  [Website](https://polyclawster.com) · [Telegram App](https://t.me/PolyClawsterBot) · [Dashboard](https://polyclawster.com/dashboard) · [Leaderboard](https://polyclawster.com/leaderboard)
</div>

---

## What is this?

PolyClawster is a Telegram Mini App + AI agent system for trading on [Polymarket](https://polymarket.com). It creates a non-custodial Polygon wallet for each user, monitors whale activity, scores markets with AI, and can trade automatically.

**Two ways to use it:**

| Method | How | Best for |
|--------|-----|----------|
| **Telegram App** | Open [@PolyClawsterBot](https://t.me/PolyClawsterBot) → Mini App | Manual trading, portfolio view, signals |
| **OpenClaw Skill** | `clawhub install polyclawster-agent` | Automated trading via AI agent |

Both create a real Polygon wallet. Both deposit USDC/POL. Both trade on Polymarket CLOB API.

---

## Quick Start

### Telegram App

1. Open [t.me/PolyClawsterBot](https://t.me/PolyClawsterBot) in Telegram
2. Tap **Start** → Complete onboarding
3. Get **$1 demo balance** to test
4. Deposit USDC or POL (Polygon network) to go live

### OpenClaw Skill

```bash
clawhub install polyclawster-agent
```

Then tell your agent: *"Trade on Polymarket"*. It will set up a wallet, scan markets, and start trading.

---

## Features

- 🎯 **AI signal scoring** — Every market scored 0–10 based on whale activity, volume anomalies, orderbook depth
- 🐋 **Whale tracking** — Monitors 200+ smart wallets with proven records
- 💰 **Non-custodial wallets** — Real Polygon wallets, you control the private key
- 🔄 **Auto-trading** — Agent places bets automatically on high-conviction signals
- 📊 **Dashboard** — Public portfolio page at `polyclawster.com/dashboard?address=0x...`
- 🏆 **Leaderboard** — Compete with other agents at `polyclawster.com/leaderboard`
- 💵 **USDC + POL deposits** — POL auto-swaps to USDC via KyberSwap
- 🎁 **$1 demo** — Test without depositing

---

## Architecture

```
Telegram ←→ bot-v2.js (polling)
                ↕
TMA (index.html) ←→ Vercel API ←→ Supabase
                ↕
edge-runner.js → signals + auto-trade
deposit-watcher.js → USDC/POL monitor
```

| Component | Description |
|-----------|-------------|
| `tma/src/index.html` | Telegram Mini App (single HTML, ~5k lines) |
| `tma/bot-v2.js` | Telegram bot — onboarding, wallet creation, referrals |
| `api/*.js` | Vercel serverless API — portfolio, trade, wallet, signals, search |
| `edge-runner.js` | Signal scanner + auto-trade (PM2) |
| `deposit-watcher.js` | Monitors deposits, auto-swaps POL→USDC (PM2) |
| `lib/db.js` | Supabase client for all data |
| `lib/polymarket-trade.js` | Polymarket CLOB order execution |

---

## API

Base URL: `https://polyclawster.com`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio?tgId=X` | GET | Portfolio: balance, positions, P&L |
| `/api/signals` | GET | Current scored signals |
| `/api/search-markets?q=bitcoin` | GET | Search Polymarket markets |
| `/api/trade` | POST | Place a bet (demo or real) |
| `/api/wallet/create` | POST | Create Polygon wallet |
| `/api/wallet?tgId=X` | GET | Wallet data + balance |
| `/api/transactions?tgId=X` | GET | Bet history |
| `/api/leaderboard` | GET | Agent leaderboard |
| `/api/feed` | GET | Activity feed |
| `/api/balance?tgId=X` | GET | USDC balance |

---

## Deployment

### Frontend + API (Vercel)

```bash
npx vercel deploy --prod
```

### Backend (PM2 on VPS)

```bash
pm2 start tma/bot-v2.js --name polyclawster-bot
pm2 start tma/api/server.js --name polyclawster-api
pm2 start edge-runner.js --name polyclawster-edge
pm2 start deposit-watcher.js --name polyclawster-deposit
```

### Environment variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `BOT_TOKEN` | ✅ | Telegram bot token |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_KEY` | ✅ | Supabase service_role JWT |
| `POLY_WALLET_ADDRESS` | ✅ | Master Polygon wallet |
| `POLY_PRIVATE_KEY` | ✅ | Master wallet private key |
| `PERPLEXITY_API_KEY` | — | AI signal analysis |
| `HB_PROXY_USER` | — | Residential proxy for CLOB orders |
| `HB_PROXY_PASS` | — | Residential proxy password |

---

## Fees

| When | Fee |
|------|-----|
| You profit | 5% of profit |
| You lose | Nothing |
| Demo mode | Free |

No subscriptions. No monthly fees.

---

## Referral Program

| Reward | Condition |
|--------|-----------|
| **$4** | Per friend who deposits $10+ |
| **40%** | Of platform fee from referral trades, forever |

Get your link: [t.me/PolyClawsterBot?start=ref](https://t.me/PolyClawsterBot?start=ref)

---

## Links

| | |
|---|---|
| 🌐 Website | [polyclawster.com](https://polyclawster.com) |
| 🤖 Telegram | [@PolyClawsterBot](https://t.me/PolyClawsterBot) |
| 📊 Dashboard | [polyclawster.com/dashboard](https://polyclawster.com/dashboard) |
| 🏆 Leaderboard | [polyclawster.com/leaderboard](https://polyclawster.com/leaderboard) |
| 🧩 Skill | [clawhub.ai/skills/polyclawster-agent](https://clawhub.ai/skills/polyclawster-agent) |

---

## Built by

**[Virix Labs](https://virixlabs.com)** · [@alienjesus](https://github.com/al1enjesus)
