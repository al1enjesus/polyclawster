#!/usr/bin/env node
/**
 * whale-monitor.js — Find top Polymarket traders and generate tweet content
 * Scans leaderboard, finds big P&L accounts, prepares tweet with screenshot
 */
'use strict';
const https = require('https');
const fs = require('fs');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'polyclawster-whale-monitor/1.0' }, timeout: 15000 }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

async function main() {
  // Fetch top Polymarket profiles via gamma API
  const markets = [
    'will-crude-oil-cl-hit-high-100-by-end-of-march-658-396-769-971',
    'trump-announces-end-of-military-operations-against-iran-by-march-31st',
    'will-there-be-no-change-in-fed-interest-rates-after-the-march-2026-meeting',
    'will-finland-win-eurovision-2026',
  ];

  console.log('🐋 Scanning hot markets for whale activity...\n');
  
  for (const slug of markets) {
    try {
      const rows = await httpsGet(`https://gamma-api.polymarket.com/markets?slug=${slug}&limit=1`);
      const m = Array.isArray(rows) ? rows[0] : null;
      if (!m) continue;
      
      const prices = JSON.parse(m.outcomePrices || '[]');
      const vol = parseFloat(m.volume || 0);
      const vol24 = parseFloat(m.volume24hr || 0);
      
      console.log(`📊 ${m.question}`);
      console.log(`   YES: ${(parseFloat(prices[0])*100).toFixed(0)}% | NO: ${(parseFloat(prices[1])*100).toFixed(0)}%`);
      console.log(`   Volume: $${(vol/1e6).toFixed(1)}M total | $${(vol24/1e3).toFixed(0)}k/24h`);
      console.log(`   🔗 polymarket.com/event/${m.slug}`);
      console.log('');
    } catch(e) {
      console.error('Error fetching', slug, e.message);
    }
  }

  // Also check our own agent for tweet content
  const profile = await httpsGet('https://polyclawster.com/api/agents?action=profile&id=fe6feb2d-86e5-4e9d-a610-54c78e7a36f2');
  if (profile?.agent) {
    const a = profile.agent;
    const liveBets = a.recentBets.filter(b => !b.is_demo && b.status === 'open');
    console.log('🤖 Claw-0 Status:');
    console.log(`   Live positions: ${liveBets.length}`);
    console.log(`   Total P&L: $${a.totalPnl}`);
    console.log(`   Win rate: ${(a.winRate*100).toFixed(0)}%`);
    console.log(`   Live balance: $${a.liveBal.toFixed(2)}`);
    liveBets.forEach(b => {
      const upnl = b.unrealizedPnl != null ? ` (${b.unrealizedPnl >= 0 ? '+' : ''}$${b.unrealizedPnl.toFixed(2)})` : '';
      console.log(`   • ${b.side} $${b.amount} — ${b.market.slice(0,50)}${upnl}`);
    });
  }
}

main().catch(e => console.error(e));
