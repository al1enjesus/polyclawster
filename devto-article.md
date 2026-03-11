---
title: Building an AI Agent That Trades Prediction Markets
published: false
description: How I built an open-source AI agent that autonomously tracks whale wallets and trades on Polymarket — non-custodial, geo-bypass included.
tags: ai, blockchain, trading, javascript
cover_image:
---

# Building an AI Agent That Trades Prediction Markets

Prediction markets are one of the most honest forecasting tools we have. Unlike polls or punditry, they require real money on the line — which means prices reflect genuine beliefs about future events. Polymarket alone handles over $7 billion in monthly volume across everything from election outcomes to economic indicators.

The problem? Humans can't monitor these markets 24/7. Whales can. And now, AI agents can too.

This post walks through how I built **PolyClawster** — an open-source skill for OpenClaw AI agents that autonomously tracks whale wallet activity and executes trades on Polymarket.

---

## The Problem

**Polymarket is US-only (officially).** Most of the world is geo-blocked from the platform. You can see markets, but you can't trade.

**Manual trading is slow.** Prediction markets move fast, especially around breaking news. By the time you've analyzed a market and placed an order, the edge is gone.

**Whale activity is public but noisy.** Polymarket runs on Polygon — all transactions are on-chain and visible. But parsing thousands of wallet addresses, filtering for signal over noise, and acting on that signal in real time? That's not a human-scale problem anymore.

This is exactly the kind of task AI agents are built for.

---

## The Solution

PolyClawster is a skill that plugs into OpenClaw, an open-source AI agent framework. Once installed, the agent:

1. Generates a local, non-custodial Polygon wallet
2. Continuously monitors a curated list of 200+ high-performance whale wallets
3. Scores incoming signals on a 0–10 scale
4. Routes trades through a geo-bypass relay
5. Posts results to a public leaderboard

---

## Architecture

```
┌─────────────────────────────────────────┐
│              OpenClaw Agent             │
│                                         │
│  ┌──────────┐    ┌─────────────────┐    │
│  │ Whale    │───▶│ Signal Scorer   │    │
│  │ Scanner  │    │ (0-10 scale)    │    │
│  └──────────┘    └────────┬────────┘    │
│                           │             │
│  ┌────────────────────────▼──────────┐  │
│  │       Local Polygon Wallet        │  │
│  │   (private key never leaves box)  │  │
│  └────────────────────────┬──────────┘  │
└───────────────────────────┼─────────────┘
                            │
                    ┌───────▼────────┐
                    │  CLOB Relay    │
                    │ (geo-bypass)   │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │   Polymarket   │
                    │   CLOB API     │
                    └────────────────┘
```

The agent never touches a centralized exchange. Every component except the relay lives locally or on-chain.

---

## Whale Tracking

The starting point is identifying wallets worth following. I pulled historical trade data from Polygon and filtered for wallets that met all of the following criteria:

- At least 20 resolved trades
- Win rate above 58%
- Average position size above $50 (filters out experimenters)
- Active within the last 90 days

This left a list of ~200+ wallets. These are then polled on a configurable interval using the Polymarket CLOB API and on-chain Polygon data.

```javascript
async function scanWhaleWallets(wallets) {
  const signals = [];

  for (const wallet of wallets) {
    const recentTrades = await getRecentTrades(wallet.address, {
      since: Date.now() - 30 * 60 * 1000, // last 30 minutes
    });

    for (const trade of recentTrades) {
      const signal = scoreSignal(trade, wallet);
      if (signal.score >= SIGNAL_THRESHOLD) {
        signals.push(signal);
      }
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}
```

---

## How Signal Scoring Works

Not all whale trades are equal. A $10k bet from a wallet with a 70% win rate on a liquid market is very different from a $100 bet from a borderline wallet on a thin market.

The scoring function weighs three main factors:

### 1. Wallet Quality (0–4 points)

```javascript
function walletQualityScore(wallet) {
  const winRateScore = Math.min((wallet.winRate - 0.5) / 0.3, 1) * 2; // 0-2 pts
  const volumeScore = Math.min(wallet.totalVolume / 100000, 1);        // 0-1 pt
  const recencyScore = wallet.daysSinceLastTrade < 7 ? 1 : 0;          // 0-1 pt
  return winRateScore + volumeScore + recencyScore;
}
```

### 2. Trade Size Relative to Market (0–3 points)

Large trades in thin markets are more meaningful than large trades in liquid ones — they imply stronger conviction.

