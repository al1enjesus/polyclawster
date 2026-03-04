/**
 * signals-view.js — таб "Signals"
 * Данные из AppStore.state.signals — без своего fetch
 */
'use strict';

const SignalsView = (() => {
  const ICONS = {
    ob_imbalance: '⚖️', whale_order: '🐋', price_drift: '📈',
    vol_spike: '⚡', news_edge: '📰', cross_market: '🔗', smartwallet: '🧠',
  };
  const LABELS = {
    ob_imbalance: 'Order Imbalance', whale_order: 'Whale Order', price_drift: 'Price Drift',
    vol_spike: 'Volume Spike', news_edge: 'News Edge', cross_market: 'Cross-Market', smartwallet: 'Smart Wallet',
  };

  function render() {
    const el = document.getElementById('signals-content');
    if (!el) return;

    const sigs = AppStore.state.signals;

    if (!sigs || !sigs.length) {
      el.innerHTML = UI.empty('📡', 'No signals right now.', 'Scanner runs every 30 min.');
      return;
    }

    const cards = sigs.slice(0, 15).map((s, i) => {
      const score    = s.score || 0;
      const isStrong = score >= 8;
      const isMed    = score >= 5;
      const lvl      = isStrong ? 'strong' : isMed ? 'medium' : 'weak';
      const barClr   = isStrong ? '#FF3366' : isMed ? '#F7B731' : '#45AAF2';
      const icon     = ICONS[s.type] || '📡';
      const label    = LABELS[s.type] || s.type;
      const ago      = s.timestamp ? UI.timeAgo(s.timestamp) : s.ago || '';
      const isNew    = s.timestamp && (Date.now() - new Date(s.timestamp).getTime()) < 10 * 60 * 1000;
      const hasAddr  = s.type === 'smartwallet' && s.addr;

      return `<div class="signal-card ${lvl}" onclick="SignalsView.openDetail(${i})" style="animation-delay:${i * 40}ms">
        <div class="signal-icon-wrap ${lvl}">${icon}</div>
        <div class="signal-body">
          <div class="signal-type">
            ${label}${hasAddr ? ' · ' + s.addr.slice(0, 8) + '...' : ''}
            ${isNew ? '<span class="sig-new-badge">NEW</span>' : ''}
            ${isStrong ? '<span class="sig-auto">AUTO</span>' : ''}
          </div>
          <div class="signal-title">${(s.market || s.title || '').slice(0, 70)}</div>
          ${s.side ? `<div class="signal-sub">Side: ${s.side}${s.amount ? ' · $' + s.amount : ''}</div>` : ''}
          ${ago ? `<div class="sig-timer">${ago}</div>` : ''}
          <div class="score-bar-bg">
            <div class="score-bar-fill" style="width:${Math.round(score / 10 * 100)}%;background:${barClr}"></div>
          </div>
        </div>
        <div class="signal-score">${score.toFixed(1)}</div>
        <svg class="chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
      </div>`;
    }).join('');

    // Nav badge
    const strong = sigs.filter(s => s.score >= 8).length;
    const badge  = document.getElementById('sig-badge');
    if (badge) { badge.style.display = strong > 0 ? 'flex' : 'none'; badge.textContent = strong; }

    el.innerHTML = `<div class="content" style="padding-top:8px">
      ${cards}
      <div class="virix">by <a href="https://virixlabs.com" target="_blank">Virix Labs</a></div>
    </div>`;
  }

  function openDetail(i) {
    const s = (AppStore.state.signals || [])[i];
    if (!s) return;
    // Используем существующий openSignal если есть (backward compat)
    if (typeof openSignal === 'function') { openSignal(i); return; }
    // Fallback: открываем на Polymarket
    UI.openLink('https://polymarket.com/event/' + (s.slug || s.market || ''));
  }

  return { render, openDetail };
})();

// ── Live "ago" ticker ──────────────────────────────────────────
// Обновляет все .sig-timer элементы с data-ts без ре-рендера
SignalsView._tickTimer = null;

SignalsView.startTicker = function() {
  if (SignalsView._tickTimer) return;
  SignalsView._tickTimer = setInterval(function() {
    document.querySelectorAll('[data-ts]').forEach(function(el) {
      const ts = parseInt(el.getAttribute('data-ts'), 10);
      if (ts) el.textContent = UI.timeAgo(ts);
    });
  }, 30000);
};

SignalsView.stopTicker = function() {
  if (SignalsView._tickTimer) { clearInterval(SignalsView._tickTimer); SignalsView._tickTimer = null; }
};
