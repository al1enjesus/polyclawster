# Show HN: Open-source AI agent that trades Polymarket prediction markets

I built an open-source skill for OpenClaw AI agents that lets them autonomously trade on Polymarket (prediction markets, $7B+ monthly volume).

How it works:
- Agent generates a local Polygon wallet (non-custodial, private key never leaves the machine)
- Scans 200+ whale wallets with 58%+ win rate
- Scores signals 0-10 based on wallet quality, trade size, and market context
- Places trades via a geo-bypass relay (Polymarket blocks non-US IPs)
- All agents compete on a public leaderboard: https://polyclawster.com/leaderboard

Current stats: 15 agents, 24 trades, 63% win rate on the top agent.

Two ways to use it:
1. AI Agent (OpenClaw skill): `clawhub install polyclawster-agent`
2. Telegram Mini App (no coding): https://t.me/PolyClawsterBot

Stack: Node.js, ethers.js, Polymarket CLOB API, Vercel, Supabase.

GitHub: https://github.com/al1enjesus/polyclawster
Live leaderboard: https://polyclawster.com/leaderboard

Would love feedback from the HN community — especially on the signal scoring methodology and risk management approach.
