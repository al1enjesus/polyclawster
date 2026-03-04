/**
 * ui.js — переиспользуемые UI-утилиты
 * Toast, sheets, formatters — всё что не зависит от данных
 */
'use strict';

const UI = (() => {

  // ── Formatters ───────────────────────────────────────────────
  const fmt = (n, prefix = true) => {
    const sign = n >= 0 ? (prefix ? '+' : '') : '-';
    return sign + '$' + Math.abs(n).toFixed(2);
  };

  const fmtBig = (n) => {
    if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
    return '$' + Math.abs(n).toFixed(0);
  };

  const fmtPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';

  const timeAgo = (isoOrTs) => {
    const ts = typeof isoOrTs === 'number' ? isoOrTs : new Date(isoOrTs || 0).getTime();
    if (!ts) return '';
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60)   return sec + 's ago';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    return Math.floor(sec / 3600) + 'h ago';
  };

  const shortAddr = (addr) => addr ? addr.slice(0, 8) + '...' + addr.slice(-4) : '';

  // ── Toast ────────────────────────────────────────────────────
  function toast(msg, type = 'default') {
    const el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast--visible'));
    setTimeout(() => {
      el.classList.remove('toast--visible');
      setTimeout(() => el.remove(), 300);
    }, 2200);
  }

  // ── Bottom sheet ─────────────────────────────────────────────
  function openSheet(name) {
    const ov = document.getElementById(name + '-overlay');
    const sh = document.getElementById(name + '-sheet');
    if (ov) ov.classList.add('open');
    if (sh) sh.classList.add('open');
    // haptic
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
  }

  function closeSheet(name) {
    const ov = document.getElementById(name + '-overlay');
    const sh = document.getElementById(name + '-sheet');
    if (ov) ov.classList.remove('open');
    if (sh) sh.classList.remove('open');
  }

  // ── Copy to clipboard ────────────────────────────────────────
  function copy(text, successMsg = 'Copied!') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast(successMsg)).catch(() => toast('Copy failed'));
    } else {
      // fallback
      const el = document.createElement('textarea');
      el.value = text;
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
      toast(successMsg);
    }
  }

  // ── Open external link ───────────────────────────────────────
  function openLink(url) {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.openLink) tg.openLink(url);
    else window.open(url, '_blank');
  }

  // ── Loader HTML ──────────────────────────────────────────────
  function loader(msg = '') {
    return `<div class="loader"><div class="spinner"></div>${msg ? '<span>' + msg + '</span>' : ''}</div>`;
  }

  function empty(icon, text, sub = '') {
    return `<div class="empty">
      <div class="empty-icon">${icon}</div>
      <div>${text}</div>
      ${sub ? '<small style="color:var(--muted)">' + sub + '</small>' : ''}
    </div>`;
  }

  return { fmt, fmtBig, fmtPct, timeAgo, shortAddr, toast, openSheet, closeSheet, copy, openLink, loader, empty };
})();

// Backward compat — глобальные функции которые уже используются в tma.html
window.showToast  = (msg) => UI.toast(msg);
window.openSheet  = (name) => UI.openSheet(name);
window.closeSheet = (name) => UI.closeSheet(name);
window.copyAddr   = (addr) => UI.copy(addr, 'Address copied!');
window.openExternal = (url) => UI.openLink(url);
