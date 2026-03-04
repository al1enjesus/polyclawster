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

  const logs = [];
  page.on('console', msg => {
    const t = msg.text();
    if (!t.includes('postEvent') && !t.includes('WebView') && !t.includes('supported'))
      logs.push(`[${msg.type()}] ${t}`);
  });
  page.on('pageerror', err => logs.push(`[ERROR] ${err.message}`));

  // Fresh user — unique timestamp ID
  const FRESH_ID = '8' + Date.now().toString().slice(-8);
  console.log('Fresh tgId:', FRESH_ID);

  const tgHash = encodeURIComponent(`user=%7B%22id%22%3A${FRESH_ID}%2C%22first_name%22%3A%22Alex%22%7D&auth_date=1772610000&hash=test`);
  const url = `https://polyclawster.vercel.app/tma.html#tgWebAppData=${tgHash}&tgWebAppVersion=7.10&tgWebAppPlatform=ios`;

  let shotIdx = 0;
  const shots = [];
  const snap = async (label, wait = 0) => {
    if (wait) await page.waitForTimeout(wait);
    const p = `/tmp/final_${String(shotIdx++).padStart(2,'0')}_${label}.png`;
    await page.screenshot({ path: p });
    shots.push(p);
    console.log('📸', label);
    return p;
  };

  // ── STEP 1: First open ───────────────────────────────────────
  console.log('\n── STEP 1: First open (new user) ──');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await snap('1_portfolio_new', 3000);

  // ── STEP 2: Go to Wallet ─────────────────────────────────────
  console.log('\n── STEP 2: Wallet tab ──');
  await page.evaluate(() => showTab('wallet'));
  await snap('2_wallet_tab', 2000);

  // ── STEP 3: Create wallet ────────────────────────────────────
  console.log('\n── STEP 3: Create wallet ──');
  const createBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => b.offsetParent && /create.*wallet|✨.*create/i.test(b.textContent));
    if (b) { b.click(); return b.textContent.trim(); }
    // try id
    const bid = document.getElementById('create-wallet-btn');
    if (bid) { bid.click(); return bid.textContent.trim(); }
    return 'NOT FOUND: ' + btns.filter(b=>b.offsetParent).slice(0,8).map(b=>b.textContent.trim().slice(0,15)).join(' | ');
  });
  console.log('Create btn:', createBtn);
  await snap('3_creating', 1000);
  await snap('4_wallet_created', 7000);

  const walletState = await page.evaluate(() => ({
    wallet: window._userWallet ? window._userWallet.slice(0,14)+'...' : 'none',
    value: window._userValue,
    demo: localStorage.getItem('pc_demo_balance')
  }));
  console.log('Wallet state:', walletState);

  // ── STEP 4: Click "Поставить первую ставку" ─────────────────
  console.log('\n── STEP 4: CTA → Signals ──');
  const ctaBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => b.offsetParent && /поставить|first.*bet|ставку/i.test(b.textContent));
    if (b) { b.click(); return b.textContent.trim(); }
    // Fallback to signals tab
    showTab('signals');
    return 'fallback to signals';
  });
  console.log('CTA:', ctaBtn);
  await snap('5_signals', 3000);

  // ── STEP 5: Open bet sheet ───────────────────────────────────
  console.log('\n── STEP 5: Open bet sheet ──');
  const yesClicked = await page.evaluate(() => {
    // Try psig-y first
    const btn = document.querySelector('.psig-y');
    if (btn) { btn.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true})); return 'psig-y click'; }
    // Direct JS call
    const cards = document.querySelectorAll('[onclick*="openBetSheetByIdx"]');
    if (cards.length > 0) {
      openBetSheetByIdx(0, 'YES');
      return 'openBetSheetByIdx(0, YES)';
    }
    return 'NOT FOUND';
  });
  console.log('YES clicked:', yesClicked);
  await snap('6_bet_sheet', 2000);

  const sheetText = await page.$eval('#bet-sheet', el => el.innerText).catch(() => 'N/A');
  console.log('Bet sheet:', sheetText.slice(0, 200));

  // ── STEP 6: Set $1 and confirm ──────────────────────────────
  console.log('\n── STEP 6: Set $1 amount ──');
  await page.evaluate(() => {
    var inp = document.getElementById('bs-amount');
    if (inp) { inp.value = '1'; inp.dispatchEvent(new Event('input', {bubbles:true})); }
  });
  await snap('7_amount_set', 800);

  console.log('\n── STEP 6b: Confirm bet ──');
  const confirmResult = await page.evaluate(() => {
    var btn = document.getElementById('bs-confirm');
    if (!btn) return 'NO BUTTON';
    if (btn.disabled) return 'DISABLED: ' + btn.textContent;
    btn.click();
    return 'clicked: ' + btn.textContent;
  });
  console.log('Confirm:', confirmResult);
  await snap('8_confirming', 1500);
  await snap('9_bet_confirmed', 4000);

  const overlayText = await page.$eval('#bet-confirm-overlay', el => el.innerText).catch(() => 'no overlay');
  console.log('Overlay:', overlayText.slice(0, 200));

  // ── STEP 7: Go to Portfolio ──────────────────────────────────
  console.log('\n── STEP 7: Portfolio ──');
  await page.evaluate(() => {
    var el = document.getElementById('bet-confirm-overlay');
    if (el) el.remove();
    _portfolio = null;
    showTab('portfolio');
    loadPortfolio && loadPortfolio();
  });
  await snap('10_portfolio_loading', 1000);
  await snap('11_portfolio_bets', 5000);

  const portText = await page.$eval('#portfolio-content', el => el.innerText).catch(() => 'N/A');
  console.log('Portfolio:', portText.slice(0, 400));

  // ── STEP 8: Reload ───────────────────────────────────────────
  console.log('\n── STEP 8: Reload ──');
  await page.reload({ waitUntil: 'networkidle' });
  await snap('12_after_reload', 5000);
  const portReload = await page.$eval('#portfolio-content', el => el.innerText).catch(() => 'N/A');
  console.log('After reload:', portReload.slice(0, 300));

  await browser.close();

  // ── Make video ───────────────────────────────────────────────
  console.log('\n── Making video ──');
  console.log('Shots:', shots.length);

  // Write file list for ffmpeg
  const listPath = '/tmp/final_shots.txt';
  const lines = shots.map(s => `file '${s}'\nduration 1.5`).join('\n');
  fs.writeFileSync(listPath, lines + `\nfile '${shots[shots.length-1]}'\n`);

  try {
    execSync(`ffmpeg -y -f concat -safe 0 -i ${listPath} -vf "scale=390:844:force_original_aspect_ratio=decrease,pad=390:844:(ow-iw)/2:(oh-ih)/2:black,fps=10" -c:v libx264 -pix_fmt yuv420p /tmp/polyclawster_ux.mp4 2>&1`, { stdio: 'inherit' });
    console.log('\n✅ Video: /tmp/polyclawster_ux.mp4');
    const size = fs.statSync('/tmp/polyclawster_ux.mp4').size;
    console.log('Size:', Math.round(size/1024) + 'KB');
  } catch(e) {
    console.log('ffmpeg error:', e.message.slice(0,200));
    // Fallback: just list screenshots
    console.log('Screenshots available:', shots.join('\n'));
  }

  // Key logs
  console.log('\n── Key logs ──');
  logs.filter(l => /render|bet|wallet|error|demo|balance/i.test(l)).slice(0,20).forEach(l => console.log(l));

})().catch(e => { console.error('FATAL:', e.message, '\n', (e.stack||'').slice(0,400)); process.exit(1); });
