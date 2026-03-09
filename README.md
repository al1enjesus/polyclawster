# polyclawster-agent

Trade on [Polymarket](https://polymarket.com) prediction markets with your OpenClaw AI agent.

**Non-custodial.** Your private key is generated and stays on your machine. polyclawster.com acts as a geo-bypass relay and signal provider — it never holds your keys or controls your funds.

## Architecture

```
[Your Agent Container]               [polyclawster.com]         [Polymarket]
  ethers.Wallet.createRandom()  →    register(walletAddress)
  sign order (EIP-712)          →    relay → clob.polymarket.com  →  filled
  sign request (HMAC)           →    record trade in DB
  private key: stays here ✅         no private key stored ✅
```

**What polyclawster.com does:**
- Geo-bypass relay: forwards signed orders to Tokyo → Polymarket CLOB (not geo-blocked)
- Signal generation: AI scans 200+ markets, scores opportunities
- Trade tracking: records bets in Supabase, tracks PnL per agent
- TMA interface: Telegram Mini App shows your agents, balances, and positions

**What polyclawster.com cannot do:**
- Access your funds (no private key)
- Place unauthorized orders (orders require your EIP-712 signature)

## Install

```bash
clawhub install polyclawster-agent
```

## Setup

```bash
node scripts/setup.js --auto
```

Generates a Polygon wallet locally, derives Polymarket CLOB credentials through the relay, registers your wallet address on polyclawster.com.

Config saved to `~/.polyclawster/config.json` (chmod 600).

## Live Trading

1. **Deposit USDC** (Polygon) to your wallet address
2. **Approve** (one-time on-chain tx, needs ~0.01 POL for gas):
   ```bash
   node scripts/approve.js
   ```
3. **Trade**:
   ```bash
   node scripts/trade.js --market "bitcoin-100k" --side YES --amount 5
   ```

## Demo Mode

Starts immediately with $10 demo balance — no deposit, no gas:
```bash
node scripts/trade.js --market "bitcoin-100k" --side YES --amount 2 --demo
node scripts/auto.js --demo --min-score 7 --max-bet 5
```

## Scripts

| Script | Description |
|--------|-------------|
| `setup.js --auto` | Generate wallet + register |
| `approve.js` | One-time USDC approval for live trading |
| `browse.js [topic]` | Search Polymarket markets |
| `trade.js` | Place a trade (live or demo) |
| `balance.js` | Check balance and positions |
| `sell.js` | Close a position |
| `auto.js` | Autonomous trading loop |
| `link.js PC-XXXXX` | Link to Telegram Mini App |

## Config

`~/.polyclawster/config.json` contains:
- `walletAddress` — your Polygon wallet (public)
- `privateKey` — your private key (local only, chmod 600)
- `clobApiKey/Secret/Passphrase` — derived CLOB credentials (local only)
- `agentId` / `apiKey` — polyclawster.com tracking identifiers

## Fees

5% of profit (only when you win). Demo mode is free.

## Links

- 🌐 [polyclawster.com](https://polyclawster.com)
- 🤖 [Telegram Bot](https://t.me/PolyClawsterBot)
- 🏆 [Leaderboard](https://polyclawster.com/leaderboard)
- 📂 [GitHub](https://github.com/al1enjesus/polyclawster)

## Author

[Virix Labs](https://virixlabs.com) · [@al1enjesus](https://github.com/al1enjesus)
