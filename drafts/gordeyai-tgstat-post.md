Мой агент сам зарегистрировался в TGStat, пока я пил кофе ☕

Мы запускаем GetClawster — AI-агент в Telegram на базе Claude. Нужен трафик. Решили добавиться во все каталоги автоматически.

Спойлер: агент справился. Вот как.

---

**Проблема**

TGStat требует reCAPTCHA при добавлении канала. Обычный браузер = моментальный бан. Ваш агент на VPS — это дата-центровый IP, сайты его видят насквозь.

Нужно было:
1. Выглядеть как человек (реальный IP)
2. Решить капчу автоматически

---

**Стек**

🌐 **Human Browser** — браузер с резидентским Romanian IP, сайты не отличают от живого юзера
→ https://humanbrowser.dev

🎨 **WaveSpeed** — 700+ AI моделей для генерации изображений и видео
→ https://wavespeedai.pxf.io/3kPoRd

🔐 **2captcha** — решает reCAPTCHA за ~30 сек, $1 за 1000 запросов
→ https://2captcha.com/auth/register/?from=27347451

---

**Шаг 1 — Запускаем браузер**

```js
const { launchHuman, getTrial } = require('./human-browser/scripts/browser-human');

await getTrial(); // бесплатный триал, Romanian IP ~100MB
const { browser, page } = await launchHuman({ headless: true });
await page.setViewportSize({ width: 1280, height: 900 }); // важно!
```

Почему `1280x900`? На мобильном viewport меню перекрывает кнопку Submit — клик не проходит.

---

**Шаг 2 — Заполняем форму**

```js
await page.goto('https://tgstat.ru/channels/add', { waitUntil: 'networkidle' });
await page.fill('input[name="username"]', '@gordeyai');
await page.selectOption('select[name="country"]', { index: 1 });
await page.selectOption('select[name="language"]', { label: 'Русский' });
await page.selectOption('select[name="category_id"]', { value: '1' }); // Технологии
```

---

**Шаг 3 — Находим sitekey (3 fallback-способа)**

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

---

**Шаг 4 — Решаем капчу**

```js
const submit = await fetch(
  `https://2captcha.com/in.php?key=${KEY}&method=userrecaptcha` +
  `&googlekey=${sitekey}&pageurl=${URL}&json=1`
).then(r => r.json());

await sleep(20000); // ждём солвера

let token;
for (let i = 0; i < 20; i++) {
  const poll = await fetch(
    `https://2captcha.com/res.php?key=${KEY}&action=get&id=${submit.request}&json=1`
  ).then(r => r.json());
  if (poll.status === 1) { token = poll.request; break; }
  await sleep(5000);
}
```

---

**Шаг 5 — Вставляем токен и сабмитим**

Некоторые сайты (TGStat в том числе) имеют **два** поля для токена. Нужно заполнить оба:

```js
await page.evaluate((t) => {
  document.getElementById('g-recaptcha-response').value = t;
  const custom = document.querySelector('input[name="recaptchaToken"]');
  if (custom) custom.value = t;
}, token);

await page.click('button[type="submit"]');
// "Заявка отправлена. Канал появится в TGStat в течение 10 минут."
```

---

**Результат:** агент сделал это сам, без единого клика с моей стороны.

Весь паттерн лежит в **Human Browser skill** на ClawHub как готовый рецепт:
→ https://clawhub.com/skills/human-browser

---

И да — параллельно крутим 15 TG Ads кампаний на @GetClawsterBot. Буду постить цифры когда пройдут модерацию.

#buildinpublic #AI #агент #Telegram #автоматизация
