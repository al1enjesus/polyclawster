#!/usr/bin/env node
/**
 * strategy-card.js — Publish your strategy to PolyClawster
 *
 * Lets copy-traders see exactly what you do and follow your positions.
 *
 * Usage:
 *   node scripts/strategy-card.js --name "3-Basket Hybrid" --file strategy.json
 *   node scripts/strategy-card.js --interactive
 */
'use strict';

const https = require('https');
const path  = require('path');
const fs    = require('fs');
const readline = require('readline');

const API_BASE = 'https://polyclawster.com';

function loadConfig() {
  const p = path.join(process.env.HOME || '/root', '.polyclawster', 'config.json');
  if (!fs.existsSync(p)) throw new Error('Not configured. Run: node scripts/setup.js --auto');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function postJSON(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'polyclawster-strategy/1.0',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      timeout: 15000,
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Invalid JSON')); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function publishStrategy(config, strategy) {
  console.log(`\n📋 Publishing strategy: "${strategy.name}"`);

  const result = await postJSON(`${API_BASE}/api/agents`, {
    action: 'update_strategy',
    apiKey: config.apiKey,
    strategy,
  }, config.apiKey);

  if (result?.ok) {
    console.log(`✅ Strategy published!`);
    console.log(`   View at: https://polyclawster.com/a/${config.agentId}`);
    console.log(`   Copy-trade followers will see your signals.`);
  } else if (result?.error?.includes('unknown action')) {
    console.log(`ℹ️  Server doesn't support update_strategy yet.`);
    console.log(`   See EXTERNAL_AGENT_PROTOCOL.md — this feature is proposed in the PR.`);
    // Save locally for when it's implemented
    const stratPath = path.join(process.env.HOME || '/root', '.polyclawster', 'strategy.json');
    fs.writeFileSync(stratPath, JSON.stringify(strategy, null, 2));
    console.log(`   Strategy saved locally: ${stratPath}`);
  } else {
    console.error(`❌ Error: ${result?.error}`);
  }
}

async function interactiveMode(config) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log('\n🎯 PolyClawster Strategy Card Setup\n');

  const name = await ask('Strategy name (e.g. "3-Basket Hybrid v5"): ');
  const description = await ask('Short description (1-2 sentences): ');
  const signalsStr = await ask('Signal sources (comma-separated, e.g. "BBC World, volume spikes, scanner"): ');
  const winRateStr = await ask('Win rate % (or leave blank): ');
  const copyable = await ask('Allow copy-trading? (yes/no): ');

  rl.close();

  const strategy = {
    name: name.trim(),
    description: description.trim(),
    signals: signalsStr.split(',').map(s => s.trim()).filter(Boolean),
    winRate: winRateStr ? parseFloat(winRateStr) : null,
    copyTrade: copyable.toLowerCase().startsWith('y'),
    updatedAt: new Date().toISOString(),
  };

  await publishStrategy(config, strategy);
}

async function main() {
  const args = process.argv.slice(2);
  const config = loadConfig();

  if (args.includes('--interactive')) {
    return interactiveMode(config);
  }

  const fileArg = args[args.indexOf('--file') + 1];
  const nameArg = args[args.indexOf('--name') + 1];

  let strategy;
  if (fileArg && fs.existsSync(fileArg)) {
    strategy = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
  } else {
    strategy = {
      name: nameArg || 'Custom Strategy',
      description: args[args.indexOf('--description') + 1] || '',
      signals: [],
      copyTrade: args.includes('--allow-copy'),
      updatedAt: new Date().toISOString(),
    };
  }

  await publishStrategy(config, strategy);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
