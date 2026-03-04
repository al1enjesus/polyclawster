/**
 * portfolio-view.js — таб "Portfolio"
 * Читает данные ТОЛЬКО из AppStore.state — не делает свои fetch
 */
'use strict';

const PortfolioView = (() => {
  const SIGNAL_ICONS = {
    ob_imbalance: '⚖️', whale_order: '🐋', price_drift: '📈',
    vol_spike: '⚡', news_edge: '📰', cross_market: '🔗', smartwallet: '🧠',
  };

  function render() {
    const el = document.getElementById('portfolio-content');
    if (!el) return;

    const { user, positions, signals } = AppStore.state;
    const pnl  = parseFloat(user.totalPnl   || 0);
    const val  = parseFloat(user.totalValue || 0);
    const pct  = parseFloat(user.pnlPct     || 0);
    const dep  = parseFloat(user.totalDeposited || 0);
    const isUp = pnl >= 0;

    // ── Hero ──
    const heroHTML = `
      <div class="balance-hero" style="padding-bottom:16px">
        <div class="balance-hero-label">Portfolio Balance</div>
        <div class="balance-amount" id="hero-pnl-amount">$${val.toFixed(2)}</div>
        <div class="balance-change ${isUp ? 'up' : 'down'}" id="hero-pnl-change">
          ${dep > 0
            ? (isUp ? '▲' : '▼') + ' ' + Math.abs(pct).toFixed(1) + '% · P&amp;L ' + UI.fmt(pnl)
            : 'No activity yet'}
        </div>
      </div>
      <div class="action-pills">
        <button class="action-pill" onclick="Router.showTab('signals')">
          <div class="action-pill-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
          <span class="action-pill-label">Signals</span>
        </button>
        <button class="action-pill" onclick="Router.showTab('wallet')">
          <div class="action-pill-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 11a2 2 0 100 4 2 2 0 000-4z"/></svg></div>
          <span class="action-pill-label">Wallet</span>
        </button>
        <button class="action-pill" onclick="Router.showTab('stats')">
          <div class="action-pill-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
          <span class="action-pill-label">Stats</span>
        </button>
      </div>`;

    // ── Has positions → show them ──
    if (positions && positions.length > 0) {
      const cards = [...positions]
        .sort((a, b) => Math.abs(b.cashPnl || 0) - Math.abs(a.cashPnl || 0))
        .map((p, i) => _positionCard(p, i))
        .join('');
      el.innerHTML = `<div class="content">${heroHTML}
        <div style="font-size:11px;color:var(--muted);padding:4px 16px 8px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Open Positions</div>
        ${cards}
        <div class="virix">by <a href="https://virixlabs.com" target="_blank">Virix Labs</a></div>
      </div>`;
      return;
    }

    // ── Empty state ──
    const ctaHTML = user.hasWallet
      ? `<div class="glass-card" style="text-align:center;margin-bottom:12px;padding:20px 16px">
          <div style="font-size:32px;margin-bottom:8px">💰</div>
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">Fund your wallet</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.6">Deposit USDC on Polygon and the AI will start trading for you</div>
          <button class="btn btn-primary" style="font-size:13px" onclick="Router.showTab('wallet')">Deposit USDC →</button>
        </div>`
      : `<div class="glass-card" style="text-align:center;margin-bottom:12px;padding:20px 16px">
          <div style="font-size:32px;margin-bottom:8px">🎰</div>
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">Create your AI wallet</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.6">Free Polygon wallet · AI trades Polymarket for you · 5% fee on profits only</div>
          <button class="btn btn-primary" style="font-size:13px" onclick="Router.showTab('wallet')">Get Started →</button>
        </div>`;

    const sigsHTML = signals && signals.length > 0
      ? `<div class="glass-card" style="margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">🎯 AI is watching</div>
          ${signals.slice(0, 4).map(s => {
            const sc = s.score || 0;
            const clr = sc >= 8 ? '#FF3366' : sc >= 5 ? '#F7B731' : '#45AAF2';
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)">
              <div style="font-size:18px;width:28px;text-align:center">${SIGNAL_ICONS[s.type] || '📡'}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(s.market || s.title || '').slice(0, 55)}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:2px">${s.type || 'signal'}</div>
              </div>
              <div style="font-size:13px;font-weight:700;color:${clr}">${sc.toFixed(1)}</div>
            </div>`;
          }).join('')}
          <button class="btn btn-secondary" style="margin-top:12px;font-size:12px" onclick="Router.showTab('signals')">See all signals →</button>
        </div>`
      : '';

    el.innerHTML = `<div class="content">${heroHTML}${ctaHTML}${sigsHTML}
      <div class="virix">by <a href="https://virixlabs.com" target="_blank">Virix Labs</a></div>
    </div>`;
  }

  function _positionCard(p, i) {
    const ppnl = p.cashPnl || 0;
    const pr   = Math.round((p.curPrice || 0) * 100);
    const oc   = (p.outcome || '').toLowerCase();
    const tagCls = oc === 'yes' ? 'yes' : oc === 'no' ? 'no' : 'other';
    const pCls   = ppnl > 0 ? 'up' : ppnl < 0 ? 'down' : 'neu';
    const icon   = pr >= 80 ? '🟢' : pr >= 50 ? '🟡' : '🔴';
    const img    = p.icon
      ? `<img src="${p.icon}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;"
           onerror="this.style.display='none';this.nextSibling.style.display='flex'">
         <span style="display:none;font-size:20px">${icon}</span>`
      : `<span style="font-size:20px">${icon}</span>`;

    return `<div class="token-card" onclick="openPosition(${i})" style="animation-delay:${i * 50}ms">
      <div class="token-icon" style="overflow:hidden;padding:0">${img}</div>
      <div class="token-info">
        <div class="token-name">${(p.title || '').slice(0, 54)}</div>
        <div class="token-meta">
          <span class="outcome-badge outcome-${tagCls}">${p.outcome}</span>
          <span class="token-sub poly-badge">P</span>
          <span class="token-sub">$${(p.currentValue || 0).toFixed(0)}</span>
        </div>
      </div>
      <div class="token-right">
        <div class="token-price">${pr}¢</div>
        <div class="token-pnl ${pCls}">${UI.fmt(ppnl)}</div>
      </div>
      <svg class="chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
    </div>`;
  }

  // Тихое обновление hero (без полного ре-рендера)
  function updateHero() {
    const { user } = AppStore.state;
    const pnl = parseFloat(user.totalPnl   || 0);
    const val = parseFloat(user.totalValue || 0);
    const pct = parseFloat(user.pnlPct     || 0);
    const isUp = pnl >= 0;

    const heroAmt = document.getElementById('hero-pnl-amount');
    const heroChg = document.getElementById('hero-pnl-change');
    if (heroAmt) heroAmt.textContent = '$' + val.toFixed(2);
    if (heroChg) heroChg.textContent = (isUp ? '▲' : '▼') + ' ' + Math.abs(pct).toFixed(1) + '% · P&L ' + UI.fmt(pnl);
  }

  return { render, updateHero };
})();
