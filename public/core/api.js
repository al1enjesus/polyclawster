/**
 * api.js — единственное место где живут fetch-вызовы
 * Работает и в Telegram TMA и в браузере (web)
 */
'use strict';

const API = (() => {
  const BASE = '';  // same-origin

  function _fetch(url, opts) {
    return fetch(BASE + url, opts).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  return {
    /**
     * Загрузить портфель + сигналы для конкретного юзера
     * @param {string} tgId
     */
    getPortfolio(tgId) {
      return _fetch('/api/portfolio?tgId=' + encodeURIComponent(tgId || '') + '&_=' + Date.now());
    },

    /**
     * Live feed: whale trades + movers
     */
    getFeed() {
      return _fetch('/api/feed?_=' + Date.now());
    },

    /**
     * Кошелёк конкретного юзера
     * @param {string} tgId
     */
    getWallet(tgId) {
      return _fetch('/api/wallet?tgId=' + encodeURIComponent(tgId || '') + '&_=' + Date.now());
    },

    /**
     * Создать кошелёк
     */
    createWallet(tgId) {
      return _fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: String(tgId) }),
      });
    },

    /**
     * Вывод средств
     */
    withdraw(tgId, toAddress, amount) {
      return _fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgId: String(tgId), toAddress, amount }),
      });
    },

    /**
     * Транзакции
     */
    getTransactions(tgId) {
      return _fetch('/api/transactions?tgId=' + encodeURIComponent(tgId || '') + '&_=' + Date.now());
    },
  };
})();
