/**
 * hCaptcha solver using 2captcha
 * NOTE: requires hCaptcha to be enabled in 2captcha account settings
 * Go to: https://2captcha.com/setting → enable "hCaptcha"
 * 
 * Alternative: use capsolver.com (has free trial, supports hCaptcha natively)
 */
const https = require('https');

const TWOCAPTCHA_KEY = process.env.TWOCAPTCHA_KEY || '';

async function solveHCaptcha(sitekey, pageUrl, apiKey = TWOCAPTCHA_KEY) {
  // Submit
  const params = new URLSearchParams({
    key: apiKey,
    method: 'hcaptcha',
    sitekey: sitekey,
    pageurl: pageUrl,
    json: '1'
  });
  
  const submit = await fetch(`https://2captcha.com/in.php`, {
    method: 'POST',
    body: params
  }).then(r => r.json());
  
  if (submit.status !== 1) throw new Error(`Submit failed: ${JSON.stringify(submit)}`);
  console.log('Task ID:', submit.request);
  
  // Poll
  await new Promise(r => setTimeout(r, 20000));
  for (let i = 0; i < 12; i++) {
    const result = await fetch(
      `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${submit.request}&json=1`
    ).then(r => r.json());
    
    if (result.status === 1) return result.request;
    if (result.request !== 'CAPCHA_NOT_READY') throw new Error(`Poll failed: ${JSON.stringify(result)}`);
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Timeout');
}

// For Discord specifically - try passthrough approach
// Discord hCaptcha Enterprise sometimes skips challenge for "trusted" clients
async function getDiscordToken(sitekey = '4c672d35-0701-42b2-88c3-78380b0db560') {
  // Try hcaptcha.com directly to get a passcode
  const res = await fetch(`https://hcaptcha.com/checksiteconfig?v=1&host=discord.com&sitekey=${sitekey}&sc=1&swa=1`)
    .then(r => r.json()).catch(() => null);
  console.log('hCaptcha site config:', JSON.stringify(res, null, 2));
  return res;
}

module.exports = { solveHCaptcha, getDiscordToken };

// Test
(async () => {
  console.log('Checking hCaptcha config for Discord...');
  const config = await getDiscordToken();
  console.log('Pass:', config?.pass, '— if true, no challenge needed!');
  
  console.log('\nNote: To solve hCaptcha via 2captcha:');
  console.log('1. Login to 2captcha.com');
  console.log('2. Settings → Captcha types → Enable hCaptcha');
  console.log('3. Then call solveHCaptcha(sitekey, pageUrl)');
})();
