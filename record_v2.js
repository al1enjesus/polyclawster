process.chdir('/workspace');
const { launchHuman, getTrial } = require('./.agents/skills/human-browser/scripts/browser-human');
const { execSync } = require('child_process');
const fs = require('fs');

(async () => {
  await getTrial();
  const { browser } = await launchHuman({ headless: true });
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  const FRESH_ID = '9' + Date.now().toString().slice(-8);
  console.log('tgId:', FRESH_ID);

  const tgHash = encodeURIComponent(`user=%7B%22id%22%3A${FRESH_ID}%2C%22first_name%22%3A%22Alex%22%7D&auth_date=1772620000&hash=test`);
  const url = `https://polyclawster.vercel.app/tma.html#tgWebAppData=${tgHash}&tgWebAppVersion=7.10&tgWebAppPlatform=ios`;

  let i = 0;
  const shots = [];
  const snap = async (label, ms = 0) => {
    if (ms) await page.waitForTimeout(ms);
    const p = `/tmp/v2_${String(i++).padStart(2,'0')}_${label}.png`;
    await page.screenshot({ path: p });
    shots.push({ path: p, label });
    console.log('📸', label);
  };

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Skip onboarding if present
  await page.waitForTimeout(2000);
  const skipped = await page.evaluate(() => {
    const skip = document.querySelector('button');
    const allBtns = Array.from(document.querySelectorAll('button')).filter(b=>b.offsetParent);
    const skipBtn = allBtns.find(b => /пропустить|skip/i.test(b.textContent));
    if (skipBtn) { skipBtn.click(); return 'skipped'; }
    // If no onboarding, we're good
    return 'no onboarding';
  });
  console.log('Onboarding:', skipped);
  await page.waitForTimeout(2000);
  await snap('01_portfolio_empty');

  // Go to wallet
  await page.evaluate(() => showTab('wallet'));
  await snap('02_wallet_onboard', 2000);

  // Create wallet
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => b.offsetParent && /create|✨/i.test(b.textContent));
    if (b) b.click();
    else { const bid = document.getElementById('create-wallet-btn'); if(bid) bid.click(); }
  });
  await snap('03_creating', 1500);
  await snap('04_wallet_created', 7000);
  
  const state = await page.evaluate(() => ({
    wallet: (window._userWallet||'').slice(0,12),
    value: window._userValue,
    demo: localStorage.getItem('pc_demo_balance'),
    deposited: window._userDeposited
  }));
  console.log('State after create:', state);

  // Click CTA or go to signals
  const ctaResult = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => b.offsetParent && /поставить|first.*bet|ставку/i.test(b.textContent));
    if (b) { b.click(); return b.textContent.trim(); }
    showTab('signals'); return 'signals tab';
  });
  console.log('CTA:', ctaResult);
  await snap('05_signals', 3000);

  // Open bet sheet via JS (bypass visibility)
  const betOpened = await page.evaluate(() => {
    if (typeof openBetSheetByIdx === 'function') {
      openBetSheetByIdx(0, 'YES');
      return 'openBetSheetByIdx OK';
    }
    return 'function not found';
  });
  console.log('Bet sheet:', betOpened);
  await snap('06_bet_sheet', 1500);

  // Set $1
  await page.evaluate(() => {
    var inp = document.getElementById('bs-amount');
    if (inp) { inp.value = '1'; inp.dispatchEvent(new Event('input', {bubbles:true})); }
  });
  await snap('07_amount_1', 600);

  // Confirm
  const confirmResult = await page.evaluate(() => {
    var btn = document.getElementById('bs-confirm');
    if (!btn) return 'NO BTN';
    console.log('[test] confirm btn disabled:', btn.disabled, 'text:', btn.textContent);
    console.log('[test] _userValue:', window._userValue, '_userDeposited:', window._userDeposited);
    console.log('[test] demoBalance:', localStorage.getItem('pc_demo_balance'));
    if (btn.disabled) return 'DISABLED';
    btn.click(); return 'CLICKED';
  });
  console.log('Confirm:', confirmResult);
  await snap('08_confirming', 2000);
  await snap('09_overlay', 4000);

  // Check overlay
  const overlayText = await page.$eval('#bet-confirm-overlay', el => el.innerText.slice(0,200)).catch(()=>'NO OVERLAY');
  console.log('Overlay:', overlayText);

  // Close overlay → portfolio
  await page.evaluate(() => {
    const el = document.getElementById('bet-confirm-overlay'); if (el) el.remove();
    _portfolio = null;
    showTab('portfolio');
  });
  await snap('10_portfolio_after_bet', 1000);
  await page.evaluate(() => { loadPortfolio && loadPortfolio(); });
  await snap('11_portfolio_loading', 4000);

  // Reload
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Skip onboarding again if needed
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b=>b.offsetParent);
    const skip = btns.find(b=>/пропустить|skip/i.test(b.textContent));
    if (skip) skip.click();
  });
  await snap('12_after_reload', 4000);

  await browser.close();

  // Make video — longer duration per frame
  const listPath = '/tmp/v2_list.txt';
  const durations = [2, 2, 1.5, 3, 2, 2, 2, 1.5, 2, 3, 2, 3, 4];
  let txt = '';
  shots.forEach((s, idx) => {
    txt += `file '${s.path}'\nduration ${durations[idx] || 2}\n`;
  });
  txt += `file '${shots[shots.length-1].path}'\n`;
  fs.writeFileSync(listPath, txt);

  execSync(`ffmpeg -y -f concat -safe 0 -i ${listPath} -vf "fps=15,scale=390:844:force_original_aspect_ratio=decrease,pad=390:844:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p /tmp/polyclawster_v2.mp4`, { stdio: 'inherit' });
  
  const sz = fs.statSync('/tmp/polyclawster_v2.mp4').size;
  console.log(`\n✅ Video: /tmp/polyclawster_v2.mp4 (${Math.round(sz/1024)}KB)`);
  console.log('Shots:', shots.map(s => s.label).join(', '));
})().catch(e => { console.error('FATAL:', e.message, (e.stack||'').slice(0,300)); process.exit(1); });
