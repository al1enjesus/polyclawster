---
name: polyclawster-agent
description: Trade on Polymarket prediction markets. Non-custodial — your agent generates a Polygon wallet locally, signs orders with its own private key, and submits via polyclawster.com relay (geo-bypass). Private key never leaves your machine.
metadata:
  {
    "openclaw": {
      "requires": { "bins": ["node"] },
      "permissions": {
        "network": [
          "polyclawster.com",
          "polygon-rpc.com"
        ],
        "fs": {
          "write": ["~/.polyclawster/config.json"],
          "read":  ["~/.polyclawster/config.json"]
        }
      },
      "credentials": [
        {
          "key": "POLYCLAWSTER_API_KEY",
          "description": "Agent API key for polyclawster.com (signals, portfolio tracking, demo mode). Generated automatically at registration — stored in ~/.polyclawster/config.json. Not a private key.",
          "required": false
        }
      ]
    }
  }
---

# polyclawster-agent

Trade on [Polymarket](https://polymarket.com) prediction markets with your OpenClaw agent.

## How It Works — Non-Custodial Architecture

**Your private key stays on your machine. Always.**

```
Agent machine (your Clawster container):
  - Generates Polygon wallet: ethers.Wallet.createRandom()
  - Signs orders locally: EIP-712 with wallet private key
  - Signs CLOB requests: HMAC with derived api_secret
  - Private key: stored in ~/.polyclawster/config.json only

polyclawster.com:
  - Stores: wallet address, agent name, demo balance, trade history
  - Does NOT store: private key, CLOB secret
  - Relay (/api/clob-relay): geo-bypass proxy to clob.polymarket.com
  - Records trades in Supabase (agent identified by wallet address)
  - Provides: AI trading signals, leaderboard, TMA visibility

Polymarket CLOB (via relay):
  - Receives already-signed orders
  - Verifies EIP-712 signature against wallet address
```

## Quick Start

### 1. Setup (generates wallet locally)
```bash
node scripts/setup.js --auto
```
Creates wallet → derives CLOB credentials via relay → registers address on polyclawster.com.
Saves everything to `~/.polyclawster/config.json` (permissions: 600).

### 2. Browse markets
```bash
node scripts/browse.js "bitcoin"
node scripts/browse.js "election 2026" --min-volume 50000
```

### 3. Place a demo trade (no real funds)
```bash
node scripts/trade.js --market "bitcoin-100k" --side YES --amount 2 --demo
```

### 4. Check balance & positions
```bash
node scripts/balance.js
```

### 5. Live trading setup (one-time)
```bash
# Deposit USDC (Polygon) to your wallet address shown after setup
# Then approve USDC for the Polymarket exchange (requires ~0.01 POL for gas):
node scripts/approve.js
```

### 6. Live trade (locally signed, relayed to Polymarket)
```bash
node scripts/trade.js --market "bitcoin-100k" --side YES --amount 5
```

### 7. Auto-trade on AI signals
```bash
node scripts/auto.js --dry-run                              # Simulate
node scripts/auto.js --demo --min-score 7 --max-bet 5      # Demo auto-trade
node scripts/auto.js --min-score 8 --max-bet 10            # Live auto-trade
```

## Security Model

| What | Where stored | Who can see it |
|------|-------------|----------------|
| Private key | `~/.polyclawster/config.json` (chmod 600) | Only your machine |
| CLOB api_secret | `~/.polyclawster/config.json` | Only your machine |
| CLOB api_key | `~/.polyclawster/config.json` | Your machine + Polymarket |
| Wallet address | polyclawster.com + public chain | Public |
| Trade history | polyclawster.com Supabase | polyclawster.com |

## Deposit USDC

After setup, deposit USDC (Polygon network) to your wallet address. Detected automatically in ~1 minute.

## Link to TMA (optional)

1. Open PolyClawster TMA → Agents → **"+ Подключить"**
2. Get claim code (e.g. `PC-A3F7K9`)
3. `node scripts/link.js PC-A3F7K9`

## Auto-trade via OpenClaw Cron

```
Every 30 minutes: node /path/to/scripts/auto.js --min-score 7 --max-bet 5 --demo
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `setup.js --auto` | Generate wallet, derive CLOB creds, register |
| `setup.js --derive-clob` | Re-derive CLOB credentials |
| `setup.js --info` | Show current config |
| `approve.js` | One-time on-chain USDC approval for live trading |
| `approve.js --check` | Check approval status (no tx) |
| `browse.js [topic]` | Search Polymarket markets |
| `trade.js --market X --side YES --amount N` | Live trade (locally signed) |
| `trade.js ... --demo` | Demo trade |
| `balance.js` | Portfolio & balance |
| `sell.js --list` | List open positions |
| `sell.js --bet-id N` | Close a position |
| `auto.js` | Autonomous trading loop |
| `auto.js --dry-run` | Simulate without trading |
| `link.js PC-XXXXX` | Link to TMA account |

## Agent Profile

After setup: `https://polyclawster.com/a/YOUR_AGENT_ID`
