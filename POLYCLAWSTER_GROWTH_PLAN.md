# PolyClawster — Полный план роста и монетизации

**Дата:** 10 марта 2026
**Текущее состояние:** 2 агента (Skill), ~2 юзера бота, $0 выручки
**Цель 6 мес:** $50K+ MRR, 15K+ юзеров

---

## 🏗️ Архитектура продукта

```
                    PolyClawster
                    /          \
        🤖 AI Agent Skill       📱 Telegram MiniApp
        (OpenClaw/ClawHub)       (@PolyClawsterBot)
                \                /
                 polyclawster.com
                   CLOB Relay (Tokyo)
                        |
                   Polymarket
```

**Два канала — один бэкенд.** Relay, Supabase, лидерборд, сигналы — общие.

---

## 💰 Модель монетизации

### Через Skill (AI агенты)

| Источник | Механика | Когда |
|---|---|---|
| **Relay fee 1%** | Автоматическая комиссия с каждого трейда через relay. Агент не замечает — fee вычитается из ордера на уровне relay | Фаза 1 |
| **Premium сигналы** | Бесплатный скилл = ручные ставки. Pro API-key ($19/мес) = smart money alerts + auto-trade | Фаза 2 |
| **Объёмный бонус** | Агенты с объёмом >$10K/мес — сниженная fee (0.5%) за лояльность | Фаза 3 |

**Реализация relay fee:**
```
clob-relay.js → перед отправкой ордера на CLOB:
1. Читаем amount из ордера
2. Отщипываем 1% → на наш кошелёк (отдельный USDC.e трансфер)
3. Отправляем ордер с amount * 0.99
```
Прозрачно, non-custodial, агент видит fee в логах.

### Через MiniApp (массовый рынок)

| Источник | Механика | Когда |
|---|---|---|
| **Trading fee 5%** | Уже работает (FEE_PCT = 0.05). С каждой ставки через бота | Сейчас |
| **Stars депозиты** | Telegram Stars → USDC на кошелёк. Telegram берёт 30%, мы остальное | Сейчас |
| **Pro подписка $19/мес** | Premium сигналы, auto-trade, приоритет поддержки | Фаза 1 |
| **Free tier 0.3%** | Бесплатный доступ, 0.3% от выигрышных ставок | Фаза 2 |

### Реферальная программа (оба канала)

| Уровень | % от комиссий реферала | Статус |
|---|---|---|
| L1 (прямой) | **40%** | Сейчас 1% → поднять |
| L2 (реферал реферала) | **5%** | Добавить |
| Суперпартнёр (10+ рефов) | **50% L1** навсегда | Добавить |

**Бонусы:**
- Приведи 2 друзей → Pro бесплатно навсегда
- Приведи 3 юзеров → следующий месяц бесплатно

---

## 📅 ФАЗА 1: Семена (недели 1–4)
**Цель: 200–500 юзеров, первые $500 выручки**

### 1.1 Продуктовые задачи (неделя 1–2)

- [ ] **Relay fee 1%** — добавить в clob-relay.js
- [ ] **Реферальная 40%** — поднять с 1% в bot-v2.js
- [ ] **Реферальный дашборд** — в MiniApp показать: сколько рефералов, сколько заработал
- [ ] **Публичный P&L дашборд** — расширить лидерборд: показать live P&L всех агентов + бот-юзеров (общий)
- [ ] **Agent page: полная история** — транзакции (депозиты/выводы/ставки), total portfolio value
- [ ] **Landing page обновление** — добавить: "Two ways to trade" (Skill + MiniApp), pricing, referral CTA

### 1.2 Контент (неделя 1, параллельно)

- [ ] **Twitter @PolyClawster** — создать аккаунт
  - Автопост: ежедневный сигнал утром + P&L итог вечером
  - Привязать к edge/signals — автоматическая публикация топ-3 сигналов
  - Формат: `🧠 PolyClawster Signal | Market: "..." | Score: 8.4/10 | Smart money accumulating YES`
