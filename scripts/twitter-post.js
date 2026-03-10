#!/usr/bin/env node
/**
 * twitter-post.js — Post tweet with optional image
 * Usage: node twitter-post.js "tweet text" [image_path]
 */
'use strict';
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

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

function makeAuth(method, url, extraParams = {}) {
  const params = {
    oauth_consumer_key: oauth.consumer_key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: oauth.token,
    oauth_version: '1.0',
    ...extraParams,
  };
  params.oauth_signature = sign(method, url, params);
  return 'OAuth ' + Object.keys(params).filter(k => k.startsWith('oauth_')).sort().map(k => penc(k) + '="' + penc(params[k]) + '"').join(', ');
}

function apiRequest(method, url, body, contentType) {
  return new Promise((resolve, reject) => {
    const headers = { 'Authorization': makeAuth(method, url) };
    if (contentType) headers['Content-Type'] = contentType;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    
    const req = https.request(url, { method, headers }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function uploadMedia(filePath) {
  // Twitter v1.1 media upload (chunked for images)
  const data = fs.readFileSync(filePath);
  const base64 = data.toString('base64');
  const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  const boundary = '----TwitterUpload' + Date.now();
  
  let body = '';
  body += '--' + boundary + '\r\n';
  body += 'Content-Disposition: form-data; name="media_data"\r\n\r\n';
  body += base64 + '\r\n';
  body += '--' + boundary + '--\r\n';

  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': makeAuth('POST', url),
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
    };
    const bodyBuf = Buffer.from(body);
    headers['Content-Length'] = bodyBuf.length;

    const req = https.request(url, { method: 'POST', headers }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

async function tweet(text, mediaId) {
  const url = 'https://api.twitter.com/2/tweets';
  const payload = { text };
  if (mediaId) payload.media = { media_ids: [mediaId] };
  return apiRequest('POST', url, JSON.stringify(payload), 'application/json');
}

async function main() {
  const args = process.argv.slice(2);
  const text = args[0];
  const imagePath = args[1];
  
  if (!text) { console.error('Usage: node twitter-post.js "text" [image_path]'); process.exit(1); }
  
  let mediaId = null;
  if (imagePath && fs.existsSync(imagePath)) {
    console.log('Uploading image...');
    const uploadResult = await uploadMedia(imagePath);
    mediaId = uploadResult?.media_id_string;
    if (mediaId) console.log('Image uploaded:', mediaId);
    else console.error('Upload failed:', uploadResult);
  }
  
  const result = await tweet(text, mediaId);
  if (result?.data?.id) {
    console.log('✅ Tweet posted: https://x.com/ilyagordey/status/' + result.data.id);
    console.log('Text:', result.data.text?.slice(0, 100));
  } else {
    console.error('❌ Failed:', JSON.stringify(result));
  }
}

main().catch(e => console.error(e));
