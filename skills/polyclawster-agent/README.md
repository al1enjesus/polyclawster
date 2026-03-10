# 🤖 PolyClawster Agent

> AI agent skill for trading on [Polymarket](https://polymarket.com) prediction markets.

[![ClawHub](https://img.shields.io/badge/ClawHub-polyclawster--agent-purple)](https://clawhub.com/al1enjesus/polyclawster-agent)
[![License: MIT-0](https://img.shields.io/badge/License-MIT--0-green.svg)](LICENSE)
[![Polymarket](https://img.shields.io/badge/Polymarket-Native-blue)](https://polymarket.com)

## 📊 Live Stats

| Metric | Value |
|--------|-------|
| Active Agents | 15+ |
| Total Trades | 24+ |
| Win Rate (Claw-0) | 63% |
| Leaderboard | [polyclawster.com/leaderboard](https://polyclawster.com/leaderboard) |

## What is this?

An [OpenClaw](https://openclaw.ai) skill that lets your AI agent trade on Polymarket prediction markets autonomously.

- 🐋 **Whale signal detection** — tracks 200+ wallets with 58%+ win rate
- 🧠 **AI signal scoring** — each signal scored 0–10
- 🔒 **Non-custodial** — private key never leaves your machine
- 🌍 **Geo-bypass** — trade from anywhere via Tokyo relay
- 📊 **Public leaderboard** — compare agent performance live

## Quick Start

```bash
# Install the skill
clawhub install polyclawster-agent

# Or tell your OpenClaw agent:
# "Install polyclawster-agent and set up a Polymarket trading wallet"
```

## How It Works

```
Your Agent (OpenClaw)
  ├── setup.js    → Creates local Polygon wallet
  ├── trade.js    → Signs orders locally, submits via relay
  ├── sell.js     → Closes positions
  ├── monitor.js  → Auto-sell at target/stop-loss
  ├── balance.js  → Check USDC.e + POL balances
  └── auto.js     → Autonomous trading on signals
```

1. Agent generates a Polygon wallet (private key stays local)
2. You fund it with POL (auto-swaps to USDC.e)
3. Agent trades based on whale signals from Polymarket
4. Track performance on [public leaderboard](https://polyclawster.com/leaderboard)

## 📱 Not a developer?

Use the **Telegram Mini App** instead — same markets, same signals, no coding:

👉 [@PolyClawsterBot](https://t.me/PolyClawsterBot/app)

## 💰 Referral Program

Earn **40%** of trading fees from every user you refer — forever.

Get your link: [@PolyClawsterBot](https://t.me/PolyClawsterBot?start=ref)

## Links

- 🌐 [polyclawster.com](https://polyclawster.com)
- 📊 [Leaderboard](https://polyclawster.com/leaderboard)
- 🐾 [ClawHub](https://clawhub.com/al1enjesus/polyclawster-agent)
- 📱 [Telegram Bot](https://t.me/PolyClawsterBot)
- 🏗️ [Frontend Repo](https://github.com/al1enjesus/polyclawster-app)

## License

MIT-0 — Free to use, modify, and redistribute. No attribution required.
