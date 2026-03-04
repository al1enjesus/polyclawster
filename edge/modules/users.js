/**
 * User wallet management
 * Stores encrypted user wallets, tracks P&L, calculates 5% performance fee
 */
const fs   = require('fs');
const path = require('path');
const { ethers } = require('ethers') ;

const USERS_FILE = '/workspace/edge/data/users.json';
const FEE_PCT    = 0.05; // 5% performance fee

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveUsers(u) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));
}

// Register user wallet (from private key)
function registerWallet(telegramId, privateKey) {
  try {
    const wallet = new ethers.Wallet(privateKey);
    const users  = loadUsers();
    users[telegramId] = {
      telegramId,
      address:    wallet.address,
      privateKey, // TODO: encrypt in production
      createdAt:  Date.now(),
      totalDeposited: 0,
      totalProfit:    0,
      totalFeesPaid:  0,
      trades: [],
      active: true
    };
    saveUsers(users);
    return { ok: true, address: wallet.address };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// Get user by telegram ID
function getUser(telegramId) {
  return loadUsers()[String(telegramId)] || null;
}

// Record a trade result and calculate fee
function recordTrade(telegramId, trade) {
  const users = loadUsers();
  const u = users[String(telegramId)];
  if (!u) return null;

  const profit = trade.profit || 0;
  const fee    = profit > 0 ? Math.round(profit * FEE_PCT * 100) / 100 : 0;

  u.trades.push({ ...trade, fee, ts: Date.now() });
  u.totalProfit   += profit;
  u.totalFeesPaid += fee;
  saveUsers(users);

  return { profit, fee, totalProfit: u.totalProfit, totalFeesPaid: u.totalFeesPaid };
}

// Get all active users with wallets
function getActiveUsers() {
  const users = loadUsers();
  return Object.values(users).filter(u => u.active && u.privateKey);
}

// Portfolio stats per user
function getUserStats(telegramId) {
  const u = getUser(telegramId);
  if (!u) return null;
  const wins   = u.trades.filter(t => t.profit > 0).length;
  const losses = u.trades.filter(t => t.profit < 0).length;
  return {
    address:      u.address,
    trades:       u.trades.length,
    wins, losses,
    winRate:      u.trades.length ? Math.round(wins / u.trades.length * 100) : 0,
    totalProfit:  u.totalProfit,
    totalFees:    u.totalFeesPaid,
    netProfit:    u.totalProfit - u.totalFeesPaid
  };
}

module.exports = { registerWallet, getUser, getActiveUsers, recordTrade, getUserStats, FEE_PCT };
