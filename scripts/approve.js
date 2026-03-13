#!/usr/bin/env node
/**
 * PolyClawster Approve — one-time Polymarket contract authorization
 *
 * Grants the Polymarket exchange contracts permission to move your USDC
 * and conditional tokens. This is the same authorization the official
 * Polymarket web app requests. Required once before your first live trade.
 *
 * Usage:
 *   node approve.js           # Grant authorizations if needed
 *   node approve.js --check   # Check status only (no transactions)
 */
'use strict';
const { loadConfig, getSigningKey } = require('./setup');

// Polygon mainnet — Polymarket contract addresses (public, from polymarket.com docs)
const USDC_CONTRACT     = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const USDC_E_CONTRACT   = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF_EXCHANGE      = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
const NEG_RISK_ADAPTER  = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';
const CTF_CONTRACT      = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const POLYGON_RPC       = 'https://polygon-bor-rpc.publicnode.com';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
];

// Spending cap: $1 billion USDC (effectively unlimited for trading purposes)
const SPENDING_CAP_USDC = '1000000000000000'; // 1B * 10^6 (6 decimals)

/**
 * ensureApprovals — programmatic entry point (called by trade.js before live trades)
 * Silently grants any missing authorizations; skips already-approved contracts.
 * @param {object} wallet  - ethers.Wallet (connected to provider)
 * @param {object} provider - ethers.Provider
 * @param {object} ethers  - ethers module
 */
async function ensureApprovals(wallet, provider, ethers) {
  const cap = ethers.BigNumber.from(SPENDING_CAP_USDC);
  const gasPrice = await provider.getGasPrice();
  const txOpts   = { gasLimit: 120000, gasPrice: gasPrice.mul(2), type: 0 };

  const erc20Tokens   = [USDC_CONTRACT, USDC_E_CONTRACT];
  const erc20Spenders = [CTF_EXCHANGE, NEG_RISK_EXCHANGE];

  for (const tokenAddr of erc20Tokens) {
    const token = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
    for (const spender of erc20Spenders) {
      const current = await token.allowance(wallet.address, spender).catch(() => ethers.BigNumber.from(0));
      if (current.lt(cap.div(2))) {
        console.log(`   Authorizing USDC for exchange ${spender.slice(0, 10)}...`);
        const tx = await token.approve(spender, cap, txOpts);
        await tx.wait();
      }
    }
  }

  const ctf = new ethers.Contract(CTF_CONTRACT, [
    'function isApprovedForAll(address owner, address operator) view returns (bool)',
    'function setApprovalForAll(address operator, bool approved) external',
  ], wallet);

  for (const spender of [CTF_EXCHANGE, NEG_RISK_EXCHANGE, NEG_RISK_ADAPTER]) {
    const ok = await ctf.isApprovedForAll(wallet.address, spender).catch(() => false);
    if (!ok) {
      console.log(`   Authorizing conditional tokens for exchange ${spender.slice(0, 10)}...`);
      const tx = await ctf.setApprovalForAll(spender, true, txOpts);
      await tx.wait();
    }
  }
}

/**
 * run — interactive CLI runner with status output
 */
async function run(checkOnly = false) {
  const config = loadConfig();
  const signingKey = getSigningKey(config);
  if (!signingKey) {
    throw new Error('No config. Run: node scripts/setup.js --auto');
  }

  const { ethers } = await import('ethers');
  const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
  const wallet   = new ethers.Wallet(signingKey, provider);
  const cap      = ethers.BigNumber.from(SPENDING_CAP_USDC);

  console.log(`📋 Wallet: ${wallet.address}`);
  console.log('');

  const polBalance   = await provider.getBalance(wallet.address);
  const polFormatted = parseFloat(ethers.utils.formatEther(polBalance)).toFixed(4);
  console.log(`⛽ POL balance: ${polFormatted} (needed: ~0.01 for gas)`);

  if (parseFloat(polFormatted) < 0.005) {
    console.log('');
    console.log('⚠️  Not enough POL for gas. Send at least 0.01 POL to:');
    console.log(`   ${wallet.address}`);
    if (!checkOnly) process.exit(1);
    return;
  }

  const tokens  = [
    { label: 'USDC (native)', address: USDC_CONTRACT  },
    { label: 'USDC.e',        address: USDC_E_CONTRACT },
  ];
  const spenders = [
    { label: 'CTF Exchange',      address: CTF_EXCHANGE      },
    { label: 'Neg Risk Exchange', address: NEG_RISK_EXCHANGE },
  ];

  console.log('');
  console.log('🔍 Checking USDC authorizations...');
  console.log('');

  for (const token of tokens) {
    const erc20 = new ethers.Contract(token.address, ERC20_ABI, wallet);
    let balance = 0;
    try {
      const raw = await erc20.balanceOf(wallet.address);
      balance = parseFloat(ethers.utils.formatUnits(raw, 6));
    } catch {}
    console.log(`💵 ${token.label} balance: $${balance.toFixed(2)}`);

    for (const spender of spenders) {
      let current = ethers.BigNumber.from(0);
      try { current = await erc20.allowance(wallet.address, spender.address); } catch {}
      const authorized = current.gte(cap.div(2));
      console.log(`   ${spender.label}: ${authorized ? '✅ authorized' : '❌ not authorized'}`);

      if (!authorized && !checkOnly) {
        console.log(`   → Authorizing ${token.label} for ${spender.label}...`);
        try {
          const gasPrice = await provider.getGasPrice();
          const tx = await erc20.approve(spender.address, cap, { gasLimit: 100000, gasPrice: gasPrice.mul(2), type: 0 });
          console.log(`   → TX: ${tx.hash}`);
          await tx.wait();
          console.log('   ✅ Done!');
        } catch (e) {
          console.warn(`   ⚠️  Failed: ${e.message}`);
        }
      }
    }
    console.log('');
  }

  const ctf = new ethers.Contract(CTF_CONTRACT, [
    'function isApprovedForAll(address owner, address operator) view returns (bool)',
    'function setApprovalForAll(address operator, bool approved) external',
  ], wallet);

  const ctfSpenders = [
    { label: 'CTF Exchange',      address: CTF_EXCHANGE      },
    { label: 'Neg Risk Exchange', address: NEG_RISK_EXCHANGE },
    { label: 'Neg Risk Adapter',  address: NEG_RISK_ADAPTER  },
  ];

  console.log('🔍 Checking conditional token authorizations...');
  console.log('');
  for (const spender of ctfSpenders) {
    const authorized = await ctf.isApprovedForAll(wallet.address, spender.address).catch(() => false);
    console.log(`   ${spender.label}: ${authorized ? '✅ authorized' : '❌ not authorized'}`);
    if (!authorized && !checkOnly) {
      console.log('   → Authorizing...');
      try {
        const gasPrice = await provider.getGasPrice();
        const tx = await ctf.setApprovalForAll(spender.address, true, { gasLimit: 100000, gasPrice: gasPrice.mul(2), type: 0 });
        console.log('   → TX: ' + tx.hash);
        await tx.wait();
        console.log('   ✅ Done!');
      } catch (e) {
        console.warn('   ⚠️  Failed: ' + e.message);
      }
    }
  }
  console.log('');

  if (!checkOnly) {
    console.log('✅ All authorizations complete. You can now live-trade on Polymarket.');
    console.log('   node scripts/trade.js --market "bitcoin-100k" --side YES --amount 5');
  }
}

module.exports = { ensureApprovals };

if (require.main === module) {
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) console.log('🔍 Checking authorizations (read-only)...\n');
  else console.log('⚡ Setting up Polymarket authorizations...\n');
  run(checkOnly).catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
}
