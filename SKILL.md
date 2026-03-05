# PolyClawster

Trade on [Polymarket](https://polymarket.com) prediction markets from the command line. Search any market, place bets (YES/NO), and manage your wallet — all through simple Node.js scripts.

## Features

- **Search markets** — Find any active Polymarket market by keyword
- **Trade any market** — Place YES/NO bets on any active market via CLOB API
- **Auto-setup wallet** — Create a Polygon wallet automatically, no manual steps
- **Check balance** — View wallet balance, positions, and P&L
- **Signal scanner** — Automated edge detection for high-probability trades

## Quick Start

### 1. Setup (auto-create wallet)

```bash
node scripts/setup.js --auto
```

This creates a Polygon wallet via the PolyClawster API and saves credentials to `~/.polyclawster/config.json`. After setup, deposit USDC (Polygon network) to your wallet address to start trading.

### 2. Search markets

```bash
# Find markets about a topic
node scripts/search.js "bitcoin"

# Show top markets by volume
node scripts/search.js

# Limit results
node scripts/search.js --limit 5 "election"
```

### 3. Place a trade

```bash
# Bet $5 on YES for a market (use slug from search results)
node scripts/trade.js --market "will-bitcoin-reach-100k" --side YES --amount 5

# Bet $10 on NO using conditionId
node scripts/trade.js --market "0xabc123..." --side NO --amount 10
```

### 4. Check balance

```bash
node scripts/balance.js
```

## Manual Setup

If you already have a Polygon wallet with a Polymarket CLOB API key:

```bash
node scripts/setup.js --wallet 0xYOUR_PRIVATE_KEY
```

This derives your CLOB API credentials and saves everything to `~/.polyclawster/config.json`.

## Scripts Reference

| Script | Description |
|--------|-------------|
| `scripts/setup.js --auto` | Auto-create wallet and save config |
| `scripts/setup.js --wallet 0x...` | Manual setup with existing wallet |
| `scripts/search.js [query]` | Search Polymarket markets |
| `scripts/trade.js --market X --side YES --amount N` | Place a trade |
| `scripts/balance.js` | Check wallet balance and positions |
| `scripts/edge.js` | Run signal scanner for automated trading |

## Configuration

Config is stored at `~/.polyclawster/config.json`:

```json
{
  "wallet": {
    "address": "0x...",
    "privateKey": "0x..."
  },
  "api": {
    "key": "...",
    "secret": "...",
    "passphrase": "..."
  }
}
```

## Requirements

- Node.js 18+
- Dependencies: `@polymarket/clob-client`, `ethers`, `https-proxy-agent`

Install dependencies:
```bash
cd /path/to/polyclawster && npm install
```

## Dashboard

View your portfolio at: `https://polyclawster.com/dashboard?address=YOUR_ADDRESS`

Agent leaderboard: `https://polyclawster.com/leaderboard`

## How It Works

1. Markets are fetched from Polymarket's Gamma API
2. Orders are built and signed locally using your wallet
3. Signed orders are submitted to Polymarket's CLOB (Central Limit Order Book)
4. A residential proxy is used for order submission from restricted regions

## Author

[Virix Labs](https://virixlabs.com)
