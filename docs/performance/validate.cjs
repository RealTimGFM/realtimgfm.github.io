// Optional local QA: see ../performance.md for Playwright and snapshot setup.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const label=process.argv[2]||'after'; const results=[];
 for(const width of [1440,820,390,320]) {
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:width<500?2:1,reducedMotion:'reduce'});
  const page=await context.newPage(); const requests=[]; const errors=[]; let sdkAttempts=0;
  page.on('request',r=>requests.push(r.url())); page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async r=>{
   if(r.request().url().includes('email.min.js')) {
    sdkAttempts++;
    if(label==='after' && sdkAttempts===1)return r.abort();
    return r.fulfill({contentType:'application/javascript',body:'window.sent=[];window.emailjs={init(){},async send(...args){window.sent.push(args)}}'});
   }
   return new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort();
  });
  await page.goto(`http://127.0.0.1:8765/${label}/`,{waitUntil:'networkidle'});
  await page.addStyleTag({content:'*,*::before,*::after {animation:none !important; transition:none !important;} .hero-copy > *, .hero-photo-wrap {opacity:1 !important;} html {scroll-behavior:auto !important;}'});
  assert.equal(await page.locator('#homelabDetails').isVisible(),false);
  assert.equal(requests.filter(x=>/\.glb$|model-viewer.min.js/.test(x)).length,0);
  if(label==='after')assert.equal(sdkAttempts,0);
  const portrait=await page.locator('.hero-photo img').evaluate(i=>({source:i.currentSrc,width:i.getBoundingClientRect().width}));
  if(width<=768){await page.locator('#navToggle').click();assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'),'true');}
  await page.locator('#menu a[href="#projects"]').click();
  assert.equal(await page.locator('#projectsGrid .card:visible').count(),4);
  await page.locator('#projectsToggle').click();assert.equal(await page.locator('#projectsGrid .card:visible').count(),11);
  await page.locator('#projectsToggle').click();assert.equal(await page.locator('#projectsGrid .card:visible').count(),4);
  await page.locator('#homelabToggle').click();
  await page.locator('#homelabThinkpad').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.homelab-hardware-server').dataset.modelState==='ready',null,{timeout:60000});
  await page.locator('#homelabRaspberry').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.homelab-hardware')].every(c=>c.dataset.modelState==='ready'),null,{timeout:60000});
  for(const id of ['homelabThinkpad','homelabRaspberry']) {
   const viewer=page.locator('#'+id); const card=page.locator('.homelab-hardware').filter({has:viewer});
   await viewer.scrollIntoViewIfNeeded();
   assert.equal(await viewer.getAttribute('auto-rotate'),null);
   const before=await viewer.evaluate(v=>v.getCameraOrbit().radius);
   await card.locator('[data-model-action="zoom-in"]').click();
   assert((await viewer.evaluate(v=>v.getCameraOrbit().radius))<before);
   await card.locator('[data-model-action="reset"]').click();
   await viewer.locator('.userInput').focus();
   const initialTheta=await viewer.evaluate(v=>v.getCameraOrbit().theta);
   await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
   const keyboardTheta=await viewer.evaluate(v=>v.getCameraOrbit().theta);
   assert.notEqual(initialTheta,keyboardTheta);
   const b=await viewer.boundingBox();
   await page.mouse.move(b.x+b.width/2,b.y+b.height/2); await page.mouse.down(); await page.mouse.move(b.x+b.width*.75,b.y+b.height/2,{steps:8});await page.mouse.up();
   await page.waitForTimeout(300);
   assert.notEqual(await viewer.evaluate(v=>v.getCameraOrbit().theta),keyboardTheta);
   await card.locator('[data-model-action="reset"]').click();
   for(const theme of ['dark','light']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    await page.waitForTimeout(100);
    await card.screenshot({path:`/tmp/portfolio-perf/${label}-${id}-${width}-${theme}.png`});
   }
  }
  const operations=[];
  for(const theme of ['dark','light']){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   for(const operation of await page.locator('.homelab-operation').all()){
    const img=operation.locator('img'); await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());
    const layout=await img.evaluate(i=>({width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height,source:i.currentSrc,ratio:i.naturalWidth/i.naturalHeight}));
    assert(Math.abs(layout.height-layout.width/layout.ratio)<=1);
    if(theme==='dark')operations.push(layout);
    if(width===1440||width===390) await operation.screenshot({path:`/tmp/portfolio-perf/${label}-${await operation.getAttribute('aria-labelledby')}-${width}-${theme}.png`});
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  if(label==='after') {
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.locator('#homelabThinkpad').scrollIntoViewIfNeeded();
   await page.waitForTimeout(3200);
   assert.equal(await page.locator('#homelabThinkpad').getAttribute('auto-rotate'),'');
   await page.locator('#home').scrollIntoViewIfNeeded();await page.waitForTimeout(300);
   assert.equal(await page.locator('#homelabThinkpad').getAttribute('auto-rotate'),null);
   await page.locator('#homelabThinkpad').scrollIntoViewIfNeeded();await page.waitForTimeout(300);
   assert.equal(await page.locator('#homelabThinkpad').getAttribute('auto-rotate'),'');
  }
  await page.locator('#homelabCollapse').click();
  assert.equal(await page.locator('#homelabDetails').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'homelabToggle');
  if(label==='after')assert.equal(await page.locator('#homelabThinkpad').getAttribute('auto-rotate'),null);
  await page.locator('#name').fill('Local QA');
  await page.locator('#email').fill('not-an-email');await page.locator('#msg').fill('Transport is mocked; no email sent.');
  await page.waitForTimeout(1250);await page.locator('#contactForm button').click();
  assert.match(await page.locator('#contactForm #status').textContent(),/valid email/);
  await page.locator('#email').fill('qa@example.com');await page.locator('#contactForm button').click();
  await page.waitForFunction(()=>document.getElementById('status').dataset.state==='success');
  await page.locator('#name').fill('Second QA');await page.locator('#email').fill('qa@example.com');await page.locator('#msg').fill('Second mocked delivery.');
  await page.waitForTimeout(1250);await page.locator('#contactForm button').click();await page.waitForFunction(()=>window.sent.length===2);
  assert.equal(await page.locator('#contactForm button').isEnabled(),true);
  if(width<=768)await page.locator('#navToggle').click();
  const oldTheme=await page.locator('html').getAttribute('data-theme');await page.locator('#themeToggle').click();assert.notEqual(await page.locator('html').getAttribute('data-theme'),oldTheme);
  assert.deepEqual(errors,[]);
  assert.equal(requests.filter(x=>/gstatic.*(draco|basis)|\.wasm/.test(x)).length,0);
  results.push({width,portrait,operations,sdkAttempts,modelRequests:requests.filter(x=>/\.glb$|model-viewer.min.js/.test(x)),errors});
  await context.close();
 }
 const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await nojs.goto(`http://127.0.0.1:8765/${label}/`);assert(await nojs.locator('#homelabDetails').isVisible());assert.equal(await nojs.locator('.homelab-model-fallback:visible').count(),2);
 fs.writeFileSync(`/tmp/portfolio-perf/${label}-validation.json`,JSON.stringify(results,null,2));console.log('PASS desktop/tablet/mobile 1440,820,390,320; themes; real local GLBs; controls; motion; operations; navigation; projects; contact retries with mocked transport; no JS fallback.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
