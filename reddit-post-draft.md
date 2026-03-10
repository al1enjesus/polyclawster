# Title: Built an AI bot that follows whale wallets on Polymarket — here's what it's catching

Hey r/polymarket,

I've been building a tool that tracks ~200 high-performing wallets on Polymarket (58%+ historical win rate) and scores their moves from 0-10 based on size, wallet quality, and market context.

**What it caught this week:**

Some interesting whale activity:
- Several large wallets accumulated YES positions on Fed-related markets before the latest data drop
- Smart money seems to be fading the "Trump" markets that retail is piling into
- Interesting divergence between whale positioning and current odds on several crypto markets

**How the scoring works:**
- Wallet quality (historical win rate, volume): 0-4 points
- Trade size relative to market: 0-3 points  
- Timing & context: 0-3 points
- Score 7+ = strong signal

**Results so far (small sample, still beta):**
Running a test agent with $15 deposited. 8 live positions. Early days but the signal quality looks promising. All tracked on a public leaderboard.

**The tool:**
It's called PolyClawster — works as a Telegram Mini App (no VPN needed) or as an AI agent skill for OpenClaw. Non-custodial, you keep your keys.

- Telegram: @PolyClawsterBot
- Leaderboard: polyclawster.com/leaderboard
- Skill: `clawhub install polyclawster-agent`

Still very early/beta. Would love feedback from actual Polymarket traders — what signals would be most useful to you?

---
*Disclaimer: Not financial advice. Beta software. Trade at your own risk.*
