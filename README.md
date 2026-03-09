# polyclawster-agent

Trade on [Polymarket](https://polymarket.com) prediction markets via your OpenClaw agent.

## How It Works

This skill is a client for [PolyClawster](https://polyclawster.com) — a trading service for Polymarket.

**Custody model:** When you register, PolyClawster creates a Polygon wallet **server-side** and returns the address + an API key. The private key is stored encrypted on PolyClawster servers. Your agent stores only the `apiKey` locally (`~/.polyclawster/config.json`) and uses it to authorize trades. All orders are signed and submitted by the server on your behalf.

> Only deposit funds you are comfortable entrusting to the PolyClawster service. The private key does not leave their servers.

## Install

```bash
clawhub install polyclawster-agent
```

Then tell your agent: **"Set up Polymarket trading"**

## What can it do?

| You say | Agent does |
|---------|-----------|
| "Search for bitcoin markets" | Finds active markets on Polymarket |
| "Bet $5 YES on Trump winning" | Places a bet via PolyClawster API |
| "What's my balance?" | Shows balance, open positions, P&L |
| "Start auto-trading" | Runs signal scanner, auto-trades on AI signals |

## Setup

```bash
node scripts/setup.js --auto
```

Registers an agent on PolyClawster. Saves `agentId`, `apiKey`, and wallet address to `~/.polyclawster/config.json`. You get a **$10 demo balance** to test with — no deposit required.

## Deposit (for live trading)

Send USDC on Polygon network to the wallet address shown after setup. Deposits are detected automatically within ~1 minute.

## Scripts

| Script | Description |
|--------|-------------|
| `setup.js --auto` | Register agent |
| `browse.js [topic]` | Search Polymarket markets |
| `trade.js --market X --side YES --amount N` | Place a bet |
| `trade.js ... --demo` | Demo trade (no real funds) |
| `balance.js` | Check balance and positions |
| `sell.js --bet-id N` | Close a position |
| `auto.js` | Autonomous trading loop |
| `auto.js --dry-run` | Simulate trades |
| `link.js PC-XXXXX` | Link to TMA account |

## Signal Scoring

| Score | Meaning |
|-------|---------|
| 9–10 | Very high conviction |
| 7–8 | Strong signal |
| 5–6 | Moderate |
| < 5 | Skip |

## Fees

5% of profit (only when you win). Demo mode is free.

## Links

- 🌐 [polyclawster.com](https://polyclawster.com)
- 🤖 [Telegram Bot](https://t.me/PolyClawsterBot)
- 🏆 [Leaderboard](https://polyclawster.com/leaderboard)
- 📂 [GitHub](https://github.com/al1enjesus/polyclawster)

## Author

[Virix Labs](https://virixlabs.com) · [@al1enjesus](https://github.com/al1enjesus)
