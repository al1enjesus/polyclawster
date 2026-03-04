/**
 * hCaptcha bypass — полный алгоритм без внешних солверов
 * 1. checksiteconfig → получаем HSW challenge (JWT)
 * 2. Скачиваем hsw.js — WASM proof-of-work модуль
 * 3. Запускаем в JSDOM → window.hsw.solve(req) → solved token
 * 4. getcaptcha с solved token → получаем generated_pass_UUID
 * 5. Используем UUID как h-captcha-response
 */
const { JSDOM } = require('jsdom');
const https = require('https');
const fs = require('fs');

async function get(url, headers={}) {
  return new Promise((res,rej) => {
    https.get(url, {headers}, r => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
    }).on('error', rej);
  });
}

async function post(url, body, headers={}) {
  const b = new URLSearchParams(body).toString();
  return new Promise((res,rej) => {
    const u = new URL(url);
    const req = https.request({ hostname:u.hostname, path:u.pathname+u.search, method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(b),...headers}
    }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); });
    req.on('error',rej); req.write(b); req.end();
  });
}

async function runHSW(hswCode, req) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://newassets.hcaptcha.com/'
  });
  const win = dom.window;
  win.WebAssembly = WebAssembly;

  // Execute HSW — it registers window.hsw
  const script = win.document.createElement('script');
  script.textContent = hswCode;
  win.document.head.appendChild(script);

  // Wait a bit for WASM to init
  await new Promise(r => setTimeout(r, 500));
  
  console.log('   window.hsw type:', typeof win.hsw);
  if (!win.hsw) throw new Error('window.hsw not found after execution');
  
  console.log('   window.hsw keys:', Object.keys(win.hsw));
  
  // Call hsw.solve or hsw(req)
  let result;
  if (typeof win.hsw === 'function') {
    result = await win.hsw(req);
  } else if (win.hsw.solve) {
    result = await win.hsw.solve(req);
  } else if (win.hsw.execute) {
    result = await win.hsw.execute(req);
  } else {
    // Try first function property
    const fn = Object.values(win.hsw).find(v => typeof v === 'function');
    if (fn) result = await fn(req);
    else throw new Error('No callable function in window.hsw');
  }
  return result;
}

async function solveHCaptcha(sitekey, host) {
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  // 1. Get config
  console.log('1. checksiteconfig...');
  const config = JSON.parse(await get(
    `https://hcaptcha.com/checksiteconfig?v=1&host=${host}&sitekey=${sitekey}&sc=1&swa=1`,
    { 'User-Agent': UA }
  ));
  const jwtPayload = JSON.parse(Buffer.from(config.c.req.split('.')[1], 'base64').toString());
  console.log(`   pass:${config.pass} iterations:${jwtPayload.c} path:${jwtPayload.l}`);

  // 2. Download hsw
  const hswUrl = `https://newassets.hcaptcha.com${jwtPayload.l}/hsw.js`;
  console.log('2. Downloading hsw.js...');
  const hswCode = await get(hswUrl, { 'User-Agent': UA, 'Referer': 'https://newassets.hcaptcha.com/' });
  console.log(`   Size: ${hswCode.length} bytes`);

  // 3. Solve proof-of-work
  console.log('3. Solving HSW proof-of-work...');
  const solvedN = await runHSW(hswCode, config.c.req);
  console.log('   Result type:', typeof solvedN);
  console.log('   Result:', JSON.stringify(solvedN).substring(0, 100));

  // 4. getcaptcha
  console.log('4. getcaptcha...');
  const captchaRes = JSON.parse(await post(
    `https://hcaptcha.com/getcaptcha/${host}`,
    {
      v: '1', sitekey, host, hl: 'en',
      motionData: JSON.stringify({st:Date.now()-5000, dct:Date.now()-4000,
        mm:[[100,200,1000],[150,250,1500],[200,300,2000],[250,350,2500]], v:1}),
      n: typeof solvedN === 'string' ? solvedN : JSON.stringify(solvedN),
      c: JSON.stringify(config.c),
    },
    { 'User-Agent': UA, 'Origin': `https://${host}`, 'Referer': `https://${host}/` }
  ));
  
  console.log('   Keys:', Object.keys(captchaRes));
  if (captchaRes.generated_pass_UUID) {
    console.log('✅ TOKEN:', captchaRes.generated_pass_UUID.substring(0,60)+'...');
    return captchaRes.generated_pass_UUID;
  }
  if (captchaRes.pass === false) console.log('   Needs image challenge:', captchaRes.tasklist?.length, 'tasks');
  return null;
}

solveHCaptcha('4c672d35-0701-42b2-88c3-78380b0db560', 'discord.com')
  .then(t => console.log(t ? '\n🎉 DONE!' : '\n❌ Need image solver'))
  .catch(e => console.log('Error:', e.message));

module.exports = { solveHCaptcha };
