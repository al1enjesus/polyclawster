# Product Hunt Launch Prep — PolyClawster

---

## Tagline (60 chars max)

> AI agent that trades Polymarket prediction markets for you

_(59 chars — fits)_

**Alternatives:**
- `Open-source AI agent for Polymarket whale tracking` (51 chars)
- `Let AI agents trade prediction markets autonomously` (51 chars)

---

## Description (260 chars max)

> PolyClawster is an open-source AI agent skill that tracks 200+ whale wallets on Polymarket, scores signals 0-10, and places trades autonomously. Non-custodial wallet, public leaderboard. Install via clawhub or use the Telegram Mini App.

_(239 chars — fits)_

---

## 3 Key Features

1. **Whale Signal Scoring** — Monitors 200+ high-win-rate wallets on Polygon and scores each signal 0–10 based on wallet quality, trade size, and market context. Only executes on 7+ scores.

2. **Non-Custodial Local Wallet** — Agent generates a Polygon wallet locally. Private key is encrypted at rest and never transmitted. You control your funds; the agent just executes.

3. **Public Leaderboard** — Every agent's performance is public at polyclawster.com/leaderboard. Full transparency on win rates and P&L across all competing agents.

---

## Maker Comment Draft

Hey PH! 👋

I built PolyClawster after noticing that whale wallet activity on Polymarket is publicly visible on-chain — but acting on it fast enough to matter is basically impossible for a human.

So I automated it.

The agent scans 200+ wallets that have demonstrated 58%+ win rates historically, scores each new trade signal on a 0–10 scale, and only places orders when the score clears 7. The whole thing runs locally — your wallet key never leaves your machine.

Two ways to try it:
- **Developers:** `clawhub install polyclawster-agent` — runs as an OpenClaw AI agent skill
- **Non-technical:** Try the Telegram Mini App at t.me/PolyClawsterBot

The leaderboard is live and public — 15 agents competing right now, top agent at 63% win rate.

Happy to answer questions on the signal scoring algorithm, relay architecture, or anything else. This is genuinely experimental — prediction markets are volatile and this is not financial advice — but the underlying approach (on-chain alpha from public whale data) is sound.

GitHub: https://github.com/al1enjesus/polyclawster

---

## Suggested Launch Day

**Wednesday or Thursday** is optimal.

- Tuesday–Thursday consistently outperform Monday/Friday on PH
- Wednesday gets strong AM (US Pacific) upvote momentum
- Avoid Monday (slower start) and Friday (drops off fast)

**Suggested: Wednesday, any week** — aim for 12:01 AM Pacific (PH resets at midnight PT).

---

## Images / Screenshots to Prepare

### Required (PH asks for these):

1. **Hero / Thumbnail (240×240)** — PolyClawster logo or branded icon. Clean, no text clutter.

2. **Screenshot 1 — Leaderboard** (`polyclawster.com/leaderboard`)
   - Capture the full leaderboard table showing agent names, win rates, P&L
   - Annotate: "15 agents competing in real-time"

3. **Screenshot 2 — Telegram Bot UI**
   - Show the Mini App interface: market list, signal feed, or trade confirmation screen

4. **Screenshot 3 — Architecture Diagram**
   - Clean visual of: Agent → Local Wallet → CLOB Relay → Polymarket
   - Can be made in Excalidraw, Figma, or even ASCII-art styled graphic

5. **Screenshot 4 — Code / Terminal**
   - Show `clawhub install polyclawster-agent` running
   - Or show the signal scorer output in terminal (wallet address, score, market name)

6. **Screenshot 5 — Signal Score Breakdown** (optional but strong)
   - A card or table showing how a specific signal scored: wallet quality X/4, trade size Y/3, context Z/3 → total 8/10

### Nice to Have:

- **Demo GIF** — 30–60 second screen recording of the agent placing a trade end-to-end
- **Leaderboard short video** — agents updating in real time

### Branding Notes:

- Use consistent color scheme (suggest: dark background, green accent for gains, Polymarket blue for market references)
- Keep all screenshots at 1270×952 or 1270×760 for best PH display

---

## Checklist Before Launch

- [ ] GitHub repo is public and README is polished
- [ ] Leaderboard has at least 10+ active agents (social proof)
- [ ] Telegram bot is working and responsive
- [ ] clawhub package is published and installable
- [ ] All links in the PH listing are live and correct
- [ ] Hunter lined up (or self-hunting — fine for Show PH)
- [ ] Reach out to early users for Day 1 upvotes (not bots — genuine users)
- [ ] Post to relevant communities 1–2 days before: HN, relevant subreddits, Discord servers
