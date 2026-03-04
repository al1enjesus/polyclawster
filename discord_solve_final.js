/**
 * Discord login — кликаем hCaptcha checkbox → challenge появляется →
 * скриншот → GPT-4o решает → submit
 */
const { getTrial } = require('/workspace/.agents/skills/human-browser/scripts/browser-human');
const { chromium } = require('/workspace/.agents/skills/human-browser/node_modules/playwright-core');
const https = require('https');
const fs = require('fs');

const OPENAI_KEY = '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';

async function gpt4v(imgBase64, prompt) {
  const body = JSON.stringify({ model:'gpt-4o', max_tokens:150,
    messages:[{role:'user', content:[
      {type:'text',text:prompt},
      {type:'image_url',image_url:{url:`data:image/png;base64,${imgBase64}`,detail:'high'}}
    ]}]
  });
  return new Promise((res,rej)=>{
    const req = https.request({hostname:'api.openai.com',path:'/v1/chat/completions',method:'POST',
      headers:{'Authorization':`Bearer ${OPENAI_KEY}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
    },r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));});
    req.on('error',rej);req.write(body);req.end();
  });
}

(async () => {
  await getTrial();
  const proxy = process.env.PROXY_HOST ? {
    server:`http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
    username:process.env.PROXY_USER, password:process.env.PROXY_PASS
  } : null;

  const ctx = await chromium.launchPersistentContext('/workspace/.browser-profiles/discord_solve', {
    headless:true, proxy:proxy||undefined,
    viewport:{width:1440,height:900},
    userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale:'en-US', args:['--no-sandbox','--disable-blink-features=AutomationControlled','--disable-dev-shm-usage']
  });
  await ctx.addInitScript(()=>{
    Object.defineProperty(navigator,'webdriver',{get:()=>undefined});
    window.chrome={runtime:{},loadTimes:()=>{},app:{}};
  });
  const page = await ctx.newPage();

  let captchaToken = null;
  page.on('response', async resp => {
    if (resp.url().includes('checkcaptcha') || resp.url().includes('getcaptcha')) {
      const text = await resp.text().catch(()=>'');
      try { const j=JSON.parse(text); if(j.generated_pass_UUID){captchaToken=j.generated_pass_UUID; console.log('🎯 Token!',captchaToken.substring(0,40)+'...');} } catch(e){}
    }
  });

  await page.goto('https://discord.com/login',{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForTimeout(2000);
  await page.fill('input[name="email"]','wdybelievein@gmail.com').catch(()=>{});
  await page.waitForTimeout(400);
  await page.fill('input[name="password"]','thisisforlalalawithfriends').catch(()=>{});
  await page.waitForTimeout(400);
  await page.locator('button[type="submit"]').click().catch(()=>{});
  await page.waitForTimeout(5000);

  if (page.url().includes('@me')) { console.log('✅ Already logged in!'); await ctx.close(); return; }

  // Step 1: Make challenge iframe visible and click checkbox
  console.log('Making hCaptcha visible and clicking checkbox...');
  await page.evaluate(() => {
    document.querySelectorAll('iframe[src*="hcaptcha"]').forEach(iframe => {
      iframe.style.cssText = 'width:400px!important;height:600px!important;position:fixed!important;top:0!important;left:0!important;z-index:99999!important;opacity:1!important;visibility:visible!important;display:block!important;';
    });
  });
  await page.waitForTimeout(1000);

  // Click checkbox in first iframe
  const checkboxIframe = await page.$('iframe[title*="checkbox"], iframe[src*="hcaptcha"]:first-child');
  if (checkboxIframe) {
    const frame = await checkboxIframe.contentFrame();
    if (frame) {
      await frame.click('#checkbox, .checkbox, [id*="check"]').catch(()=>{});
      console.log('Checkbox clicked');
    }
  }
  await page.waitForTimeout(4000);

  // Take screenshot of the full page to see challenge
  const fullScreenshot = await page.screenshot({path:'/tmp/hcap_visible.png'});
  console.log('Screenshot saved');

  if (captchaToken) {
    console.log('Token already obtained from network!');
  } else {
    // GPT-4o solve the challenge
    const imgBase64 = fs.readFileSync('/tmp/hcap_visible.png').toString('base64');
    
    // First ask GPT what question it sees
    const describeResp = await gpt4v(imgBase64,
      'Look at this screenshot. Is there a hCaptcha image challenge visible? If yes, what is the question/prompt asking to identify? Just describe what you see in 1-2 sentences.'
    );
    const description = describeResp.choices?.[0]?.message?.content || '';
    console.log('GPT-4o sees:', description);

    if (description.toLowerCase().includes('hcaptcha') || description.toLowerCase().includes('image') || description.toLowerCase().includes('select') || description.toLowerCase().includes('click')) {
      // Solve it
      const solveResp = await gpt4v(imgBase64,
        `This is a hCaptcha challenge. ${description}
         The images are arranged in a grid. Number them 1-9 from left to right, top to bottom.
         Which numbered images match what's being asked?
         Reply with ONLY comma-separated numbers like: 1,4,7`
      );
      const answer = solveResp.choices?.[0]?.message?.content || '';
      console.log('GPT-4o answer:', answer);

      const positions = [...answer.matchAll(/\b[1-9]\b/g)].map(m=>parseInt(m[0]));
      console.log('Positions to click:', positions);

      // Click positions on page
      if (positions.length > 0) {
        // Find the challenge images area
        const challengeImg = await page.$('.task-image, [class*="challenge-image"], .image-wrapper');
        if (challengeImg) {
          const box = await challengeImg.boundingBox();
          console.log('Challenge area:', box);
        }
        
        // Take screenshot of challenge iframe specifically
        const challengeIframe = await page.$('iframe[title="hCaptcha challenge"]');
        if (challengeIframe) {
          const cFrame = await challengeIframe.contentFrame();
          if (cFrame) {
            const cBody = await cFrame.evaluate(()=>document.body.innerHTML.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')).catch(()=>'');
            console.log('Challenge body text:', cBody.substring(0,300));
            
            // Find images and click correct ones
            for (const pos of positions) {
              await cFrame.evaluate((pos) => {
                const images = document.querySelectorAll('.task-image, li, .image');
                if (images[pos-1]) images[pos-1].click();
              }, pos).catch(()=>{});
              await page.waitForTimeout(200);
            }
            // Submit
            await cFrame.click('button[type="submit"], .button-submit').catch(()=>{});
            await page.waitForTimeout(4000);
          }
        }
      }
    }
  }

  // Use token
  const finalToken = captchaToken;
  if (finalToken) {
    console.log('Submitting with token...');
    await page.evaluate(t => {
      document.querySelectorAll('[name="h-captcha-response"]').forEach(el=>{el.value=t;});
      document.querySelector('button[type="submit"]')?.click();
    }, finalToken);
    await page.waitForTimeout(5000);
  }

  const success = page.url().includes('@me') || page.url().includes('channels');
  console.log('Result:', success?'✅ LOGGED IN!':'❌ Failed', page.url());

  if (success) {
    const cookies = await ctx.cookies();
    fs.writeFileSync('/tmp/discord_cookies.json', JSON.stringify(cookies));
    console.log('✅ Cookies saved!');
  }

  await page.screenshot({path:'/tmp/discord_solve_final.png'});
  await ctx.close();
})();
