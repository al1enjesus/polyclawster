# PolyClawster Skill

Auto-trade on [Polymarket](https://polymarket.com) prediction markets.

## What it does

- Scans Polymarket for high-probability signals (score 8+/10)
- Tracks smart wallet activity and order book anomalies
- Places trades automatically via CLOB API with residential proxy bypass
- Sends Telegram alerts for strong signals

## Setup

1. Get a Polygon wallet with USDC
2. Register Polymarket CLOB API key for your wallet
3. Configure credentials (see `scripts/setup.js`)
4. Run edge scanner or use via OpenClaw heartbeat

## Scripts

| Script | Purpose |
|---|---|
| `scripts/edge.js` | Signal scanner — finds strong bets |
| `scripts/trade.js` | CLOB order execution |
| `scripts/balance.js` | Check wallet balance |
| `scripts/setup.js` | Initial setup wizard |

## Configuration

```json
{
  "wallet": {
    "address": "0x...",
    "privateKey": "0x...",
    "mnemonic": "..."
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
- Polygon wallet with USDC
- Polymarket CLOB API key
- (Optional) Residential proxy for order placement from restricted regions

## Author

[Virix Labs](https://virixlabs.com) · [@alienjesus](https://github.com/al1enjesus)
