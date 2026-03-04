const { JSDOM } = require('jsdom');
const fs = require('fs');
const https = require('https');

async function get(url, headers={}) {
  return new Promise((res,rej) => {
    https.get(url, {headers}, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); }).on('error',rej);
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

async function solveHSW(hswCode, req) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://newassets.hcaptcha.com/'
  });
  const win = dom.window;
  win.WebAssembly = WebAssembly;

  return new Promise((resolve, reject) => {
    // HSW is an IIFE: !function ZVAwy(){ ... }()
    // We need to capture its return/export
    const wrapper = `
      var __hswResult = null;
      var __hswError = null;
      var __hswModule = null;
      
      // Patch to capture the module's exported promise
      var __origPromise = window.Promise;
      
      ${hswCode}
      
      // After execution, ZVAwy has run as IIFE
      // Try to find the solve function it exposed
      __hswModule = typeof solve !== 'undefined' ? solve : 
                    typeof hsw !== 'undefined' ? hsw :
                    typeof module !== 'undefined' ? module :
                    null;
      
      // Call with the req JWT
      try {
        var p = ZVAwy(1, ${JSON.stringify(req)}, 1000);
        if (p && p.then) {
          p.then(function(r){ __hswResult = r; }).catch(function(e){ __hswError = e.toString(); });
        } else {
          __hswResult = p;
        }
      } catch(e) {
        // ZVAwy is IIFE, call the internal function differently
        __hswError = 'IIFE: ' + e.message;
      }
    `;
    
    try {
      const script = win.document.createElement('script');
      script.textContent = wrapper;
      win.document.head.appendChild(script);
    } catch(e) {
      return reject(e);
    }
    
    // Poll for result
    let polls = 0;
    const iv = setInterval(() => {
      polls++;
      const r = win.__hswResult;
      const err = win.__hswError;
      if (r !== null) { clearInterval(iv); resolve(r); }
      if (err) { clearInterval(iv); reject(new Error(err)); }
      if (polls > 200) { clearInterval(iv); reject(new Error('HSW timeout after 20s')); }
    }, 100);
  });
}

(async () => {
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const SITEKEY = '4c672d35-0701-42b2-88c3-78380b0db560';
  const HOST = 'discord.com';

  // 1. Site config
  const config = JSON.parse(await get(
    `https://hcaptcha.com/checksiteconfig?v=1&host=${HOST}&sitekey=${SITEKEY}&sc=1&swa=1`,
    { 'User-Agent': UA }
  ));
  const jwt = config.c.req;
  const jwtPayload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
  console.log('HSW path:', jwtPayload.l, '| iterations:', jwtPayload.c);

  // 2. Get HSW
  const hswUrl = `https://newassets.hcaptcha.com${jwtPayload.l}/hsw.js`;
  const hswCode = await get(hswUrl, { 'User-Agent': UA, 'Referer': 'https://newassets.hcaptcha.com/' });
  console.log('HSW downloaded:', hswCode.length, 'bytes');

  // 3. Solve
  console.log('Solving...');
  const solvedN = await solveHSW(hswCode, jwt).catch(e => { console.log('HSW error:', e.message); return null; });
  console.log('Solved N:', solvedN ? JSON.stringify(solvedN).substring(0,80) : 'null');

  if (!solvedN) {
    console.log('\n--- Trying alternative: run hsw in Playwright context ---');
    return;
  }

  // 4. getcaptcha
  const res = JSON.parse(await post(
    `https://hcaptcha.com/getcaptcha/${HOST}`,
    { v:'1', sitekey:SITEKEY, host:HOST, hl:'en',
      motionData: JSON.stringify({st:Date.now()-5000,dct:Date.now()-4000,mm:[[100,200,1000],[200,300,2000]],v:1}),
      n: JSON.stringify(solvedN), c: JSON.stringify(config.c) },
    { 'User-Agent': UA, 'Origin': `https://${HOST}` }
  ));
  console.log('getcaptcha:', Object.keys(res));
  if (res.generated_pass_UUID) console.log('✅ TOKEN:', res.generated_pass_UUID.substring(0,60)+'...');
})();
