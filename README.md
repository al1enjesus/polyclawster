# PolyClawster — Polymarket Trading Skill for OpenClaw

Trade on [Polymarket](https://polymarket.com) prediction markets through your OpenClaw agent. Search any market, place YES/NO bets, and manage a real Polygon wallet — all from chat.

## Install

```bash
clawhub install polyclawster-agent
```

Then tell your agent: **"Set up Polymarket trading"** — it will create a wallet and you're ready to go.

## What can it do?

| You say | Agent does |
|---------|-----------|
| "Search for bitcoin markets" | Finds active Polymarket markets matching your query |
| "Bet $5 YES on Trump winning" | Finds the market, places a $5 YES bet via CLOB API |
| "What's my balance?" | Shows wallet balance, open positions, P&L |
| "Set up auto-trading" | Starts scanning for whale signals and trading automatically |

The agent can trade on **any active Polymarket market** — not just preset signals.

## How it works

1. **Wallet creation** — Agent calls the PolyClawster API to create a real Polygon wallet (secp256k1 keypair via `ethers.Wallet.createRandom()`). Private key stored locally.

2. **Market search** — Queries 200+ active markets from Polymarket's Gamma API. Filter by keyword, sort by volume.

3. **Trading** — Builds and signs orders locally using your wallet. Submits to Polymarket's CLOB (Central Limit Order Book) via residential proxy to bypass datacenter IP restrictions.

4. **Signal scanner** — Monitors 200+ whale wallets. Scores each market opportunity 0–10. Auto-trades on signals above your threshold.

## Setup

### Automatic (recommended)

```bash
node scripts/setup.js --auto
```

Creates a wallet via PolyClawster API. Saves config to `~/.polyclawster/config.json`. You get a $1 demo balance to test with.

### Manual (bring your own wallet)

```bash
node scripts/setup.js --wallet 0xYOUR_PRIVATE_KEY
```

Derives CLOB API credentials from your existing Polygon wallet.

### Then deposit

Send **USDC** or **POL** on Polygon network to your wallet address. POL auto-converts to USDC. The deposit watcher picks it up within 60 seconds.

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/setup.js --auto` | Create wallet automatically |
| `scripts/setup.js --wallet 0x...` | Manual setup with existing wallet |
| `scripts/search.js [query]` | Search Polymarket markets |
| `scripts/trade.js --market X --side YES --amount N` | Place a bet on any market |
| `scripts/balance.js` | Check balance and positions |
| `scripts/edge.js --auto` | Run signal scanner + auto-trade |

### Examples

```bash
# Find markets about AI
node scripts/search.js "artificial intelligence"

# Bet $3 YES on a specific market
node scripts/trade.js --market "will-bitcoin-reach-100k" --side YES --amount 3

# Check your balance
node scripts/balance.js

# Auto-trade on strong signals (score ≥ 8)
node scripts/edge.js --auto
```

## Signal Scoring

| Score | Meaning | Suggested action |
|-------|---------|-----------------|
| 9–10 | Whale moved $20k+, very high conviction | Bet up to max budget |
| 7–8 | Strong signal, multiple confirmations | Bet normally |
| 5–6 | Moderate signal | Small bet or skip |
| < 5 | Weak / informational | Skip |

## Web Dashboard

View your portfolio: `https://polyclawster.com/dashboard?address=YOUR_ADDRESS`

Agent leaderboard: `https://polyclawster.com/leaderboard`

## Requirements

- Node.js 18+
- OpenClaw agent (or standalone Node.js environment)

Dependencies installed automatically:
- `@polymarket/clob-client` — Polymarket order execution
- `ethers` — Wallet management
- `https-proxy-agent` — Residential proxy for order submission

## Fees

- **5% of profit** — Only when you win
- **Nothing** when you lose
- **Free** in demo mode

No subscriptions or monthly fees.

## Links

- 🌐 [polyclawster.com](https://polyclawster.com)
- 🤖 [Telegram App](https://t.me/PolyClawsterBot)
- 📊 [Dashboard](https://polyclawster.com/dashboard)
- 🏆 [Leaderboard](https://polyclawster.com/leaderboard)

## Author

[Virix Labs](https://virixlabs.com) · [@alienjesus](https://github.com/al1enjesus)
