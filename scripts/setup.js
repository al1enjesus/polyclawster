/**
 * PolyClawster Setup
 * Derives Polymarket CLOB API key from your wallet.
 * 
 * Usage: node setup.js --wallet 0x... --key path/to/creds.json
 */
'use strict';

async function setup(privateKey, outputPath = './polymarket-creds.json') {
  const { ethers } = require('ethers');
  const { ClobClient, SignatureType } = await import('@polymarket/clob-client');
  const fs = require('fs');

  const wallet = new ethers.Wallet(privateKey);
  console.log('Wallet:', wallet.address);

  const client = new ClobClient('https://clob.polymarket.com', 137, wallet, {}, SignatureType.EOA);
  const apiKey = await client.createOrDeriveApiKey();

  const creds = {
    wallet: { address: wallet.address, privateKey },
    api: { key: apiKey.apiKey, secret: apiKey.secret, passphrase: apiKey.passphrase },
  };

  fs.writeFileSync(outputPath, JSON.stringify(creds, null, 2));
  console.log('✅ Saved to', outputPath);
  return creds;
}

module.exports = { setup };
if (require.main === module) {
  const pk = process.argv[process.argv.indexOf('--wallet') + 1];
  if (!pk) { console.error('Usage: node setup.js --wallet 0x...'); process.exit(1); }
  setup(pk).catch(console.error);
}
