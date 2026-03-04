const { launchHuman, getTrial } = require('./.agents/skills/human-browser/scripts/browser-human');

(async () => {
  await getTrial();
  
  // Mobile viewport for proper TMA feel
  const { browser } = await launchHuman({ headless: true });
  const context = browser.contexts()[0] || await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  const logs = [], errors = [];
  page.on('console', msg => {
    const txt = msg.text();
    if (!txt.includes('postEvent') && !txt.includes('WebView') && !txt.includes('supported in version'))
      logs.push(`[${msg.type()}] ${txt}`);
  });
  page.on('pageerror', err => errors.push(err.message));

  const TEST_TG_ID = '777123456'; // fresh user
  const tgHash = encodeURIComponent(`user=%7B%22id%22%3A${TEST_TG_ID}%2C%22first_name%22%3A%22Alex%22%7D&auth_date=1772610000&hash=abc`);
  const url = `https://polyclawster.vercel.app/tma.html#tgWebAppData=${tgHash}&tgWebAppVersion=7.10&tgWebAppPlatform=ios`;
  
  const shots = [];
  const snap = async (label) => {
    const path = `/tmp/vid_${String(shots.length).padStart(2,'0')}_${label}.png`;
    await page.screenshot({ path, fullPage: false });
    shots.push({ path, label });
    console.log(`📸 ${label}`);
  };

  console.log('\n=== STEP 1: Открываем как новый юзер ===');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await snap('new_user_portfolio');
  
  const portText = await page.$eval('#portfolio-content', el => el.innerText).catch(()=>'');
  console.log('Portfolio:', portText.slice(0, 200));

  console.log('\n=== STEP 2: Wallet → Create ===');
  await page.evaluate(() => typeof showTab === 'function' && showTab('wallet'));
  await page.waitForTimeout(2000);
  await snap('wallet_onboard');
  
  const walletText = await page.$eval('#s-wallet', el => el.innerText).catch(()=>'');
  console.log('Wallet screen:', walletText.slice(0, 300));

  // Find and click Create Wallet
  const createClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.offsetParent && /create.*wallet|✨/i.test(b.textContent));
    if (btn) { btn.click(); return btn.textContent.trim(); }
    // Try by id
    const byId = document.getElementById('create-wallet-btn');
    if (byId) { byId.click(); return byId.textContent.trim(); }
    return 'NOT FOUND: ' + btns.filter(b=>b.offsetParent).map(b=>b.textContent.trim().slice(0,20)).join(' | ');
  });
  console.log('Create clicked:', createClicked);
  
  // Wait for wallet creation (API call)
  await page.waitForTimeout(7000);
  await snap('wallet_created');
  
  const afterCreate = await page.$eval('#wallet-content, #s-wallet', el => el.innerText).catch(()=>'');
  console.log('After create:', afterCreate.slice(0, 400));
  
  // Check globals
  const globals = await page.evaluate(() => ({
    _userWallet: window._userWallet ? window._userWallet.slice(0,10)+'...' : 'empty',
    _userValue: window._userValue,
    demoBalance: localStorage.getItem('pc_demo_balance')
  }));
  console.log('Globals after create:', globals);

  console.log('\n=== STEP 3: Click "Поставить первую ставку" ===');
  // Click CTA if available, else navigate to signals
  const ctaClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.offsetParent && /поставить|first.*bet|ставку/i.test(b.textContent));
    if (btn) { btn.click(); return btn.textContent.trim(); }
    return 'NOT FOUND';
  });
  console.log('CTA clicked:', ctaClicked);
  if (ctaClicked === 'NOT FOUND') {
    await page.evaluate(() => typeof showTab === 'function' && showTab('signals'));
  }
  await page.waitForTimeout(3000);
  await snap('signals_screen');
  
  const sigsText = await page.$eval('#s-signals', el => el.innerText).catch(()=>'');
  console.log('Signals:', sigsText.slice(0, 200));

  console.log('\n=== STEP 4: Click YES on first signal ===');
  // Use JS click (bypass visibility check)
  const yesBtnClicked = await page.evaluate(() => {
    const btn = document.querySelector('.psig-y');
    if (btn) { btn.dispatchEvent(new MouseEvent('click', {bubbles:true})); return btn.textContent; }
    // Try signal card YES button
    const card = document.querySelector('[onclick*="openBetSheetByIdx"]');
    if (card) { 
      // Extract function call and run it
      const match = card.getAttribute('onclick').match(/openBetSheetByIdx\((\d+),'(\w+)'\)/);
      if (match) { openBetSheetByIdx(parseInt(match[1]), match[2]); return 'openBetSheetByIdx via onclick'; }
    }
    return 'NOT FOUND';
  });
  console.log('YES clicked:', yesBtnClicked);
  await page.waitForTimeout(1500);
  await snap('bet_sheet_open');
  
  const betSheetText = await page.$eval('#bet-sheet', el => el.innerText).catch(()=>'N/A');
  console.log('Bet sheet:', betSheetText.slice(0, 400));

  console.log('\n=== STEP 5: Set amount $1 and confirm ===');
  // Set amount to $1
  await page.evaluate(() => {
    var inp = document.getElementById('bs-amount');
    if (inp) { inp.value = '1'; inp.dispatchEvent(new Event('input', {bubbles:true})); }
  });
  await page.waitForTimeout(500);
  await snap('bet_amount_set');
  
  // Click confirm
  const confirmClicked = await page.evaluate(() => {
    var btn = document.getElementById('bs-confirm');
    if (btn && !btn.disabled) { btn.click(); return 'confirmed: ' + btn.textContent; }
    if (btn && btn.disabled) return 'btn disabled';
    return 'NOT FOUND';
  });
  console.log('Confirm:', confirmClicked);
  await page.waitForTimeout(5000);
  await snap('after_bet');
  
  const overlayText = await page.$eval('#bet-confirm-overlay', el => el.innerText).catch(()=>'no overlay');
  console.log('Confirm overlay:', overlayText.slice(0, 300));

  console.log('\n=== STEP 6: Go to Portfolio → check active bets ===');
  await page.evaluate(() => {
    var el = document.getElementById('bet-confirm-overlay');
    if (el) el.remove();
    typeof showTab === 'function' && showTab('portfolio');
    typeof loadPortfolio === 'function' && loadPortfolio();
  });
  await page.waitForTimeout(5000);
  await snap('portfolio_with_bets');
  
  const portAfter = await page.$eval('#portfolio-content', el => el.innerText).catch(()=>'');
  console.log('Portfolio after bet:', portAfter.slice(0, 500));

  console.log('\n=== STEP 7: Reload page → check persistence ===');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await snap('after_reload');
  
  const portReload = await page.$eval('#portfolio-content', el => el.innerText).catch(()=>'');
  console.log('Portfolio after reload:', portReload.slice(0, 400));

  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log('ERROR:', e));
  console.log('\n=== KEY LOGS ===');
  logs.filter(l => /render|bet|wallet|error|tgId|balance/i.test(l)).forEach(l => console.log(l));
  
  console.log('\n=== SCREENSHOTS ===');
  shots.forEach(s => console.log(s.path));
  
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message, '\n', (e.stack||'').slice(0,600)); process.exit(1); });