```javascript
function tradeSizeScore(trade, market) {
  const relativeSize = trade.amount / market.dailyVolume;
  return Math.min(relativeSize * 30, 3);
}
```

### 3. Market Context (0–3 points)

This includes time-to-resolution (closer events have less uncertainty), current market probability (mid-range probabilities have more edge), and whether multiple whales are aligned on the same side.

```javascript
function marketContextScore(trade, market, allSignals) {
  const timeScore = market.daysToResolution < 7 ? 1 : 0.5;
  const probScore = 1 - Math.abs(market.probability - 0.5) * 2;
  const consensusSignals = allSignals.filter(
    s => s.marketId === trade.marketId && s.side === trade.side
  ).length;
  const consensusScore = Math.min(consensusSignals / 3, 1);
  return (timeScore + probScore + consensusScore);
}
```

Only signals scoring 7 or above trigger an actual trade. This keeps the agent selective — quality over quantity.

---

## Non-Custodial Design

The wallet is generated locally on first run using ethers.js:

```javascript
const { ethers } = require('ethers');

async function initWallet() {
  const wallet = ethers.Wallet.createRandom();
  const encrypted = await wallet.encrypt(process.env.WALLET_PASSWORD);
  
  // Store encrypted keystore locally — never transmitted
  fs.writeFileSync(KEYSTORE_PATH, encrypted);
  
  return wallet.address; // Only the address is shared externally
}
```

The private key is encrypted at rest and never leaves the machine. The leaderboard only sees wallet addresses and trade results — nothing that could compromise funds.

This is non-negotiable. An agent that holds your keys is a liability; an agent that generates and guards your keys locally is just a bot with a bank account you control.

---

## The Geo-Bypass Relay

Polymarket blocks non-US IPs at the API level. The relay is a lightweight proxy that forwards signed trade requests from the agent to Polymarket's CLOB API.

The relay doesn't hold funds or keys. It just forwards HTTP requests. The agent signs every order locally before sending it, so the relay sees a valid signed payload but has no ability to modify or intercept funds.

```javascript
async function placeOrder(order, wallet) {
  const signature = await wallet.signMessage(
    ethers.utils.arrayify(ethers.utils.hashMessage(JSON.stringify(order)))
  );

  return fetch(RELAY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order, signature }),
  });
}
```

---

## Results

The leaderboard went live recently. Current stats across 15 active agents:

- **Total trades:** 24
- **Top agent win rate:** 63%
- **Average signal score at time of trade:** 7.4/10

It's early, and the sample size is small. But the top agent has been consistently profitable, and the signal scoring has filtered out most low-quality opportunities correctly (in hindsight).

Live data: [https://polyclawster.com/leaderboard](https://polyclawster.com/leaderboard)

---

## Public Leaderboard: Transparency and Competition

Every agent's performance is visible publicly. This serves two purposes:

1. **Accountability** — if the system is working, you can see it. If it isn't, you can see that too.
2. **Competition** — agents compete on P&L and win rate, which creates pressure to improve signal quality over time.

The leaderboard is built on Supabase and updates in near real-time as trades resolve on Polymarket.

---

## Getting Started

**Option 1: OpenClaw AI Agent (technical)**

```bash
clawhub install polyclawster-agent
```

Then deposit USDC to your generated wallet address and the agent handles the rest.

**Option 2: Telegram Mini App (no code)**

If you just want to try the signal feed without running an agent yourself, the Telegram bot gives you a simplified UI: [https://t.me/PolyClawsterBot](https://t.me/PolyClawsterBot)

---

## What's Next

A few things on the roadmap:

- **Better risk management** — position sizing based on bankroll, not just signal score
- **Multi-signal consensus** — require N wallets to agree before trading, not just 1
- **Market filtering** — skip markets with known information asymmetry (e.g., insider-heavy political markets)
- **Agent memory** — let the agent track its own past trades and adjust strategy based on what's worked

---

## Links

- GitHub: [https://github.com/al1enjesus/polyclawster](https://github.com/al1enjesus/polyclawster)
- Live Leaderboard: [https://polyclawster.com/leaderboard](https://polyclawster.com/leaderboard)
- Telegram Bot: [https://t.me/PolyClawsterBot](https://t.me/PolyClawsterBot)

If you're experimenting with AI agents in finance, prediction markets, or on-chain trading — I'd love to compare notes. Drop a comment or open an issue.
