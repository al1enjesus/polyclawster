---
ФИНАЛЬНЫЙ ПОСТ ДЛЯ @gordeyai
Формат: Telegram Markdown (ссылки вставятся как гиперссылки)
Картинка: V2 (робот с очками) — https://files.catbox.moe/9jh5z6.png
---

Запустил рекламу на $800 в TG Ads и зарегался в каталогах — ни разу не открыл браузер 🤖

Мы запускаем [GetClawster](https://t.me/GetClawsterBot/app) — это AI-агент на базе Claude, которого можно развернуть в Telegram за 2 минуты. Стандартный запуск стартапа: нужна реклама + нужно засветиться в каталогах.

Но я не сделал это руками. Агент сделал сам.

Вот полный гайд как это работает 👇

---

**Почему обычные скрипты не работают**

Если ваш агент крутится на VPS — у него дата-центровый IP. Cloudflare, TGStat, большинство сайтов видят это сразу и либо блокируют, либо вешают капчу которую скрипт не решит.

Плюс reCAPTCHA требует не просто токен — некоторые сайты используют **два поля** для него, и если заполнить только стандартное — форма не отправится.

Решается это двумя инструментами:

**[Human Browser](https://humanbrowser.dev)** — даёт агенту реальный резидентский IP (Румыния). Сайты не отличают от живого человека. Есть бесплатный триал.

**[2captcha](https://2captcha.com/auth/register/?from=27347451)** — сервис решения капч. $1 за 1000 reCAPTCHA. Работает через API, ответ приходит за ~30 секунд.

---

**Шаг 1 — Запускаем браузер с реальным IP**

```js
const { launchHuman, getTrial } = require('./human-browser/scripts/browser-human');

await getTrial(); // бесплатный триал, Romanian IP ~100MB
const { browser, page } = await launchHuman({ headless: true });
await page.setViewportSize({ width: 1280, height: 900 });
// ↑ важно: на мобильном viewport меню перекрывает кнопку Submit
```

---

**Шаг 2 — Заполняем форму (пример TGStat)**

```js
await page.goto('https://tgstat.ru/channels/add', { waitUntil: 'networkidle' });
await page.fill('input[name="username"]', '@gordeyai');
await page.selectOption('select[name="language"]', { label: 'Русский' });
await page.selectOption('select[name="category_id"]', { value: '1' }); // Технологии
```

---

**Шаг 3 — Находим sitekey (3 fallback метода)**

Разные сайты прячут sitekey по-разному. Вот универсальный детект:

```js
const sitekey = await page.evaluate(() => {
  // 1. Стандартный атрибут
  const el = document.querySelector('[data-sitekey]');
  if (el) return el.getAttribute('data-sitekey');

  // 2. Из src iframe'а reCAPTCHA
  for (const f of document.querySelectorAll('iframe')) {
    const m = (f.src || '').match(/[?&]k=([^&]+)/);
    if (m) return m[1];
  }

  // 3. Сканируем HTML страницы
  const m = document.documentElement.innerHTML
    .match(/sitekey['":\s]+['"]([^'"]+)['"]/);
  return m ? m[1] : null;
});
```

---

**Шаг 4 — 2captcha решает капчу**

```js
const API_KEY = 'ваш_ключ_2captcha';

// Отправляем задачу
const { request: taskId } = await fetch(
  `https://2captcha.com/in.php?key=${API_KEY}` +
  `&method=userrecaptcha&googlekey=${sitekey}` +
  `&pageurl=${encodeURIComponent(page.url())}&json=1`
).then(r => r.json());

// Ждём ~20 сек и поллим
await new Promise(r => setTimeout(r, 20000));
let token;
for (let i = 0; i < 20; i++) {
  const { status, request } = await fetch(
    `https://2captcha.com/res.php?key=${API_KEY}&action=get&id=${taskId}&json=1`
  ).then(r => r.json());
  if (status === 1) { token = request; break; }
  await new Promise(r => setTimeout(r, 5000));
}
```

---

**Шаг 5 — Вставляем токен и сабмитим**

Ключевой момент: **TGStat использует два поля** для токена. Если заполнить только стандартное — форма не уйдёт.

```js
await page.evaluate((t) => {
  // Стандартное поле reCAPTCHA
  document.getElementById('g-recaptcha-response').value = t;
  // Кастомное поле (TGStat-специфично)
  const custom = document.querySelector('input[name="recaptchaToken"]');
  if (custom) custom.value = t;
}, token);

await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
// ✅ "Заявка отправлена. Канал появится в TGStat в течение 10 минут."
```

---

**Результат**

За один запуск агент:
— подал заявку на @gordeyai в TGStat
— запустил 15 TG Ads кампаний на $800
— всё это без единого открытого браузера с моей стороны

Хочешь такой же стек — ставь скилл через OpenClaw и всё уже внутри:
→ **[Human Browser на ClawHub](https://clawhub.com/skills/human-browser)**

Если хочешь сгенерировать аватарку для канала или картинку к посту — в том же стеке есть **[WaveSpeed](https://wavespeedai.pxf.io/3kPoRd)** (700+ моделей, FLUX, Kling, Sora).

И да, буду постить цифры по рекламе как только кампании пройдут модерацию 📊

#buildinpublic #AI #агент #Telegram #автоматизация #GetClawster
