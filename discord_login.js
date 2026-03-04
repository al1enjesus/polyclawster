/**
 * Discord login bypassing hCaptcha via Enterprise passthrough
 * hCaptcha Enterprise с pass:true — токен без решения задачи
 */
const { launchHuman, getTrial } = require('/workspace/.agents/skills/human-browser/scripts/browser-human');
const fs = require('fs');

async function getHCaptchaToken(sitekey, host) {
  // Step 1: get site config
  const config = await fetch(`https://hcaptcha.com/checksiteconfig?v=1&host=${host}&sitekey=${sitekey}&sc=1&swa=1`)
    .then(r => r.json());
  console.log('  hCaptcha pass:', config.pass);
  if (!config.pass) throw new Error('No passthrough — need to solve captcha');
  
  // Step 2: get HSW token using the c.req from config  
  const hswReq = config.c?.req;
  const hswType = config.c?.type;
  console.log('  HSW type:', hswType);
  
  // Step 3: get captcha token using getcaptcha endpoint
  const captchaRes = await fetch(`https://hcaptcha.com/getcaptcha/discord.com`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
    body: new URLSearchParams({
      v: '1',
      sitekey: sitekey,
      host: host,
      hl: 'en',
      motionData: JSON.stringify({ st: Date.now(), dct: Date.now() }),
      n: hswReq,
      c: JSON.stringify(config.c),
    })
  }).then(r => r.json()).catch(e => ({ error: e.message }));
  
  console.log('  getCaptcha response keys:', Object.keys(captchaRes));
  if (captchaRes.pass) return captchaRes.generated_pass_UUID;
  
  return null;
}

async function loginDiscord(email, password) {
  await getTrial();
  const { browser, page } = await launchHuman({ 
    headless: true,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  await page.goto('https://discord.com/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.waitForSelector('input[name="email"]', { timeout: 15000 });

  await page.fill('input[name="email"]', email);
  await page.waitForTimeout(500);
  await page.fill('input[name="password"]', password);
  await page.waitForTimeout(500);
  
  // First submit attempt - might succeed without captcha or trigger captcha
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);
  
  const url = page.url();
  if (url.includes('channels') || url.includes('@me')) {
    console.log('✅ Logged in without captcha!');
    const cookies = await page.context().cookies();
    fs.writeFileSync('/tmp/discord_cookies.json', JSON.stringify(cookies));
    await browser.close();
    return true;
  }
  
  console.log('Captcha required, trying passthrough...');
  
  // Get hCaptcha token via passthrough
  const token = await getHCaptchaToken(
    '4c672d35-0701-42b2-88c3-78380b0db560',
    'discord.com'
  ).catch(e => { console.log('Token error:', e.message); return null; });
  
  if (token) {
    console.log('Got token:', token.substring(0, 50) + '...');
    // Inject token and submit
    await page.evaluate((t) => {
      // Inject into all hcaptcha response fields
      document.querySelectorAll('textarea[name="h-captcha-response"], [name="h-captcha-response"]')
        .forEach(el => { el.value = t; el.dispatchEvent(new Event('input', {bubbles:true})); });
      // Try window callback
      if (typeof hcaptcha !== 'undefined') {
        try { hcaptcha.execute(undefined, {async: true}).then(() => {}); } catch(e) {}
      }
    }, token);
    await page.waitForTimeout(1000);
    await page.locator('button[type="submit"]').click().catch(() =>
      page.evaluate(() => document.querySelector('button[type="submit"]')?.click())
    );
    await page.waitForTimeout(5000);
  }
  
  const finalUrl = page.url();
  const success = finalUrl.includes('channels') || finalUrl.includes('@me');
  console.log('Final URL:', finalUrl);
  console.log('Logged in:', success ? '✅' : '❌');
  
  if (success) {
    const cookies = await page.context().cookies();
    fs.writeFileSync('/tmp/discord_cookies.json', JSON.stringify(cookies));
    console.log('Cookies saved');
  }
  
  await page.screenshot({ path: '/tmp/discord_final.png' });
  await browser.close();
  return success;
}

loginDiscord('wdybelievein@gmail.com', 'thisisforlalalawithfriends')
  .then(ok => process.exit(ok ? 0 : 1));
