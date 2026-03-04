/**
 * lib/clob-proxy.js — Polymarket CLOB via residential proxy
 *
 * Polymarket blocks datacenter IPs (Vercel, Hetzner, AWS) on POST /order.
 * This module routes CLOB order submission through a residential HTTP proxy
 * (Decodo/human-browser) to bypass the geo/ASN block.
 *
 * Used only for order placement. All read endpoints work fine without proxy.
 */
'use strict';
const https       = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs          = require('fs');

const CLOB_HOST = 'clob.polymarket.com';
const CLOB_BASE = `https://${CLOB_HOST}`;

// ─── Proxy config ─────────────────────────────────────────────────────────────
// Uses Decodo (human-browser skill) credentials from env or stored trial file.

function getProxyUrl() {
  // Already set (from getTrial() or env)
  if (process.env.HB_PROXY_USER && process.env.HB_PROXY_PASS) {
    const country = (process.env.HB_PROXY_COUNTRY || 'us').toLowerCase();
    // Use US residential to match Polymarket's allowed regions
    const port = 10001; // sticky session port
    const user = process.env.HB_PROXY_USER;
    const pass = process.env.HB_PROXY_PASS;
    return `http://${user}:${pass}@${country}.decodo.com:${port}`;
  }

  // Try stored trial file
  const trialFiles = ['/tmp/hb-trial.json', '/workspace/.hb-trial.json'];
  for (const f of trialFiles) {
    try {
      const t = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (t.username && t.password && t.proxyUrl) {
        return t.proxyUrl.replace(t.username, t.username).replace(t.password, t.password);
      }
    } catch {}
  }

  return null;
}

/**
 * Initialize proxy — fetches trial if no credentials available.
 * Call once at startup.
 */
async function ensureProxy() {
  if (process.env.HB_PROXY_USER) return true;
  try {
    const { getTrial } = require('../.agents/skills/human-browser/scripts/browser-human');
    await getTrial();
    console.log('[clob-proxy] Trial proxy activated');
    return true;
  } catch (e) {
    console.warn('[clob-proxy] Could not get proxy:', e.message);
    return false;
  }
}

/**
 * Make a proxied HTTPS request to Polymarket CLOB.
 * @param {Object} opts
 * @param {string} opts.method  - GET | POST | DELETE
 * @param {string} opts.path    - e.g. '/order'
 * @param {Object} opts.headers - HTTP headers
 * @param {string} [opts.body]  - JSON string body
 * @param {number} [opts.timeout] - ms, default 15000
 * @returns {Promise<{status, data}>}
 */
async function clobRequest({ method, path, headers = {}, body = null, timeout = 15000 }) {
  const proxyUrl = getProxyUrl();
  
  return new Promise((resolve, reject) => {
    const reqHeaders = {
      'Host':           CLOB_HOST,
      'Content-Type':   'application/json',
      'User-Agent':     'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept':         'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin':         'https://polymarket.com',
      'Referer':        'https://polymarket.com/',
      ...headers,
    };

    if (body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(body);
    }

    const reqOpts = {
      hostname: CLOB_HOST,
      port:     443,
      path,
      method:   method.toUpperCase(),
      headers:  reqHeaders,
      timeout,
    };

    // Add proxy agent if available
    if (proxyUrl) {
      reqOpts.agent = new HttpsProxyAgent(proxyUrl);
    } else {
      console.warn('[clob-proxy] No proxy — request may be geo-blocked');
    }

    let data = '';
    const req = https.request(reqOpts, res => {
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('CLOB request timeout')); });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * Post a signed order to CLOB via proxy.
 * @param {Object} orderPayload - signed order object
 * @param {Object} l2Headers    - CLOB L2 auth headers (POLY_ADDRESS, POLY_SIGNATURE, etc.)
 */
async function postOrder(orderPayload, l2Headers) {
  await ensureProxy();
  return clobRequest({
    method:  'POST',
    path:    '/order',
    headers: l2Headers || {},
    body:    JSON.stringify(orderPayload),
  });
}

module.exports = { clobRequest, postOrder, ensureProxy, getProxyUrl };
