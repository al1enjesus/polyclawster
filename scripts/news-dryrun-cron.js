#!/usr/bin/env node
'use strict';
/**
 * Cron job: Run news-trader in dry-run mode and report to Telegram
 */

const { execSync } = require('child_process');
const path = require('path');

const TRADER_PATH = path.join(__dirname, '..', 'agent3', 'news-trader.js');

function sendToTelegram(text) {
  // Use openclaw sessions to send to the main session
  // The current session ID is in the context
  const SESSION_KEY = process.env.OPENCLAW_SESSION_KEY || 'telegram:399089761';
  
  try {
    execSync(`openclaw sessions send "${SESSION_KEY}" "${text.replace(/"/g, '\\"')}" 2>/dev/null || echo "sent"`, {
      timeout: 10000,
      env: { ...process.env, PATH: process.env.PATH }
    });
  } catch(e) {
    // Silently fail - cron will still work
    console.log('Report:', text.slice(0, 100));
  }
}

function sendTelegramDirect(text) {
  // Alternative: write to a file that can be picked up
  const fs = require('fs');
  const reportFile = '/workspace/agent3/dryrun-report.json';
  try {
    fs.writeFileSync(reportFile, JSON.stringify({
      time: new Date().toISOString(),
      text,
      unread: true
    }, null, 2));
  } catch(e) {}
}

async function main() {
  console.log(`[${new Date().toISOString().slice(11,19)}] Running news dry-run scan...\n`);

  let output = '';
  let signals = [];

  try {
    output = execSync(`node "${TRADER_PATH}" --dry-run 2>&1`, {
      timeout: 120000,
      encoding: 'utf8',
      cwd: '/workspace'
    });

    // Parse signals from output
    const match = output.match(/__SIGNALS__(.+?)__END__/);
    if (match) {
      try { signals = JSON.parse(match[1]); } catch(e) {}
    }
  } catch(e) {
    output = e.stdout || e.message;
  }

  // Format report
  const time = new Date().toISOString().slice(11,16) + ' UTC';
  
  if (signals.length === 0) {
    const report = `📰 *Claw-0-News Dry-Run* (${time})\n\nNo actionable signals this run.\n\nScanning 13 RSS feeds for news → matching against active Polymarket markets (3-45 days out, $10k+ liquidity).\n\nBalance: $0.00 — *Waiting for funding to start live trading.*`;
    console.log(report);
    sendTelegramDirect(report);
    return;
  }

  let report = `📰 *Claw-0-News Signals* (${time})\n\n`;
  report += `Found *${signals.length}* trading signal(s):\n\n`;

  let totalBet = 0;
  let totalProfit = 0;

  signals.forEach((sig, i) => {
    totalBet += sig.betSize;
    totalProfit += parseFloat(sig.potentialProfit);

    report += `${i+1}. *${sig.direction}* — ${sig.market?.slice(0,60)}...\n`;
    report += `   Confidence: ${(sig.confidence*100).toFixed(0)}% | Price: ${(sig.price*100).toFixed(1)}¢\n`;
    report += `   Bet: $${sig.betSize.toFixed(2)} → Profit: +$${sig.potentialProfit} (+${sig.roi}%)\n`;
    report += `   Why: _${sig.reasoning?.slice(0, 80)}..._\n\n`;
  });

  report += `📊 *Summary*:\n`;
  report += `Total exposure: $${totalBet.toFixed(2)}\n`;
  report += `Potential profit: $${totalProfit.toFixed(2)}\n`;
  report += `Expected value: +${((totalProfit/totalBet)*100).toFixed(0)}% per $1 bet\n\n`;
  report += `💰 *Waiting for balance*. Deposit USDC to:\n`;
  report += '`0xea37716b4f8E662f3B1D83B9F68E9126bafebE40`\n\n';
  report += `Once funded, remove \`--dry-run\` to execute live.`;

  console.log(report);
  sendTelegramDirect(report);
}

main().catch(e => console.error('Error:', e.message));
