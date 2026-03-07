/**
 * edge/modules/channels.js — Channel registry
 * Stores Telegram channel IDs where bot is admin
 * Bot auto-registers on my_chat_member events
 */
'use strict';
const fs  = require('fs');
const DIR = '/workspace/edge/data';
const FILE = DIR + '/channels.json';

function ensure() { if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true }); }

function loadChannels() {
  ensure();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}

function saveChannels(channels) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(channels, null, 2));
}

function addChannel(id, title, username) {
  const channels = loadChannels();
  const existing = channels.find(c => String(c.id) === String(id));
  if (!existing) {
    channels.push({ id: String(id), title: title || '', username: username || '', addedAt: new Date().toISOString() });
    saveChannels(channels);
    console.log(`[channels] ✅ Registered: ${title || id}`);
    return true;
  }
  return false;
}

function removeChannel(id) {
  const channels = loadChannels();
  const filtered = channels.filter(c => String(c.id) !== String(id));
  if (filtered.length < channels.length) { saveChannels(filtered); return true; }
  return false;
}

module.exports = { loadChannels, addChannel, removeChannel };
