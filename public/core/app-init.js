/**
 * app-init.js — точка входа, запускается один раз при загрузке страницы
 *
 * Порядок:
 * 1. AppStore.init() — определяет tgId, делает fetch, заполняет state
 * 2. Подписываемся на события стора → ре-рендерим нужные вьюхи
 * 3. Router регистрирует табы → при переключении вызывает render()
 * 4. Показываем первый экран
 */
'use strict';

(async function bootstrap() {
  // ── 1. Init store ────────────────────────────────────────────
  await AppStore.init();

  // ── 2. Subscribe ─────────────────────────────────────────────
  AppStore.on('updated', () => {
    // Обновляем активный таб
    const tab = Router.current();
    if (tab === 'portfolio') PortfolioView.render();
    if (tab === 'signals')   SignalsView.render();
    // Тихое обновление hero если портфель уже отрендерен
    PortfolioView.updateHero();
  });

  AppStore.on('feed:updated', (feed) => {
    // feed данные — рендерим если на нужном табе
    if (typeof renderWhales === 'function') renderWhales(feed.trades || []);
    if (typeof renderMovers === 'function') renderMovers(feed.movers || []);
    if (typeof renderLiveTicker === 'function') renderLiveTicker(feed.trades || []);
  });

  // ── 3. Register tabs ─────────────────────────────────────────
  Router.register('portfolio', {
    onEnter: () => PortfolioView.render(),
  });

  Router.register('signals', {
    onEnter: () => SignalsView.render(),
  });

  Router.register('stats', {
    onEnter: () => { if (typeof loadStats === 'function') loadStats(); },
  });

  Router.register('wallet', {
    onEnter: () => { if (typeof loadWallet === 'function') loadWallet(); },
  });

  // ── 4. Show initial tab ──────────────────────────────────────
  Router.showTab('portfolio');

  // ── 5. Backward compat: expose globals used in tma.html ──────
  window._tgId = AppStore.state.tgId;

  // Override old showTab function
  window.showTab = (tab) => Router.showTab(tab);

  // Override old loadPortfolio/loadSignals
  window.loadPortfolio = () => { AppStore.refresh().then(() => PortfolioView.render()); };
  window.loadSignals   = () => { AppStore.refresh().then(() => SignalsView.render()); };

  // ── 6. Safe area / fullscreen (Telegram) ────────────────────
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    function applyLayout() {
      const isFS = tg.isFullscreen || false;
      document.body.setAttribute('data-fullscreen', isFS);
      if (isFS) {
        const total = Math.max((tg.safeAreaInset && tg.safeAreaInset.top || 0) + (tg.contentSafeAreaInset && tg.contentSafeAreaInset.top || 0), 54);
        document.body.style.paddingTop = total + 'px';
        document.body.style.setProperty('--header-safe-top', total + 'px');
      } else {
        document.body.style.paddingTop = '0px';
        document.body.style.setProperty('--header-safe-top', '0px');
      }
    }
    applyLayout();
    tg.onEvent('fullscreenChanged', applyLayout);
    tg.onEvent('viewportChanged', applyLayout);
  }

  // ── 7. Load feed in background ───────────────────────────────
  setTimeout(() => AppStore.refreshFeed(), 600);

  console.log('[App] ready | tgId:', AppStore.state.tgId, '| platform:', AppStore.state.platform);
})();
