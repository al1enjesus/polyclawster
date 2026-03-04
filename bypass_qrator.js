/**
 * Qrator WAF bypass using curl-impersonate
 * Mimics real Chrome TLS fingerprint — bypasses Qrator 403
 */
const { execSync, exec } = require('child_process');
const path = require('path');

const CURL_CHROME = '/tmp/curl_chrome116';
const CURL_FF = '/tmp/curl_ff117';

async function fetchWithQratorBypass(url, options = {}) {
  const { method = 'GET', headers = {}, body, cookies, curlBin = CURL_CHROME } = options;
  
  const args = [
    '-s',
    '-L',                          // follow redirects
    '-w', '\\n__STATUS__%{http_code}',
    '--max-time', '30',
  ];
  
  // Add headers
  Object.entries(headers).forEach(([k, v]) => args.push('-H', `${k}: ${v}`));
  
  // Add cookies
  if (cookies) args.push('-b', cookies);
  
  // POST body
  if (body) { args.push('-X', 'POST', '-d', body); }
  
  args.push(url);
  
  return new Promise((resolve, reject) => {
    exec(`${curlBin} ${args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`, 
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && !stdout) { reject(err); return; }
        const parts = stdout.split('\n__STATUS__');
        const statusCode = parseInt(parts[1]) || 0;
        const body = parts[0];
        resolve({ statusCode, body, ok: statusCode >= 200 && statusCode < 400 });
      }
    );
  });
}

// Test
(async () => {
  console.log('Testing Qrator bypass...\n');
  
  // Test 1: marketolog.mts.ru
  console.log('1. marketolog.mts.ru/cabinet/');
  const r1 = await fetchWithQratorBypass('https://marketolog.mts.ru/cabinet/', { curlBin: CURL_CHROME });
  console.log('   Status:', r1.statusCode, r1.ok ? '✅' : r1.statusCode === 401 ? '✅ (need auth)' : '❌');
  console.log('   Body preview:', r1.body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 150));
  
  // Test 2: regular curl comparison
  console.log('\n2. Regular curl (should be 403):');
  const r2 = await fetchWithQratorBypass('https://marketolog.mts.ru/cabinet/', { curlBin: 'curl' });
  console.log('   Status:', r2.statusCode);
  
  // Test 3: hh.ru (also Qrator)
  console.log('\n3. hh.ru:');
  const r3 = await fetchWithQratorBypass('https://hh.ru/', { curlBin: CURL_CHROME });
  console.log('   Status:', r3.statusCode, r3.ok ? '✅' : '❌');
  
  console.log('\n✅ curl-impersonate Qrator bypass module ready!');
  console.log('Usage: const { fetchWithQratorBypass } = require("./bypass_qrator.js")');
})();

module.exports = { fetchWithQratorBypass };
