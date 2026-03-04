# ТЗ — humanbrowser.dev landing page

## Цель
Конвертировать разработчиков/AI-энтузиастов в:
1. ⭐ GitHub звезду (al1enjesus/human-browser)
2. 💳 Покупку плана
3. 📦 Установку скилла с ClawHub

## Header (sticky, всегда виден при скролле)
- Лого / название слева: **Human Browser**
- Справа: `[⭐ Star on GitHub — {count}]` — кнопка с живым счётчиком звёзд через GitHub API
- Правее: кнопка `[Get Started →]` (scroll to pricing / trial)

Счётчик звёзд:
```js
fetch('https://api.github.com/repos/al1enjesus/human-browser')
  .then(r => r.json()).then(d => d.stargazers_count)
```

## Hero секция
**Заголовок:** Your AI agent, acting human.
**Подзаголовок:** Residential IP + human-like behavior for any AI agent. Drop-in replacement for Playwright.

**CTA блок:**
```
[⭐ Star on GitHub]   [Get Free Trial →]
```

Под кнопками: `MIT License · Open Source · 4.1k downloads`

## Use Cases (3 карточки)
1. **Form automation** — регистрация на сайтах, добавление в каталоги, TGStat, storebot, botsarchive
2. **CAPTCHA bypass** — reCAPTCHA v2/v3, hCaptcha через 2captcha integration
3. **Social scraping** — LinkedIn, Instagram, Twitter без блокировок

## Как это работает (2 колонки)
Слева: обычный Playwright → datacenter IP → blocked instantly
Справа: Human Browser → residential IP (Romania) → passes as human

## Open Source секция
Большой акцент — не баннер, а полноценная секция:
```
🔓 Fully Open Source
The human behavior logic (mouse curves, typing simulation, scroll patterns) 
is free and open. You pay only for what you use: proxy bandwidth + CAPTCHA solves.

[View on GitHub →]  [Contribute →]  [Star ⭐]
```

## Pricing
- **Free Trial** — ~100MB Romanian IP, no signup
- **Pay-as-you-go** — $X/GB residential (via humanbrowser.dev)
- **Enterprise** — Bright Data integration (link: https://get.brightdata.com/4ihj1kk8jt0v)
- **CAPTCHA** — 2captcha integration ($1/1k, link: https://2captcha.com/auth/register/?from=27347451)

## Footer
- GitHub: github.com/al1enjesus/human-browser
- ClawHub: clawhub.com/skills/human-browser  
- Skill для OpenClaw: `npx clawhub install human-browser`

## Tech stack рекомендация
- Next.js / Astro (static generation)
- Tailwind
- GitHub API для live star count
- Vercel deploy
