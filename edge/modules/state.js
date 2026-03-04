/**
 * edge/modules/state.js — Persistent state management
 */
const fs = require('fs');

function load(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadSet(file) {
  try { return new Set(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { return new Set(); }
}

function saveSet(file, set, limit = 15000) {
  fs.writeFileSync(file, JSON.stringify([...set].slice(-limit)));
}

module.exports = { load, save, loadSet, saveSet };
