#!/usr/bin/env node
/**
 * PolyClawster Setup
 *
 * Usage:
 *   node setup.js --auto                      # Auto-create agent wallet
 *   node setup.js --auto --name "My Agent"    # With custom name
 *   node setup.js --auto --ref REF_CODE       # With referral code
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_DIR  = path.join(process.env.HOME || '/root', '.polyclawster');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const API_BASE    = 'https://polyclawster.com';

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'polyclawster-skill/1.2',
      },
      timeout: 15000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Invalid JSON: ' + d.slice(0, 100))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(payload);
    req.end();
  });
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return null; }
}

function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

async function autoSetup(opts = {}) {
  const existing = loadConfig();
  if (existing?.agentId && existing?.walletAddress) {
    console.log('✅ Already configured!');
    console.log(`   Agent ID: ${existing.agentId}`);
    console.log(`   Wallet:   ${existing.walletAddress}`);
    console.log(`   Dashboard: ${existing.dashboard}`);
    console.log('');
    console.log('Delete ~/.polyclawster/config.json to reconfigure.');
    return existing;
  }

  const name     = opts.name     || 'OpenClaw Agent';
  const strategy = opts.strategy || '';
  const claimCode = opts.claimCode || undefined;

  console.log('🤖 Creating agent on PolyClawster...');

  const result = await postJSON(`${API_BASE}/api/agents`, {
    action: 'register',
    name,
    emoji: '🤖',
    strategy,
    claimCode,
  });

  if (!result.ok) {
    throw new Error('Registration failed: ' + (result.error || 'unknown'));
  }

  const config = {
    agentId:       result.agentId,
    apiKey:        result.apiKey,
    walletAddress: result.walletAddress,
    dashboard:     result.dashboard,
    createdAt:     new Date().toISOString(),
  };

  saveConfig(config);

  console.log('');
  console.log('✅ Agent created!');
  console.log(`   Name:      ${name}`);
  console.log(`   Wallet:    ${result.walletAddress}`);
  console.log(`   API Key:   ${result.apiKey}`);
  console.log(`   Dashboard: ${result.dashboard}`);
  console.log('');
  console.log('💰 Deposit USDC (Polygon network) to start live trading:');
  console.log(`   ${result.walletAddress}`);
  console.log('');
  console.log('🎮 You have $10 demo balance to start with.');
  console.log('');
  console.log('📋 Next steps:');
  console.log('   Browse markets:  node scripts/browse.js "crypto"');
  console.log('   Trade (demo):    node scripts/trade.js --market "bitcoin-100k" --side YES --amount 2 --demo');
  console.log('   Check balance:   node scripts/balance.js');
  console.log('   Auto-trade:      node scripts/auto.js --min-score 7 --max-bet 5 --dry-run');

  return config;
}

module.exports = { autoSetup, loadConfig, saveConfig, CONFIG_FILE };

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--auto') || args.length === 0) {
    const nameIdx = args.indexOf('--name');
    const name = nameIdx >= 0 ? args[nameIdx + 1] : undefined;
    const refIdx = args.indexOf('--ref');
    const ref = refIdx >= 0 ? args[refIdx + 1] : undefined;
    const claimIdx = args.indexOf('--claim');
    const claimCode = claimIdx >= 0 ? args[claimIdx + 1] : undefined;

    autoSetup({ name, claimCode }).catch(e => {
      console.error('❌ Error:', e.message);
      process.exit(1);
    });
  } else {
    console.log('PolyClawster Setup');
    console.log('');
    console.log('Usage:');
    console.log('  node setup.js --auto                   # Create agent');
    console.log('  node setup.js --auto --name "Trader"   # With name');
    console.log('  node setup.js --auto --claim PC-XXXXX  # Link to TMA account');
  }
}
