#!/usr/bin/env node
/**
 * PolyClawster Balance — check all balances
 */
'use strict';
const { loadConfig, getSigningKey } = require('./setup');

async function run() {
  const config = loadConfig();
  if (!(getSigningKey(config))) throw new Error('Not configured. Run: node scripts/setup.js --auto');

  const { ethers } = await import('ethers');
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
  const wallet = new ethers.Wallet(getSigningKey(config), provider);

  const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const USDC_NATIVE = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

  const usdce = new ethers.Contract(USDC_E, ['function balanceOf(address) view returns (uint256)'], provider);
  const usdc = new ethers.Contract(USDC_NATIVE, ['function balanceOf(address) view returns (uint256)'], provider);

  const polBal = await provider.getBalance(wallet.address);
  const usdceBal = await usdce.balanceOf(wallet.address);
  const usdcBal = await usdc.balanceOf(wallet.address);

  console.log('💰 ' + wallet.address);
  console.log('');
  console.log('   POL:        ' + parseFloat(ethers.utils.formatEther(polBal)).toFixed(4));
  console.log('   USDC.e:     $' + ethers.utils.formatUnits(usdceBal, 6) + '  ← trading token');
  if (usdcBal.gt(0)) {
    console.log('   USDC:       $' + ethers.utils.formatUnits(usdcBal, 6) + '  ← run swap.js to convert');
  }

  // CLOB balance
  if (config.clobApiKey && config.clobSig) {
    try {
      const { ClobClient, SignatureType } = await import('@polymarket/clob-client');
      const signer = new ethers.Wallet(getSigningKey(config));
      const creds = { key: config.clobApiKey, secret: config.clobSig, passphrase: config.clobPass };
      const client = new ClobClient('https://clob.polymarket.com', 137, signer, creds, SignatureType.EOA, signer.address);
      await client.updateBalanceAllowance({ asset_type: 'COLLATERAL' });
      const bal = await client.getBalanceAllowance({ asset_type: 'COLLATERAL' });
      console.log('   CLOB:       $' + (parseInt(bal.balance) / 1e6).toFixed(2) + '  ← available for orders');
    } catch {}
  }

  console.log('');
  console.log('📋 Polygonscan: https://polygonscan.com/address/' + wallet.address);
  console.log('');
  console.log('To fund: send POL (Polygon) to ' + wallet.address);
  console.log('Then run: node scripts/swap.js');
}

async function getWalletBalance() {
  const { httpGet, API_BASE } = require('./setup');
  const config = loadConfig();
  if (!getSigningKey(config)) return null;

  // Fetch portfolio (demo balance, open bets) from polyclawster.com
  const portfolio = await httpGet(
    `${API_BASE}/api/agents?action=portfolio`,
    config.apiKey ? { 'X-Api-Key': config.apiKey } : {}
  ).catch(() => null);

  // On-chain USDC.e balance
  let cashBalance = 0;
  let polBalance  = 0;
  try {
    const { ethers } = await import('ethers');
    const provider  = new ethers.providers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const wallet    = new ethers.Wallet(getSigningKey(config), provider);
    const usdce     = new ethers.Contract('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', ['function balanceOf(address) view returns (uint256)'], provider);
    const [polBal, usdceBal] = await Promise.all([provider.getBalance(wallet.address), usdce.balanceOf(wallet.address)]);
    cashBalance = parseFloat(ethers.utils.formatUnits(usdceBal, 6));
    polBalance  = parseFloat(ethers.utils.formatEther(polBal));
  } catch {}

  return {
    cashBalance,
    polBalance,
    demoBal:  parseFloat(portfolio?.demoBal  || portfolio?.demo_balance || 10),
    openBets: portfolio?.openBets || [],
  };
}

module.exports = { getWalletBalance };

if (require.main === module) {
  run().catch(e => { console.error('❌', e.message); process.exit(1); });
}
