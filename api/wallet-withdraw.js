/**
 * /api/wallet-withdraw — вывод USDC с кошелька на Polygon
 * POST { tgId, toAddress, amount }
 * Комиссия: $1 + gas (автоматически)
 * Мин вывод: $10
 */
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e on Polygon
const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];
const RPC_URL = 'https://polygon-rpc.com';
const FEE_RECIPIENT = '0x6f314d7d2f50808cec1d26c1092e7729d9378d75'; // комиссия идёт на мастер-кошелёк
const FEE_AMOUNT = 1.0; // $1
const MIN_WITHDRAW = 10.0; // $10

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.json({ ok: false, error: 'POST only' }); return; }

  const { tgId, toAddress, amount } = req.body || {};

  // Валидация
  if (!tgId) return res.json({ ok: false, error: 'no tgId' });
  if (!toAddress || !ethers.utils.isAddress(toAddress))
    return res.json({ ok: false, error: 'Invalid address' });

  const amountNum = parseFloat(amount);
  if (!amountNum || isNaN(amountNum))
    return res.json({ ok: false, error: 'Invalid amount' });
  if (amountNum < MIN_WITHDRAW)
    return res.json({ ok: false, error: `Minimum withdrawal is $${MIN_WITHDRAW}` });

  // Загружаем кошелёк юзера
  const usersPath = path.join(process.cwd(), 'users.json');
  let users = {};
  try { users = JSON.parse(fs.readFileSync(usersPath, 'utf8')); } catch(e) {
    return res.json({ ok: false, error: 'Users DB error' });
  }

  const user = users[String(tgId)];
  if (!user || !user.privateKey)
    return res.json({ ok: false, error: 'Wallet not found' });

  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(user.privateKey, provider);
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);

    // Проверяем баланс
    const decimals = await usdc.decimals(); // 6
    const balance = await usdc.balanceOf(wallet.address);
    const balanceUSD = parseFloat(ethers.utils.formatUnits(balance, decimals));

    const totalNeeded = amountNum + FEE_AMOUNT;
    if (balanceUSD < totalNeeded)
      return res.json({ ok: false, error: `Insufficient balance. Have $${balanceUSD.toFixed(2)}, need $${totalNeeded.toFixed(2)} (inc. $${FEE_AMOUNT} fee)` });

    // Сначала отправляем комиссию $1 на мастер-кошелёк
    const feeAmt = ethers.utils.parseUnits(FEE_AMOUNT.toFixed(6), decimals);
    const feeTx = await usdc.transfer(FEE_RECIPIENT, feeAmt, { gasLimit: 100000 });
    await feeTx.wait(1);

    // Потом отправляем сумму юзеру
    const sendAmt = ethers.utils.parseUnits(amountNum.toFixed(6), decimals);
    const sendTx = await usdc.transfer(toAddress, sendAmt, { gasLimit: 100000 });
    const receipt = await sendTx.wait(1);

    // Обновляем запись
    if (!users[String(tgId)].history) users[String(tgId)].history = [];
    users[String(tgId)].history.push({
      hash: receipt.transactionHash,
      type: 'withdraw',
      amount: amountNum,
      fee: FEE_AMOUNT,
      toAddress,
      timestamp: Date.now(),
      explorerUrl: `https://polygonscan.com/tx/${receipt.transactionHash}`,
    });
    users[String(tgId)].lastWithdraw = {
      amount: amountNum, fee: FEE_AMOUNT, toAddress,
      txHash: receipt.transactionHash, timestamp: Date.now(),
    };
    if (users[String(tgId)].totalValue)
      users[String(tgId)].totalValue = Math.max(0, users[String(tgId)].totalValue - totalNeeded);
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    res.json({
      ok: true,
      data: {
        txHash: receipt.transactionHash,
        amount: amountNum,
        fee: FEE_AMOUNT,
        toAddress,
        explorerUrl: `https://polygonscan.com/tx/${receipt.transactionHash}`,
      }
    });

  } catch(e) {
    console.error('Withdraw error:', e.message);
    res.json({ ok: false, error: e.message?.slice(0, 200) || 'Transaction failed' });
  }
};
