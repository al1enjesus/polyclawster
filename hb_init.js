// ─────────────────────────────────────────────────────────────
//  init.js v8 — Human Browser
//  • i18n (EN / RU / ES / ZH) — auto-detect + manual toggle
//  • Hero rotating phrases
//  • Country picker (fixed selectors)
//  • Hamburger, copy, payment sheet
// ─────────────────────────────────────────────────────────────

var STRIPE_PK = 'pk_live_51R5830GI1G0ctYHF3neTcrY2NsNZQqNfDVB6zVnVGuWWa66eFfk8qit16zL9RD2YutczWoQOxCB3Lx5ytrZEO0bR00Ne5VPCHR';

// ═══════════════════════════════════════════════════════════════
//  TRANSLATIONS
// ═══════════════════════════════════════════════════════════════

var TRANSLATIONS = {
  en: {
    // ─── Hero ───
    hero_pill:     'Any country · Residential IP · Zero bans',
    hero_prefix:   'The browser that',
    hero_desc:     '<span class="no-mac-hl">No Mac Mini.</span> No local setup. A full Playwright browser that runs on any server, looks like a real device, and bypasses every bot detection system alive.',
    install_intro: 'Built for OpenClaw — just send this to your agent, it handles everything',
    install_available: 'Available on',
    // ─── Nav ───
    nav_features:  'Features',
    nav_pricing:   'Pricing',
    nav_how:       'How it works',
    nav_cta:       'Get Started →',
    nav_mobile_skill: 'ClawHub Skill (free)',
    trial_desc: 'No signup. No credit card. Just grab the credentials and go.',
    trial_cta:  'Get credentials →',
    // ─── Trust bar ───
    trust_1: 'Bypasses Cloudflare',
    trust_2: 'Bypasses DataDome',
    trust_3: 'Bypasses PerimeterX',
    trust_4: 'Residential IP',
    trust_5: 'Any Linux server',
    trust_6: 'OpenClaw native skill',
    // ─── Code preview ───
    code_label: '5 lines · any server · zero bans',
    code_c1: 'smooth scroll with jitter',
    code_c2: '60–220ms/char',
    code_c3: 'Residential IP · iPhone 15 fingerprint · webdriver=false',
    // ─── Callout ───
    callout_h2: 'Stop buying <span class="grad">hardware</span><br>for your AI agent',
    callout_p:  'Most browser automation guides assume you have a Mac Mini, a desktop VPS, or a $500/mo cloud browser subscription. Human Browser runs on a $5 Linux VPS. Nothing else.',
    callout_li1: 'No display server, no VNC, no desktop required',
    callout_li2: 'Chromium headless + residential proxy = real human fingerprint',
    callout_li3: 'iPhone 15 Pro UA · Residential IP · Local geolocation',
    callout_li4: 'Bezier mouse · human-speed typing · natural scroll',
    callout_li5: 'Works in Docker, GitHub Actions, any CI/CD pipeline',
    cmp_h1: 'Solution',
    cmp_h2: 'Cost',
    cmp_h3: 'Anti-bot',
    cmp_r1_bot: 'Data center IP',
    cmp_r2_bot: 'Partial',
    cmp_r3_bot: 'Instant ban',
    cmp_r4_bot: '✓ Full bypass',
    // ─── Country picker ───
    countries_eyebrow: 'Residential IPs',
    countries_title:   'Pick your country — see what works',
    countries_sub:     'Different services block different IPs. Choose a location and instantly see which platforms are accessible. Your agent picks the right country automatically.',
    country_note: '* Compatibility based on typical residential IP behavior. Some services may vary by specific ISP or account status.',
    // ─── Features ───
    features_eyebrow: 'Features',
    features_title:   'Everything bots look for — covered',
    features_sub:     'Every signal Cloudflare, DataDome, and PerimeterX check. Handled before you write a line of code.',
    feat_1_h: 'Residential IP · 6 Countries',
    feat_1_p: 'Real home ISPs — Romania, US, UK, Germany, Netherlands & Japan. Your agent looks like a local person browsing from home.',
    feat_2_h: 'iPhone 15 Pro Fingerprint',
    feat_2_p: 'iOS 17.4.1 Safari UA, correct viewport, pixel ratio, touch events, platform string. Passes every fingerprint check.',
    feat_3_h: 'Bezier Mouse Curves',
    feat_3_p: 'Movement along randomized curved paths. Humans never go in straight lines — neither does this browser.',
    feat_4_h: 'Human Typing Speed',
    feat_4_p_html: '60–220ms per keystroke with mid-word pauses. Works with React inputs where <code>page.fill()</code> silently fails.',
    feat_5_h: 'Natural Scroll Behavior',
    feat_5_p: 'Scrolls in smooth steps with random jitter. Pauses to read content. Looks exactly like a real user.',
    feat_6_h: 'Full Anti-Detection',
    feat_6_p_html: '<code>webdriver=false</code>, no automation flags, real plugin list, canvas fingerprint, real timezone & geo.',
    feat_7_h: 'OpenClaw Native Skill',
    feat_7_p_html: 'One command install: <code>clawhub install human-browser</code>. Your agent gets it instantly.',
    feat_8_h: 'Desktop Mode',
    feat_8_p_html: 'Switch to Windows Chrome fingerprint when needed: <code>launchHuman({ mobile: false })</code>.',
    feat_9_h: 'Any Server, Zero Setup',
    feat_9_p: 'Bare Linux, Docker, CI/CD. Just Node.js + Chromium. No display server, no VNC, no X11.',
    // ─── How it works ───
    how_eyebrow: 'How it works',
    how_title: 'Built for AI agents,<br>not just humans',
    how_sub: 'The API speaks agent. Pay with crypto. Get credentials programmatically. No dashboards to click.',
    step_1_h_html: 'Agent calls <code>GET humanbrowser.dev/api/plans</code>',
    step_1_p: 'Sees pricing, bandwidth, and supported currencies. Machine-readable JSON.',
    step_2_h_html: 'Agent calls <code>POST /buy</code>',
    step_2_p: 'Picks plan + currency (USDT, ETH, BTC, or card). Gets payment address back.',
    step_3_h: 'Payment auto-confirmed',
    step_3_p: '0xProcessing or Stripe webhook fires. Credentials provisioned in seconds.',
    step_4_h_html: 'Agent polls <code>GET /status/:id</code>',
    step_4_p_html: 'Gets proxy credentials + API key. Drops into <code>.env</code>. Starts browsing.',
    how_code_label: 'Agent purchase flow',
    how_or_card: 'Or pay with card — same flow, Stripe checkout link returned instead.',
    // ─── Pricing ───
    pricing_eyebrow: 'Pricing',
    pricing_title: 'Simple, transparent pricing',
    pricing_sub: 'All plans include proxy credentials + OpenClaw skill. Card, Apple Pay, Google Pay or crypto. Cancel anytime.',
    plan_pop_tag: 'Most Popular',
    plan_starter_usage: '2GB Romania residential',
    plan_pro_usage: '20GB multi-country · 10+ countries',
    plan_ent_usage: '100GB · Dedicated IPs · SLA',
    starter_li1: '2GB Romania residential IP',
    starter_li2: 'Human Browser skill included',
    starter_li3: 'iPhone 15 Pro fingerprint',
    starter_li4: 'Basic support (Telegram)',
    pro_li1: '20GB multi-country (10+ countries)',
    pro_li2: 'All fingerprint profiles',
    pro_li3: '100 CAPTCHA solves/mo included',
    pro_li4: 'Priority queue',
    pro_li5: 'Priority support',
    ent_li1: '100GB bandwidth',
    ent_li2: 'Dedicated sticky IPs',
    ent_li3: 'Custom fingerprint profiles',
    ent_li4: 'API access (REST)',
    ent_li5: 'Dedicated support channel',
    ent_li6: 'SLA',
    // ─── Pay-per-Request ───
    plan_ppr_badge: 'Beta',
    plan_ppr_name: 'Pay-per-Request API',
    plan_ppr_per: '/req',
    plan_ppr_usage: 'No monthly commitment · Pay with crypto',
    ppr_li1: '1,000 requests — $3.00',
    ppr_li2: '5,000 requests — $10.00',
    ppr_li3: '50,000 requests — $50.00',
    ppr_li4: 'Pay with USDT TRC-20, ETH, BTC, SOL',
    ppr_li5: 'Agent-native: POST /api/ppr/quote',
    ppr_cta_btn: 'Buy Credits →',
    // ─── Add-ons ───
    addons_eyebrow: 'Add-ons',
    addons_title: 'Boost your setup',
    addons_sub: 'One-time purchases and monthly extras to customize any plan.',
    addon_1_name: 'Fingerprint Pack',
    addon_1_desc: '20 device profiles',
    addon_1_price: '$9.99 one-time',
    addon_2_name: 'Scraping Recipes',
    addon_2_desc: 'Instagram, LinkedIn, Amazon',
    addon_2_price: '$4.99/script',
    addon_3_name: 'Sticky Session',
    addon_3_desc: 'Same IP for 24h',
    addon_3_price: '$2.99/day',
    addon_4_name: 'Priority Queue',
    addon_4_desc: 'Skip the line',
    addon_4_price: '+$5/mo',
    addon_5_name: 'CAPTCHA Bundle',
    addon_5_desc: '1000 solves',
    addon_5_price: '$2.99',
    // ─── Affiliate ───
    affiliate_title: 'Prefer self-hosted proxies?',
    proxy_compare_title: 'Recommended residential proxies',
    proxy_compare_sub: 'All providers below are tested and compatible with Human Browser. Set PROXY_HOST/USER/PASS in your env and it works out of the box.',
    proxy_compare_note: '💡 Don\'t want to manage proxies? Human Browser Starter — $13.99/mo includes a residential IP out of the box.',
    affiliate_desc: 'Tested and working with Human Browser. Pick a provider and set your proxy credentials in the env vars.',
    aff_hb_title: 'Promote Human Browser. Earn 20%.',
    aff_hb_desc: 'Share the skill with developers, AI teams, or scraping communities. You get 20% of every subscription they buy — recurring, forever.',
    aff_hb_cta: 'Get your referral link →',
    aff_hb_note: 'Payouts in USDT TRC-20 · Monthly · No minimum',
    aff_badge_50first: '50% commission',
    aff_badge_10life: '10% lifetime',
    aff_badge_25rec: '25% recurring',
    aff_badge_nodemaven: '50% + 10% recurring',
    aff_decodo_desc: 'Best value. 195M+ IPs, 195 countries. Our recommended pick.',
    aff_iproyal_desc: 'Affordable rotating & sticky residential proxies. Pay-as-you-go.',
    aff_oxylabs_desc: 'Enterprise-grade. 175M+ IPs, advanced geo-targeting.',
    aff_nodemaven_desc: 'High-quality IPs with excellent success rates.',
    aff_webshare_desc: 'Best price-to-performance ratio. Free tier available.',
    aff_brightdata_desc: 'The original. Best network quality. No affiliate discount.',
    aff_cta: 'Get Started →',
    aff_cta_visit: 'Visit →',
    // ─── Free vs Paid ───
    fvp_eyebrow: "What's included",
    fvp_title: 'Free vs Paid — no tricks',
    fvp_sub: 'The skill and code are open and free. You pay only for the residential proxy — the IP that makes everything work.',
    free_tag: 'FREE forever',
    free_h3: 'OpenClaw Skill + Script',
    free_p: 'Everything you need to run the browser. No credit card, no account.',
    free_li1_html: '✅ <code>browser-human.js</code> — full source code',
    free_li2: '✅ Human mouse, typing, scroll logic',
    free_li3: '✅ iPhone 15 Pro + Desktop fingerprints',
    free_li4: '✅ Anti-detection stack (webdriver=false, etc.)',
    free_li5: '✅ OpenClaw skill via clawhub',
    free_li6: '✅ All future updates to the script',
    free_li7: '⚠️ Own residential proxy required',
    free_li8: '⚠️ Without residential IP — sites will block you',
    paid_tag: 'from $13.99/mo',
    paid_h3: 'Residential Proxy Credentials',
    paid_p: 'The missing piece. A real home IP that makes your browser invisible to anti-bot systems.',
    paid_li1: '✅ RO / US / UK / DE / NL / JP IPs',
    paid_li2: '✅ Real residential ISP (DIGI, AT&T, BT…)',
    paid_li3: '✅ Instant credential delivery',
    paid_li4_html: '✅ Works out of the box with <code>browser-human.js</code>',
    paid_li5: '✅ No Bright Data account needed',
    paid_li6: '✅ Email support included',
    paid_li7: '✅ Cancel anytime — no long-term contract',
    paid_cta: 'See Plans →',
    fvp_why_h: 'Why do you need a residential IP at all?',
    fvp_why_p: "Data center IPs (from AWS, DigitalOcean, Hetzner — your regular VPS) are instantly recognized and blocked by Cloudflare, Instagram, LinkedIn, and most modern sites. A residential IP comes from a real home internet connection — it looks exactly like a normal person browsing. That's the only difference between getting blocked in 2 seconds and scraping forever.",
    // ─── Payment methods ───
    pay_eyebrow: 'Payment',
    pay_title: 'Pay any way you want',
    pay_sub: 'Card, Apple Pay, Google Pay or crypto. Credentials delivered automatically.',
    pm1_h: 'Card / Apple Pay / Google Pay',
    pm1_p: 'Processed by Stripe. Visa, Mastercard, Amex. Apple Pay and Google Pay supported. Subscription renews monthly.',
    pm1_s1: 'Click Get Started on any plan',
    pm1_s2: 'Choose Card / Apple Pay / Google Pay',
    pm1_s3: 'Pay → credentials delivered instantly',
    pm2_h: 'USDT TRC-20',
    pm2_p: 'Most popular crypto option. Exact amount to wallet address. Auto-confirmed by 0xProcessing.',
    pm2_s1: 'Click Get Started → choose USDT TRC-20',
    pm2_s2: 'Get wallet address + exact amount',
    pm2_s3: 'Send → credentials in ~2 min',
    pm3_h: 'Solana / ETH / BTC',
    pm3_p: 'All major blockchains accepted. Same automatic flow — no manual approval.',
    pm3_s1: 'Pick your coin in the payment panel',
    pm3_s2: 'Get network-specific address',
    pm3_s3: 'Send → credentials auto-delivered',
    pm4_h: 'AI Agent (API)',
    pm4_p: 'Your agent can buy credentials programmatically. Full JSON API — machine-readable responses.',
    pm4_s1_html: 'Agent: <code>GET /api/plans</code>',
    pm4_s2_html: 'Agent: <code>POST /api/buy {currency:"USDT"}</code>',
    pm4_s3_html: 'Agent pays → polls <code>GET /api/status/:id</code>',
    pay_guar1: '🔒 Credentials delivered within 10 minutes of payment confirmation.',
    pay_guar2: '❌ Not satisfied? Full refund within 24h — no questions asked.',
    // ─── FAQ ───
    faq_eyebrow: 'FAQ',
    faq_title: 'Common questions',
    faq_1q: 'Do I need a Mac Mini or desktop computer?',
    faq_1a: 'No. Human Browser runs on any Linux VPS, Docker container, or cloud server. A $5/mo Hetzner or Contabo VPS is all you need. No display server, no VNC, no X11 — just Node.js and Chromium.',
    faq_2q: 'What exactly is free and what costs money?',
    faq_2a_html: 'The browser-human.js script and the OpenClaw skill are completely free — open source, install anytime. The paid subscription gives you <strong>residential proxy credentials</strong>: a real home IP address from DIGI Romania, AT&T, BT, etc. Without a residential IP, anti-bot systems will block your VPS\'s data center IP instantly.',
    faq_3q: 'Why Romania? Can I use other countries?',
    faq_3a: 'Romania is the cheapest option and works for most tasks — Instagram, LinkedIn, Binance, Polymarket, Cloudflare sites. We also offer USA, UK, Germany, Netherlands, and Japan. Use the country picker above to see which services work where.',
    faq_4q: 'How quickly do I get credentials after paying?',
    faq_4a: 'Card payments via Stripe: 2–3 minutes. USDT TRC-20: 1–3 minutes after on-chain confirmation (Tron is fast). ETH/BTC: 5–15 minutes. AI agent API: fully automatic.',
    faq_5q: 'Can my AI agent buy this automatically?',
    faq_5a_html: 'Yes — that\'s the whole point. Call <code>GET humanbrowser.dev/api/plans</code>, then <code>POST /buy</code> with your preferred currency. You\'ll get a crypto payment address. Your agent sends the payment, polls <code>GET /status/:id</code>, and receives proxy credentials in the response. Zero human involvement required.',
    faq_6q: 'Will this bypass Cloudflare / DataDome / PerimeterX?',
    faq_6a: "Yes, in the vast majority of cases. The combination of a residential IP + realistic browser fingerprint (iPhone 15 Pro) + human behavior simulation (Bezier mouse, natural typing, scroll patterns) passes all major anti-bot systems. We've tested against all three.",
    faq_7q: "What's an OpenClaw skill?",
    faq_7a_html: 'OpenClaw is an AI agent platform. Skills are reusable capability packages — install one and your agent gains specialized knowledge and tools. The Human Browser skill gives your OpenClaw agent the ability to launch a stealth browser with one function call: <code>launchHuman()</code>.',
    faq_8q: 'What if I want to cancel?',
    faq_8a_html: 'DM <a href="https://t.me/virixlabs" target="_blank">@virixlabs</a> on Telegram. We\'ll cancel your subscription immediately. If you\'re within 24h of purchase, you\'ll get a full refund — no questions.',
    // ─── Footer / Virix ───
    vx_h3: 'Built by Virix Labs',
    vx_p: 'AI-powered venture studio building focused products at scale. Human Browser is part of the OpenClaw skill ecosystem — tools that let AI agents work without human bottlenecks.',
    footer_copy: '© 2026 Virix Labs · No Mac Mini needed · Runs on any server',
    footer_blog: 'Blog',
    footer_install: 'Install',
    footer_clawhub: 'ClawHub',
    footer_openclaw: 'OpenClaw',
    footer_virix: 'Virix Labs',
    footer_support: 'Support',
    // ─── Agent Modal ───
    modal_title:        'Send this to your OpenClaw agent',
    modal_sub:          'Your agent will install the skill, pick a plan, and browse like a human — no manual setup.',
    modal_cmd_label:    'INSTALL COMMAND',
    modal_tap_copy:     '📋 tap to copy',
    modal_msg_label:    'OR SEND THIS MESSAGE TO YOUR AGENT',
    modal_msg:          'Install the Human Browser skill and use it whenever I browse the web — Instagram, LinkedIn, Binance, Cloudflare-protected sites, or any page that blocks bots. It uses a real residential IP and iPhone 15 Pro fingerprint, so you\'ll always pass anti-bot checks. Install with: clawhub install human-browser',
    modal_tap_copy2:    '📋 tap to copy',
    modal_clawhub:      'View on ClawHub →',
    modal_github:       'GitHub ↗',
    modal_support_html: 'Need help? <a href="https://t.me/virixlabs" target="_blank">@virixlabs</a> on Telegram',
    // ─── Payment sheet ───
    sheet_tab_card: '💳 Card · Apple Pay · Google Pay',
    sheet_tab_crypto: '₿ Crypto',
    sheet_loading: 'Loading secure checkout…',
    // ─── Rotating phrases ───
    rotating: [
      "thinks it's human",
      "passes every fingerprint check",
      "moves like a real person",
      "bypasses Cloudflare, always",
      "has no idea it's a bot",
      "reads, scrolls, types — just like you",
      "lives rent-free on your server",
      "never triggers a CAPTCHA",
    ],
  },

  ru: {
    // ─── Hero ───
    hero_pill:     'Любая страна · Резидентный IP · Ноль банов',
    hero_prefix:   'Браузер, который',
    hero_desc:     '<span class="no-mac-hl">Без Mac Mini.</span> Без локальной настройки. Полноценный Playwright-браузер на любом сервере — выглядит как реальное устройство и обходит любую защиту от ботов.',
    install_intro: 'Создан для OpenClaw — просто скиньте это своему агенту, он всё сделает сам',
    install_available: 'Доступно на',
    // ─── Nav ───
    nav_features:  'Функции',
    nav_pricing:   'Тарифы',
    nav_how:       'Как это работает',
    nav_cta:       'Начать →',
    nav_mobile_skill: 'Скилл ClawHub (бесплатно)',
    trial_desc: 'Без регистрации. Без карты. Просто забери credentials и начни.',
    trial_cta:  'Получить credentials →',
    // ─── Trust bar ───
    trust_1: 'Обходит Cloudflare',
    trust_2: 'Обходит DataDome',
    trust_3: 'Обходит PerimeterX',
    trust_4: 'Резидентный IP',
    trust_5: 'Любой Linux-сервер',
    trust_6: 'Нативный скилл OpenClaw',
    // ─── Code preview ───
    code_label: '5 строк · любой сервер · ноль банов',
    code_c1: 'плавный скролл с джиттером',
    code_c2: '60–220мс/символ',
    code_c3: 'Резидентный IP · фингерпринт iPhone 15 · webdriver=false',
    // ─── Callout ───
    callout_h2: 'Хватит покупать <span class="grad">железо</span><br>для AI-агента',
    callout_p:  'Большинство гайдов предполагают наличие Mac Mini, рабочего стола или облачного браузера за $500/мес. Human Browser работает на VPS за $5. И больше ничего.',
    callout_li1: 'Без display-сервера, VNC и рабочего стола',
    callout_li2: 'Headless Chromium + резидентный прокси = настоящий фингерпринт человека',
    callout_li3: 'UA iPhone 15 Pro · Резидентный IP · Локальная геолокация',
    callout_li4: 'Мышь по кривым Безье · скорость печати человека · естественный скролл',
    callout_li5: 'Работает в Docker, GitHub Actions, любом CI/CD',
    cmp_h1: 'Решение',
    cmp_h2: 'Стоимость',
    cmp_h3: 'Антибот',
    cmp_r1_bot: 'IP дата-центра',
    cmp_r2_bot: 'Частично',
    cmp_r3_bot: 'Мгновенный бан',
    cmp_r4_bot: '✓ Полный обход',
    // ─── Country picker ───
    countries_eyebrow: 'Резидентные IP',
    countries_title:   'Выбери страну — смотри что работает',
    countries_sub:     'Разные сервисы блокируют разные IP. Выбери регион и мгновенно увидишь, какие платформы доступны. Агент сам выбирает нужную страну.',
    country_note: '* Совместимость основана на типичном поведении резидентных IP. Может варьироваться в зависимости от ISP.',
    // ─── Features ───
    features_eyebrow: 'Возможности',
    features_title:   'Всё что ищут антиботы — перекрыто',
    features_sub:     'Каждый сигнал Cloudflare, DataDome и PerimeterX. Обрабатывается до того, как ты напишешь строку кода.',
    feat_1_h: 'Резидентный IP · 6 стран',
    feat_1_p: 'Настоящие домашние ISP — Румыния, США, Великобритания, Германия, Нидерланды и Япония. Агент выглядит как местный житель, сидящий дома.',
    feat_2_h: 'Фингерпринт iPhone 15 Pro',
    feat_2_p: 'User-Agent Safari iOS 17.4.1, правильный viewport, pixel ratio, тач-события, платформа. Проходит все проверки фингерпринта.',
    feat_3_h: 'Мышь по кривым Безье',
    feat_3_p: 'Движение по случайным изогнутым траекториям. Люди никогда не ходят прямыми линиями — этот браузер тоже.',
    feat_4_h: 'Человеческая скорость печати',
    feat_4_p_html: '60–220мс на символ с паузами внутри слов. Работает с React-инпутами, где <code>page.fill()</code> тихо отказывает.',
    feat_5_h: 'Естественный скролл',
    feat_5_p: 'Плавный скролл с джиттером. Делает паузы как будто читает. Выглядит в точности как реальный пользователь.',
    feat_6_h: 'Полная антидетекция',
    feat_6_p_html: '<code>webdriver=false</code>, без флагов автоматизации, настоящий список плагинов, canvas fingerprint, реальный часовой пояс и геолокация.',
    feat_7_h: 'Нативный скилл OpenClaw',
    feat_7_p_html: 'Установка одной командой: <code>clawhub install human-browser</code>. Агент получает всё мгновенно.',
    feat_8_h: 'Режим десктопа',
    feat_8_p_html: 'Переключение на фингерпринт Windows Chrome когда нужно: <code>launchHuman({ mobile: false })</code>.',
    feat_9_h: 'Любой сервер, нулевой сетап',
    feat_9_p: 'Голый Linux, Docker, CI/CD. Только Node.js + Chromium. Без display-сервера, VNC, X11.',
    // ─── How it works ───
    how_eyebrow: 'Как это работает',
    how_title: 'Создан для AI-агентов,<br>а не только для людей',
    how_sub: 'API говорит на языке агентов. Оплата криптой. Получение credentials программно. Никаких дашбордов.',
    step_1_h_html: 'Агент запрашивает <code>GET humanbrowser.dev/api/plans</code>',
    step_1_p: 'Видит цены, трафик и поддерживаемые валюты. Machine-readable JSON.',
    step_2_h_html: 'Агент вызывает <code>POST /buy</code>',
    step_2_p: 'Выбирает план + валюту (USDT, ETH, BTC или карта). Получает адрес для оплаты.',
    step_3_h: 'Оплата автоматически подтверждается',
    step_3_p: 'Срабатывает вебхук 0xProcessing или Stripe. Credentials готовы за секунды.',
    step_4_h_html: 'Агент поллит <code>GET /status/:id</code>',
    step_4_p_html: 'Получает proxy credentials + API ключ. Записывает в <code>.env</code>. Начинает работать.',
    how_code_label: 'Поток агентной покупки',
    how_or_card: 'Или оплата картой — тот же поток, только вместо адреса возвращается ссылка на Stripe.',
    // ─── Pricing ───
    pricing_eyebrow: 'Тарифы',
    pricing_title: 'Простые, прозрачные цены',
    pricing_sub: 'Все планы включают proxy credentials + OpenClaw скилл. Карта, Apple Pay, Google Pay или крипта. Отмена в любой момент.',
    plan_pop_tag: 'Самый популярный',
    plan_starter_usage: '2ГБ резидентный IP Румынии',
    plan_pro_usage: '20ГБ мультистрана · 10+ стран',
    plan_ent_usage: '100ГБ · Выделенные IP · SLA',
    starter_li1: '2ГБ резидентный IP Румынии',
    starter_li2: 'Скилл Human Browser включён',
    starter_li3: 'Фингерпринт iPhone 15 Pro',
    starter_li4: 'Базовая поддержка (Telegram)',
    pro_li1: '20ГБ мультистрана (10+ стран)',
    pro_li2: 'Все профили фингерпринтов',
    pro_li3: '100 решений CAPTCHA/мес включено',
    pro_li4: 'Приоритетная очередь',
    pro_li5: 'Приоритетная поддержка',
    ent_li1: '100ГБ трафика',
    ent_li2: 'Выделенные sticky IP',
    ent_li3: 'Кастомные профили фингерпринтов',
    ent_li4: 'API доступ (REST)',
    ent_li5: 'Выделенный канал поддержки',
    ent_li6: 'SLA',
    // ─── Pay-per-Request ───
    plan_ppr_badge: 'Бета',
    plan_ppr_name: 'Pay-per-Request API',
    plan_ppr_per: '/запрос',
    plan_ppr_usage: 'Без ежемесячной платы · Крипто-оплата',
    ppr_li1: '1,000 запросов — $3.00',
    ppr_li2: '5,000 запросов — $10.00',
    ppr_li3: '50,000 запросов — $50.00',
    ppr_li4: 'Оплата USDT TRC-20, ETH, BTC, SOL',
    ppr_li5: 'Для агентов: POST /api/ppr/quote',
    ppr_cta_btn: 'Купить кредиты →',
    // ─── Add-ons ───
    addons_eyebrow: 'Дополнения',
    addons_title: 'Прокачай свой тариф',
    addons_sub: 'Разовые покупки и ежемесячные дополнения для любого тарифа.',
    addon_1_name: 'Пак фингерпринтов',
    addon_1_desc: '20 профилей устройств',
    addon_1_price: '$9.99 разово',
    addon_2_name: 'Рецепты скрапинга',
    addon_2_desc: 'Instagram, LinkedIn, Amazon',
    addon_2_price: '$4.99/скрипт',
    addon_3_name: 'Sticky-сессия',
    addon_3_desc: 'Один IP на 24 часа',
    addon_3_price: '$2.99/день',
    addon_4_name: 'Приоритетная очередь',
    addon_4_desc: 'Без ожидания',
    addon_4_price: '+$5/мес',
    addon_5_name: 'Пак CAPTCHA',
    addon_5_desc: '1000 решений',
    addon_5_price: '$2.99',
    // ─── Affiliate ───
    affiliate_title: 'Предпочитаете свои прокси?',
    proxy_compare_title: 'Рекомендованные резидентные прокси',
    proxy_compare_sub: 'Все провайдеры ниже протестированы и совместимы с Human Browser. Укажи PROXY_HOST/USER/PASS в env — и всё работает.',
    proxy_compare_note: '💡 Не хочешь управлять прокси? Human Browser Starter — $13.99/мес. Прокси включён.',
    affiliate_desc: 'Протестированные провайдеры, совместимые с Human Browser. Выберите и укажите credentials в env vars.',
    aff_hb_title: 'Продвигай Human Browser. Зарабатывай 20%.',
    aff_hb_desc: 'Делись скиллом с разработчиками, AI-командами или скрейпинг-сообществами. Получай 20% с каждой их подписки — рекуррентно, навсегда.',
    aff_hb_cta: 'Получить реферальную ссылку →',
    aff_hb_note: 'Выплаты в USDT TRC-20 · Ежемесячно · Без минимума',
    aff_badge_50first: '50% комиссия',
    aff_badge_10life: '10% постоянно',
    aff_badge_25rec: '25% рекуррентно',
    aff_badge_nodemaven: '50% + 10% рекуррентно',
    aff_decodo_desc: 'Лучшая цена. 195M+ IP, 195 стран. Наш рекомендуемый выбор.',
    aff_iproyal_desc: 'Доступные ротируемые и sticky прокси. Оплата по факту.',
    aff_oxylabs_desc: 'Энтерпрайз-уровень. 175M+ IP, продвинутый геотаргетинг.',
    aff_nodemaven_desc: 'Высококачественные IP с отличными показателями успеха.',
    aff_webshare_desc: 'Лучшее соотношение цены и качества. Есть бесплатный тариф.',
    aff_brightdata_desc: 'Оригинал. Лучшее качество сети. Без партнёрской скидки.',
    aff_cta: 'Начать →',
    aff_cta_visit: 'Перейти →',
    // ─── Free vs Paid ───
    fvp_eyebrow: 'Что включено',
    fvp_title: 'Бесплатно vs Платно — без хитростей',
    fvp_sub: 'Скилл и код открыты и бесплатны. Платишь только за резидентный прокси — IP, который делает всё возможным.',
    free_tag: 'БЕСПЛАТНО навсегда',
    free_h3: 'Скилл OpenClaw + Скрипт',
    free_p: 'Всё необходимое для запуска браузера. Без карты и аккаунта.',
    free_li1_html: '✅ <code>browser-human.js</code> — полный исходный код',
    free_li2: '✅ Логика мыши, печати и скролла',
    free_li3: '✅ Фингерпринты iPhone 15 Pro + Desktop',
    free_li4: '✅ Антидетекция (webdriver=false и т.д.)',
    free_li5: '✅ Скилл OpenClaw через clawhub',
    free_li6: '✅ Все будущие обновления скрипта',
    free_li7: '⚠️ Нужен свой резидентный прокси',
    free_li8: '⚠️ Без резидентного IP — сайты заблокируют тебя',
    paid_tag: 'от $13.99/мес',
    paid_h3: 'Credentials резидентного прокси',
    paid_p: 'Недостающий элемент. Настоящий домашний IP, делающий твой браузер невидимым для антибот-систем.',
    paid_li1: '✅ RO / US / UK / DE / NL / JP IPs',
    paid_li2: '✅ Настоящий ISP (DIGI, AT&T, BT…)',
    paid_li3: '✅ Мгновенная доставка credentials после оплаты',
    paid_li4_html: '✅ Работает из коробки с <code>browser-human.js</code>',
    paid_li5: '✅ Не нужен аккаунт Bright Data',
    paid_li6: '✅ Поддержка по email включена',
    paid_li7: '✅ Отмена в любой момент',
    paid_cta: 'Смотреть планы →',
    fvp_why_h: 'Зачем вообще нужен резидентный IP?',
    fvp_why_p: 'IP дата-центров (AWS, DigitalOcean, Hetzner — обычный VPS) мгновенно распознаются и блокируются Cloudflare, Instagram, LinkedIn и большинством современных сайтов. Резидентный IP приходит с настоящего домашнего подключения — он выглядит как обычный человек в сети. Это единственная разница между баном за 2 секунды и бесконечным скрапингом.',
    // ─── Payment methods ───
    pay_eyebrow: 'Оплата',
    pay_title: 'Платите любым удобным способом',
    pay_sub: 'Карта, Apple Pay, Google Pay или крипта. Credentials доставляются автоматически.',
    pm1_h: 'Карта / Apple Pay / Google Pay',
    pm1_p: 'Обрабатывается Stripe. Visa, Mastercard, Amex. Apple Pay и Google Pay поддерживаются. Подписка продлевается ежемесячно.',
    pm1_s1: 'Нажмите «Начать» на любом плане',
    pm1_s2: 'Выберите карту / Apple Pay / Google Pay',
    pm1_s3: 'Оплатите → credentials доставлены мгновенно',
    pm2_h: 'USDT TRC-20',
    pm2_p: 'Самый популярный криптовариант. Точная сумма на адрес кошелька. Автоподтверждение через 0xProcessing.',
    pm2_s1: 'Нажмите «Начать» → выберите USDT TRC-20',
    pm2_s2: 'Получите адрес кошелька + точную сумму',
    pm2_s3: 'Отправьте → credentials за ~2 мин',
    pm3_h: 'Solana / ETH / BTC',
    pm3_p: 'Принимаются все основные блокчейны. Тот же автоматический поток — без ручного подтверждения.',
    pm3_s1: 'Выберите монету в панели оплаты',
    pm3_s2: 'Получите адрес для нужной сети',
    pm3_s3: 'Отправьте → credentials придут автоматически',
    pm4_h: 'AI-агент (API)',
    pm4_p: 'Ваш агент может купить credentials программно. Полный JSON API — машиночитаемые ответы.',
    pm4_s1_html: 'Агент: <code>GET /api/plans</code>',
    pm4_s2_html: 'Агент: <code>POST /api/buy {currency:"USDT"}</code>',
    pm4_s3_html: 'Агент платит → поллит <code>GET /api/status/:id</code>',
    pay_guar1: '🔒 Credentials доставляются в течение 10 минут после подтверждения оплаты.',
    pay_guar2: '❌ Не устраивает? Полный возврат в течение 24ч — без вопросов.',
    // ─── FAQ ───
    faq_eyebrow: 'FAQ',
    faq_title: 'Частые вопросы',
    faq_1q: 'Нужен ли мне Mac Mini или десктоп?',
    faq_1a: 'Нет. Human Browser работает на любом Linux VPS, Docker-контейнере или облачном сервере. VPS за $5/мес (Hetzner, Contabo) — всё что нужно. Без display-сервера, VNC, X11 — только Node.js и Chromium.',
    faq_2q: 'Что именно бесплатно, а что стоит денег?',
    faq_2a_html: 'Скрипт browser-human.js и скилл OpenClaw полностью бесплатны — открытый код, установите в любой момент. Платная подписка даёт вам <strong>credentials резидентного прокси</strong>: настоящий домашний IP-адрес от DIGI Romania, AT&T, BT и т.д. Без резидентного IP антибот-системы мгновенно заблокируют IP вашего VPS.',
    faq_3q: 'Почему Румыния? Можно использовать другие страны?',
    faq_3a: 'Румыния — самый дешёвый вариант и работает для большинства задач: Instagram, LinkedIn, Binance, Polymarket, сайты с Cloudflare. Также доступны США, Великобритания, Германия, Нидерланды и Япония. Используйте выбор страны выше, чтобы увидеть где что работает.',
    faq_4q: 'Как быстро придут credentials после оплаты?',
    faq_4a: 'Карта (Stripe): 2–3 минуты. USDT TRC-20: 1–3 минуты (сеть Tron быстрая). ETH/BTC: 5–15 минут. API AI-агента: полностью автоматически.',
    faq_5q: 'Может ли мой AI-агент купить это автоматически?',
    faq_5a_html: 'Да — именно для этого всё и создано. Вызовите <code>GET humanbrowser.dev/api/plans</code>, затем <code>POST /buy</code> с нужной валютой. Получите адрес для крипто-оплаты. Агент отправляет платёж, поллит <code>GET /status/:id</code>, получает credentials в ответе. Ноль участия человека.',
    faq_6q: 'Обходит ли это Cloudflare / DataDome / PerimeterX?',
    faq_6a: 'Да, в подавляющем большинстве случаев. Комбинация резидентного IP + реалистичного фингерпринта браузера (iPhone 15 Pro) + симуляции поведения человека (мышь Безье, натуральная печать, паттерны скролла) проходит все основные антибот-системы. Мы тестировали против всех трёх.',
    faq_7q: 'Что такое скилл OpenClaw?',
    faq_7a_html: 'OpenClaw — платформа для AI-агентов. Скиллы — переиспользуемые пакеты возможностей: установите один и ваш агент получает специализированные знания и инструменты. Скилл Human Browser даёт вашему агенту OpenClaw возможность запустить стелс-браузер одним вызовом функции: <code>launchHuman()</code>.',
    faq_8q: 'Как отменить подписку?',
    faq_8a_html: 'Напишите <a href="https://t.me/virixlabs" target="_blank">@virixlabs</a> в Telegram. Отменим подписку сразу. Если с момента покупки прошло менее 24ч — полный возврат средств без вопросов.',
    // ─── Footer / Virix ───
    vx_h3: 'Создано Virix Labs',
    vx_p: 'AI-студия, создающая сфокусированные продукты в масштабе. Human Browser — часть экосистемы скиллов OpenClaw: инструменты, позволяющие AI-агентам работать без участия человека.',
    footer_copy: '© 2026 Virix Labs · Без Mac Mini · Работает на любом сервере',
    footer_blog: 'Blog',
    footer_install: 'Install',
    footer_clawhub: 'ClawHub',
    footer_openclaw: 'OpenClaw',
    footer_virix: 'Virix Labs',
    footer_support: 'Поддержка',
    // ─── Agent Modal ───
    modal_title:        'Отправьте это своему OpenClaw агенту',
    modal_sub:          'Агент установит скилл, выберет план и начнёт серфить как человек — никаких ручных настроек.',
    modal_cmd_label:    'КОМАНДА УСТАНОВКИ',
    modal_tap_copy:     '📋 нажмите чтобы скопировать',
    modal_msg_label:    'ИЛИ ОТПРАВЬТЕ ЭТО СООБЩЕНИЕ АГЕНТУ',
    modal_msg:          'Установи скилл Human Browser и используй его всегда, когда мне нужно зайти в интернет — Instagram, LinkedIn, Binance, сайты с защитой Cloudflare или любые страницы, которые блокируют ботов. У него настоящий резидентный IP и фингерпринт iPhone 15 Pro — антибот-системы не заблокируют. Установка: clawhub install human-browser',
    modal_tap_copy2:    '📋 нажмите чтобы скопировать',
    modal_clawhub:      'Открыть на ClawHub →',
    modal_github:       'GitHub ↗',
    modal_support_html: 'Нужна помощь? <a href="https://t.me/virixlabs" target="_blank">@virixlabs</a> в Telegram',
    // ─── Payment sheet ───
    sheet_tab_card: '💳 Карта · Apple Pay · Google Pay',
    sheet_tab_crypto: '₿ Крипта',
    sheet_loading: 'Загрузка безопасной оплаты…',
    // ─── Rotating phrases ───
    rotating: [
      "думает, что он человек",
      "проходит любой fingerprint-чек",
      "двигается как живой",
      "обходит Cloudflare всегда",
      "понятия не имеет, что он бот",
      "читает, скроллит, печатает — как ты",
      "живёт на твоём сервере бесплатно",
      "никогда не триггерит CAPTCHA",
    ],
  },

  es: {
    // ─── Hero ───
    hero_pill:     'Cualquier país · IP residencial · Cero bloqueos',
    hero_prefix:   'El navegador que',
    hero_desc:     '<span class="no-mac-hl">Sin Mac Mini.</span> Sin configuración local. Un navegador Playwright completo que corre en cualquier servidor, parece un dispositivo real y evita todo sistema anti-bot.',
    install_intro: 'Hecho para OpenClaw — solo envía esto a tu agente, él se encarga de todo',
    install_available: 'Disponible en',
    // ─── Nav ───
    nav_features:  'Características',
    nav_pricing:   'Precios',
    nav_how:       'Cómo funciona',
    nav_cta:       'Empezar →',
    nav_mobile_skill: 'Skill ClawHub (gratis)',
    trial_desc: 'Sin registro. Sin tarjeta. Solo toma las credenciales y empieza.',
    trial_cta:  'Obtener credenciales →',
    // ─── Trust bar ───
    trust_1: 'Evita Cloudflare',
    trust_2: 'Evita DataDome',
    trust_3: 'Evita PerimeterX',
    trust_4: 'IP residencial',
    trust_5: 'Cualquier servidor Linux',
    trust_6: 'Skill nativo de OpenClaw',
    // ─── Code preview ───
    code_label: '5 líneas · cualquier servidor · cero bloqueos',
    code_c1: 'scroll suave con variación',
    code_c2: '60–220ms/carácter',
    code_c3: 'IP residencial · huella iPhone 15 · webdriver=false',
    // ─── Callout ───
    callout_h2: 'Deja de comprar <span class="grad">hardware</span><br>para tu agente de IA',
    callout_p:  'La mayoría de guías asumen que tienes un Mac Mini, VPS de escritorio o suscripción a un navegador cloud de $500/mes. Human Browser corre en un VPS de $5. Nada más.',
    callout_li1: 'Sin servidor de pantalla, VNC ni escritorio',
    callout_li2: 'Chromium headless + proxy residencial = huella humana real',
    callout_li3: 'UA iPhone 15 Pro · IP residencial · geolocalización local',
    callout_li4: 'Ratón Bezier · velocidad de escritura humana · scroll natural',
    callout_li5: 'Funciona en Docker, GitHub Actions, cualquier CI/CD',
    cmp_h1: 'Solución',
    cmp_h2: 'Costo',
    cmp_h3: 'Anti-bot',
    cmp_r1_bot: 'IP de datacenter',
    cmp_r2_bot: 'Parcial',
    cmp_r3_bot: 'Bloqueado al instante',
    cmp_r4_bot: '✓ Bypass completo',
    // ─── Country picker ───
    countries_eyebrow: 'IPs Residenciales',
    countries_title:   'Elige tu país — ve qué funciona',
    countries_sub:     'Diferentes servicios bloquean diferentes IPs. Elige una ubicación y ve al instante qué plataformas son accesibles. Tu agente elige el país automáticamente.',
    country_note: '* Compatibilidad basada en el comportamiento típico de IPs residenciales. Puede variar según el ISP.',
    // ─── Features ───
    features_eyebrow: 'Características',
    features_title:   'Todo lo que detectan los bots — cubierto',
    features_sub:     'Cada señal que Cloudflare, DataDome y PerimeterX comprueban. Gestionada antes de escribir una línea de código.',
    feat_1_h: 'IP Residencial · 6 Países',
    feat_1_p: 'ISPs residenciales reales — Rumania, EE.UU., UK, Alemania, Países Bajos y Japón. Tu agente parece una persona local navegando desde casa.',
    feat_2_h: 'Huella iPhone 15 Pro',
    feat_2_p: 'UA Safari iOS 17.4.1, viewport correcto, pixel ratio, eventos táctiles, plataforma. Pasa todas las verificaciones.',
    feat_3_h: 'Curvas de Ratón Bezier',
    feat_3_p: 'Movimiento por trayectorias curvas aleatorias. Los humanos nunca van en línea recta — este navegador tampoco.',
    feat_4_h: 'Velocidad de Escritura Humana',
    feat_4_p_html: '60–220ms por tecla con pausas. Funciona con inputs de React donde <code>page.fill()</code> falla silenciosamente.',
    feat_5_h: 'Scroll Natural',
    feat_5_p: 'Desplazamiento suave con variación aleatoria. Hace pausas para leer. Se ve exactamente como un usuario real.',
    feat_6_h: 'Anti-detección Completa',
    feat_6_p_html: '<code>webdriver=false</code>, sin flags de automatización, lista real de plugins, canvas fingerprint, timezone y geo reales.',
    feat_7_h: 'Skill Nativo de OpenClaw',
    feat_7_p_html: 'Instalación en un comando: <code>clawhub install human-browser</code>. Tu agente lo obtiene al instante.',
    feat_8_h: 'Modo Escritorio',
    feat_8_p_html: 'Cambia a huella Windows Chrome cuando lo necesites: <code>launchHuman({ mobile: false })</code>.',
    feat_9_h: 'Cualquier Servidor, Sin Configuración',
    feat_9_p: 'Linux básico, Docker, CI/CD. Solo Node.js + Chromium. Sin servidor de pantalla, VNC, X11.',
    // ─── How it works ───
    how_eyebrow: 'Cómo funciona',
    how_title: 'Construido para agentes de IA,<br>no solo para humanos',
    how_sub: 'La API habla el idioma del agente. Paga con cripto. Obtén credenciales programáticamente. Sin paneles que clickear.',
    step_1_h_html: 'El agente llama <code>GET humanbrowser.dev/api/plans</code>',
    step_1_p: 'Ve precios, ancho de banda y divisas soportadas. JSON legible por máquinas.',
    step_2_h_html: 'El agente llama <code>POST /buy</code>',
    step_2_p: 'Elige plan + divisa (USDT, ETH, BTC o tarjeta). Recibe dirección de pago.',
    step_3_h: 'Pago confirmado automáticamente',
    step_3_p: 'Se activa el webhook de 0xProcessing o Stripe. Credenciales listas en segundos.',
    step_4_h_html: 'El agente consulta <code>GET /status/:id</code>',
    step_4_p_html: 'Obtiene credenciales proxy + clave API. Las guarda en <code>.env</code>. Empieza a navegar.',
    how_code_label: 'Flujo de compra del agente',
    how_or_card: 'O paga con tarjeta — mismo flujo, se devuelve enlace de Stripe checkout en su lugar.',
    // ─── Pricing ───
    pricing_eyebrow: 'Precios',
    pricing_title: 'Precios simples y transparentes',
    pricing_sub: 'Todos los planes incluyen credenciales proxy + skill OpenClaw. Tarjeta, Apple Pay, Google Pay o cripto. Cancela cuando quieras.',
    plan_pop_tag: 'Más Popular',
    plan_starter_usage: '2GB residencial Romania',
    plan_pro_usage: '20GB multi-país · 10+ países',
    plan_ent_usage: '100GB · IPs dedicadas · SLA',
    starter_li1: '2GB IP residencial Romania',
    starter_li2: 'Skill Human Browser incluido',
    starter_li3: 'Huella iPhone 15 Pro',
    starter_li4: 'Soporte básico (Telegram)',
    pro_li1: '20GB multi-país (10+ países)',
    pro_li2: 'Todos los perfiles de huella',
    pro_li3: '100 resoluciones CAPTCHA/mes incluidas',
    pro_li4: 'Cola prioritaria',
    pro_li5: 'Soporte prioritario',
    ent_li1: '100GB de ancho de banda',
    ent_li2: 'IPs sticky dedicadas',
    ent_li3: 'Perfiles de huella personalizados',
    ent_li4: 'Acceso API (REST)',
    ent_li5: 'Canal de soporte dedicado',
    ent_li6: 'SLA',
    // ─── Pay-per-Request ───
    plan_ppr_badge: 'Próximamente',
    plan_ppr_name: 'API Pay-per-Request',
    plan_ppr_per: '–$0.005/req',
    plan_ppr_usage: 'Sin compromiso mensual · Para agentes IA',
    ppr_li1: 'Solicitud básica: $0.001',
    ppr_li2: 'Cloudflare/JS-heavy: $0.005',
    ppr_li3: 'Resolución CAPTCHA: $0.003',
    ppr_li4: 'Paga con USDT, ETH, BTC, SOL o tarjeta',
    ppr_li5: 'Auto-compra: los agentes compran sus propios créditos',
    ppr_notify_btn: '🔔 Notificarme cuando esté listo',
    // ─── Add-ons ───
    addons_eyebrow: 'Complementos',
    addons_title: 'Potencia tu configuración',
    addons_sub: 'Compras únicas y extras mensuales para personalizar cualquier plan.',
    addon_1_name: 'Pack de Huellas',
    addon_1_desc: '20 perfiles de dispositivo',
    addon_1_price: '$9.99 único',
    addon_2_name: 'Recetas de Scraping',
    addon_2_desc: 'Instagram, LinkedIn, Amazon',
    addon_2_price: '$4.99/script',
    addon_3_name: 'Sesión Sticky',
    addon_3_desc: 'Misma IP por 24h',
    addon_3_price: '$2.99/día',
    addon_4_name: 'Cola Prioritaria',
    addon_4_desc: 'Salta la cola',
    addon_4_price: '+$5/mes',
    addon_5_name: 'Bundle CAPTCHA',
    addon_5_desc: '1000 resoluciones',
    addon_5_price: '$2.99',
    // ─── Affiliate ───
    affiliate_title: '¿Prefieres proxies propios?',
    proxy_compare_title: 'Proxies residenciales recomendados',
    proxy_compare_sub: 'Todos los proveedores están probados y son compatibles con Human Browser. Configura PROXY_HOST/USER/PASS en tus variables de entorno.',
    proxy_compare_note: '💡 ¿No quieres gestionar proxies? Human Browser Starter — $13.99/mes incluye una IP residencial.',
    affiliate_desc: 'Proveedores probados y compatibles con Human Browser. Elige uno e introduce las credenciales en tus variables de entorno.',
    aff_hb_title: 'Promociona Human Browser. Gana 20%.',
    aff_hb_desc: 'Comparte el skill con desarrolladores, equipos de IA o comunidades de scraping. Gana el 20% de cada suscripción — recurrente, para siempre.',
    aff_hb_cta: 'Obtener tu enlace de referido →',
    aff_hb_note: 'Pagos en USDT TRC-20 · Mensual · Sin mínimo',
    aff_badge_50first: '50% comisión',
    aff_badge_10life: '10% de por vida',
    aff_badge_25rec: '25% recurrente',
    aff_badge_nodemaven: '50% + 10% recurrente',
    aff_decodo_desc: 'Mejor relación precio/calidad. 195M+ IPs, 195 países. Nuestra recomendación.',
    aff_iproyal_desc: 'Proxies residenciales rotativos y sticky a buen precio. Pago por uso.',
    aff_oxylabs_desc: 'Nivel enterprise. 175M+ IPs, geotargeting avanzado.',
    aff_nodemaven_desc: 'IPs de alta calidad con excelentes tasas de éxito.',
    aff_webshare_desc: 'Mejor relación calidad/precio. Nivel gratuito disponible.',
    aff_brightdata_desc: 'El original. Mejor calidad de red. Sin descuento de afiliado.',
    aff_cta: 'Empezar →',
    aff_cta_visit: 'Visitar →',
    // ─── Free vs Paid ───
    fvp_eyebrow: 'Qué incluye',
    fvp_title: 'Gratis vs Pago — sin trucos',
    fvp_sub: 'El skill y el código son abiertos y gratuitos. Solo pagas por el proxy residencial — la IP que hace funcionar todo.',
    free_tag: 'GRATIS para siempre',
    free_h3: 'Skill OpenClaw + Script',
    free_p: 'Todo lo que necesitas para ejecutar el navegador. Sin tarjeta ni cuenta.',
    free_li1_html: '✅ <code>browser-human.js</code> — código fuente completo',
    free_li2: '✅ Lógica de ratón, escritura y scroll humanos',
    free_li3: '✅ Huellas iPhone 15 Pro + Escritorio',
    free_li4: '✅ Stack anti-detección (webdriver=false, etc.)',
    free_li5: '✅ Skill OpenClaw vía clawhub',
    free_li6: '✅ Todas las actualizaciones futuras',
    free_li7: '⚠️ Necesitas tu propio proxy residencial',
    free_li8: '⚠️ Sin IP residencial — los sitios te bloquearán',
    paid_tag: 'desde $13.99/mes',
    paid_h3: 'Credenciales de Proxy Residencial',
    paid_p: 'La pieza que falta. Una IP doméstica real que hace invisible tu navegador para los sistemas anti-bot.',
    paid_li1: '✅ IPs Romania / EEUU / UK / DE / NL / JP',
    paid_li2: '✅ ISP residencial real (DIGI, AT&T, BT…)',
    paid_li3: '✅ Entrega instantánea de credenciales',
    paid_li4_html: '✅ Funciona listo con <code>browser-human.js</code>',
    paid_li5: '✅ No necesitas cuenta en Bright Data',
    paid_li6: '✅ Soporte por email incluido',
    paid_li7: '✅ Cancela cuando quieras',
    paid_cta: 'Ver Planes →',
    fvp_why_h: '¿Por qué necesitas una IP residencial?',
    fvp_why_p: 'Las IPs de datacenter (AWS, DigitalOcean, Hetzner — tu VPS habitual) son reconocidas y bloqueadas instantáneamente por Cloudflare, Instagram, LinkedIn y la mayoría de sitios modernos. Una IP residencial proviene de una conexión doméstica real — se ve exactamente como una persona normal navegando. Esa es la única diferencia entre ser bloqueado en 2 segundos y hacer scraping para siempre.',
    // ─── Payment methods ───
    pay_eyebrow: 'Pago',
    pay_title: 'Paga como quieras',
    pay_sub: 'Tarjeta, Apple Pay, Google Pay o cripto. Credenciales entregadas automáticamente.',
    pm1_h: 'Tarjeta / Apple Pay / Google Pay',
    pm1_p: 'Procesado por Stripe. Visa, Mastercard, Amex. Apple Pay y Google Pay soportados. Suscripción mensual automática.',
    pm1_s1: 'Haz clic en Empezar en cualquier plan',
    pm1_s2: 'Elige Tarjeta / Apple Pay / Google Pay',
    pm1_s3: 'Paga → credenciales entregadas al instante',
    pm2_h: 'USDT TRC-20',
    pm2_p: 'La opción cripto más popular. Monto exacto a dirección de cartera. Confirmado automáticamente por 0xProcessing.',
    pm2_s1: 'Haz clic en Empezar → elige USDT TRC-20',
    pm2_s2: 'Obtén dirección + monto exacto',
    pm2_s3: 'Envía → credenciales en ~2 min',
    pm3_h: 'Solana / ETH / BTC',
    pm3_p: 'Se aceptan todas las blockchains principales. Mismo flujo automático — sin aprobación manual.',
    pm3_s1: 'Elige tu moneda en el panel de pago',
    pm3_s2: 'Obtén dirección específica de red',
    pm3_s3: 'Envía → credenciales entregadas automáticamente',
    pm4_h: 'Agente IA (API)',
    pm4_p: 'Tu agente puede comprar credenciales programáticamente. API JSON completa — respuestas legibles por máquinas.',
    pm4_s1_html: 'Agente: <code>GET /api/plans</code>',
    pm4_s2_html: 'Agente: <code>POST /api/buy {currency:"USDT"}</code>',
    pm4_s3_html: 'Agente paga → consulta <code>GET /api/status/:id</code>',
    pay_guar1: '🔒 Credenciales entregadas en 10 minutos tras confirmación de pago.',
    pay_guar2: '❌ ¿No estás satisfecho? Reembolso completo en 24h — sin preguntas.',
    // ─── FAQ ───
    faq_eyebrow: 'FAQ',
    faq_title: 'Preguntas frecuentes',
    faq_1q: '¿Necesito un Mac Mini o computadora de escritorio?',
    faq_1a: 'No. Human Browser corre en cualquier VPS Linux, contenedor Docker o servidor cloud. Un VPS de $5/mes (Hetzner, Contabo) es todo lo que necesitas. Sin servidor de pantalla, VNC, X11 — solo Node.js y Chromium.',
    faq_2q: '¿Qué es gratis y qué cuesta dinero?',
    faq_2a_html: 'El script browser-human.js y el skill OpenClaw son completamente gratuitos — código abierto, instala cuando quieras. La suscripción paga te da <strong>credenciales de proxy residencial</strong>: una IP doméstica real de DIGI Romania, AT&T, BT, etc. Sin IP residencial, los sistemas anti-bot bloquearán la IP de datacenter de tu VPS al instante.',
    faq_3q: '¿Por qué Romania? ¿Puedo usar otros países?',
    faq_3a: 'Romania es la opción más económica y funciona para la mayoría de tareas — Instagram, LinkedIn, Binance, Polymarket, sitios con Cloudflare. También ofrecemos EEUU, UK, Alemania, Países Bajos y Japón.',
    faq_4q: '¿Cuánto tardo en recibir las credenciales?',
    faq_4a: 'Pagos con tarjeta via Stripe: 2–3 minutos. Cripto (USDT/ETH): 5–10 minutos tras confirmación on-chain. API de agente IA: completamente automático, sin intervención humana.',
    faq_5q: '¿Puede mi agente IA comprar esto automáticamente?',
    faq_5a_html: 'Sí — ese es el punto. Llama a <code>GET humanbrowser.dev/api/plans</code>, luego <code>POST /buy</code> con tu divisa preferida. Recibirás una dirección de pago cripto. Tu agente envía el pago, consulta <code>GET /status/:id</code>, y recibe las credenciales en la respuesta. Cero intervención humana.',
    faq_6q: '¿Esto evita Cloudflare / DataDome / PerimeterX?',
    faq_6a: 'Sí, en la gran mayoría de casos. La combinación de IP residencial + huella de navegador realista (iPhone 15 Pro) + simulación de comportamiento humano (ratón Bezier, escritura natural, patrones de scroll) supera todos los principales sistemas anti-bot. Hemos probado contra los tres.',
    faq_7q: '¿Qué es un skill de OpenClaw?',
    faq_7a_html: 'OpenClaw es una plataforma de agentes IA. Los skills son paquetes de capacidades reutilizables — instala uno y tu agente obtiene conocimiento especializado y herramientas. El skill Human Browser le da a tu agente OpenClaw la capacidad de lanzar un navegador sigiloso con una llamada: <code>launchHuman()</code>.',
    faq_8q: '¿Qué hago si quiero cancelar?',
    faq_8a_html: 'Escribe a <a href="https://t.me/virixlabs" target="_blank">@virixlabs</a> en Telegram. Cancelaremos tu suscripción de inmediato. Si es dentro de las 24h de la compra, obtienes reembolso completo — sin preguntas.',
    // ─── Footer / Virix ───
    vx_h3: 'Construido por Virix Labs',
    vx_p: 'Estudio de ventures impulsado por IA que crea productos enfocados a escala. Human Browser es parte del ecosistema de skills de OpenClaw — herramientas que permiten a los agentes IA trabajar sin cuellos de botella humanos.',
    footer_copy: '© 2026 Virix Labs · Sin Mac Mini · Corre en cualquier servidor',
    footer_blog: 'Blog',
    footer_install: 'Install',
    footer_clawhub: 'ClawHub',
    footer_openclaw: 'OpenClaw',
    footer_virix: 'Virix Labs',
    footer_support: 'Soporte',
    // ─── Agent Modal ───
    modal_title:        'Envía esto a tu agente OpenClaw',
    modal_sub:          'Tu agente instalará el skill, elegirá un plan y navegará como humano — sin configuración manual.',
    modal_cmd_label:    'COMANDO DE INSTALACIÓN',
    modal_tap_copy:     '📋 toca para copiar',
    modal_msg_label:    'O ENVÍA ESTE MENSAJE A TU AGENTE',
    modal_msg:          'Instala el skill Human Browser y úsalo siempre que navegue — Instagram, LinkedIn, Binance, sitios protegidos por Cloudflare. Usa IP residencial real y huella iPhone 15 Pro. Instala con: clawhub install human-browser',
    modal_tap_copy2:    '📋 toca para copiar',
    modal_clawhub:      'Ver en ClawHub →',
    modal_github:       'GitHub ↗',
    modal_support_html: '¿Necesitas ayuda? <a href="https://t.me/virixlabs" target="_blank">@virixlabs</a> en Telegram',
    // ─── Payment sheet ───
    sheet_tab_card: '💳 Tarjeta · Apple Pay · Google Pay',
    sheet_tab_crypto: '₿ Cripto',
    sheet_loading: 'Cargando checkout seguro…',
    // ─── Rotating phrases ───
    rotating: [
      "cree que es humano",
      "pasa cada verificación de huella digital",
      "se mueve como una persona real",
      "evita Cloudflare siempre",
      "no sabe que es un bot",
      "lee, hace scroll, escribe — como tú",
      "vive gratis en tu servidor",
      "nunca activa un CAPTCHA",
    ],
  },

  zh: {
    // ─── Hero ───
    hero_pill:     '任意国家 · 住宅IP · 零封禁',
    hero_prefix:   '这个浏览器',
    hero_desc:     '<span class="no-mac-hl">无需Mac Mini，</span>无需本地配置。完整的Playwright浏览器，可在任何服务器上运行，看起来像真实设备，绕过所有反爬虫系统。',
    install_intro: '专为 OpenClaw 打造 — 把这条命令发给你的Agent，它会搞定一切',
    install_available: '可用平台',
    // ─── Nav ───
    nav_features:  '功能',
    nav_pricing:   '定价',
    nav_how:       '工作原理',
    nav_cta:       '立即开始 →',
    nav_mobile_skill: 'ClawHub技能（免费）',
    trial_desc: '无需注册，无需信用卡。直接获取凭证，立即开始。',
    trial_cta:  '获取凭证 →',
    // ─── Trust bar ───
    trust_1: '绕过 Cloudflare',
    trust_2: '绕过 DataDome',
    trust_3: '绕过 PerimeterX',
    trust_4: '住宅IP',
    trust_5: '任意Linux服务器',
    trust_6: 'OpenClaw原生技能',
    // ─── Code preview ───
    code_label: '5行代码 · 任意服务器 · 零封禁',
    code_c1: '自然滚动带随机抖动',
    code_c2: '60–220毫秒/字符',
    code_c3: '住宅IP · iPhone 15指纹 · webdriver=false',
    // ─── Callout ───
    callout_h2: '不要再为AI代理买<span class="grad">硬件</span>了',
    callout_p:  '大多数浏览器自动化教程都假设你有Mac Mini、桌面VPS或每月500美元的云浏览器订阅。Human Browser只需5美元的Linux VPS，仅此而已。',
    callout_li1: '无需显示服务器、VNC或桌面环境',
    callout_li2: '无头Chromium + 住宅代理 = 真实人类指纹',
    callout_li3: 'iPhone 15 Pro UA · 住宅IP · 本地地理位置',
    callout_li4: '贝塞尔曲线鼠标 · 人类打字速度 · 自然滚动',
    callout_li5: '支持Docker、GitHub Actions、任意CI/CD流水线',
    cmp_h1: '方案',
    cmp_h2: '费用',
    cmp_h3: '反爬',
    cmp_r1_bot: '数据中心IP',
    cmp_r2_bot: '部分',
    cmp_r3_bot: '立即封禁',
    cmp_r4_bot: '✓ 完全绕过',
    // ─── Country picker ───
    countries_eyebrow: '住宅IP',
    countries_title:   '选择国家 — 查看可用服务',
    countries_sub:     '不同服务封锁不同IP。选择地区，即时查看哪些平台可访问。您的Agent自动选择合适的国家。',
    country_note: '* 兼容性基于住宅IP的典型行为，可能因ISP不同而有所差异。',
    // ─── Features ───
    features_eyebrow: '功能特点',
    features_title:   '反检测全覆盖',
    features_sub:     'Cloudflare、DataDome和PerimeterX检测的每个信号，在您写代码之前就已处理完毕。',
    feat_1_h: '住宅IP · 6个国家',
    feat_1_p: '真实家庭ISP — 罗马尼亚、美国、英国、德国、荷兰和日本。您的代理看起来就像当地居民在家上网。',
    feat_2_h: 'iPhone 15 Pro指纹',
    feat_2_p: 'iOS 17.4.1 Safari UA，正确的viewport、pixel ratio、触摸事件和平台字符串。通过所有指纹检测。',
    feat_3_h: '贝塞尔曲线鼠标',
    feat_3_p: '沿随机曲线路径移动。人类从不走直线——这个浏览器也不会。',
    feat_4_h: '人类打字速度',
    feat_4_p_html: '每键60–220毫秒，带词中停顿。支持React输入框（<code>page.fill()</code>在这里会静默失败）。',
    feat_5_h: '自然滚动行为',
    feat_5_p: '分步平滑滚动带随机抖动，暂停如同在阅读内容。看起来和真实用户完全一样。',
    feat_6_h: '完整反检测',
    feat_6_p_html: '<code>webdriver=false</code>，无自动化标志，真实插件列表，canvas指纹，真实时区和地理位置。',
    feat_7_h: 'OpenClaw原生技能',
    feat_7_p_html: '一条命令安装：<code>clawhub install human-browser</code>。你的Agent立即获得它。',
    feat_8_h: '桌面模式',
    feat_8_p_html: '需要时切换到Windows Chrome指纹：<code>launchHuman({ mobile: false })</code>。',
    feat_9_h: '任意服务器，零配置',
    feat_9_p: '裸Linux、Docker、CI/CD，只需Node.js + Chromium，无需显示服务器、VNC或X11。',
    // ─── How it works ───
    how_eyebrow: '工作原理',
    how_title: '专为AI代理构建，<br>不只是人类',
    how_sub: 'API以代理语言对话。用加密货币付款。以编程方式获取凭据。无需点击任何仪表板。',
    step_1_h_html: '代理调用 <code>GET humanbrowser.dev/api/plans</code>',
    step_1_p: '获取定价、带宽和支持的货币。机器可读的JSON。',
    step_2_h_html: '代理调用 <code>POST /buy</code>',
    step_2_p: '选择方案和货币（USDT、ETH、BTC或信用卡），获得支付地址。',
    step_3_h: '支付自动确认',
    step_3_p: '0xProcessing或Stripe webhook触发，凭据在数秒内准备就绪。',
    step_4_h_html: '代理轮询 <code>GET /status/:id</code>',
    step_4_p_html: '获取代理凭据和API密钥，写入<code>.env</code>，开始浏览。',
    how_code_label: '代理购买流程',
    how_or_card: '或者刷卡支付——同样的流程，返回Stripe结账链接。',
    // ─── Pricing ───
    pricing_eyebrow: '定价',
    pricing_title: '简单透明的价格',
    pricing_sub: '所有方案包含代理凭据和OpenClaw技能。信用卡、Apple Pay、Google Pay或加密货币。随时取消。',
    plan_pop_tag: '最受欢迎',
    plan_starter_usage: '2GB 罗马尼亚住宅',
    plan_pro_usage: '20GB 多国 · 10+国家',
    plan_ent_usage: '100GB · 专属IP · SLA',
    starter_li1: '2GB 罗马尼亚住宅IP',
    starter_li2: 'Human Browser技能已包含',
    starter_li3: 'iPhone 15 Pro指纹',
    starter_li4: '基础支持（Telegram）',
    pro_li1: '20GB多国（10+国家）',
    pro_li2: '全部指纹档案',
    pro_li3: '每月100次CAPTCHA解决',
    pro_li4: '优先队列',
    pro_li5: '优先支持',
    ent_li1: '100GB带宽',
    ent_li2: '专属Sticky IP',
    ent_li3: '自定义指纹档案',
    ent_li4: 'API访问（REST）',
    ent_li5: '专属支持渠道',
    ent_li6: 'SLA保障',
    // ─── Pay-per-Request ───
    plan_ppr_badge: '即将推出',
    plan_ppr_name: '按请求付费API',
    plan_ppr_per: '–$0.005/请求',
    plan_ppr_usage: '无月费承诺 · 专为AI代理设计',
    ppr_li1: '基础请求：$0.001',
    ppr_li2: 'Cloudflare/JS-heavy：$0.005',
    ppr_li3: 'CAPTCHA解决：$0.003',
    ppr_li4: '支持USDT、ETH、BTC、SOL或信用卡',
    ppr_li5: '自动购买：代理自行充值积分',
    ppr_notify_btn: '🔔 上线时通知我',
    // ─── Add-ons ───
    addons_eyebrow: '附加功能',
    addons_title: '强化你的配置',
    addons_sub: '一次性购买和每月附加功能，适配任意套餐。',
    addon_1_name: '指纹包',
    addon_1_desc: '20个设备档案',
    addon_1_price: '$9.99 一次性',
    addon_2_name: '爬取配方',
    addon_2_desc: 'Instagram、LinkedIn、Amazon',
    addon_2_price: '$4.99/脚本',
    addon_3_name: 'Sticky会话',
    addon_3_desc: '同一IP持续24小时',
    addon_3_price: '$2.99/天',
    addon_4_name: '优先队列',
    addon_4_desc: '跳过等待',
    addon_4_price: '+$5/月',
    addon_5_name: 'CAPTCHA包',
    addon_5_desc: '1000次解决',
    addon_5_price: '$2.99',
    // ─── Affiliate ───
    affiliate_title: '偏好自托管代理？',
    proxy_compare_title: '推荐的住宅代理商',
    proxy_compare_sub: '以下所有代理商均经过测试，与Human Browser完全兼容。在环境变量中设置PROXY_HOST/USER/PASS即可使用。',
    proxy_compare_note: '💡 不想管理代理？Human Browser Starter $13.99/月，包含住宅IP。',
    affiliate_desc: '经过测试的代理商，与Human Browser完全兼容。选择一家并在环境变量中设置凭据。',
    aff_hb_title: '推广Human Browser，赚取20%。',
    aff_hb_desc: '将技能分享给开发者、AI团队或爬虫社区。每带来一个订阅用户，您将永久获得20%的持续佣金。',
    aff_hb_cta: '获取您的推广链接 →',
    aff_hb_note: 'USDT TRC-20支付 · 每月结算 · 无最低门槛',
    aff_badge_50first: '50%佣金',
    aff_badge_10life: '10%终身佣金',
    aff_badge_25rec: '25%持续佣金',
    aff_badge_nodemaven: '50% + 10%持续佣金',
    aff_decodo_desc: '最佳性价比。195M+ IP，195个国家。我们的首选推荐。',
    aff_iproyal_desc: '实惠的轮换和粘性住宅代理，按需计费。',
    aff_oxylabs_desc: '企业级代理。175M+ IP，高级地理定位。',
    aff_nodemaven_desc: '高质量IP，成功率出色。',
    aff_webshare_desc: '最佳价格性能比，提供免费套餐。',
    aff_brightdata_desc: '始祖级别，网络质量最佳。无联盟折扣。',
    aff_cta: '立即开始 →',
    aff_cta_visit: '前往 →',
    // ─── Free vs Paid ───
    fvp_eyebrow: '包含内容',
    fvp_title: '免费 vs 付费 — 没有套路',
    fvp_sub: '技能和代码完全开放免费，你只需为住宅代理付费——那个让一切成为可能的IP。',
    free_tag: '永久免费',
    free_h3: 'OpenClaw技能 + 脚本',
    free_p: '运行浏览器所需的一切，无需信用卡，无需账户。',
    free_li1_html: '✅ <code>browser-human.js</code> — 完整源代码',
    free_li2: '✅ 人类鼠标、打字、滚动逻辑',
    free_li3: '✅ iPhone 15 Pro + 桌面指纹',
    free_li4: '✅ 反检测栈 (webdriver=false等)',
    free_li5: '✅ 通过clawhub的OpenClaw技能',
    free_li6: '✅ 脚本的所有未来更新',
    free_li7: '⚠️ 你需要自己的住宅代理',
    free_li8: '⚠️ 没有住宅IP — 网站会封锁你',
    paid_tag: '从$13.99/月起',
    paid_h3: '住宅代理凭据',
    paid_p: '缺失的那块。让你的浏览器对反爬虫系统隐身的真实家庭IP。',
    paid_li1: '✅ 罗马尼亚/美国/英国/德国/荷兰/日本IP',
    paid_li2: '✅ 真实住宅ISP (DIGI, AT&T, BT…)',
    paid_li3: '✅ 付款后立即交付凭据',
    paid_li4_html: '✅ 开箱即用支持 <code>browser-human.js</code>',
    paid_li5: '✅ 无需Bright Data账户',
    paid_li6: '✅ 包含邮件支持',
    paid_li7: '✅ 随时取消，无长期合同',
    paid_cta: '查看方案 →',
    fvp_why_h: '为什么需要住宅IP？',
    fvp_why_p: '数据中心IP（AWS、DigitalOcean、Hetzner——你的普通VPS）会被Cloudflare、Instagram、LinkedIn和大多数现代网站立即识别并封锁。住宅IP来自真实的家庭网络连接——它看起来完全像一个普通人在上网。这是被2秒封禁和永久爬取之间的唯一区别。',
    // ─── Payment methods ───
    pay_eyebrow: '支付方式',
    pay_title: '随心选择支付方式',
    pay_sub: '信用卡、Apple Pay、Google Pay或加密货币。凭据自动交付。',
    pm1_h: '信用卡 / Apple Pay / Google Pay',
    pm1_p: '通过Stripe处理。支持Visa、Mastercard、Amex、Apple Pay和Google Pay。每月自动续订。',
    pm1_s1: '点击任意方案的「立即开始」',
    pm1_s2: '选择信用卡 / Apple Pay / Google Pay',
    pm1_s3: '付款 → 凭据立即交付',
    pm2_h: 'USDT TRC-20',
    pm2_p: '最受欢迎的加密选项。精确金额发送到钱包地址。0xProcessing自动确认。',
    pm2_s1: '点击「立即开始」→ 选择USDT TRC-20',
    pm2_s2: '获取钱包地址和精确金额',
    pm2_s3: '发送 → 约2分钟获得凭据',
    pm3_h: 'Solana / ETH / BTC',
    pm3_p: '接受所有主要区块链。同样的自动流程——无需人工审批。',
    pm3_s1: '在支付面板选择你的代币',
    pm3_s2: '获取网络专属地址',
    pm3_s3: '发送 → 凭据自动交付',
    pm4_h: 'AI代理 (API)',
    pm4_p: '你的代理可以编程购买凭据。完整JSON API——机器可读响应。',
    pm4_s1_html: '代理：<code>GET /api/plans</code>',
    pm4_s2_html: '代理：<code>POST /api/buy {currency:"USDT"}</code>',
    pm4_s3_html: '代理付款 → 轮询 <code>GET /api/status/:id</code>',
    pay_guar1: '🔒 支付确认后10分钟内交付凭据。',
    pay_guar2: '❌ 不满意？24小时内全额退款——无需理由。',
    // ─── FAQ ───
    faq_eyebrow: '常见问题',
    faq_title: '常见问题解答',
    faq_1q: '我需要Mac Mini或台式电脑吗？',
    faq_1a: '不需要。Human Browser可在任何Linux VPS、Docker容器或云服务器上运行。每月5美元的Hetzner或Contabo VPS就够了。无需显示服务器、VNC或X11——只需Node.js和Chromium。',
    faq_2q: '什么是免费的，什么需要付费？',
    faq_2a_html: 'browser-human.js脚本和OpenClaw技能完全免费——开源，随时安装。付费订阅给你<strong>住宅代理凭据</strong>：来自DIGI Romania、AT&T、BT等的真实家庭IP。没有住宅IP，反爬虫系统会立即封锁你VPS的数据中心IP。',
    faq_3q: '为什么是罗马尼亚？可以用其他国家吗？',
    faq_3a: '罗马尼亚是最便宜的选项，适用于大多数任务——Instagram、LinkedIn、Binance、Polymarket、使用Cloudflare的网站。我们还提供美国、英国、德国、荷兰和日本。',
    faq_4q: '付款后多久收到凭据？',
    faq_4a: 'Stripe信用卡支付：2–3分钟。加密货币（USDT/ETH）：链上确认后5–10分钟。AI代理API：全自动，无需人工介入。',
    faq_5q: '我的AI代理可以自动购买吗？',
    faq_5a_html: '是的——这正是设计目的。调用<code>GET humanbrowser.dev/api/plans</code>，然后用你偏好的货币调用<code>POST /buy</code>，获取加密支付地址。代理发送付款，轮询<code>GET /status/:id</code>，在响应中获取代理凭据。零人工介入。',
    faq_6q: '这能绕过Cloudflare / DataDome / PerimeterX吗？',
    faq_6a: '是的，绝大多数情况下可以。住宅IP + 真实浏览器指纹（iPhone 15 Pro）+ 人类行为模拟（贝塞尔鼠标、自然打字、滚动模式）的组合可以通过所有主要反爬虫系统。我们已针对这三个系统进行了测试。',
    faq_7q: '什么是OpenClaw技能？',
    faq_7a_html: 'OpenClaw是AI代理平台。技能是可复用的能力包——安装一个，你的代理就获得专业知识和工具。Human Browser技能让你的OpenClaw代理能够一句话启动隐身浏览器：<code>launchHuman()</code>。',
    faq_8q: '如果我想取消怎么办？',
    faq_8a_html: '在Telegram上发送私信给<a href="https://t.me/virixlabs" target="_blank">@virixlabs</a>。我们会立即取消你的订阅。如果在购买24小时内，你将获得全额退款——无需任何理由。',
    // ─── Footer / Virix ───
    vx_h3: '由 Virix Labs 构建',
    vx_p: '以AI为驱动的创业工作室，大规模打造专注产品。Human Browser是OpenClaw技能生态系统的一部分——让AI代理无需人工瓶颈即可工作的工具。',
    footer_copy: '© 2026 Virix Labs · 无需Mac Mini · 运行于任意服务器',
    footer_blog: 'Blog',
    footer_install: 'Install',
    footer_clawhub: 'ClawHub',
    footer_openclaw: 'OpenClaw',
    footer_virix: 'Virix Labs',
    footer_support: '支持',
    // ─── Agent Modal ───
    modal_title:        '发送给您的OpenClaw代理',
    modal_sub:          '您的代理将安装技能、选择计划并像人类一样浏览 — 无需手动设置。',
    modal_cmd_label:    '安装命令',
    modal_tap_copy:     '📋 点击复制',
    modal_msg_label:    '或将此消息发送给您的代理',
    modal_msg:          '安装Human Browser技能，每次我需要浏览网络时使用它 — Instagram、LinkedIn、Binance、受Cloudflare保护的网站。使用真实住宅IP和iPhone 15 Pro指纹。安装命令：clawhub install human-browser',
    modal_tap_copy2:    '📋 点击复制',
    modal_clawhub:      '在ClawHub查看 →',
    modal_github:       'GitHub ↗',
    modal_support_html: '需要帮助？<a href="https://t.me/virixlabs" target="_blank">@virixlabs</a> Telegram',
    // ─── Payment sheet ───
    sheet_tab_card: '💳 信用卡 · Apple Pay · Google Pay',
    sheet_tab_crypto: '₿ 加密货币',
    sheet_loading: '加载安全结账中…',
    // ─── Rotating phrases ───
    rotating: [
      "以为自己是人类",
      "通过所有指纹检测",
      "移动方式像真人",
      "始终绕过 Cloudflare",
      "完全不知道自己是机器人",
      "阅读、滚动、输入——就像你",
      "免费住在你的服务器上",
      "从不触发验证码",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════

var currentLang              = 'en';
var currentRotatingPhrases   = TRANSLATIONS.en.rotating;
var rotIdx                   = 0;
var currentPayPlan           = 'starter';
var activePayTab             = 'card';
var stripeInstance           = null;
var embeddedCheckout         = null;

var PLAN_NAMES  = { starter: 'Starter',  pro: 'Pro',     enterprise: 'Enterprise' };
var PLAN_PRICES = { starter: '$13.99',   pro: '$69.99',  enterprise: '$299' };

// ═══════════════════════════════════════════════════════════════
//  i18n
// ═══════════════════════════════════════════════════════════════

function detectLang() {
  try {
    var saved = localStorage.getItem('hb_lang');
    if (saved && TRANSLATIONS[saved]) return saved;
  } catch(e) {}
  var lang = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase().slice(0, 2);
  if (lang === 'ru') return 'ru';
  if (lang === 'es') return 'es';
  if (lang === 'zh') return 'zh';
  return 'en';
}

function applyLang(lang) {
  var t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  currentLang = lang;

  // Apply data-i18n elements (plain text)
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });
  // Apply data-i18n-html elements (HTML content)
  document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
    var key = el.getAttribute('data-i18n-html');
    if (t[key] !== undefined) el.innerHTML = t[key];
  });

  // Update lang buttons
  document.querySelectorAll('.lang-btn').forEach(function(b) {
    b.classList.toggle('lang-active', b.getAttribute('data-lang') === lang);
  });

  // Update rotating phrases
  currentRotatingPhrases = t.rotating || TRANSLATIONS.en.rotating;
  rotIdx = 0;
  var rotEl = document.getElementById('hero-rotating');
  if (rotEl) { rotEl.style.opacity = '0'; rotEl.textContent = currentRotatingPhrases[0]; rotEl.style.opacity = '1'; }

  try { localStorage.setItem('hb_lang', lang); } catch(e) {}
}

