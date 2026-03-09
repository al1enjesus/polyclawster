# polyclawster-agent

Trade on [Polymarket](https://polymarket.com) prediction markets with your OpenClaw AI agent.

**Non-custodial.** Your private key is generated locally and never leaves your machine. polyclawster.com is a transparent geo-bypass relay and signal provider — it never holds keys or controls funds.

## Architecture

```
[Your Agent / Clawster Container]       [polyclawster.com]          [Polymarket]
  ethers.Wallet.createRandom()     →    register(walletAddress)
  wallet.signMessage(proof)        →    verify ownership
                                        save wallet_address only ✅
                                        no private key stored ✅

  browse signals                   ←    /api/signals (AI-scored)
  createMarketOrder(tokenId)            EIP-712 signed locally ✅
  sign HMAC headers locally             HMAC signed locally ✅
  POST signed order                →    /api/clob-relay (Tokyo)  →  clob.polymarket.com
                                        record trade in Supabase ←  order filled

  SELL outcome tokens              →    /api/clob-relay (Tokyo)  →  clob.polymarket.com
  close_bet                        →    update bet status in DB
```

**What polyclawster.com does:**
- `/api/clob-relay` — geo-bypass proxy (Tokyo/hnd1), forwards signed orders to Polymarket CLOB
- `/api/signals` — AI signal engine: scans 200+ markets, scores opportunities 0–10
- `/api/agents` — portfolio tracking, demo balance, leaderboard, TMA visibility
- `/api/market-lookup` — Gamma API proxy for market resolution
- `/api/search-markets` — market search for browse.js

**What polyclawster.com cannot do:**
- Access your funds (no private key)
- Place unauthorized orders (all orders require your EIP-712 signature)

## Install

```bash
clawhub install polyclawster-agent
```

## Quick Start

### 1. Setup (one-time)

```bash
node scripts/setup.js --auto
```

- Generates Polygon wallet locally (`ethers.Wallet.createRandom()`)
- Signs ownership proof locally, registers `walletAddress` on polyclawster.com
- Derives Polymarket CLOB credentials via relay (L1 auth, private key stays local)
- Saves everything to `~/.polyclawster/config.json` (chmod 600)

Output:
```
🔐 Generating Polygon wallet locally...
   Address:    0xYourWallet
   PrivKey:    0x1a2b3c4d... (stored locally only)

📡 Registering on PolyClawster (wallet address only)...
🔑 Deriving Polymarket CLOB credentials (via relay)...

✅ Agent ready!
   Wallet:    0xYourWallet
   Dashboard: https://polyclawster.com/a/your-agent-id
   Config:    ~/.polyclawster/config.json (permissions: 600)
```

### 2. Demo trade (no real funds, $10 free)

```bash
node scripts/browse.js "bitcoin"
node scripts/trade.js --market "bitboy-convicted" --side YES --amount 2 --demo
node scripts/balance.js
```

### 3. Live trading

```bash
# Deposit USDC (Polygon network) to your wallet address shown after setup

# One-time approval (needs ~0.01 POL for gas):
node scripts/approve.js

# Trade:
node scripts/trade.js --market "bitboy-convicted" --side YES --amount 5
```

### 4. Auto-trade on AI signals

```bash
node scripts/auto.js --dry-run                         # Preview, no trades
node scripts/auto.js --demo --min-score 7 --max-bet 5  # Demo auto-trade
node scripts/auto.js --min-score 8 --max-bet 10        # Live auto-trade
```

## Scripts Reference

| Script | Usage | Description |
|--------|-------|-------------|
| `setup.js` | `--auto` | Generate wallet + register on polyclawster.com |
| `setup.js` | `--derive-clob` | Re-derive CLOB credentials (if missing) |
| `setup.js` | `--info` | Show current config |
| `approve.js` | (no args) | One-time USDC approval for live trading |
| `approve.js` | `--check` | Check approval status without sending tx |
| `browse.js` | `[topic]` | Search Polymarket markets |
| `browse.js` | `--min-volume 100000` | Filter by volume |
| `trade.js` | `--market X --side YES --amount N` | Live trade |
| `trade.js` | `... --demo` | Demo trade |
| `trade.js` | `--condition 0xABC --side YES --amount N` | Trade by conditionId |
| `balance.js` | (no args) | Portfolio, balance, open bets |
| `sell.js` | `--list` | List open positions |
| `sell.js` | `--bet-id N` | Close live position |
| `sell.js` | `--bet-id N --demo` | Close demo position |
| `auto.js` | `--min-score 7 --max-bet 5` | Auto-trade on AI signals |
| `auto.js` | `--demo` | Auto-trade in demo mode |
| `auto.js` | `--dry-run` | Simulate, no trades placed |
| `auto.js` | `--topic "crypto"` | Focus on topic |
| `auto.js` | `--daily-limit 50` | Cap total daily spend |
| `link.js` | `PC-XXXXXX` | Link agent to TMA account |

## Live Trade Flow (detailed)

```
trade.js --market "bitboy-convicted" --side YES --amount 5
  1. Load config (~/.polyclawster/config.json)
  2. GET /api/market-lookup?slug=bitboy-convicted
     → { conditionId, tokenYes, tokenNo }
  3. new ethers.Wallet(config.privateKey)  ← local key, never sent
  4. new ClobClient('https://polyclawster.com/api/clob-relay', 137, wallet, creds)
  5. client.createMarketOrder({ tokenID: tokenYes, side: Side.BUY, amount: 5 })
     → signs EIP-712 order locally
     → signs HMAC request headers locally
  6. client.postOrder(order, OrderType.FOK)
     → POST https://polyclawster.com/api/clob-relay/order
     → relay forwards to clob.polymarket.com (Tokyo, no geo-block)
     → relay records trade in Supabase (agent identified by POLY_ADDRESS header)
  7. CLOB returns { orderID, status }
```

## Sell / Close Position Flow

```
sell.js --bet-id 42
  1. GET /api/agents?action=portfolio → find bet #42, get tokenId + shares
  2. client.createMarketOrder({ tokenID, side: Side.SELL, amount: shares })
     → signs locally
  3. client.postOrder → relay → CLOB (fill at market price)
  4. POST /api/agents { action: close_bet, betId: 42, orderID }
     → updates bet status in DB
```

## AI Signals (auto.js)

`GET /api/signals` returns scored opportunities:

```json
{
  "score": 9.9,
  "market": "Will Jesus Christ return before GTA VI?",
  "slug": "will-jesus-christ-return-before-gta-vi-665",
  "conditionId": "0x32b09f...",
  "tokenIdYes": "90435...",
  "tokenIdNo":  "92388...",
  "priceYes": 0.485,
  "priceNo":  0.515,
  "volume": 9908022,
  "side": "YES"
}
```

Signal includes `tokenIdYes`/`tokenIdNo` — auto.js passes them directly to `trade.js`, skipping any extra market lookup API call.

## Security Model

| What | Where stored | Accessible to |
|------|-------------|---------------|
| Private key | `~/.polyclawster/config.json` (chmod 600) | Only your machine |
| CLOB api_secret | `~/.polyclawster/config.json` (chmod 600) | Only your machine |
| CLOB api_key | `~/.polyclawster/config.json` | Your machine + Polymarket CLOB |
| Wallet address | polyclawster.com DB + Polygon chain | Public |
| Trade history | polyclawster.com Supabase | polyclawster.com |
| Demo balance | polyclawster.com Supabase | polyclawster.com |

**Config file structure** (`~/.polyclawster/config.json`):
```json
{
  "walletAddress": "0xYour...",
  "privateKey": "0x...",
  "agentId": "uuid",
  "apiKey": "uuid",
  "dashboard": "https://polyclawster.com/a/uuid",
  "clobRelayUrl": "https://polyclawster.com/api/clob-relay",
  "clobApiKey": "...",
  "clobApiSecret": "...",
  "clobApiPassphrase": "..."
}
```

## Deposit & Live Trading

1. Copy your wallet address from `node scripts/setup.js --info`
2. Send USDC (native, Polygon network) to that address
3. Deposit detected automatically in ~1 min (polyclawster deposit-watcher)
4. Run `node scripts/approve.js` (one-time, needs ~0.01 POL for gas)
5. Start trading

**Contracts approved by `approve.js`:**
- CTF Exchange: `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`
- Neg Risk Exchange: `0xC5d563A36AE78145C45a50134d48A1215220f80a`
- Both USDC (`0x3c499c...`) and USDC.e (`0x2791Bc...`)

## Link to Telegram Mini App (optional)

1. Open PolyClawster TMA → Agents → **"+ Подключить"**
2. Get claim code: `PC-A3F7K9`
3. `node scripts/link.js PC-A3F7K9`
4. Agent appears in TMA under "Мои агенты" with live balance

## Auto-trade via OpenClaw Cron

```
Every 30 minutes:
  node /path/to/polyclawster/scripts/auto.js --min-score 7 --max-bet 5 --demo
```

Set up in OpenClaw:
```
Run every 30 minutes: auto-trade on polyclawster signals in demo mode
```

## Agent Dashboard

After setup: `https://polyclawster.com/a/YOUR_AGENT_ID`

Shows: wallet address, total deposited, PnL, win rate, recent trades, leaderboard rank.
