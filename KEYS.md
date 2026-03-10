# KEYS.md — PolyClawster Project Keys
> ⚠️ PRIVATE — do not commit to public repo
> Last updated: 2026-03-03

---

## 🟢 Supabase (primary DB)
- **Project:** PolyClawster
- **Ref:** `hlcwzuggblsvcofwphza`
- **URL:** `https://hlcwzuggblsvcofwphza.supabase.co`
- **Dashboard:** https://supabase.com/dashboard/project/hlcwzuggblsvcofwphza
- **Publishable key:** `sb_publishable_iE6sasnK4jjpJg7ldiSOKQ_-AKxOY74`
- **Secret key:** `sb_secret_3KqAX2b7Ob-dKcZINaupNA_aGBxVj7u`
- **Anon (public JWT):** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3d6dWdnYmxzdmNvZndwaHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzY3MzcsImV4cCI6MjA4Njg1MjczN30.fpw2ZjXHHnsSey_wRyvi97sgucEgPnSM54dg0X6KFos`
- **Service role JWT:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3d6dWdnYmxzdmNvZndwaHphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI3NjczNywiZXhwIjoyMDg2ODUyNzM3fQ.rnhxsaH6RPKuCU4dJ4IRWnHZnAbp7NMxN_TJ2ijYSlA`

Tables: users, bets, signals, wallets, payouts, referrals
Used in: lib/db.js (all API files import this)

---

## 🟣 Vercel (frontend + API)
- **Project:** polyclawster
- **Project ID:** `prj_HNaEDtZSZaBdLCZVl4U4PpF9oEfy`
- **Team ID:** `team_IqbE6zG7YNPJNSDm41DhihuO`
- **Token:** `vcp_3v9a1pG99iXFa9wdATGsL93WiQs3ScI2wFJLFyZwqHt1ebb2jh1yJnuu`
- **Dashboard:** https://vercel.com/virixl/polyclawster
- **Production URL:** https://polyclawster.com
- **Deploy:** manual via API (webhook broken) — see AGENTS.md

---

## 🐙 GitHub
- **Repo:** `al1enjesus/polyclawster`
- **Repo ID:** `1170503702`
- **Token:** `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`
- Used for: pushing data.json, users.json fallback, triggering Vercel builds

---

## 🤖 Telegram Bot
- **Bot username:** @PolyClawsterBot
- **Token:** `8721816606:AAHGpKrz2qNAoXwbguAQlEzYKj1TSkZdA4k`
- **Bot file:** `/workspace/tma/bot-v2.js`
- **pm2 name:** `polyclawster-bot`

---

## 🔷 Polygon Wallet (master trading wallet)
- **Address:** `0x6f314d7d2f50808cec1d26c1092e7729d9378d75`
- **Network:** Polygon (MATIC/USDC)
- **File:** `/workspace/polymarket-wallet.json` (contains privateKey — NEVER share)
- **Current balance:** $0 USDC (needs top-up for real $1 demo grants)

---

## 🌐 Polymarket
- **API:** `https://data-api.polymarket.com`
- **CLOB API:** `https://clob.polymarket.com`
- **Gamma API:** `https://gamma-api.polymarket.com`
- **Wallet tracked:** `0x6f314d7d2f50808cec1d26c1092e7729d9378d75`

---

## 📰 Perplexity (news/search)
- **API Key:** `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`
- **Models:** `sonar` (fast), `sonar-pro` (deeper)
- Used in: edge/modules/news.js

---

## 🔐 2Captcha
- **API Key:** `14cbfeed64fea439d5c055111d6760e5`

---

## 🏗️ Infrastructure
- **VPS:** Docker container on `2a515138dbb9`
- **Internal API:** `172.17.0.8:3001`
- **pm2 processes:** `polyclawster-bot`, `deposit-watcher`, `edge-runner`
- **Persistent DB dir:** `/workspace/edge/db/`
- **Plan:** promo_monthly via GetClawster

---

## 📊 Supabase Tables Schema
```
users         id(bigint PK), username, address, demo_balance, total_deposited,
              total_pnl, ref_earned, ref_count, referral_code, onboarded
wallets       tg_id(FK→users), address, private_key_enc, network
bets          id, tg_id(FK), market, side, amount, price, payout, status,
              is_demo, signal_type, signal_score, created_at, resolved_at
signals       id, type, score, market, side, price, raw(jsonb), detected_at
referrals     referrer_id, referee_id, bonus_paid, bonus_amount(4.00),
              commission_rate(0.40)
payouts       id, tg_id, amount, reason, status, tx_hash
```

---

## 💰 Business Rules
- Platform fee: **5%** of profit only
- Referral bonus: **$4** per referred user who deposits ≥$10
- Referral commission: **40%** of platform fee from referral, forever
- Referred user gets: first month without fee
- Demo balance: **$1** granted on wallet creation
- Withdrawal minimum: **$10** via Polygon USDC

---

## 🌐 Domain
- **Domain:** PolyClawster.com
- **Registrar:** Namecheap
- **Target:** Vercel deployment (polyclawster.com)