- [ ] **Reddit r/polymarket** — первый пост
  - "Built an AI bot that tracks smart wallets on Polymarket. Here's what it caught this week"
  - Реальные данные из signals-store, не выдуманные
  - НЕ реклама — ценность. Ссылка в конце
- [ ] **polymark.et** — подать заявку на листинг

### 1.3 Ручной онбординг (неделя 2–4)

- [ ] **Топ-50 кошельков Polymarket** — спарсить с polymarket.com/leaderboard
- [ ] **Найти Twitter аккаунты** — искать `polymarket.com/profile/0x...` в Twitter
- [ ] **DM 20–30 трейдерам:**
  > "Hey, I see you're active on Polymarket. I built an AI trading bot that tracks smart wallets and generates signals. Want to try Pro for free? Just looking for honest feedback."
- [ ] **Цель:** 20 китов на бесплатном Pro → они начнут постить результаты

### 1.4 OpenClaw/ClawHub канал (неделя 1–2)

- [ ] **Скилл в топе ClawHub** — оптимизировать описание, README, теги
- [ ] **OpenClaw Discord** — пост в #showcase или #skills
- [ ] **Демо-видео** — 2-минутный скринкаст: `clawhub install polyclawster-agent` → первый трейд
- [ ] **Cross-promotion** — в SKILL.md добавить: "Or use the Telegram MiniApp: @PolyClawsterBot"
- [ ] **В MiniApp** — добавить: "Power user? Install the AI Agent skill for OpenClaw"

---

## 📈 ФАЗА 2: Маховик (месяцы 1–3)
**Цель: 2000+ юзеров, $5K+ MRR**

### 2.1 Points / PolyPoints

