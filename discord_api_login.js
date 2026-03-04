/**
 * Discord login via REST API with curl-impersonate TLS fingerprint
 * Bypasses browser detection + hCaptcha trigger
 */
const { exec } = require('child_process');
const fs = require('fs');

const CURL = '/tmp/curl_chrome116';

function curlPost(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const headerArgs = Object.entries(headers).map(([k,v]) => `-H '${k}: ${v}'`).join(' ');
    const cmd = `${CURL} -s -X POST '${url}' ${headerArgs} -d '${JSON.stringify(data).replace(/'/g, "'\\''")}'`;
    exec(cmd, { maxBuffer: 5*1024*1024 }, (err, stdout) => {
      if (err && !stdout) return reject(err);
      try { resolve(JSON.parse(stdout)); } catch(e) { resolve({ raw: stdout }); }
    });
  });
}

(async () => {
  console.log('Logging into Discord via API...');

  const res = await curlPost(
    'https://discord.com/api/v9/auth/login',
    {
      login: 'wdybelievein@gmail.com',
      password: 'thisisforlalalawithfriends',
      undelete: false,
      captcha_key: null,
      login_source: null,
      gift_code_sku_id: null
    },
    {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Origin': 'https://discord.com',
      'Referer': 'https://discord.com/login',
      'X-Discord-Locale': 'en-US',
      'X-Discord-Timezone': 'Europe/London',
      'X-Super-Properties': Buffer.from(JSON.stringify({
        os: 'Mac OS X', browser: 'Chrome', device: '',
        system_locale: 'en-US', browser_user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        browser_version: '122.0.0.0', os_version: '10.15.7',
        referrer: '', referring_domain: '', referrer_current: '', referring_domain_current: '',
        release_channel: 'stable', client_build_number: 9999, client_event_source: null
      })).toString('base64')
    }
  );

  console.log('Response:', JSON.stringify(res, null, 2));

  if (res.token) {
    console.log('\n✅ Got token!', res.token.substring(0,30)+'...');
    fs.writeFileSync('/tmp/discord_token.json', JSON.stringify({ token: res.token }));
  } else if (res.captcha_key) {
    console.log('\n⚠️ Captcha required. Service:', res.captcha_service, '| Key:', res.captcha_key?.[0]);
  } else if (res.mfa) {
    console.log('\n⚠️ MFA required. Ticket:', res.ticket);
  } else {
    console.log('\n❌ Unknown response');
  }
})();
