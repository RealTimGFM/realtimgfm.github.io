// Local-only Chrome QA; pass an existing Playwright module URL. No shipped dependency.
// node scripts/qa-schedulebooker.mjs file:///path/to/playwright/index.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.argv[2] || 'playwright');
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = resolve(root, 'build/qa-schedulebooker');
await mkdir(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer(async (request, response) => {
    const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    try { response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream'); response.end(await readFile(path)); }
    catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = { checks: [], errors: [], external: [], screenshots: [], geometry: [] };
async function newPage(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1536, height: 900 }, ...options });
    await context.route('**/*', route => {
        if (route.request().url().startsWith(url)) return route.continue();
        results.external.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => results.errors.push(error.message));
    await page.goto(url);
    return page;
}
const page = await newPage();
const scene = page.locator('[data-schedulebooker-journey]');
const control = name => scene.locator(`[data-sb-${name}]`);
const selectSlide = () => page.getByRole('button', { name: 'Show Schedule Booker, 3 of 5', exact: true }).click();
async function steps(count) {
    for (let i = 0; i < count; i++) {
        if (await control('next').getAttribute('aria-disabled') === 'true') break;
        await control('next').click();
    }
}
async function reset() { await control('scenario').selectOption('race'); }
async function capture(name, target = scene) {
    await target.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(450); // Let scroll/fixed chrome and the carousel crossfade settle.
    await target.screenshot({ path: resolve(output, name + '.png') }); results.screenshots.push(name + '.png');
}
async function settleStage(stage) {
    await page.waitForFunction(value => document.querySelector('[data-schedulebooker-journey]').dataset.stage === String(value), stage);
}
try {
    await scene.locator('[data-sb-controls]:not([hidden])').waitFor({ state: 'attached' });
    assert.deepEqual(await page.locator('.carousel-projects button').allTextContents(), ['FinCore', 'ForexAlert', 'Schedule Booker', 'PomodoroYT', 'Home Lab']);
    await page.waitForTimeout(4200);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-schedule-booker');
    assert.equal(await scene.getAttribute('data-stage'), '0');
    assert.equal(await scene.getAttribute('data-saved'), '0');
    await control('next').click();
    assert.equal(await page.locator('[data-featured-carousel]').getAttribute('data-pinned'), 'true');
    await page.waitForTimeout(2300);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-schedule-booker');
    results.checks.push('Exact five-project order, 2000ms previews, no automatic booking, engagement pins slide');

    for (const width of process.argv.includes('--interaction-only') ? [] : [1536, 768, 390, 320]) {
        await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
        for (const theme of ['light', 'dark']) {
            await page.locator('html').evaluate((element, value) => element.setAttribute('data-theme', value), theme);
            await reset();
            const geometry = await scene.evaluate(element => ({
                scrollWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
                targets: [...element.querySelectorAll('button, select, summary')].filter(item => item.checkVisibility()).map(item => {
                    const b = item.getBoundingClientRect(); return { text: item.textContent.trim(), width: b.width, height: b.height };
                }),
                boxes: [...element.querySelectorAll('.sb-browser, .sb-calendar, .sb-storage')].map(item => {
                    const b = item.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, scrollWidth: item.scrollWidth, clientWidth: item.clientWidth };
                })
            }));
            assert.ok(geometry.scrollWidth <= width, `No horizontal overflow ${width}/${theme}`);
            assert.ok(geometry.targets.every(box => box.height >= 44 && box.width >= 44), `44px targets ${width}/${theme}: ${JSON.stringify(geometry.targets)}`);
            assert.ok(geometry.boxes.every(box => box.scrollWidth <= box.clientWidth + 1), `No clipped objects ${width}/${theme}`);
            results.geometry.push({ width, theme, ...geometry });
            const prefix = `${width}-${theme}`;
            await capture(prefix + '-idle');
            await steps(2);
            assert.equal(await control('lock').getAttribute('data-sb-lock'), 'closed');
            assert.equal(await control('queue').isVisible(), true);
            assert.equal(await scene.getAttribute('data-saved'), '0');
            const tickets = await scene.locator('.sb-ticket').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
            assert.ok(tickets[0].right + 4 <= tickets[1].left, `Waiting tickets remain separate ${width}/${theme}`);
            await capture(prefix + '-lock');
            await steps(1);
            assert.equal(await control('slot-a').textContent(), 'Booked · A');
            assert.equal(await control('status-a').textContent(), 'Confirmed');
            assert.equal(await control('status-b').textContent(), 'Waiting');
            assert.equal(await control('lock').getAttribute('data-sb-lock'), 'open');
            await capture(prefix + '-winner');
            await steps(1);
            assert.equal(await control('status-b').textContent(), 'Checking again');
            await steps(1);
            assert.equal(await control('status-b').textContent(), 'Choose another time');
            assert.equal(await scene.getAttribute('data-saved'), '1');
            await capture(prefix + '-rejected');
            const recovery = await control('recover').boundingBox();
            assert.ok(recovery.width >= 44 && recovery.height >= 44);
            await control('recover').click(); await control('play').click();
            assert.equal(await scene.getAttribute('data-stage'), '6');
            await steps(2);
            assert.equal(await control('slot-b').textContent(), 'Booked · B');
            assert.equal(await control('status-b').textContent(), 'Confirmed');
            assert.equal(await scene.getAttribute('data-saved'), '2');
            await capture(prefix + '-recovery');
        }
        console.log(`Captured ${width}px in both themes`);
    }
    if (results.geometry.length) results.checks.push('4 widths × 2 themes × 5 required states, readable objects, zero overflow, 44px controls');
    await page.setViewportSize({ width: 1536, height: 900 });
    await page.locator('html').evaluate(element => element.setAttribute('data-theme', 'light'));
    await reset(); await steps(5);
    const saved = await scene.getAttribute('data-saved');
    await control('previous').click(); await control('previous').click();
    assert.match(await control('history').textContent(), /read-only snapshot.*1 saved appointment/);
    assert.equal(await scene.getAttribute('data-saved'), saved);
    await steps(12);
    await control('next').evaluate(element => { for (let i = 0; i < 20; i++) element.click(); });
    assert.equal(await scene.getAttribute('data-saved'), '1');
    await control('recover').click(); await control('play').click(); await steps(2);
    await steps(10);
    assert.equal(await scene.getAttribute('data-saved'), '2');
    await control('previous').click(); await steps(5);
    assert.equal(await scene.getAttribute('data-saved'), '2');
    await control('play').click(); await control('play').click();
    assert.match(await control('fixture').textContent(), /Watch again cleared/);
    assert.equal(await scene.getAttribute('data-saved'), '0');
    await control('reset').click();
    assert.equal(await scene.getAttribute('data-stage'), '0');
    results.checks.push('Read-only history preserves live ledger, repeated clicks cannot duplicate, Watch again and Start over explicitly clear fictional run');

    await control('scenario').selectOption('single'); await steps(8);
    assert.equal(await scene.getAttribute('data-stage'), '3');
    assert.equal(await scene.getAttribute('data-saved'), '1');
    assert.equal(await control('status-b').textContent(), 'Just browsing');
    assert.equal(await control('recover').isVisible(), false);
    assert.equal(await control('ticket-b').isVisible(), false);
    await capture('1536-single');
    results.checks.push('Single customer commits exactly once, B sends no request');

    await reset(); await control('play').click();
    await page.waitForTimeout(250);
    const first = await control('ticket-a').getAttribute('style');
    await page.waitForTimeout(250);
    assert.notEqual(await control('ticket-a').getAttribute('style'), first);
    await control('play').click();
    const paused = await control('ticket-a').getAttribute('style');
    await page.waitForTimeout(450);
    assert.equal(await control('ticket-a').getAttribute('style'), paused);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await control('ticket-a').getAttribute('style'), paused);
    await page.setViewportSize({ width: 1536, height: 900 });
    await control('play').click(); await settleStage(5);
    assert.equal(await scene.getAttribute('data-saved'), '1');
    await control('recover').click(); await settleStage(8);
    assert.equal(await scene.getAttribute('data-saved'), '2');
    await capture('1536-animated-recovery');
    results.checks.push('Request tickets actually travel, Pause freezes motion and data across resize, Continue runs to rejection, automatic recovery commits second time');

    await reset(); await control('play').click();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    const hiddenStage = await scene.getAttribute('data-stage');
    await page.waitForTimeout(1800);
    assert.equal(await scene.getAttribute('data-stage'), hiddenStage);
    assert.equal(await scene.getAttribute('data-running'), 'false');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await scene.getAttribute('data-running'), 'false');
    await control('play').click();
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(150);
    const offscreenStage = await scene.getAttribute('data-stage');
    await page.waitForTimeout(1700);
    assert.equal(await scene.getAttribute('data-stage'), offscreenStage);
    assert.equal(await scene.getAttribute('data-running'), 'false');
    await scene.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await control('play').click();
    await page.getByRole('button', { name: 'Show Home Lab, 5 of 5', exact: true }).click();
    const deactivatedStage = await scene.getAttribute('data-stage');
    await page.waitForTimeout(1700);
    assert.equal(await scene.getAttribute('data-stage'), deactivatedStage);
    await selectSlide();
    assert.equal(await scene.getAttribute('data-running'), 'false');
    await control('play').click();
    for (const scenario of ['single', 'race', 'single', 'race']) await control('scenario').selectOption(scenario);
    await page.waitForTimeout(1700);
    assert.equal(await scene.getAttribute('data-stage'), '0');
    await page.getByRole('button', { name: 'Resume project rotation', exact: true }).click();
    assert.equal(await scene.getAttribute('data-stage'), '0');
    await page.waitForTimeout(2150);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-pomodoroyt');
    await page.locator('#featured-pomodoroyt [data-py-next]').click();
    assert.equal(await page.locator('#featured-pomodoroyt [data-py-video]').textContent(), 'Playing');
    results.checks.push('Visibility event, actual offscreen scroll and slide deactivation halt work until deliberate continuation; rapid switches remove stale callbacks; Resume restores previews; PomodoroYT works');

    await selectSlide();
    await control('next').focus(); await page.keyboard.press('Enter');
    assert.equal(await scene.getAttribute('data-stage'), '1');
    await page.keyboard.press('Tab');
    assert.equal(await control('reset').evaluate(element => element === document.activeElement), true);
    const reduced = await newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    await reduced.waitForTimeout(2150);
    assert.equal(await reduced.locator('.featured-slide.is-active').getAttribute('id'), 'featured-fincore');
    await reduced.getByRole('button', { name: 'Show Schedule Booker, 3 of 5', exact: true }).click();
    await reduced.locator('[data-sb-play]').click();
    const fixed = await reduced.locator('[data-sb-ticket-a]').getAttribute('style');
    await reduced.waitForTimeout(400);
    assert.equal(await reduced.locator('[data-sb-ticket-a]').getAttribute('style'), fixed);
    await reduced.locator('[data-sb-play]').click();
    await reduced.locator('[data-sb-next]').click();
    assert.equal(await reduced.locator('[data-schedulebooker-journey]').getAttribute('data-stage'), '2');
    await reduced.locator('[data-schedulebooker-journey]').screenshot({ path: resolve(output, '390-reduced-motion.png') });
    results.screenshots.push('390-reduced-motion.png');
    await reduced.context().close();
    const nojs = await newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    assert.equal(await nojs.locator('[data-sb-play]').isVisible(), false);
    await nojs.screenshot({ path: resolve(output, '390-no-js.png') });
    results.screenshots.push('390-no-js.png');
    await nojs.context().close();
    const touch = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await touch.getByRole('button', { name: 'Show Schedule Booker, 3 of 5', exact: true }).tap();
    for (let i = 0; i < 5; i++) await touch.locator('[data-sb-next]').tap();
    await touch.locator('[data-sb-recover]').tap();
    assert.equal(await touch.locator('[data-schedulebooker-journey]').getAttribute('data-stage'), '6');
    await touch.locator('[data-sb-play]').tap();
    await touch.locator('[data-schedulebooker-journey]').screenshot({ path: resolve(output, '390-touch.png') });
    results.screenshots.push('390-touch.png');
    await touch.context().close();
    results.checks.push('Reduced motion removes spatial travel but retains manual steps, no-JS portfolio remains accessible, mobile touch recovery works');
    assert.deepEqual(results.errors, []);
    assert.deepEqual(results.external, []);
    console.log(JSON.stringify({ checks: results.checks, screenshots: results.screenshots.length, errors: results.errors, external: results.external }, null, 2));
} finally {
    await writeFile(resolve(output, process.argv.includes('--interaction-only') ? 'interactions.json' : 'results.json'), JSON.stringify(results, null, 2));
    await browser.close(); await new Promise(done => server.close(done));
}