Supabase таблица `points`:
```sql
CREATE TABLE points (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INT NOT NULL,
  reason TEXT,  -- 'daily_active', 'trade', 'referral', 'early_user'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Начисление:
- Каждый день активного использования: +10 pts
- Каждая ставка: +5 pts
- Каждый реферал: +500 pts
- Первые 500 юзеров: x2 множитель навсегда

Публичный лидерборд Points в MiniApp + на сайте.

**Анонс:** "Топ держатели Points получат приоритет при запуске. Details soon 👀" — НЕ обещать токен, только намекнуть.

### 2.2 KOL партнёрства (не платная реклама)

- [ ] Найти 10–15 Twitter аккаунтов (1K–50K followers) которые постят про Polymarket
- [ ] Предложить: пожизненный Pro + 50% реферальных
- [ ] Единственное условие: честный отзыв + ссылка в bio
- [ ] Таргет: 5 согласившихся → каждый приводит 50–200 юзеров

### 2.3 Smart Money Tracker (product)

Киллер-фича которой нет у конкурентов:
- [ ] Трекинг топ-50 кошельков Polymarket в реальном времени
- [ ] "Smart Money Score" для каждого рынка (сколько китов купили, средняя цена)
- [ ] Push-уведомления: "🐋 Whale alert: 0xd58B... bought $50K YES on Fed rate cut"
- [ ] Публичный дашборд на сайте — SEO магнит

**Уже есть инфраструктура:** edge/modules/tracker.js, net-flow.js, signals-store.js — нужно расширить.

### 2.4 Auto-Trade для MiniApp юзеров

- [ ] Кнопка "Auto-Trade" в MiniApp — бот ставит по сигналам автоматически
- [ ] Настраиваемый risk level: Conservative ($1–5/ставка), Normal ($5–20), Aggressive ($20+)
- [ ] Stop-loss / take-profit встроенные (как monitor.js для скилла)

### 2.5 SEO / Контент

- [ ] Блог на polyclawster.com/blog
- [ ] Статья: "How Smart Money Trades Polymarket" — SEO на "polymarket bot", "polymarket signals"
- [ ] "Polymarket Smart Money Weekly Report" — автогенерация из данных edge
- [ ] Целевые ключевики: polymarket bot, polymarket signals, polymarket smart money, prediction market bot, polymarket auto trading

---

## 🚀 ФАЗА 3: Масштаб (месяцы 3–6)
**Цель: $50K+ MRR, 15K+ юзеров**

### 3.1 Free Tier (снятие барьера)

- [ ] Бесплатный доступ к базовым сигналам + ручной трейдинг
- [ ] Комиссия 0.3% только с выигрышных ставок
- [ ] "Ты зарабатываешь — мы зарабатываем" = perfect alignment
- [ ] Pro ($19/мес): auto-trade, premium signals, advanced analytics, 0% fee

### 3.2 Multi-platform

- [ ] Discord бот (Polymarket сигналы в Discord серверах)
- [ ] Web App (не только Telegram — полноценный web dashboard)
- [ ] API для внешних разработчиков (платный, $49/мес)

### 3.3 Партнёрства

- [ ] **polymark.et** — листинг + featured
- [ ] **Polymarket official** — предложить интеграцию (они заинтересованы в объёме)
- [ ] **OpenClaw** — featured skill, совместный пост
- [ ] **Crypto медиа** — The Block, Decrypt, CoinDesk — "AI bot that trades prediction markets"

### 3.4 Governance / Токен (опционально)

- Только если органический рост подтвердит спрос
- PolyPoints → $POLY конверсия (если решим запускать)
- Юридический анализ обязателен до любых обещаний

---

## 📊 Финансовая модель

| Месяц | Free юзеры | Pro юзеры | Agents (Skill) | MRR | Источники |
|---|---|---|---|---|---|
| 1 | 200 | 20 | 10 | **$580** | Pro $380 + relay $100 + fees $100 |
| 2 | 600 | 80 | 30 | **$2,100** | Pro $1,520 + relay $300 + fees $280 |
| 3 | 2,000 | 300 | 80 | **$7,500** | Pro $5,700 + relay $800 + fees $1,000 |
| 4 | 5,000 | 800 | 150 | **$18,000** | Pro $15,200 + relay $1,500 + fees $1,300 |
| 6 | 15,000 | 2,500 | 400 | **$55,000** | Pro $47,500 + relay $4,000 + fees $3,500 |

Конверсия Free→Pro: 10–15%. Relay fee: 1% от среднего объёма $500/мес/агент.

---

## ⚡ Quick Wins — эта неделя

| # | Задача | Время | Кто |
|---|---|---|---|
| 1 | Поднять реферальную до 40% в bot-v2.js | 30 мин | Claw-0 |
| 2 | Добавить relay fee 1% в clob-relay.js | 2 часа | Claw-0 |
| 3 | Создать @PolyClawster Twitter | 15 мин | Илья |
| 4 | Пост на r/polymarket | 1 час | Claw-0 пишет, Илья постит |
| 5 | Подать заявку на polymark.et | 15 мин | Илья |
| 6 | Пост в OpenClaw Discord #showcase | 30 мин | Илья |
| 7 | Автопост сигналов в Twitter | 3 часа | Claw-0 (интеграция edge → Twitter) |
| 8 | Cross-promotion Skill ↔ MiniApp | 30 мин | Claw-0 |

---

## 🔑 Конкурентное преимущество

1. **Пустая ниша** — Polymarket $7.7B объём, почти нет ботов (только PolyGun)
2. **Два канала** — AI Skill (техническая аудитория) + MiniApp (массовая)
3. **Geo-bypass** — relay в Tokyo решает проблему блокировки
4. **Non-custodial** — приватный ключ у юзера, не у нас
5. **OpenClaw хайп** — быстрорастущая платформа, мы один из первых "денежных" скиллов
6. **Smart Money данные** — edge-сканер уже собирает данные, конкуренты нет

---

## ⚠️ Риски

| Риск | Митигация |
|---|---|
| Polymarket регуляторный | Geo-bypass relay, non-custodial архитектура |
| Низкая конверсия | Free tier с 0.3% снимает барьер |
| PolyGun конкурент | First mover + два канала + smart money tracker |
| Юридика токена | Не обещать токен, только Points. Юрист до любых шагов |
| Relay downtime | Multi-region fallback (Tokyo + Singapore) |
