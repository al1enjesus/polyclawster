/**
 * hCaptcha bypass через Playwright — запускаем HSW в реальном браузере
 * Браузер имеет полный Canvas, WebGL, WebAssembly → HSW работает нормально
 */
const { launchHuman, getTrial } = require('/workspace/.agents/skills/human-browser/scripts/browser-human');
const https = require('https');
const fs = require('fs');

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

async function solveHCaptchaInBrowser(page, sitekey, host) {
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  // 1. checksiteconfig
  const config = JSON.parse(await get(
    `https://hcaptcha.com/checksiteconfig?v=1&host=${host}&sitekey=${sitekey}&sc=1&swa=1`,
    { 'User-Agent': UA }
  ));
  const jwtPayload = JSON.parse(Buffer.from(config.c.req.split('.')[1], 'base64').toString());
  console.log(`   pass:${config.pass} | iterations:${jwtPayload.c} | path:${jwtPayload.l}`);

  // 2. Download HSW
  const hswUrl = `https://newassets.hcaptcha.com${jwtPayload.l}/hsw.js`;
  const hswCode = await get(hswUrl, { 'User-Agent': UA });
  console.log(`   HSW: ${hswCode.length} bytes`);

  // 3. Run HSW in Playwright page (full browser environment!)
  const solvedN = await page.evaluate(async ({ hswCode, req }) => {
    // Create isolated context
    const blob = new Blob([hswCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    // Load as module to avoid polluting global scope
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.textContent = hswCode;
      document.head.appendChild(script);
      
      setTimeout(async () => {
        try {
          if (typeof window.hsw === 'function') {
            const result = await window.hsw(req);
            resolve(result);
          } else {
            reject('window.hsw not found, type: ' + typeof window.hsw);
          }
        } catch(e) {
          reject(e.message || String(e));
        }
      }, 300);
    });
  }, { hswCode, req: config.c.req });

  console.log(`   Solved N: ${typeof solvedN} = ${JSON.stringify(solvedN).substring(0,80)}`);

  // 4. getcaptcha
  const captchaRes = JSON.parse(await post(
    `https://hcaptcha.com/getcaptcha/${host}`,
    {
      v:'1', sitekey, host, hl:'en',
      motionData: JSON.stringify({
        st: Date.now()-5000, dct: Date.now()-4000,
        mm: Array.from({length:20}, (_,i) => [100+i*5, 200+i*3, 1000+i*100]),
        v:1
      }),
      n: typeof solvedN === 'string' ? solvedN : JSON.stringify(solvedN),
      c: JSON.stringify(config.c),
    },
    { 'User-Agent': UA, 'Origin': `https://${host}`, 'Referer': `https://${host}/` }
  ));

  console.log(`   getcaptcha response: ${Object.keys(captchaRes)}`);
  if (captchaRes.generated_pass_UUID) return captchaRes.generated_pass_UUID;
  if (captchaRes.tasklist) console.log(`   Challenge tasks: ${captchaRes.tasklist.length} (need image solver)`);
  return null;
}

async function discordLoginWithHCaptcha(email, password) {
  await getTrial();
  const { browser, page } = await launchHuman({
    headless: true,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  await page.goto('https://discord.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.fill('input[name="email"]', email);
  await page.waitForTimeout(400);
  await page.fill('input[name="password"]', password);
  await page.waitForTimeout(400);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  if (page.url().includes('channels') || page.url().includes('@me')) {
    console.log('✅ Logged in without captcha!');
    const cookies = await page.context().cookies();
    fs.writeFileSync('/tmp/discord_cookies.json', JSON.stringify(cookies));
    await browser.close();
    return true;
  }

  console.log('Solving hCaptcha in browser...');
  const token = await solveHCaptchaInBrowser(page, '4c672d35-0701-42b2-88c3-78380b0db560', 'discord.com');

  if (token) {
    console.log('Got token, submitting...');
    await page.evaluate((t) => {
      document.querySelectorAll('[name="h-captcha-response"]').forEach(el => {
        el.value = t; el.dispatchEvent(new Event('input', {bubbles:true}));
      });
      document.querySelector('button[type="submit"]')?.click();
    }, token);
    await page.waitForTimeout(5000);
  }

  const finalUrl = page.url();
  const success = finalUrl.includes('channels') || finalUrl.includes('@me');
  console.log('Result:', success ? '✅ Logged in!' : '❌ Failed', finalUrl);

  if (success) {
    const cookies = await page.context().cookies();
    fs.writeFileSync('/tmp/discord_cookies.json', JSON.stringify(cookies));
  }

  await page.screenshot({ path: '/tmp/discord_solved.png' });
  await browser.close();
  return success;
}

discordLoginWithHCaptcha('wdybelievein@gmail.com', 'thisisforlalalawithfriends');
