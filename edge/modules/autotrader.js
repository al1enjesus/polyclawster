/**
 * Auto-trader for user wallets
 * Executes signals on behalf of registered users
 */
const { getActiveUsers, recordTrade } = require('./users');
const { executeOrder } = require('./trade');

const MAX_BET_PER_USER = 50;  // max $50 per signal per user
const MIN_BALANCE      = 10;  // don't trade if balance < $10

async function executeSingleUser(user, signal) {
  try {
    // Check USDC balance
    const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
    const r = await (await fetch)(
      `https://data-api.polymarket.com/positions?user=${user.address}&limit=1`
    );
    // Get available balance
    const balRes = await (await fetch)(
      `https://api.polymarket.com/balance?address=${user.address}`
    );
    const balData = await balRes.json().catch(()=>({}));
    const balance = parseFloat(balData.balance || balData.USDC || 0);

    if (balance < MIN_BALANCE) {
      return { skip: true, reason: `balance too low: $${balance}` };
    }

    // Size: 20% of balance, max $50
    const size = Math.min(balance * 0.2, MAX_BET_PER_USER);
    if (size < 5) return { skip: true, reason: 'size too small' };

    // Execute using user's private key
    const result = await executeOrder({
      privateKey:  user.privateKey,
      market:      signal.market,
      conditionId: signal.conditionId,
      side:        signal.side || 'YES',
      size:        Math.round(size * 100) / 100,
      price:       signal.price || 0.5
    });

    return { ok: true, size, result };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// Execute signal for ALL active users
async function executeForAllUsers(signal) {
  const users   = getActiveUsers();
  const results = [];

  for (const user of users) {
    const res = await executeSingleUser(user, signal);
    results.push({ telegramId: user.telegramId, address: user.address, ...res });
    await new Promise(r => setTimeout(r, 300)); // rate limit
  }

  console.log(`[autotrader] Executed signal for ${users.length} users:`, 
    results.filter(r=>r.ok).length, 'success,',
    results.filter(r=>r.skip).length, 'skipped,',
    results.filter(r=>r.ok===false).length, 'failed'
  );
  return results;
}

module.exports = { executeForAllUsers, executeSingleUser };
