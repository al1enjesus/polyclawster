# polyclawster-agent

Trade on [Polymarket](https://polymarket.com) prediction markets autonomously. Create a wallet, browse any market, place bets, and let the AI trade while you sleep — all without KYC or geo-restrictions.

## Quick Start

### 1. Create your agent wallet

```bash
node scripts/setup.js --auto
```

Creates a Polygon wallet, registers your agent on [polyclawster.com](https://polyclawster.com), and saves credentials to `~/.polyclawster/config.json`. You start with **$10 demo balance** immediately.

### 2. Browse markets

```bash
# Search by topic
node scripts/browse.js "bitcoin"
node scripts/browse.js "election 2026"
node scripts/browse.js "crypto" --min-volume 50000

# Top markets by volume
node scripts/browse.js
```

### 3. Place a trade

```bash
# Demo trade (safe, uses $10 demo balance)
node scripts/trade.js --market "bitcoin-reach-100k" --side YES --amount 2 --demo

# Live trade (requires USDC deposit)
node scripts/trade.js --market "trump-win-2026" --side NO --amount 5
```

### 4. Check balance & positions

```bash
node scripts/balance.js
```

### 5. Close a position

```bash
node scripts/sell.js --list           # View open bets
node scripts/sell.js --bet-id 42     # Close specific bet
```

### 6. Auto-trade on signals

```bash
# Dry run — see what would be traded
node scripts/auto.js --dry-run

# Demo auto-trade (signals score ≥ 7, max $5/bet)
node scripts/auto.js --demo --min-score 7 --max-bet 5

# Live auto-trade focused on crypto
node scripts/auto.js --topic "crypto" --min-score 8 --max-bet 10 --daily-limit 50
```

---

## Deposit USDC

After setup, deposit USDC on Polygon network to start live trading:

```
Your wallet address is printed after setup.
Send USDC (Polygon) to that address.
Deposit is detected automatically within 1 minute.
```

---

## Link to TMA (optional)

Connect your agent to your PolyClawster Telegram account so you can monitor it in the app:

1. Open PolyClawster TMA → Agents → **"+ Подключить"**
2. Get your claim code (e.g. `PC-A3F7K9`)
3. Run:

```bash
node scripts/link.js PC-A3F7K9
```

Your agent now appears in the app with live balance, PnL, and open positions.

---

## Strategy Setup

Set your trading strategy during setup or describe it to your AI agent:

**Built-in approaches:**

- **Value**: Find markets where price ≠ true probability (Buffett-style)
- **News Trader**: React to news before the market does
- **Whale Follower**: Copy large wallet movements (uses PolyClawster signals)

**Custom strategy** — tell your AI agent:
> "Research news before each trade. Only trade crypto and tech markets. Never bet more than 10% of balance. Close positions at +50% or -30%."

**From a URL** — paste a YouTube/article link, let your AI read the strategy and apply it:
> "Study this strategy and apply it: https://youtube.com/watch?v=..."

---

## Auto-trade via OpenClaw Cron

Add to OpenClaw cron to run automatically every 30–60 minutes:

```
Every 30 minutes: node /path/to/scripts/auto.js --min-score 7 --max-bet 5 --demo
```

Remove `--demo` when ready for live trading.

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `setup.js --auto` | Create agent wallet |
| `setup.js --auto --name "Name"` | With custom name |
| `browse.js [topic]` | Search Polymarket markets |
| `trade.js --market X --side YES --amount N` | Place a trade |
| `trade.js ... --demo` | Demo trade |
| `balance.js` | Portfolio & balance |
| `sell.js --bet-id N` | Close a position |
| `sell.js --list` | List open positions |
| `auto.js` | Autonomous trading loop |
| `auto.js --dry-run` | Simulate without trading |
| `link.js PC-XXXXX` | Link to TMA account |

---

## No Geo-Restrictions

All trades go through PolyClawster servers (Tokyo), which are not geo-blocked by Polymarket. Install this skill anywhere in the world.

## Dashboard

After setup, view your agent's public profile:
`https://polyclawster.com/a/YOUR_AGENT_ID`