function setLang(lang) { applyLang(lang); }

// ═══════════════════════════════════════════════════════════════
//  COUNTRY PICKER DATA
// ═══════════════════════════════════════════════════════════════

var COUNTRIES = {
  ro: { flag: '🇷🇴', name: 'Romania',        isp: 'DIGI Romania / WS Telecom',   price: '$13.99', note: 'Best price · Most popular' },
  us: { flag: '🇺🇸', name: 'United States',  isp: 'AT&T / Comcast / Verizon',    price: '$29.99', note: 'Required for US-only services' },
  gb: { flag: '🇬🇧', name: 'United Kingdom', isp: 'BT / Virgin Media',           price: '$24.99', note: 'EU-adjacent · Crypto & markets' },
  de: { flag: '🇩🇪', name: 'Germany',        isp: 'Deutsche Telekom / Vodafone', price: '$22.99', note: 'EU-compliant · GDPR-friendly' },
  nl: { flag: '🇳🇱', name: 'Netherlands',    isp: 'KPN / Ziggo',                 price: '$22.99', note: 'Privacy-friendly · Web3' },
  jp: { flag: '🇯🇵', name: 'Japan',          isp: 'NTT / SoftBank',              price: '$26.99', note: 'Japanese content · Line' },
};

var SERVICES = [
  { icon: '📊', name: 'Polymarket',  status: { ro:'ok', us:'bad',  gb:'ok',  de:'ok',  nl:'ok',  jp:'ok'  }, note: { us:'Blocked in US' } },
  { icon: '📸', name: 'Instagram',   status: { ro:'ok', us:'ok',   gb:'ok',  de:'ok',  nl:'ok',  jp:'ok'  } },
  { icon: '💼', name: 'LinkedIn',    status: { ro:'ok', us:'ok',   gb:'ok',  de:'ok',  nl:'ok',  jp:'ok'  } },
  { icon: '🔶', name: 'Binance',     status: { ro:'ok', us:'bad',  gb:'warn',de:'ok',  nl:'ok',  jp:'ok'  }, note: { us:'Blocked in US', gb:'Limited' } },
  { icon: '🎬', name: 'Netflix US',  status: { ro:'bad',us:'ok',   gb:'bad', de:'bad', nl:'bad', jp:'bad' }, note: { ro:'US IP required' } },
  { icon: '🏦', name: 'US Banking',  status: { ro:'bad',us:'ok',   gb:'bad', de:'bad', nl:'bad', jp:'bad' }, note: { ro:'US IP only' } },
  { icon: '🍔', name: 'DoorDash',    status: { ro:'bad',us:'ok',   gb:'bad', de:'bad', nl:'bad', jp:'bad' }, note: { ro:'US only' } },
  { icon: '🛡️', name: 'Cloudflare', status: { ro:'ok', us:'ok',   gb:'ok',  de:'ok',  nl:'ok',  jp:'ok'  } },
];

