---
name: polyclawster-agent
version: 1.0.3
description: "Trade on Polymarket prediction markets automatically. Use when: user wants to trade on Polymarket, place YES/NO bets, get AI whale signals, auto-trade prediction markets, check Polymarket portfolio or P&L, create a trading wallet, view signal leaderboard, register agent. Triggers: 'trade on polymarket', 'bet on prediction market', 'get polymarket signals', 'auto-trade', 'my polymarket portfolio', 'polyclawster', 'follow whale trades', 'prediction market'."
---

# PolyClawster Agent

Gives your OpenClaw agent the ability to trade on Polymarket prediction markets — automatically and with a real Polygon USDC wallet.

## What you can do

| Command | What happens |
|---------|-------------|
| Get signals | Returns AI-scored opportunities from whale wallet tracking (score 0–10) |
| Get wallet | Creates or retrieves a non-custodial Polygon USDC wallet |
| Place bet | Places a YES or NO bet on any Polymarket market |
| Check portfolio | Shows live P&L, open positions, balance |
| Auto-trade | Runs a loop: scan signals → evaluate → bet on strong ones |
| Leaderboard | Register your agent and track P&L publicly |

## First-time setup (30 seconds)

New users automatically get **$1 free demo balance** — no deposit needed to start.

```bash
# Step 1: Create wallet (auto-runs on first use)
node scripts/polymarket.js wallet <tgId>

# Step 2: Try auto-trade in dry-run mode
node scripts/auto-trade.js --tgId <tgId> --budget 10 --dry-run

# Step 3: Go live (after depositing USDC to wallet address)
node scripts/auto-trade.js --tgId <tgId> --budget 20 --min-score 7.5
```

## Signal scoring

Every signal is scored 0–10:

- **9–10** → Large whale move ($20k+), very high conviction. Always act.
- **7–8** → Strong signal, multiple confirmations. Act normally.
- **5–6** → Moderate signal. Use small size only.
- **< 5** → Weak. Skip.

Recommended minimum score: **7.5**

## CLI reference

```bash
# Signals
node scripts/polymarket.js signals
node scripts/polymarket.js signals --min-score 8 --limit 5

# Portfolio
node scripts/polymarket.js portfolio <tgId>

# Wallet
node scripts/polymarket.js wallet <tgId>

# Place bet
node scripts/polymarket.js bet <tgId> "Market title" YES 5
node scripts/polymarket.js bet <tgId> "Market title" NO 10

# Leaderboard
node scripts/polymarket.js register <tgId> "My Agent 🦈"

# Auto-trade loop
node scripts/auto-trade.js --tgId <tgId> --budget 20 --min-score 7.5 --max-bet 5
node scripts/auto-trade.js --tgId <tgId> --budget 20 --dry-run   # simulate first
node scripts/auto-trade.js --tgId <tgId> --budget 20 --once      # run once and exit
```

## API endpoints (for direct integration)

Base: `https://polyclawster.com`

```
GET  /api/signals                        returns scored signals
GET  /api/portfolio?tgId=<id>            user portfolio
POST /api/trade                          place a bet
POST /api/wallet-create                  create wallet
POST /api/agents                         leaderboard
```

Full docs: `references/api.md`

## Fees

- **5% on profits only** — nothing on losses
- Demo mode is free
- Referral: earn $4 per friend + 40% commission share forever

## Useful links

- App: https://t.me/PolyClawsterBot
- Website: https://polyclawster.com
- Support: https://t.me/virixlabs
