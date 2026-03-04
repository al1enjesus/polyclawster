/**
 * Discord login — intercept hCaptcha token from browser directly
 * The browser executes hCaptcha JS, we intercept the generated token
 */
const { launchHuman, getTrial } = require('/workspace/.agents/skills/human-browser/scripts/browser-human');
const fs = require('fs');

async function loginDiscord(email, password) {
  await getTrial();
  const { browser, page } = await launchHuman({ 
    headless: true,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  // Intercept hCaptcha network requests to capture the token
  let captchaToken = null;
  
  await page.route('**/getcaptcha/**', async route => {
    const response = await route.fetch();
    const body = await response.text();
    try {
      const json = JSON.parse(body);
      if (json.generated_pass_UUID) {
        captchaToken = json.generated_pass_UUID;
        console.log('  🎯 Intercepted token from network:', captchaToken.substring(0,50)+'...');
      }
      if (json.pass === false && json.key) {
        // Challenge required - token is in a different field
        console.log('  Challenge required, keys:', Object.keys(json));
      }
    } catch(e) {}
    await route.fulfill({ response });
  });

  // Also intercept checkcaptcha to see the final response
  await page.route('**/checkcaptcha/**', async route => {
    const response = await route.fetch();
    const body = await response.text();
    try {
      const json = JSON.parse(body);
      if (json.generated_pass_UUID) {
        captchaToken = json.generated_pass_UUID;
        console.log('  🎯 Token from checkcaptcha:', captchaToken.substring(0,50)+'...');
      }
    } catch(e) {}
    await route.fulfill({ response });
  });

  await page.goto('https://discord.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.waitForSelector('input[name="email"]', { timeout: 15000 });

  await page.fill('input[name="email"]', email);
  await page.waitForTimeout(500);
  await page.fill('input[name="password"]', password);
  await page.waitForTimeout(500);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  let url = page.url();
  if (url.includes('channels') || url.includes('@me')) {
    console.log('✅ Logged in without captcha!');
    const cookies = await page.context().cookies();
    fs.writeFileSync('/tmp/discord_cookies.json', JSON.stringify(cookies));
    await browser.close();
    return { success: true, cookies };
  }

  // Wait for hCaptcha to auto-execute (pass:true means it runs automatically)
  console.log('Waiting for hCaptcha auto-execute...');
  await page.waitForTimeout(5000);
  
  // Check if we got a token from network intercept
  if (captchaToken) {
    console.log('Using intercepted token...');
    await page.evaluate((t) => {
      document.querySelectorAll('[name="h-captcha-response"]').forEach(el => {
        el.value = t; el.dispatchEvent(new Event('input', {bubbles:true}));
      });
    }, captchaToken);
    await page.evaluate(() => document.querySelector('button[type="submit"]')?.click());
    await page.waitForTimeout(5000);
    url = page.url();
  }

  // Try to extract token from page's hcaptcha widget
  if (!url.includes('channels') && !url.includes('@me')) {
    console.log('Trying to extract token from widget...');
    const widgetToken = await page.evaluate(() => {
      // Try various ways to get the token
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (ta.value && ta.value.length > 100) return ta.value;
      }
      // Try hcaptcha global
      if (window.hcaptcha) {
        const widgets = window.hcaptcha.getResponse ? window.hcaptcha.getResponse() : null;
        return widgets;
      }
      return null;
    });
    console.log('Widget token:', widgetToken ? widgetToken.substring(0,60)+'...' : 'none');
    
    if (widgetToken) {
      await page.evaluate((t) => {
        document.querySelectorAll('[name="h-captcha-response"]').forEach(el => { el.value = t; });
        document.querySelector('button[type="submit"]')?.click();
      }, widgetToken);
      await page.waitForTimeout(5000);
      url = page.url();
    }
  }

  const success = url.includes('channels') || url.includes('@me');
  console.log('\nFinal URL:', url);
  console.log('Result:', success ? '✅ Logged in!' : '❌ Failed');
  
  if (success) {
    const cookies = await page.context().cookies();
    fs.writeFileSync('/tmp/discord_cookies.json', JSON.stringify(cookies));
    console.log('Cookies saved to /tmp/discord_cookies.json');
  }

  await page.screenshot({ path: '/tmp/discord_v2.png' });
  await browser.close();
  return { success, url };
}

loginDiscord('wdybelievein@gmail.com', 'thisisforlalalawithfriends');
