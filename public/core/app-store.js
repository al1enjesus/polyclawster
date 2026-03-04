/**
 * app-store.js — глобальный стор приложения
 *
 * Единственный источник истины. Работает в:
 *   - Telegram Mini App (window.Telegram.WebApp)
 *   - Браузер (веб-версия, tgId из URL или localStorage)
 *
 * Использование:
 *   await AppStore.init();
 *   AppStore.on('updated', () => renderAll());
 *   const { user, signals, positions } = AppStore.state;
 */
'use strict';

const AppStore = (() => {
  // ── State ────────────────────────────────────────────────────
  const state = {
    tgId:      '',
    platform:  'unknown',   // 'telegram' | 'web'
    user:      {},          // { totalValue, totalPnl, pnlPct, hasWallet, address }
    positions: [],          // open positions (owner only for now)
    signals:   [],          // AI signals
    feed:      null,        // { trades, movers }
    loading:   false,
    lastUpdated: null,
  };

  // ── Event emitter (tiny) ─────────────────────────────────────
  const _listeners = {};
  function on(event, fn)  { (_listeners[event] = _listeners[event] || []).push(fn); }
  function off(event, fn) { _listeners[event] = (_listeners[event] || []).filter(f => f !== fn); }
  function emit(event, data) { (_listeners[event] || []).forEach(fn => { try { fn(data); } catch(e) { console.error('[AppStore]', e); } }); }

  // ── Resolve tgId ─────────────────────────────────────────────
  function resolveTgId() {
    // 1. Telegram WebApp (TMA)
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) {
      state.platform = 'telegram';
      return String(tg.initDataUnsafe.user.id);
    }
    // 2. URL param (dev/testing)
    const urlId = new URLSearchParams(location.search).get('tgId');
    if (urlId) { state.platform = 'web'; return urlId; }
    // 3. localStorage (web session persistence)
    const stored = (() => { try { return localStorage.getItem('pc_tgid'); } catch { return null; } })();
    if (stored) { state.platform = 'web'; return stored; }
    // 4. Anonymous
    state.platform = 'web';
    return '';
  }

  // ── Load data ────────────────────────────────────────────────
  async function refresh(opts = {}) {
    if (state.loading && !opts.force) return;
    state.loading = true;
    emit('loading', true);

    try {
      // Portfolio + signals (one call)
      const d = await API.getPortfolio(state.tgId);
      state.user      = d.portfolio || {};
      state.positions = (d.portfolio && d.portfolio.positions) || [];
      state.signals   = d.signals || [];
      state.lastUpdated = Date.now();
      emit('updated', state);
    } catch (e) {
      console.error('[AppStore] refresh failed:', e);
      emit('error', e);
    } finally {
      state.loading = false;
      emit('loading', false);
    }
  }

  async function refreshFeed() {
    try {
      const d = await API.getFeed();
      if (d.ok) {
        state.feed = d;
        emit('feed:updated', d);
      }
    } catch (e) {
      console.warn('[AppStore] feed error:', e);
    }
  }

  // ── Auto-refresh ─────────────────────────────────────────────
  let _refreshTimer = null;
  function startPolling(intervalMs = 60000) {
    stopPolling();
    _refreshTimer = setInterval(() => refresh(), intervalMs);
  }
  function stopPolling() {
    if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
  }

  // ── Init ─────────────────────────────────────────────────────
  async function init() {
    state.tgId = resolveTgId();

    // Persist for web session
    if (state.tgId) {
      try { localStorage.setItem('pc_tgid', state.tgId); } catch {}
    }

    // Init Telegram WebApp
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg) {
      tg.expand && tg.expand();
      tg.setHeaderColor    && tg.setHeaderColor('#0d0820');
      tg.setBackgroundColor && tg.setBackgroundColor('#0d0820');
    }

    await refresh();
    startPolling(60000);

    // Feed after main data loads
    setTimeout(refreshFeed, 800);

    return state;
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    state,
    init,
    refresh,
    refreshFeed,
    startPolling,
    stopPolling,
    on,
    off,
    emit,
  };
})();
