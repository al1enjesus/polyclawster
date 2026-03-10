---
name: polyclawster-agent
description: Trade on Polymarket prediction markets. Non-custodial — your agent generates a Polygon wallet, signs orders locally, and submits via polyclawster.com relay (geo-bypass). Private key never leaves your machine. Fund with POL — agent auto-swaps to USDC.e.
metadata:
  {
    "openclaw": {
      "requires": { "bins": ["node"] },
      "permissions": {
        "network": [
          "polyclawster.com",
          "polygon-bor-rpc.publicnode.com",
          "clob.polymarket.com",
          "gamma-api.polymarket.com"
        ],
        "fs": {
          "write": ["~/.polyclawster/config.json"],
          "read":  ["~/.polyclawster/config.json"]
        }
      }
    }
  }
---

# polyclawster-agent

Trade on [Polymarket](https://polymarket.com) prediction markets with your OpenClaw agent.

## How to talk to users

When a user asks you to trade, check markets, or manage their Polymarket account — handle it yourself. Run the right script, interpret the output, and reply in plain language.

**Good example:**
> User: "Bet $5 on Bitcoin above 100k"
> You: "Done — placed a $5 YES bet on Bitcoin above $100k. Your position is now live. Current price was $0.62."

**Bad example:**
> User: "Bet $5 on Bitcoin above 100k"
> You: "Run this command: `node scripts/trade.js --market bitcoin-above-100k --side YES --amount 5`"

Users don't need to see commands, file paths, or technical details. They want results.

**When to explain what's happening:**
- First-time setup: "I'm creating your wallet now..." → "Your wallet is ready. Send POL to `0x...` to fund it."
- Swaps/approvals: "Converting your POL to trading tokens..." (no need to mention USDC.e, Uniswap, or contract addresses unless asked)
- Errors: explain what went wrong in plain terms, suggest next steps

**Wallet address is the exception** — always share it when the user needs to send funds.

## Setup flow

When a user wants to start trading Polymarket:

1. Run `setup.js --auto` — creates a local wallet and registers on polyclawster.com
2. Share the wallet address and tell the user to send POL (Polygon) to it
3. Once funded, the agent is ready to trade

Config is stored in `~/.polyclawster/config.json`.

## Scripts reference

All scripts are in the `scripts/` directory. Run with `node scripts/<name>.js`.

| Script | Purpose | Key flags |
|--------|---------|-----------|
| `setup.js` | Create wallet + register agent | `--auto` (non-interactive), `--info` (show config), `--derive-clob` (re-derive API keys) |
| `balance.js` | Check POL, USDC.e, and CLOB balances | — |
| `swap.js` | Convert POL or native USDC → USDC.e | `--pol N`, `--usdc N`, `--check` (balances only) |
| `approve.js` | One-time Polymarket contract approvals | `--check` (read-only) |
| `browse.js` | Search markets by topic | Pass search term as argument |
| `trade.js` | Place a bet (live or demo) | `--market`, `--side YES/NO`, `--amount N`, `--demo` |
| `sell.js` | Close a position | `--bet-id N`, `--list` (show open positions) |
| `auto.js` | Autonomous trading on AI signals | `--demo`, `--min-score N`, `--max-bet N`, `--dry-run` |
| `link.js` | Link agent to Telegram Mini App | Pass claim code as argument |

## Live trading

`trade.js` handles the full flow automatically before placing a live bet:
1. Checks USDC.e balance
2. Swaps POL → USDC.e if needed (keeps 1 POL for gas)
3. Runs one-time contract approvals if missing
4. Refreshes CLOB balance
5. Places the order (signed locally, submitted via relay)

No manual steps needed — just run `trade.js` with the market and amount.

## Architecture

- **Wallet**: Polygon EOA generated locally — private key stays on this machine
- **Trading token**: USDC.e (bridged USDC on Polygon)
- **Funding**: user sends POL → agent swaps to USDC.e via Uniswap
- **Relay**: orders go through polyclawster.com (Tokyo) for geo-bypass
- **Dashboard**: polyclawster.com/a/{agent_id}

## Important notes

- **USDC.e ≠ native USDC** — Polymarket uses bridged USDC.e (`0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`). If user sends native USDC, use `swap.js` to convert.
- Demo mode (`--demo`) uses a free $10 paper balance — good for testing.
- All orders are signed locally with EIP-712 + HMAC. The relay never sees the private key.
