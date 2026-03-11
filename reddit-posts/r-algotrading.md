# Title: Prediction market algo: tracking whale wallets on Polymarket with signal scoring

Been running a live algo on Polymarket for a while. Here's the methodology — sharing because I haven't seen much written about systematic approaches to prediction market trading.

**The core idea:**

Polymarket is fully on-chain. Every trade, every wallet, every position is public. That makes it possible to build a curated list of high-performing wallets and monitor their activity in real time. The signal is: "a wallet with a verified edge just made a move."

**Signal scoring (0–10):**

Each detected trade from a tracked wallet gets scored across three dimensions:

1. **Wallet quality (0–4 pts)**
   - Historical win rate (weighted more heavily for larger sample sizes)
   - Total volume traded (filters out lucky small-sample wallets)
   - Recency of performance (decay on old data)

2. **Position size relative to market (0–3 pts)**
   - Size as % of market liquidity
   - Absolute size in USDC
   - Whether it's a new position or adding to existing

3. **Timing & context (0–3 pts)**
   - Distance from resolution date (avoiding last-minute noise)
   - Current odds vs. historical range (fading obvious misprices)
   - Market category (some categories have cleaner signals than others)

Score ≥ 7 = agent considers acting. Score ≥ 8 = strong signal.

**Position sizing:**

Kelly criterion with a fractional multiplier (currently 0.25× Kelly) to account for model uncertainty and the binary payoff structure. Max position size capped at a fixed % of portfolio regardless of Kelly output. 

Polymarket is binary (resolves $0 or $1), so Kelly simplifies cleanly: `f = (p × b - q) / b` where b = (1 - odds) / odds. The fractional multiplier stays conservative while the strategy is being validated.

**Execution:**

FOK (Fill or Kill) orders only. If the order doesn't fill at the target price, it's dropped — no chasing. This matters on Polymarket because the order book can be thin and a partial fill at a worse price can meaningfully affect expected value. If a signal is strong enough to act on, it's strong enough to wait for the right price.

**Monitoring & exit:**

The agent runs a separate stop-loss monitor. Positions are evaluated against:
- Current implied probability vs. entry price (tracks if the thesis is deteriorating)
- Time to resolution (position is reduced or closed if approaching resolution with adverse movement)
- Portfolio-level exposure (prevents concentration in correlated markets — e.g., multiple crypto markets moving together)

**Live results:**

- 15 agents on leaderboard, 7 open positions
- Top agent (Claw-0): 63% win rate
- Portfolio size: $14.72 (intentionally small during validation phase)

Sample is small. The win rate is directionally consistent with backtests but not statistically conclusive yet. Planning to scale once there's a larger sample.

**Open questions I'm working through:**

- How to handle correlated markets (e.g., two markets that are effectively the same bet)
- Optimal decay function for wallet quality scores over time
- Whether FOK vs. GTC changes fill rate enough to matter at current portfolio size

If anyone else is running systematic strategies on prediction markets, curious what execution approach you're using. The on-chain data is rich but the tooling is still pretty raw.

---

The tool is called PolyClawster — polyclawster.com/leaderboard if you want to see the live performance data. Also runs as an autonomous agent skill via OpenClaw.

*Not financial advice. Live trading with real funds. Beta.*
