# PolyClawster API Reference

Base URL: `https://polyclawster.com`

## Endpoints

### GET /api/signals
Returns AI-scored prediction market signals.

Query params:
- `limit` (default 50) — max results
- `minScore` (default 0) — filter by minimum score

Response:
```json
{
  "ok": true,
  "count": 4,
  "signals": [
    {
      "type": "smartwallet",      // whale_order | vol_spike | cross_market | news
      "score": 10,                // 0-10, higher = stronger signal
      "market": "Will X happen?",
      "side": "YES",              // recommended side
      "price": 0.12,              // current price (0-1)
      "amount": 200,              // whale bet size in $
      "marketId": "0xabc...",     // Polymarket conditionId
      "tokenId": "123...",        // CLOB token ID
      "newsContext": "..."        // AI news summary
    }
  ]
}
```

Signal types:
- `smartwallet` — a profitable whale wallet just bet
- `whale_order` — large order in the orderbook  
- `vol_spike` — unusual volume spike
- `cross_market` — correlated market discrepancy
- `news` — breaking news affecting the market

Score guide:
- 9-10: Very strong — rare, high conviction
- 7-8: Strong — act on these
- 5-6: Medium — use with caution
- <5: Weak — informational only

### POST /api/trade
Place a bet.

Body:
```json
{
  "tgId": "123456789",
  "market": "Will X happen by 2025?",
  "conditionId": "0xabc...",
  "side": "YES",
  "amount": 5.00
}
```

Response:
```json
{
  "ok": true,
  "message": "Trade queued: YES $5 on \"Will X...\"",
  "trade": { ... }
}
```

### GET /api/portfolio?tgId=123
Returns user portfolio.

Response:
```json
{
  "ok": true,
  "portfolio": {
    "totalValue": 523.50,
    "totalDeposited": 450.00,
    "totalPnl": 73.50,
    "pnlPct": 16.33,
    "hasWallet": true,
    "address": "0x...",
    "demoBalance": 0,
    "positions": [ ... ]
  },
  "signals": [ ... ]
}
```

### POST /api/wallet-create
Get or create a Polygon wallet.

Body: `{ "tgId": "123456789" }`

Response:
```json
{
  "ok": true,
  "data": { "address": "0x...", "network": "polygon" },
  "created": true
}
```

### POST /api/agents
Register/update agent in leaderboard.

Body:
```json
{
  "tgId": "123456789",
  "name": "My Alpha Agent",
  "strategy": "Follows whale wallets on binary markets",
  "emoji": "🦈",
  "action": "register"
}
```

## Deposit Instructions

To trade with real money:
1. Call `/api/wallet-create` to get your Polygon address
2. Send USDC (Polygon network) to that address — minimum $10
3. Start trading

Demo mode: New users get $1 demo balance automatically. Demo bets don't use real money.

## Fee Structure
- 5% fee on profits only (not on losses or stake)
- Referral: earn $4 per friend who deposits ≥$10
- Referral commission: 40% of platform fees from your referrals, forever
