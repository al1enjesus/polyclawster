const { JSDOM } = require('jsdom');
const fs = require('fs');
const https = require('https');

async function get(url, headers={}) {
  return new Promise((res,rej) => {
    https.get(url, {headers}, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); }).on('error',rej);
  });
}

async function post(url, body, headers={}) {
  const b = typeof body === 'string' ? body : new URLSearchParams(body).toString();
  return new Promise((res,rej) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname+u.search, method:'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(b),...headers}
    }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); });
    req.on('error',rej); req.write(b); req.end();
  });
}

async function solveHSW(req, iterations) {
  // Run hsw.js in JSDOM environment
  const dom = new JSDOM('<!DOCTYPE html>', {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://newassets.hcaptcha.com/'
  });
  const win = dom.window;
  win.WebAssembly = WebAssembly;
  
  const hswCode = fs.readFileSync('/tmp/hsw_module.js', 'utf8');
  
  return new Promise((resolve, reject) => {
    // HSW exposes a global solve function after execution
    const script = win.document.createElement('script');
    script.textContent = hswCode + `
      // Try to find and call the solve function
      var _hswResult = null;
      var _hswError = null;
      try {
        // The main function is ZVAwy - call with req token
        var req = ${JSON.stringify(req)};
        var result = ZVAwy(1, req, ${iterations});
        if (result && result.then) {
          result.then(function(r) { _hswResult = r; }).catch(function(e) { _hswError = e.message; });
        } else {
          _hswResult = result;
        }
      } catch(e) {
        _hswError = e.message;
      }
    `;
    win.document.head.appendChild(script);
    
    // Poll for result
    let polls = 0;
    const interval = setInterval(() => {
      polls++;
      const result = win._hswResult;
      const error = win._hswError;
      if (result) { clearInterval(interval); resolve(result); }
      if (error) { clearInterval(interval); reject(new Error(error)); }
      if (polls > 100) { clearInterval(interval); reject(new Error('HSW timeout')); }
    }, 100);
  });
}

async function getHCaptchaToken(sitekey, host) {
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  
  // 1. Get site config with HSW challenge
  console.log('1. Getting site config...');
  const config = JSON.parse(await get(
    `https://hcaptcha.com/checksiteconfig?v=1&host=${host}&sitekey=${sitekey}&sc=1&swa=1`,
    { 'User-Agent': UA }
  ));
  console.log('   pass:', config.pass, '| type:', config.c?.type, '| iterations:', config.c?.c || '?');
  
  // Decode JWT to get path + iterations
  const jwtPayload = JSON.parse(Buffer.from(config.c.req.split('.')[1], 'base64').toString());
  console.log('   HSW path:', jwtPayload.l, '| iterations:', jwtPayload.c);
  
  // 2. Download hsw.js if not cached
  const hswPath = `https://newassets.hcaptcha.com${jwtPayload.l}/hsw.js`;
  console.log('2. Downloading HSW from:', hswPath);
  const hswCode = await get(hswPath, { 'User-Agent': UA, 'Referer': 'https://newassets.hcaptcha.com/' });
  fs.writeFileSync('/tmp/hsw_current.js', hswCode);
  console.log('   HSW size:', hswCode.length, 'bytes');
  
  // 3. Solve HSW proof-of-work
  console.log('3. Solving HSW proof-of-work...');
  const solvedToken = await solveHSW(config.c.req, jwtPayload.c);
  console.log('   Solved token:', typeof solvedToken, solvedToken?.toString().substring(0,60));
  
  // 4. Submit to getcaptcha
  console.log('4. Submitting to getcaptcha...');
  const captchaRes = JSON.parse(await post(
    `https://hcaptcha.com/getcaptcha/${host}`,
    {
      v: '1', sitekey, host, hl: 'en',
      motionData: JSON.stringify({ st: Date.now()-5000, dct: Date.now()-4000, mm:[[100,200,1000],[200,300,2000]], v:1 }),
      n: solvedToken,
      c: JSON.stringify(config.c),
    },
    { 'User-Agent': UA, 'Origin': `https://${host}`, 'Referer': `https://${host}/` }
  ));
  
  console.log('   getcaptcha keys:', Object.keys(captchaRes));
  if (captchaRes.generated_pass_UUID) {
    console.log('✅ TOKEN:', captchaRes.generated_pass_UUID.substring(0,60)+'...');
    return captchaRes.generated_pass_UUID;
  }
  if (captchaRes.tasklist) console.log('   Tasks (need image solving):', captchaRes.tasklist?.length);
  return null;
}

getHCaptchaToken('4c672d35-0701-42b2-88c3-78380b0db560', 'discord.com')
  .then(t => { if(t) console.log('\n🎉 Success!'); else console.log('\n❌ No token - need image solver'); })
  .catch(e => console.log('Error:', e.message));
