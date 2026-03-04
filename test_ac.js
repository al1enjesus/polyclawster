const ac = require('@antiadmin/anticaptchaofficial');
ac.setAPIKey(process.env.TWOCAPTCHA_KEY || '');
(async () => {
  const balance = await ac.getBalance().catch(e => 'ERR: '+e.message);
  console.log('Balance:', balance);

  console.log('Submitting hCaptcha...');
  const token = await ac.solveHCaptchaProxyless(
    'https://discord.com/login',
    '4c672d35-0701-42b2-88c3-78380b0db560'
  ).catch(e => { console.log('Error:', e.message); return null; });

  if (token) console.log('✅ Token:', token.substring(0,80)+'...');
  else console.log('❌ Failed');
})();