// ═══════════════════════════════════════════════════════════════
//  DOM READY
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {

  // ── Detect & apply language ──────────────────────────────────
  applyLang(detectLang());

  // ── Hero rotating text ───────────────────────────────────────
  setInterval(function() {
    rotIdx = (rotIdx + 1) % currentRotatingPhrases.length;
    var el = document.getElementById('hero-rotating');
    if (!el) return;
    el.style.transition = 'opacity 0.3s';
    el.style.opacity = '0';
    setTimeout(function() {
      el.textContent = currentRotatingPhrases[rotIdx];
      el.style.opacity = '1';
    }, 300);
  }, 3200);

  // ── Hamburger ────────────────────────────────────────────────
  var hbtn = document.getElementById('hamburger');
  var hmenu = document.getElementById('mobile-menu');
  if (hbtn && hmenu) {
    hbtn.addEventListener('click', function() { hmenu.classList.toggle('open'); });
    hmenu.querySelectorAll('a').forEach(function(a) {
      a.addEventListener('click', function() { hmenu.classList.remove('open'); });
    });
  }
  // Global helper for mobile lang buttons
  window.closeMobileMenu = function() {
    var m = document.getElementById('mobile-menu');
    if (m) m.classList.remove('open');
  };

  // ── Country picker ───────────────────────────────────────────
  function renderCountry(code) {
    var c = COUNTRIES[code];
    if (!c) return;

    // Highlight active tab — HTML uses class "ctab"
    document.querySelectorAll('.ctab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-country') === code);
    });

    // Country meta info — HTML has id="country-meta"
    var meta = document.getElementById('country-meta');
    if (meta) {
      meta.innerHTML =
        '<div class="cm-flag">' + c.flag + '</div>' +
        '<div class="cm-info">' +
          '<h3>' + c.name + '</h3>' +
          '<p>' + c.isp + ' · ' + c.note + '</p>' +
        '</div>' +
        '<div class="cm-price">' + c.price + '<span>/mo</span></div>';
    }

    // Service grid — CSS uses .svc-card, .ok/.warn/.bad, .svc-badge
    var grid = document.getElementById('service-grid');
    if (grid) {
      grid.innerHTML = SERVICES.map(function(s) {
        var st  = s.status[code] || 'ok';
        var noteText = (s.note && s.note[code]) ? s.note[code] : (st === 'ok' ? 'Available' : st === 'warn' ? 'Limited' : 'Blocked');
        var badgeCls = st === 'ok' ? 'badge-ok' : st === 'warn' ? 'badge-warn' : 'badge-bad';
        var badgeTxt = st === 'ok' ? '✓' : st === 'warn' ? '~' : '✗';
        return (
          '<div class="svc-card ' + st + '">' +
            '<span class="svc-icon">' + s.icon + '</span>' +
            '<div class="svc-info">' +
              '<div class="svc-name">' + s.name + '</div>' +
              '<div class="svc-note">' + noteText + '</div>' +
            '</div>' +
            '<span class="svc-badge ' + badgeCls + '">' + badgeTxt + '</span>' +
          '</div>'
        );
      }).join('');
    }
  }

  // Bind tab clicks
  document.querySelectorAll('.ctab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      renderCountry(this.getAttribute('data-country'));
    });
  });

  // Initial render
  renderCountry('ro');

  // Auto-rotate countries (slower — 4s)
  var countryKeys = Object.keys(COUNTRIES);
  var cpIdx = 0;
  setInterval(function() {
    cpIdx = (cpIdx + 1) % countryKeys.length;
    renderCountry(countryKeys[cpIdx]);
  }, 4000);

}); // end DOMContentLoaded


