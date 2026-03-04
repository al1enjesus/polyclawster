Научил агента проходить reCAPTCHA на любом сайте.

Пока плавал в море — он зарегался в TGStat и запустил 15 рекламных кампаний. Я не открывал браузер.

Вот как это работает 👇

---

**Проблема**

Агент на VPS = дата-центровый IP. Сайты видят это мгновенно и либо блокируют, либо вешают капчу. Обычный Playwright не поможет — нужен реальный IP и автоматическое решение CAPTCHA.

Две вещи это решают:

[Human Browser](https://humanbrowser.dev) — даёт агенту резидентский IP (выглядит как обычный пользователь из Румынии). Бесплатный триал есть.

[2captcha](https://2captcha.com/auth/register/?from=27347451) — решает reCAPTCHA через API за ~30 секунд. Стоит $1 за 1000 решений.

---

**Шаг 1 — запускаем браузер с живым IP**

```js
const { launchHuman, getTrial } = require('./human-browser/scripts/browser-human');

await getTrial(); // бесплатный триал
const { browser, page } = await launchHuman({ headless: true });
await page.setViewportSize({ width: 1280, height: 900 });
// ↑ не пропускайте: мобильный viewport блокирует кнопку Submit
```

**Шаг 2 — находим sitekey (3 способа, работает везде)**

```js
const sitekey = await page.evaluate(() => {
  const el = document.querySelector('[data-sitekey]');
  if (el) return el.getAttribute('data-sitekey');

  for (const f of document.querySelectorAll('iframe')) {
    const m = (f.src || '').match(/[?&]k=([^&]+)/);
    if (m) return m[1];
  }

  const m = document.documentElement.innerHTML
    .match(/sitekey['":\s]+['"]([^'"]+)['"]/);
  return m ? m[1] : null;
});
```

**Шаг 3 — 2captcha решает капчу**

```js
const { request: id } = await fetch(
  `https://2captcha.com/in.php?key=${KEY}` +
  `&method=userrecaptcha&googlekey=${sitekey}` +
  `&pageurl=${encodeURIComponent(url)}&json=1`
).then(r => r.json());

await new Promise(r => setTimeout(r, 20000)); // ждём ~20 сек

let token;
for (let i = 0; i < 20; i++) {
  const { status, request } = await fetch(
    `https://2captcha.com/res.php?key=${KEY}&action=get&id=${id}&json=1`
  ).then(r => r.json());
  if (status === 1) { token = request; break; }
  await new Promise(r => setTimeout(r, 5000));
}
```

**Шаг 4 — вставляем токен**

Важный момент: некоторые сайты (TGStat в том числе) используют **два поля** для токена. Нужно заполнить оба:

```js
await page.evaluate((t) => {
  document.getElementById('g-recaptcha-response').value = t;
  const custom = document.querySelector('input[name="recaptchaToken"]');
  if (custom) custom.value = t;
}, token);

await page.click('button[type="submit"]');
// ✅ готово
```

---

Весь паттерн задокументирован в [Human Browser](https://clawhub.com/skills/human-browser) на ClawHub — ставишь скилл, агент умеет это из коробки.

Если нужна картинка к посту или аватарка — там же есть [WaveSpeed](https://wavespeedai.pxf.io/3kPoRd), 700+ моделей.

Буду постить цифры по рекламным кампаниям 📊

#buildinpublic #AI #агент #Telegram #автоматизация
