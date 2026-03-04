/**
 * /api/balance — real USDC.e balance from Polygon RPC
 */
const https = require('https');

const USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

const RPC_ENDPOINTS = [
  { host: 'polygon-bor-rpc.publicnode.com', path: '/' },
  { host: 'rpc-mainnet.matic.quiknode.pro',  path: '/' },
  { host: 'polygon.drpc.org',               path: '/' },
  { host: 'rpc.ankr.com',                   path: '/polygon' },
];

function rpcCall({ host, path }, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: host, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(7000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body); req.end();
  });
}

async function getUSDCBalance(address) {
  const selector = '0x70a08231';
  const padded = address.toLowerCase().replace('0x', '').padStart(64, '0');
  const callData = selector + padded;

  for (const ep of RPC_ENDPOINTS) {
    try {
      const res = await rpcCall(ep, {
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: USDC_CONTRACT, data: callData }, 'latest']
      });
      if (res.result !== undefined) {
        const hex = res.result;
        if (!hex || hex === '0x') return 0;
        return Number(BigInt(hex)) / 1e6;
      }
    } catch(e) { /* try next */ }
  }
  throw new Error('All RPCs unavailable');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const { address } = req.query;
  if (!address || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
    return res.json({ ok: false, error: 'Invalid address' });
  }
  try {
    const balance = await getUSDCBalance(address);
    res.json({ ok: true, balance, symbol: 'USDC', network: 'Polygon' });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
};
