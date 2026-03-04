/**
 * edge/config.js — Central config for all edge modules
 */
const fs = require('fs');

let _cfg;
function getCfg() {
  if (!_cfg) {
    try { _cfg = JSON.parse(fs.readFileSync('/config/openclaw.json')); } catch { _cfg = {}; }
  }
  return _cfg;
}

module.exports = {
  MY_WALLET:   '0x3eae9f8a3e1eba6b7f4792fc3877e50a32e2c47b',
  CHAT_ID:     '399089761',
  get BOT_TOKEN() { return getCfg()?.channels?.telegram?.botToken || ''; },
  PPLX_KEY:    'process.env.PERPLEXITY_API_KEY || ""',

  // Orderbook thresholds
  OB_BIG:      5_000,    // $5k+ single order = interesting
  OB_WHALE:    20_000,   // $20k+ = whale
  OB_IMBALANCE: 3.0,     // bid/ask ratio 3:1 = accumulation
  PRICE_DRIFT: 0.04,     // 4% price move between runs

  // Smart wallet scoring
  SW_MIN_WR:   0.58,     // 58%+ win rate
  SW_MIN_CLOSED: 8,  // Minimum 8 closed positions for reliable WR      // 5+ closed positions
  SW_MIN_BET:  150,      // $150+ avg bet

  // Volume spike (new positions in 5 min)
  VOL_SPIKE:   10_000,   // $10k in last trades = spike

  // State files — persistent storage (NOT /tmp)
  STATE:       '/workspace/edge/db/edge_state.json',
  WALLETS_DB:  '/workspace/edge/db/edge_wallets.json',
  SEEN:        '/workspace/edge/db/edge_seen.json',
  MARKETS_DB:  '/workspace/edge/db/edge_markets.json',

  // Non-political filter
  SPORTS: [
    ' vs ', 'nba', 'nfl', 'nhl', 'mlb', 'mls', 'premier league',
    'champions league', 'bundesliga', 'serie a', 'ligue 1', 'la liga',
    'o/u ', 'over/under', 'spread', '1h ', '2h ', 'moneyline',
    'bitcoin up or down', 'solana up or down', 'ethereum up or down',
    'btc up', 'eth up', 'crypto up or down',
    'fc win', 'ufc', 'mma', 'boxing', 'tennis', 'golf',
    'f1 ', 'formula 1', 'grand prix', 'esport', 'csgo', 'dota',
    'set handicap', 'world cup', 'tweet', 'post 21', 'post 22',
    'australian open', 'wimbledon', 'french open', 'us open',
  ],
};
