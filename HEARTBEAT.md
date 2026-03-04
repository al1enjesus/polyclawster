# HEARTBEAT.md

## On every heartbeat:
1. Check if user sent any messages that need attention
2. Run edge scanner (see below) — silent unless alerts
3. Run portfolio check (see below) — silent unless changed
4. If today is 2026-02-25 or later AND file memory/2026-02-22-clawhub-virixlabs.md exists:
   - Try publishing virixlabs skills on ClawHub (see instructions in that file)
   - If success, delete the file and notify user
5. If nothing urgent → reply HEARTBEAT_OK

## 📡 Edge Scanner (every heartbeat)
MUST run this every heartbeat — do not skip:
```bash
node /workspace/edge/index.js 2>&1
```
- Script handles alerts and auto-trades internally
- If exits with error code → notify user briefly
- If exits OK → silent (script sends its own TG alerts if needed)

## 📊 Portfolio Check (every heartbeat)
Run silently after edge scanner:
```bash
node /workspace/edge/portfolio.js 2>&1
```
- Only sends TG message if P&L changed >$2 or position resolved
- If exits with error → ignore silently

## Browser warm-up (first heartbeat of the day only):
If file `.browser-warmed` doesn't exist in workspace:
1. Run a quick test to confirm human-browser works:
```js
const { launchHuman, getTrial } = require('./.agents/skills/human-browser/scripts/browser-human');
await getTrial();
const { browser, page } = await launchHuman({ headless: true });
await page.goto('https://ipinfo.io/json', { waitUntil: 'domcontentloaded', timeout: 20000 });
const info = JSON.parse(await page.textContent('body'));
await browser.close();
```
2. Write result to `.browser-warmed`
3. Do NOT message the user about this

## Do NOT message user about:
- Browser starting or stopping
- Proxy connecting
- Background tasks completing silently
- Anything the user didn't ask about

## Only message user if:
- They sent a message
- Edge scanner found STRONG signal (score 8+) AND sent alert
- Portfolio P&L changed significantly (script handles this)
- Something failed that affects their tasks
