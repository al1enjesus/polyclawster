#!/usr/bin/env node
/**
 * PolyClawster Setup
 * 
 * Usage:
 *   node setup.js --auto                  # Auto-create wallet via polyclawster.com API
 *   node setup.js --wallet 0xPRIVATEKEY   # Manual setup with existing wallet
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const CONFIG_DIR = path.join(process.env.HOME || '/root', '.polyclawster');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'polyclawster-skill/1.0',
      },
      timeout: 15000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error('Invalid response')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  console.log(`Config saved to ${CONFIG_FILE}`);
}

async function autoSetup() {
  // Check if already configured
  const existing = loadConfig();
  if (existing?.wallet?.address) {
    console.log(`Wallet already configured: ${existing.wallet.address}`);
    console.log('Delete ~/.polyclawster/config.json to reconfigure.');
    return existing;
  }

  const tgId = 'skill_' + crypto.randomBytes(8).toString('hex');
  console.log('Creating wallet via polyclawster.com API...');

  const result = await postJSON('https://polyclawster.com/api/wallet/create', { tgId });

  if (!result.ok) {
    throw new Error('Wallet creation failed: ' + (result.error || 'unknown'));
  }

  const address = result.data?.address;
  if (!address) {
    throw new Error('No address returned from API');
  }

  // The API creates the wallet in Supabase. We need the private key for local trading.
  // For auto-setup, the wallet-create endpoint doesn't return the private key publicly.
  // We store the tgId so we can reference the wallet later.
  const config = {
    wallet: {
      address,
      tgId,
    },
    api: {},
    createdAt: new Date().toISOString(),
    dashboard: `https://polyclawster.com/dashboard?address=${address}`,
  };

  saveConfig(config);

  console.log('');
  console.log('✅ Wallet created successfully!');
  console.log('');
  console.log(`   Address:   ${address}`);
  console.log(`   Network:   Polygon`);
  console.log(`   Dashboard: https://polyclawster.com/dashboard?address=${address}`);
  console.log('');
  console.log('To start trading, deposit USDC (Polygon) to your wallet address.');
  console.log('You can also send POL for gas fees.');

  return config;
}

async function manualSetup(privateKey) {
  const { ethers } = require('ethers');
  const wallet = new ethers.Wallet(privateKey);
  console.log('Wallet:', wallet.address);

  let apiCreds = {};
  try {
    const { ClobClient, SignatureType } = await import('@polymarket/clob-client');
    const client = new ClobClient('https://clob.polymarket.com', 137, wallet, {}, SignatureType.EOA);
    const apiKey = await client.createOrDeriveApiKey();
    apiCreds = {
      key: apiKey.apiKey,
      secret: apiKey.secret,
      passphrase: apiKey.passphrase,
    };
    console.log('API key derived successfully.');
  } catch (e) {
    console.warn('Could not derive API key:', e.message);
    console.warn('Trading will use on-demand key derivation.');
  }

  const config = {
    wallet: {
      address: wallet.address,
      privateKey,
    },
    api: apiCreds,
    createdAt: new Date().toISOString(),
    dashboard: `https://polyclawster.com/dashboard?address=${wallet.address}`,
  };

  saveConfig(config);

  console.log('');
  console.log('✅ Setup complete!');
  console.log(`   Address: ${wallet.address}`);
  console.log(`   Config:  ${CONFIG_FILE}`);

  return config;
}

module.exports = { autoSetup, manualSetup, loadConfig, saveConfig, CONFIG_FILE };

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--auto')) {
    autoSetup().catch(e => {
      console.error('Error:', e.message);
      process.exit(1);
    });
  } else if (args.includes('--wallet')) {
    const pk = args[args.indexOf('--wallet') + 1];
    if (!pk) {
      console.error('Usage: node setup.js --wallet 0xPRIVATEKEY');
      process.exit(1);
    }
    manualSetup(pk).catch(e => {
      console.error('Error:', e.message);
      process.exit(1);
    });
  } else {
    console.log('PolyClawster Setup');
    console.log('');
    console.log('Usage:');
    console.log('  node setup.js --auto                # Auto-create wallet');
    console.log('  node setup.js --wallet 0xPRIVATEKEY # Manual setup');
    process.exit(0);
  }
}
