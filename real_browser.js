/**
 * Real Browser — persistent profile with cookies и fingerprint
 * Использует launchPersistentContext вместо обычного launch
 * Куки, localStorage, IndexedDB сохраняются между сессиями
 */
const { chromium } = require('/workspace/.agents/skills/human-browser/node_modules/playwright-core');
const { getTrial } = require('/workspace/.agents/skills/human-browser/scripts/browser-human');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/workspace/.browser-profiles';

async function getProxyConfig() {
  await getTrial();
  // Read proxy from human-browser environment
  const proxyServer = process.env.HUMAN_BROWSER_PROXY || 
                      process.env.PROXY_URL ||
                      process.env.HTTPS_PROXY;
  
  // Parse human-browser config to get proxy
  const hbDir = '/workspace/.agents/skills/human-browser';
  let proxy = null;
  
  // Check if getTrial wrote proxy info somewhere
  const envFiles = ['/tmp/.hb_proxy', '/tmp/hb_config.json', `${hbDir}/.proxy`];
  for (const f of envFiles) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8').trim();
      console.log('Found proxy config:', f, content.substring(0,100));
    }
  }
  
  // Check env vars set by getTrial
  console.log('Proxy env vars:');
  ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','HUMAN_BROWSER_PROXY','PROXY_SERVER','PROXY_URL'].forEach(k => {
    if (process.env[k]) console.log(' ', k, '=', process.env[k]);
  });
  
  return proxyServer ? { server: proxyServer } : null;
}

async function launchRealBrowser(profileName = 'main', options = {}) {
  const proxy = await getProxyConfig();
  const profilePath = path.join(PROFILE_DIR, profileName);
  fs.mkdirSync(profilePath, { recursive: true });
  
  console.log('Profile path:', profilePath);
  console.log('Proxy:', proxy?.server || 'none (will use direct)');
  
  const contextOptions = {
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Europe/London',
    geolocation: { latitude: 51.5074, longitude: -0.1278 }, // London
    permissions: ['geolocation'],
    colorScheme: 'dark',
    ...options
  };
  
  if (proxy) contextOptions.proxy = proxy;
  
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox', 
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
    ...contextOptions
  });
  
  const page = await context.newPage();
  
  // Remove automation fingerprint
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
    window.chrome = { runtime: {} };
  });
  
  return { context, page, profilePath };
}

// Test with Discord
(async () => {
  console.log('Launching real browser with persistent profile...\n');
  const { context, page, profilePath } = await launchRealBrowser('discord_session');

  // Check IP
  await page.goto('https://ipinfo.io/json', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(()=>{});
  const ipInfo = await page.textContent('body').catch(() => '{}');
  console.log('IP Info:', ipInfo.substring(0, 150));

  // Try Discord
  await page.goto('https://discord.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Check if already logged in (from saved cookies)
  const url = page.url();
  console.log('Discord URL:', url);
  
  if (url.includes('channels') || url.includes('@me')) {
    console.log('✅ Already logged in from saved profile!');
  } else {
    console.log('Not logged in yet. Filling form...');
    await page.fill('input[name="email"]', 'wdybelievein@gmail.com').catch(()=>{});
    await page.waitForTimeout(500);
    await page.fill('input[name="password"]', 'thisisforlalalawithfriends').catch(()=>{});
    await page.waitForTimeout(500);
    await page.locator('button[type="submit"]').click().catch(()=>{});
    await page.waitForTimeout(6000);
    console.log('After submit:', page.url());
  }
  
  await page.screenshot({ path: '/tmp/real_browser_discord.png' });
  await context.close();
  
  // Check what was saved in profile
  const profileFiles = fs.readdirSync(profilePath);
  console.log('\nProfile saved files:', profileFiles.slice(0,10));
})();
