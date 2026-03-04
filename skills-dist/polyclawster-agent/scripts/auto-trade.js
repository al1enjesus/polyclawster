#!/usr/bin/env node
/**
 * polyclawster-agent/scripts/auto-trade.js
 *
 * Autonomous trading loop for OpenClaw agents.
 * Fetches signals, evaluates them, places bets automatically.
 *
 * Usage:
 *   node auto-trade.js --tgId 123456 --budget 10 --min-score 7 --dry-run
 *   node auto-trade.js --tgId 123456 --budget 50 --min-score 8
 *
 * Options:
 *   --tgId <id>        Your Telegram ID (required)
 *   --budget <$>       Max to spend per run (default: $10)
 *   --min-score <n>    Minimum signal score to act on (default: 7)
 *   --max-bet <$>      Max per single bet (default: $5)
 *   --dry-run          Simulate without placing real bets
 *   --once             Run once and exit (vs loop every 20 min)
 */
'use strict';

const { getSignals, getPortfolio, placeBet } = require('./polymarket.js');

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag, def) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : def;
  };
  return {
    tgId: get('--tgId', null),
    budget: parseFloat(get('--budget', '10')),
    minScore: parseFloat(get('--min-score', '7')),
    maxBet: parseFloat(get('--max-bet', '5')),
    dryRun: args.includes('--dry-run'),
    once: args.includes('--once'),
  };
}

function pickBetSize(signal, maxBet) {
  // Kelly-inspired sizing: higher score = bigger bet
  const score = signal.score || 0;
  if (score >= 9)  return Math.min(maxBet, maxBet * 1.0);
  if (score >= 8)  return Math.min(maxBet, maxBet * 0.7);
  if (score >= 7)  return Math.min(maxBet, maxBet * 0.5);
  return Math.min(maxBet, maxBet * 0.3);
}

async function runOnce(cfg) {
  const { tgId, budget, minScore, maxBet, dryRun } = cfg;
  console.log(`\n[${new Date().toISOString()}] 🤖 PolyClawster Agent running`);
  console.log(`  tgId: ${tgId} | budget: $${budget} | minScore: ${minScore} | dryRun: ${dryRun}`);

  // 1. Check portfolio
  const portfolio = await getPortfolio(tgId);
  const balance = portfolio.totalValue || portfolio.demoBalance || 0;
  const deposited = portfolio.totalDeposited || 0;
  console.log(`  Portfolio: value=$${balance.toFixed(2)}, deposited=$${deposited}, hasWallet=${portfolio.hasWallet}`);

  if (!portfolio.hasWallet && !dryRun) {
    console.log('  ⚠️  No wallet yet. Deposit USDC to your PolyClawster wallet first.');
    return { status: 'no_wallet' };
  }

  // 2. Fetch signals
  const signals = await getSignals({ minScore, limit: 10 });
  console.log(`  Signals: ${signals.length} above score ${minScore}`);

  if (!signals.length) {
    console.log('  No actionable signals this run.');
    return { status: 'no_signals' };
  }

  // 3. Pick and place bets
  let spent = 0;
  const placed = [];

  for (const signal of signals) {
    if (spent >= budget) break;
    const betSize = pickBetSize(signal, Math.min(maxBet, budget - spent));
    if (betSize < 0.5) continue;

    const side = signal.side || (signal.score >= 8 ? 'YES' : 'NO');
    const market = signal.market || signal.title || '';

    console.log(`  → ${dryRun ? '[DRY]' : ''} Bet $${betSize.toFixed(2)} ${side} on "${market.slice(0, 50)}" (score: ${signal.score})`);

    if (!dryRun) {
      try {
        const result = await placeBet({
          tgId, market, marketId: signal.marketId || signal.market_id,
          side, amount: betSize, signalScore: signal.score,
        });
        console.log(`    ✅ ${result.message || 'queued'}`);
        placed.push({ market, side, amount: betSize, score: signal.score });
      } catch (e) {
        console.log(`    ❌ Failed: ${e.message}`);
      }
    } else {
      placed.push({ market, side, amount: betSize, score: signal.score, dry: true });
    }
    spent += betSize;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n  Summary: ${placed.length} bets, $${spent.toFixed(2)} total`);
  return { status: 'done', placed, spent };
}

async function main() {
  const cfg = parseArgs();
  if (!cfg.tgId) {
    console.error('Error: --tgId required');
    console.error('Example: node auto-trade.js --tgId 123456789 --budget 10 --dry-run');
    process.exit(1);
  }

  if (cfg.once) {
    await runOnce(cfg);
    return;
  }

  // Loop every 20 minutes (matching edge-runner cadence)
  console.log('🔄 Auto-trade loop started (every 20 min). Ctrl+C to stop.');
  while (true) {
    await runOnce(cfg).catch(e => console.error('Run error:', e.message));
    const nextRun = new Date(Date.now() + 20 * 60 * 1000);
    console.log(`\n  Next run: ${nextRun.toISOString()}`);
    await new Promise(r => setTimeout(r, 20 * 60 * 1000));
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
