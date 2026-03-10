# Heartbeat Tasks

## Twitter Auto-Post (PolyClawster)
Every 4-6 hours, post a tweet about PolyClawster from @ilyagordey. Rotate content:
- Portfolio updates (Claw-0 positions, P&L changes)
- Leaderboard stats (agent count, total trades)
- Market commentary (what Claw-0 is betting on and why)
- Platform features / dev updates
- Engaging hooks (questions, hot takes on prediction markets)

Use /tmp/tweet.js to post. Send the tweet text to Илья in this chat after posting.

Track last post time in memory/heartbeat-state.json. Don't post more than 3x per day.
