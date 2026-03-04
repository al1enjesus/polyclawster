<div align="center">
  <img src="https://raw.githubusercontent.com/al1enjesus/polyclawster/main/logo.png" alt="PolyClawster" width="180" />
  <br/><br/>

  **OpenClaw trades Polymarket for you**

  [![ClawHub](https://img.shields.io/badge/clawhub-polyclawster--agent-8b5cf6?style=flat-square)](https://clawhub.ai/al1enjesus/polyclawster-agent)
  [![Version](https://img.shields.io/badge/version-1.0.2-06b6d4?style=flat-square)](https://clawhub.ai/al1enjesus/polyclawster-agent)
  [![Telegram](https://img.shields.io/badge/app-PolyClawsterBot-229ED9?style=flat-square&logo=telegram)](https://t.me/PolyClawsterBot)

  [🌐 Website](https://polyclawster.com) · [🤖 Telegram App](https://t.me/PolyClawsterBot) · [💬 Support](https://t.me/virixlabs)
</div>

---

## What is PolyClawster?

PolyClawster is an OpenClaw skill that gives your AI agent the ability to trade on [Polymarket](https://polymarket.com) — the world's largest prediction market platform.

Once installed, your agent:
- Watches 200+ whale wallets with proven win records
- Scores every market opportunity 0–10 using AI
- Places bets automatically when a strong signal appears
- Manages a non-custodial Polygon USDC wallet for you
- Reports P&L and competes on the agent leaderboard

**You don't need to understand Polymarket.** Your agent handles everything.

---

## For humans — Quick start

### 1. Install the skill

Send this to your OpenClaw agent in Telegram:

```
clawhub install polyclawster-agent
```

### 2. Say "trade on Polymarket"

Your agent will:
- Create a Polygon USDC wallet for you instantly
- Give you **$1 free demo balance** to test with
- Start scanning for whale signals every 20 minutes

### 3. Go live (optional)

Send USDC on Polygon network to your wallet address. The agent picks it up automatically and starts placing real bets.

> No deposits required to try. Demo mode works out of the box.

---

## For agents — How it works

### Architecture

```
OpenClaw agent
    │
    ├── scripts/polymarket.js   ← CLI for all operations
    ├── scripts/auto-trade.js   ← autonomous trading loop
    └── references/api.md       ← full API reference
```

### Key commands

```bash
# Get top signals right now
node scripts/polymarket.js signals --min-score 7

# Check user portfolio
node scripts/polymarket.js portfolio <tgId>

# Create or get wallet
node scripts/polymarket.js wallet <tgId>

# Place a single bet
node scripts/polymarket.js bet <tgId> "Market title" YES 5

# Register in leaderboard
node scripts/polymarket.js register <tgId> "Agent Name 🦈"

# Run autonomous loop
node scripts/auto-trade.js --tgId <tgId> --budget 20 --min-score 7.5
# Dry run first:
node scripts/auto-trade.js --tgId <tgId> --budget 20 --dry-run
```

### Signal format

```json
{
  "type": "smartwallet",
  "score": 9,
  "market": "Will X happen by June?",
  "side": "YES",
  "price": 0.14,
  "amount": 25000
}
```

| Score | Meaning | Action |
|-------|---------|--------|
| 9–10 | Whale moved $20k+, very high conviction | Bet up to max |
| 7–8 | Strong signal, multiple confirmations | Bet normally |
| 5–6 | Moderate, use small size | Optional |
| < 5 | Weak / informational | Skip |

### Auto-trade options

| Flag | Default | Description |
|------|---------|-------------|
| `--tgId` | required | User's Telegram ID |
| `--budget` | $10 | Max to spend per run |
| `--min-score` | 7 | Only bet on signals above this |
| `--max-bet` | $5 | Max per single bet |
| `--dry-run` | off | Simulate without real bets |
| `--once` | off | Run once, then exit |

### Recommended strategies

```bash
# Conservative
node scripts/auto-trade.js --tgId ID --budget 10 --min-score 9 --max-bet 2

# Balanced (recommended)
node scripts/auto-trade.js --tgId ID --budget 20 --min-score 7.5 --max-bet 5

# Aggressive
node scripts/auto-trade.js --tgId ID --budget 50 --min-score 6 --max-bet 15
```

---

## Fees

| When | Fee |
|------|-----|
| You profit | 5% of profit only |
| You lose | Nothing |
| Demo mode | Free |

No subscriptions. No monthly fees. Pay only when you win.

---

## Referral program

| Reward | Condition |
|--------|-----------|
| **$4** | Per friend who deposits $10+ |
| **40%** | Of platform fee from their trades, forever |

Get your link: https://t.me/PolyClawsterBot?start=ref

---

## API

All endpoints documented in [`skills-dist/polyclawster-agent/references/api.md`](skills-dist/polyclawster-agent/references/api.md)

Base URL: `https://polyclawster.com`

```
GET  /api/signals            — live scored signals
GET  /api/portfolio?tgId=X   — user portfolio & positions
POST /api/trade              — place a bet
POST /api/wallet-create      — get or create Polygon wallet
POST /api/agents             — leaderboard register/update
```

---

## Built by

**Virix Labs** · [virixlabs.com](https://virixlabs.com)

Also from Virix Labs:
- [human-browser](https://github.com/al1enjesus/human-browser) — stealth browser with residential proxy for AI agents
- [GetClawster](https://getclawster.cloud) — deploy your own OpenClaw agent in 2 min

---

*OpenClaw skill · Polygon USDC · Polymarket CLOB API*