// ═══════════════════════════════════════════════════════════════
//  COPY INSTALL COMMAND
// ═══════════════════════════════════════════════════════════════

function copyInstallCmd() {
  var cmd = 'clawhub install human-browser';
  var btn = document.getElementById('heroInstallCopy');
  navigator.clipboard.writeText(cmd).then(function() {
    if (btn) {
      btn.classList.add('copied');
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(function() {
        btn.classList.remove('copied');
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 2000);
    }
  }).catch(function() {
    var el = document.getElementById('heroInstallCmd');
    if (el) { var r = document.createRange(); r.selectNodeContents(el); window.getSelection().removeAllRanges(); window.getSelection().addRange(r); }
  });
}


// ═══════════════════════════════════════════════════════════════
//  PAYMENT BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════

function openPayModal(plan) { openPaySheet(plan); }

function openPaySheet(plan) {
  currentPayPlan = plan || 'starter';
  var nameEl  = document.getElementById('pshPlanName');
  var priceEl = document.getElementById('pshPlanPrice');
  if (nameEl)  nameEl.textContent  = PLAN_NAMES[currentPayPlan]  + ' Plan';
  if (priceEl) priceEl.textContent = PLAN_PRICES[currentPayPlan] + '/mo';
  var backdrop = document.getElementById('payBackdrop');
  var sheet    = document.getElementById('paySheet');
  if (backdrop) backdrop.classList.add('open');
  if (sheet)    sheet.classList.add('open');
  document.body.style.overflow = 'hidden';
  switchPayTab('card');
}

function closePaySheet() {
  var backdrop = document.getElementById('payBackdrop');
  var sheet    = document.getElementById('paySheet');
  if (backdrop) backdrop.classList.remove('open');
  if (sheet)    sheet.classList.remove('open');
  document.body.style.overflow = '';
  if (embeddedCheckout) { try { embeddedCheckout.destroy(); } catch(e) {} embeddedCheckout = null; }
  var inv = document.getElementById('cryptoInvoice');
  if (inv) inv.innerHTML = '';
  document.querySelectorAll('.ccoin').forEach(function(b) { b.classList.remove('ccoin-active'); });
}

function closePayModal() { closePaySheet(); }

// ── Tabs ─────────────────────────────────────────────────────

function switchPayTab(tab) {
  activePayTab = tab;
  var cardTab   = document.getElementById('tabCard');
  var cryptoTab = document.getElementById('tabCrypto');
  var cardPane  = document.getElementById('tabContentCard');
  var cryptPane = document.getElementById('tabContentCrypto');
  if (cardTab)   cardTab.classList.toggle('pst-active',   tab === 'card');
  if (cryptoTab) cryptoTab.classList.toggle('pst-active', tab === 'crypto');
  if (cardPane)  cardPane.classList.toggle('psc-hidden',  tab !== 'card');
  if (cryptPane) cryptPane.classList.toggle('psc-hidden', tab !== 'crypto');
  if (tab === 'card') initStripeCheckout();
}

// ── Stripe Embedded ──────────────────────────────────────────

async function initStripeCheckout() {
  var container = document.getElementById('stripe-checkout');
  if (!container) return;
  container.innerHTML = '<div class="psc-placeholder"><div class="pay-spinner"></div><p>Loading secure checkout…</p></div>';
  try {
    if (embeddedCheckout) { try { embeddedCheckout.destroy(); } catch(e) {} embeddedCheckout = null; }
    var res  = await fetch('/api/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: currentPayPlan, currency: 'card' }) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');
    var stripe = await waitForStripe();
    embeddedCheckout = await stripe.initEmbeddedCheckout({ clientSecret: data.client_secret });
    container.innerHTML = '';
    embeddedCheckout.mount('#stripe-checkout');
  } catch(e) {
    container.innerHTML =
      '<p style="color:#ef4444;padding:2rem;text-align:center;font-size:0.9rem;">⚠ ' + e.message + '</p>' +
      '<p style="text-align:center;"><button class="pay-back-btn" onclick="initStripeCheckout()">↺ Retry</button></p>';
  }
}

function waitForStripe(n) {
  n = n || 0;
  return new Promise(function(resolve, reject) {
    if (typeof Stripe !== 'undefined') {
      if (!stripeInstance) stripeInstance = Stripe(STRIPE_PK);
      return resolve(stripeInstance);
    }
    if (n > 20) return reject(new Error('Stripe.js failed to load'));
    setTimeout(function() { waitForStripe(n + 1).then(resolve).catch(reject); }, 300);
  });
}

// ── Crypto ───────────────────────────────────────────────────

async function selectCoin(coin) {
  document.querySelectorAll('.ccoin').forEach(function(b) {
    b.classList.toggle('ccoin-active',
      b.getAttribute('onclick') && b.getAttribute('onclick').indexOf("'" + coin + "'") !== -1);
  });
  var invoice = document.getElementById('cryptoInvoice');
  if (!invoice) return;
  invoice.innerHTML = '<div class="psc-placeholder"><div class="pay-spinner"></div><p>Creating invoice…</p></div>';
  try {
    var res  = await fetch('/api/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: currentPayPlan, currency: coin }) });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');
    var addr = data.wallet_address || '';
    // 0xProcessing returns payment_url → open in new tab (avoids X-Frame-Options issues)
    if (data.payment_url && !addr) {
      window.open(data.payment_url, '_blank', 'noopener,noreferrer');
      invoice.innerHTML =
        '<div class="crypto-invoice-box" style="text-align:center;">' +
          '<div style="font-size:2rem;margin-bottom:0.75rem;">🔗</div>' +
          '<div class="cib-title" style="margin-bottom:0.5rem;">Payment page opened</div>' +
          '<p style="color:#94a3b8;font-size:0.9rem;margin:0 0 1rem;">Complete your payment in the new tab. Credentials are delivered automatically after confirmation.</p>' +
          '<a href="' + data.payment_url + '" target="_blank" rel="noopener noreferrer" class="pay-back-btn" style="display:inline-block;text-decoration:none;margin-bottom:0.75rem;">↗ Reopen payment page</a>' +
          '<p style="color:#64748b;font-size:0.78rem;margin:0;">Order: <code style="color:#94a3b8;">' + (data.order_id || '') + '</code></p>' +
        '</div>';
      return;
    }
    // Direct wallet address
    var coinLabels = { USDT: 'USDT TRC-20', USDTTRC: 'USDT TRC-20', USDTERC: 'USDT ERC-20', BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana' };
    var amt = data.amount_crypto || PLAN_PRICES[currentPayPlan].replace('$', '');
    invoice.innerHTML =
      '<div class="crypto-invoice-box">' +
        '<div class="cib-title">' + (coinLabels[coin] || coin) + '</div>' +
        '<div class="cib-amount">' + amt + ' ' + coin + '</div>' +
        '<p class="cib-label">Send to this address:</p>' +
        '<div class="cib-addr" id="cryptoAddrEl">' + addr + '</div>' +
        '<p class="cib-hint">Tap to copy · Order: <code>' + (data.order_id || '') + '</code></p>' +
        '<p class="cib-confirm">⏱ Credentials delivered automatically after on-chain confirmation</p>' +
      '</div>';
    var addrEl = document.getElementById('cryptoAddrEl');
    if (addrEl && addr) {
      addrEl.style.cursor = 'pointer';
      addrEl.addEventListener('click', function() {
        navigator.clipboard.writeText(addr).then(function() {
          addrEl.textContent = '✅ Copied!';
          setTimeout(function() { addrEl.textContent = addr; }, 2000);
        });
      });
    }
  } catch(e) {
    invoice.innerHTML = '<p style="color:#ef4444;padding:1.5rem;text-align:center;">⚠ ' + e.message + '</p><button class="pay-back-btn" onclick="selectCoin(\'' + coin + '\')">↺ Retry</button>';
  }
}

// ── Legacy compat ────────────────────────────────────────────

function goPay(plan, currency) {
  openPaySheet(plan);
  if (currency !== 'card') {
    setTimeout(function() { switchPayTab('crypto'); setTimeout(function() { selectCoin(currency); }, 100); }, 200);
  }
}

function buyPlan(plan, currency) {
  if (currency === 'card') { openPaySheet(plan); }
  else { openPaySheet(plan); setTimeout(function() { switchPayTab('crypto'); setTimeout(function() { selectCoin(currency); }, 200); }, 300); }
}

// ── Agent Install Modal ───────────────────────────────────────────────
function showAgentModal() {
  var overlay = document.getElementById('agent-modal');
  if (!overlay) return;
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Apply i18n to modal elements
  if (typeof applyLang === 'function') applyLang(currentLang || 'en');
}

function closeAgentModal() {
  var overlay = document.getElementById('agent-modal');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  // Reset copied states
  ['amodal-cmd-box','amodal-msg-box'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('copied');
  });
}

function handleModalOverlayClick(e) {
  if (e.target === e.currentTarget) closeAgentModal();
}

function copyModalCmd(text, boxId) {
  if (!navigator.clipboard) return;
  navigator.clipboard.writeText(text.trim()).then(function() {
    var box = document.getElementById(boxId);
    if (!box) return;
    box.classList.add('copied');
    var hint = box.querySelector('.amodal-copy-hint');
    if (hint) { var orig = hint.textContent; hint.textContent = '✅ Copied!'; setTimeout(function() { hint.textContent = orig; box.classList.remove('copied'); }, 2000); }
  });
}

// ESC key closes modal
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeAgentModal();
});

// Expose globally
window.showAgentModal   = showAgentModal;
window.closeAgentModal  = closeAgentModal;
window.handleModalOverlayClick = handleModalOverlayClick;
window.copyModalCmd     = copyModalCmd;

window._installCmds = {
  npm: 'npm install human-browser',
  github: 'cd ~/.openclaw/workspace && mkdir -p skills/human-browser/scripts && curl -sL https://raw.githubusercontent.com/al1enjesus/human-browser/main/SKILL.md > skills/human-browser/SKILL.md && curl -sL https://raw.githubusercontent.com/al1enjesus/human-browser/main/scripts/browser-human.js > skills/human-browser/scripts/browser-human.js'
};
window._installTab = 'npm';

function switchInstallTab(tab, btn) {
  window._installTab = tab;
  var cmd = window._installCmds[tab] || '';
  var el = document.getElementById('amodal-cmd-text');
  if (el) el.textContent = cmd;
  var box = document.getElementById('amodal-cmd-box');
  if (box) box.title = cmd;
  // toggle active class
  var tabs = document.querySelectorAll('.amodal-tab');
  tabs.forEach(function(t){ t.classList.remove('active'); });
  if (btn) btn.classList.add('active');
}

