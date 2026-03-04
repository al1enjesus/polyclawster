const { launchHuman, getTrial } = require('./.agents/skills/human-browser/scripts/browser-human');

(async () => {
  await getTrial();
  const { browser, page } = await launchHuman({ headless: true });
  
  const logs = [], errors = [], apiCalls = [];
  
  page.on('console', msg => {
    const txt = `[${msg.type()}] ${msg.text()}`;
    if (!txt.includes('postEvent') && !txt.includes('WebView') && !txt.includes('supported in version'))
      logs.push(txt);
  });
  page.on('pageerror', err => errors.push(err.message));
  page.on('response', async resp => {
    if (resp.url().includes('/api/')) {
      try {
        const body = await resp.json();
        apiCalls.push({ url: resp.url().replace('https://polyclawster.vercel.app',''), status: resp.status(), ok: body.ok, data: JSON.stringify(body).slice(0,180) });
      } catch {}
    }
  });

  const TEST_TG_ID = '123456001';
  const tgHash = encodeURIComponent(`user=%7B%22id%22%3A${TEST_TG_ID}%2C%22first_name%22%3A%22TestUser%22%7D&auth_date=1772600000&hash=test`);
  const url = `https://polyclawster.vercel.app/tma.html#tgWebAppData=${tgHash}&tgWebAppVersion=7.10&tgWebAppPlatform=ios`;
  
  console.log('=== STEP 1: Новый юзер открывает TMA ===');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/s1_initial.png' });
  
  const tgId = await page.evaluate(() => String(window._tgId || ''));
  const portText = await page.$eval('#portfolio-content', el => el.innerText).catch(()=>'N/A');
  console.log('_tgId:', tgId);
  console.log('Portfolio:', portText.slice(0, 400));
  
  console.log('\n=== STEP 2: Переходим в Wallet ===');
  await page.evaluate(() => typeof showTab === 'function' && showTab('wallet'));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/s2_wallet.png' });
  const walletText = await page.$eval('#s-wallet', el => el.innerText).catch(()=>'N/A');
  console.log('Wallet:', walletText.slice(0, 400));
  
  console.log('\n=== STEP 3: Create wallet ===');
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.offsetParent && /create|начать|wallet|кошел/i.test(b.textContent));
    if (btn) { btn.click(); return btn.textContent.trim(); }
    return 'NOT FOUND';
  });
  console.log('Create btn clicked:', clicked);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '/tmp/s3_after_create.png' });
  const afterCreate = await page.$eval('#s-wallet', el => el.innerText).catch(()=>'N/A');
  console.log('After create:', afterCreate.slice(0, 400));
  
  console.log('\n=== STEP 4: Signals ===');
  await page.evaluate(() => typeof showTab === 'function' && showTab('signals'));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/s4_signals.png' });
  const sigsText = await page.$eval('#s-signals', el => el.innerText).catch(()=>'N/A');
  console.log('Signals:', sigsText.slice(0, 400));
  
  const yesCount = await page.$$eval('.psig-y', els => els.length);
  console.log('YES buttons:', yesCount);
  
  if (yesCount > 0) {
    console.log('\n=== STEP 5: Click YES ===');
    await page.click('.psig-y');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/s5_bet_sheet.png' });
    const betText = await page.$eval('#bet-sheet', el => el.innerText).catch(()=>'N/A');
    console.log('Bet sheet:', betText.slice(0, 600));
    
    console.log('\n=== STEP 6: Confirm bet ===');
    // Пробуем кликнуть confirm
    const confirmClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.offsetParent && /place|confirm|поставить|bet \$|yes|submit/i.test(b.textContent));
      if (btn) { btn.click(); return btn.textContent.trim(); }
      // Пробуем по id
      const ids = ['bet-confirm-btn', 'place-bet-btn', 'submit-bet'];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) { el.click(); return `#${id}`; }
      }
      // Все видимые кнопки
      return 'NOT FOUND: ' + btns.filter(b=>b.offsetParent).map(b=>b.textContent.trim()).join(' | ');
    });
    console.log('Confirm clicked:', confirmClicked);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: '/tmp/s7_after_bet.png' });
    
    // Что произошло
    const toast = await page.$eval('#toast, .toast, [class*="toast"]', el => el.innerText).catch(()=>'no toast');
    console.log('Toast:', toast);
    const confirmOverlay = await page.$eval('#bet-confirm-overlay', el => el.innerHTML.slice(0,400)).catch(()=>'no confirm overlay');
    console.log('Confirm overlay:', confirmOverlay);
    
    console.log('\n=== STEP 7: Reload → Portfolio ===');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/s8_reload.png' });
    const portAfter = await page.$eval('#portfolio-content', el => el.innerText).catch(()=>'N/A');
    console.log('Portfolio after reload:', portAfter.slice(0, 600));
  }

  console.log('\n=== API CALLS ===');
  apiCalls.forEach(c => console.log(`${c.status} ${c.url} ok=${c.ok}`));
  console.log('\n=== CONSOLE LOGS ===');
  logs.forEach(l => console.log(l));
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
  
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message, '\n', (e.stack||'').slice(0,600)); process.exit(1); });
