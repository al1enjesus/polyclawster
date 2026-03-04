/**
 * router.js — управление табами и экранами
 *
 * Таб = верхний уровень (portfolio, signals, stats, wallet)
 * Экран = любой screen внутри таба (detail, onboarding, etc.)
 */
'use strict';

const Router = (() => {
  let _current = 'portfolio';
  let _history = ['portfolio'];

  // Реестр табов: { id → { onEnter, onLeave } }
  const _tabs = {};

  function register(tabId, handlers = {}) {
    _tabs[tabId] = handlers;
  }

  function showTab(tabId) {
    const prev = _current;

    // Update nav
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('nb-' + tabId);
    if (btn) btn.classList.add('active');

    // Hide all screens, show target
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + tabId);
    if (screen) screen.classList.add('active');

    // Lifecycle
    if (prev !== tabId && _tabs[prev] && _tabs[prev].onLeave) {
      try { _tabs[prev].onLeave(); } catch(e) {}
    }
    if (_tabs[tabId] && _tabs[tabId].onEnter) {
      try { _tabs[tabId].onEnter(); } catch(e) {}
    }

    _current = tabId;
    _history = [tabId];
    window._tab = tabId;  // backward compat
    window.scrollTo(0, 0);
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + screenId);
    if (screen) screen.classList.add('active');
    _history.push(screenId);
    window.scrollTo(0, 0);
  }

  function back() {
    _history.pop();
    const prev = _history[_history.length - 1] || _current;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + prev);
    if (screen) screen.classList.add('active');
  }

  function current() { return _current; }

  return { register, showTab, showScreen, back, current };
})();
