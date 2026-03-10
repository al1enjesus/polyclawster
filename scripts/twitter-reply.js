#!/usr/bin/env node
/**
 * twitter-reply.js — Reply to a tweet
 * Usage: node twitter-reply.js <tweet_id> "reply text"
 */
'use strict';
const crypto = require('crypto');
const https = require('https');

const oauth = {
  consumer_key: 'zkzwLpuHWNQeA5U4dTIDdra4k',
  consumer_secret: 'fz4ELKBt4DpoHVm5G4hrZJmWQJmpFM2SWyasEYFqsIjjPJGzmr',
  token: '1671857503452250112-sl1rWcKsH3JqJbnBx785Hfk04wO3kO',
  token_secret: 'kR4Q61TOvQwOHt1KWGb8nrQpX2pxsRRh7ORmy8bTMiOsn',
};

function penc(s) { return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); }

function sign(method, url, params) {
  const base = Object.keys(params).sort().map(k => penc(k) + '=' + penc(params[k])).join('&');
  const sigBase = method + '&' + penc(url) + '&' + penc(base);
  const sigKey = penc(oauth.consumer_secret) + '&' + penc(oauth.token_secret);
  return crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64');
}

function makeAuth(method, url) {
  const params = {
    oauth_consumer_key: oauth.consumer_key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: oauth.token,
    oauth_version: '1.0',
  };
  params.oauth_signature = sign(method, url, params);
  return 'OAuth ' + Object.keys(params).sort().map(k => penc(k) + '="' + penc(params[k]) + '"').join(', ');
}

async function reply(tweetId, text) {
  const url = 'https://api.twitter.com/2/tweets';
  const body = JSON.stringify({
    text,
    reply: { in_reply_to_tweet_id: tweetId }
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': makeAuth('POST', url),
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const [tweetId, text] = process.argv.slice(2);
if (!tweetId || !text) { console.error('Usage: node twitter-reply.js <tweet_id> "text"'); process.exit(1); }
reply(tweetId, text).then(r => {
  if (r?.data?.id) console.log('✅ Reply posted: https://x.com/ilyagordey/status/' + r.data.id);
  else console.error('❌ Failed:', JSON.stringify(r));
}).catch(e => console.error(e));
