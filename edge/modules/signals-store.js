/**
 * signals-store.js — Persistent signal history
 * Keeps last 200 signals, deduped by market+type+side
 * Survives restarts, used by TMA and API
 */
const fs   = require('fs');
const path = require('path');

const STORE_FILE = '/workspace/edge/db/signals_history.json';
const MAX_SIGNALS = 200;

function load() {
  try { return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); }
  catch { return []; }
}

function save(signals) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(signals, null, 2));
}

function upsert(newSignals) {
  const existing = load();
  const now = Date.now();

  for (const s of newSignals) {
    const key = `${s.type}:${(s.market||s.title||'').slice(0,50)}:${s.side||''}`;
    const idx = existing.findIndex(e => e._key === key);
    const entry = { ...s, _key: key, _updatedAt: now };
    if (idx >= 0) {
      existing[idx] = entry;
    } else {
      existing.unshift(entry);
    }
  }

  // Keep only MAX_SIGNALS, sorted by score desc then updatedAt desc
  const sorted = existing
    .sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b._updatedAt || 0) - (a._updatedAt || 0);
    })
    .slice(0, MAX_SIGNALS);

  save(sorted);
  return sorted;
}

function getAll(limit = 50) {
  return load().slice(0, limit);
}

function getStrong(minScore = 7) {
  return load().filter(s => (s.score || 0) >= minScore);
}

module.exports = { upsert, getAll, getStrong, load, save };
