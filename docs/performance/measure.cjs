// Optional local QA: see ../performance.md for Playwright and snapshot setup.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');
(async()=>{
const label=process.argv[2]||'baseline';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[];
for(const width of [1440,390]) for(let run=0;run<3;run++) {
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:width===390?2:1});
 const page=await context.newPage();
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const session=await context.newCDPSession(page);
 await session.send('Network.enable');
 await session.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
 await session.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
  window.audit={lcp:0,cls:0,longTasks:0,tbt:0};
  new PerformanceObserver(l=>{for(const e of l.getEntries())audit.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)audit.cls+=e.value}).observe({type:'layout-shift',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries()){audit.longTasks++;audit.tbt+=Math.max(0,e.duration-50)}}).observe({type:'longtask',buffered:true});
 });
 await page.goto(`http://127.0.0.1:8765/${label}/`,{waitUntil:'networkidle'});
 await page.waitForTimeout(2000);
 results.push(await page.evaluate(({width,run})=>{
 const resources=performance.getEntriesByType('resource').filter(x=>x.name.startsWith(location.origin)); const nav=performance.getEntriesByType('navigation')[0];
 return {width,run,...audit,fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,dcl:nav.domContentLoadedEventEnd,bytes:resources.reduce((a,x)=>a+x.encodedBodySize,nav.encodedBodySize),requests:resources.length+1,cssRequests:resources.filter(x=>x.name.endsWith('.css')).length,modelRequests:resources.filter(x=>/\.glb$|model-viewer.min.js/.test(x.name)).length,portrait:document.querySelector('.hero-photo img').currentSrc,resources:resources.map(x=>({url:x.name.replace(location.origin,''),bytes:x.encodedBodySize}))};
 },{width,run}));
 await context.close();
}
fs.writeFileSync(`/tmp/portfolio-perf/${label}-metrics.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({resources,...x})=>x),null,2)); await browser.close();
})();
