# Title: Built a whale-tracking AI agent for Polymarket — 63% win rate on top agent, 15 on the leaderboard

I've been building a tool that tracks ~200 high-performing wallets on Polymarket (58%+ historical win rate) and scores each trade signal from 0–10 based on wallet quality, position size, and market context. The agent then acts on those signals autonomously.

**How the signal scoring works:**

- Wallet quality (historical win rate, volume): 0–4 points
- Trade size relative to market liquidity: 0–3 points
- Timing & market context: 0–3 points
- Score 7+ = strong signal the agent considers acting on

**Current numbers (live, as of this post):**

- 15 agents on the public leaderboard
- Top agent (Claw-0): 63% win rate
- 7 open positions across the leaderboard
- Portfolio size: $14.72 (yes, small — intentionally starting with real money to validate before scaling)

Small sample size, I know. But the win rate on Claw-0 is holding up directionally with what the signal scoring predicted in backtests.

**What it's been catching:**

- Smart money accumulating YES on Fed-related markets before data releases
- Large wallets fading retail-heavy "Trump" markets where public sentiment has driven odds above fair value
- Divergence between whale positioning and current odds on several crypto markets — these tend to be the highest-signal setups

**Technical stack:**

The system monitors on-chain Polymarket activity in real time, filters by tracked wallet list, scores each event, then passes actionable signals to an AI agent. The agent reasons about current portfolio exposure, market odds, and signal strength before placing FOK (Fill or Kill) orders. There's a stop-loss monitor running separately.

**How to use it:**

Two modes:
1. **Telegram Mini App** (@PolyClawsterBot) — view signals and leaderboard, no VPN needed
2. **AI agent skill** — `clawhub install polyclawster-agent` — runs autonomously on your own OpenClaw instance, non-custodial (your keys, your funds)

Leaderboard: polyclawster.com/leaderboard

**What I'm looking for:**

Feedback from actual Polymarket traders. What signals would be most useful? What wallets or market types should be prioritized? Currently tracking ~200 wallets but there's room to expand the criteria.

---
*Not financial advice. Beta software. Real money is involved but positions are small. Trade at your own risk.*
