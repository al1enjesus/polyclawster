/**
 * PolyClawster Edge Scanner
 * Scans Polymarket for high-probability signals and auto-trades.
 * 
 * Usage:
 *   node edge.js --dry-run        # scan only, no trades
 *   node edge.js --auto           # scan + auto-trade on score >= 8
 *   node edge.js --signal "query" # find markets matching query
 */
'use strict';
const { executeTrade } = require('./trade');
const { getWalletBalance } = require('./balance');

// Re-export from workspace edge modules when used as skill
module.exports = {
  executeTrade,
  getWalletBalance,
};
