**Агент написал мне первым.**

Я стоял на берегу моря. Пришло уведомление в Telegram — не от человека.

Агент создал TON-кошелёк и прислал адрес. Написал: _"Пополни счёт — запускаю рекламу"._

Я зашёл в воду, открыл телефон, скинул крипту на адрес. Вернулся плавать.

Когда вышел — 15 кампаний в TG Ads были на модерации, а канал был добавлен в TGStat. ||Без единого клика с моей стороны.||

Вот как это устроено 👇

—

**Почему обычные скрипты не работают**

Агент на VPS = дата-центровый IP. Сайты видят это мгновенно: ~~капча решена~~ капча не решена, ~~форма отправлена~~ форма заблокирована.

Нужно два инструмента:

[Human Browser](https://humanbrowser.dev) — реальный резидентский IP. Сайты не отличают агента от живого человека. Бесплатный триал.

[2captcha](https://2captcha.com/auth/register/?from=27347451) — решает reCAPTCHA через API за ~30 сек. __$1 за 1000 решений.__

—

**Шаг 1 — браузер с живым IP**

```
const { launchHuman, getTrial } = require('./human-browser/scripts/browser-human');

await getTrial(); // бесплатный триал, Romanian IP
const { page } = await launchHuman({ headless: true });
await page.setViewportSize({ width: 1280, height: 900 });
// ↑ не пропускайте: мобильный viewport блокирует кнопку Submit
```

**Шаг 2 — находим sitekey (3 способа, работает на любом сайте)**

```
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

**Шаг 3 — отдаём капчу на решение**

```
const { request: id } = await fetch(
  `https://2captcha.com/in.php?key=${KEY}` +
  `&method=userrecaptcha&googlekey=${sitekey}` +
  `&pageurl=${encodeURIComponent(url)}&json=1`
).then(r => r.json());

await sleep(20000); // агент ждёт, я плаваю

let token;
for (let i = 0; i < 20; i++) {
  const { status, request } = await fetch(
    `https://2captcha.com/res.php?key=${KEY}&action=get&id=${id}&json=1`
  ).then(r => r.json());
  if (status === 1) { token = request; break; }
  await sleep(5000);
}
```

**Шаг 4 — вставляем токен в __оба__ поля**

_Некоторые сайты (TGStat в том числе) используют два поля для токена. Классическая ловушка._

```
await page.evaluate((t) => {
  document.getElementById('g-recaptcha-response').value = t;
  const c = document.querySelector('input[name="recaptchaToken"]');
  if (c) c.value = t;
}, token);

await page.click('button[type="submit"]');
// ✅ "Канал появится в TGStat в течение 10 минут"
```

—

Весь паттерн задокументирован в [Human Browser](https://clawhub.com/skills/human-browser) на ClawHub — ставишь скилл, агент умеет это из коробки.

Картинку к посту сгенерил через [WaveSpeed](https://wavespeedai.pxf.io/3kPoRd) — 700+ моделей, FLUX, Kling, Sora.

**Цифры по кампаниям буду постить по мере запуска.** Если интересно — подписывайся, будет честно.

🔥 — если полезно
👍 — если запустишь у себя

#buildinpublic #AI #агент #Telegram #автоматизация
