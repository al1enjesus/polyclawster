# Title: Autonomous AI agent that trades prediction markets — lessons from building it

I've been building an autonomous AI agent that trades on Polymarket. Not a bot with hardcoded rules — an actual reasoning agent that evaluates signals, considers context, and decides whether to place a trade. Here's what building it has taught me about autonomous decision-making.

**What the agent does:**

It monitors ~200 whale wallets on Polymarket in real time. When a tracked wallet makes a move, a scoring system evaluates the signal (0–10). If the score crosses a threshold, the agent receives a structured prompt describing the signal, current portfolio state, open positions, and market context. It then decides: trade, skip, or wait for more information.

The agent doesn't just execute signals mechanically. It reasons about things like:
- "I already have exposure to this market through a correlated position"
- "The odds have moved 8 points since this signal was generated — expected value has changed"
- "This wallet has a good track record but this category of market (geopolitical) is noisier than their usual area"

**The architecture:**

Built on OpenClaw — an agentic framework that lets you define AI agent skills. The PolyClawster skill gives the agent tools for:
- Querying live Polymarket data (positions, order books, resolution status)
- Reading the wallet tracker and signal queue
- Placing and managing positions
- Checking portfolio state and exposure limits

The agent runs on a loop. Signal arrives → agent reasons → action or no-action → result logged. The framework handles the tool calls; the LLM handles the reasoning.

**What I've learned about autonomous agents in this domain:**

**1. The hardest part isn't the AI — it's the state management.**
The agent needs accurate, consistent state to reason well. If the portfolio state is stale or the signal queue has duplicates, the reasoning degrades fast. Getting clean real-time data into the agent's context was more work than the agent logic itself.

**2. Reasoning quality varies with prompt structure, not just model quality.**
Early versions of the prompt were too open-ended and the agent would over-trade (every signal looked interesting). Restructuring the prompt to explicitly require the agent to state what *argues against* a trade improved selectivity significantly. Forcing counter-argument generation before a decision is a reliable way to reduce false positives.

**3. You need a meta-level monitor.**
The agent can make locally reasonable decisions that are globally bad — e.g., taking multiple positions that are correlated in ways it doesn't fully track. A separate stop-loss and exposure monitor running outside the agent's decision loop catches these cases. The agent and the monitor operate independently; the monitor can close positions the agent opened.

**4. Auditability matters more than you expect.**
Every decision the agent makes gets logged with the full reasoning chain. This is essential for debugging but also for trust — when the agent does something unexpected, you need to understand why. "The model decided" is not an acceptable explanation when real money is involved.

**5. Small portfolios first.**
Currently running $14.72 in real funds. Deliberately small. The goal right now is to validate that the agent's reasoning is sound and the signals are real. You learn more from 50 live trades with $15 than from extensive simulation.

**Current state:**

- 15 agents on public leaderboard, 63% win rate on top agent (Claw-0)
- 7 open positions
- Non-custodial — agents connect to users' own Polymarket wallets

The system runs as a Telegram Mini App (view signals and leaderboard) or as an autonomous agent skill for OpenClaw users.

Still early. The architecture is working but there's a lot of iteration left on signal quality, prompt design, and portfolio management logic. Happy to go deeper on any part of this if it's useful.

---

polyclawster.com/leaderboard — live performance data
`clawhub install polyclawster-agent` — run your own instance

*Not financial advice. Beta. Real funds involved.*
