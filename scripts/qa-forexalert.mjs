// Local Chrome visual/functional QA. Optional Playwright path; no shipped dependency.
// node scripts/qa-forexalert.mjs file:///path/to/playwright/index.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.argv[2] || 'playwright');
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = resolve(root, 'build/qa-forexalert-simple');
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
const context = await browser.newContext({ viewport: { width: 1536, height: 900 } });
const page = await context.newPage();
page.on('pageerror', error => results.errors.push(error.message));
page.on('request', request => { if (!request.url().startsWith(url) && !request.url().startsWith('data:')) results.external.push(request.url()); });
const fx = page.locator('[data-forexalert-journey]');
const control = name => fx.locator(`[data-fx-${name}]`);
const choose = name => control('scenario').selectOption(name);
async function steps(count) {
    for (let i = 0; i < count; i++) {
        if (await control('next').getAttribute('aria-disabled') === 'true') break;
        await control('next').click();
    }
}
const scenarioSteps = { valid: 7, below: 4, duplicate: 5, cooldown: 5, closed: 1 };
async function finish(name) { await choose(name); await steps(scenarioSteps[name]); }
async function capture(name) {
    await fx.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await fx.screenshot({ path: resolve(output, name + '.png') });
    results.screenshots.push(name + '.png');
}
async function captureSlide(targetPage, name) {
    await targetPage.locator('#featured-forexalert').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await targetPage.waitForTimeout(450); // Settle crossfade; keep fixed offscreen chrome outside the capture.
    await targetPage.locator('#featured-forexalert').screenshot({ path: resolve(output, name + '.png') });
    results.screenshots.push(name + '.png');
}
try {
    await page.goto(url);
    await fx.locator('[data-fx-controls]:not([hidden])').waitFor({ state: 'attached' });
    assert.deepEqual(await page.locator('.carousel-projects button').allTextContents(), ['FinCore', 'ForexAlert', 'Schedule Booker', 'PomodoroYT', 'Home Lab']);
    await page.waitForTimeout(2150);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-forexalert');
    assert.equal(await fx.getAttribute('data-stage'), '0');
    assert.deepEqual(await control('scenario').locator('option').allTextContents(), ['Price goes up', 'Small price change', 'Repeated alert', 'Another alert too soon', 'Market closed']);
    assert.equal(await fx.locator('[data-fx-retry]').count(), 0);
    await control('play').click();
    await control('play').click();
    assert.equal(await page.locator('[data-featured-carousel]').getAttribute('data-pinned'), 'true');
    await page.getByRole('button', { name: 'Show ForexAlert, 2 of 5', exact: true }).click();
    await page.waitForTimeout(8300);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-forexalert');
    results.checks.push('Exact order, 2000ms preview, static activation, interaction pin and manual selection holds beyond 8s');

    for (const width of process.argv.includes('--interaction-only') ? [] : [1536, 768, 390, 320]) {
        await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
        for (const theme of ['light', 'dark']) {
            await page.locator('html').evaluate((element, value) => element.setAttribute('data-theme', value), theme);
            await choose('valid');
            const geometry = await fx.evaluate(element => {
                const bounds = item => { const b = item.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
                return { scrollWidth: document.documentElement.scrollWidth, width: document.documentElement.clientWidth,
                    chart: bounds(element.querySelector('[data-fx-chart]')), run: bounds(element.querySelector('[data-fx-play]')),
                    baselineLabel: bounds(element.querySelector('[data-fx-baseline-label]')),
                    marker: bounds(element.querySelector('[data-fx-marker]')),
                    targets: [...element.querySelectorAll('button:not([hidden]), select')].filter(item => item.checkVisibility()).map(bounds) };
            });
            assert.ok(geometry.scrollWidth <= width, `No overflow at ${width}/${theme}`);
            assert.ok(geometry.targets.every(target => target.height >= 44 && target.width >= 44), `44px targets at ${width}/${theme}`);
            assert.ok(geometry.baselineLabel.x >= geometry.marker.x + geometry.marker.width + 8,
                `Previous-close label has clear space away from the idle marker at ${width}/${theme}`);
            results.geometry.push({ width, theme, ...geometry });
            await capture(`${width}-${theme}-idle`);
            await steps(3);
            assert.equal(await fx.getAttribute('data-crossed'), 'true');
            await capture(`${width}-${theme}-crossing`);
            await steps(3);
            assert.match(await control('output').textContent(), /✓ Alert recorded/);
            assert.equal(await control('memory').textContent(), 'No earlier alert saved.', 'Send succeeds before mark');
            await steps(1);
            assert.equal(await fx.getAttribute('data-outcome'), 'success');
            assert.match(await control('memory').textContent(), /earlier alert/);
            await capture(`${width}-${theme}-success`);
            for (const name of ['below', 'duplicate', 'cooldown', 'closed']) {
                await finish(name);
                assert.equal(await fx.getAttribute('data-outcome'), name);
                assert.equal(await fx.locator('[data-fx-gate="commit"]').getAttribute('data-status'), 'waiting');
                assert.doesNotMatch(await control('output').textContent(), /✓/);
                assert.equal(await control('output').textContent(), 'No new alert recorded', 'Stopped examples must not look as if they are still checking');
                if (name === 'below') {
                    assert.equal(await control('mid').textContent(), '1.1044');
                    assert.equal(await fx.getAttribute('data-crossed'), 'false');
                }
                await capture(`${width}-${theme}-${name}`);
            }
        }
        console.log(`Captured ${width}px in both themes`);
    }
    if (results.geometry.length) results.checks.push('8 viewport/theme layouts and 56 captures: idle, crossing and all five outcomes; 44px controls and no overflow');

    await page.setViewportSize({ width: 1536, height: 900 });
    await finish('valid');
    const ledger = await control('memory').textContent();
    const log = await control('log-line').textContent();
    await control('previous').click();
    assert.match(await control('result').textContent(), /Earlier step/);
    assert.equal(await control('memory').textContent(), ledger);
    await steps(3);
    assert.equal(await control('log-line').textContent(), log);
    await control('replay').click();
    await steps(7);
    assert.equal(await fx.getAttribute('data-outcome'), 'duplicate');
    await control('reset').click(); await control('cancel-reset').click();
    assert.equal(await control('memory').textContent(), ledger);
    await control('reset').click(); await control('confirm-reset').click();
    assert.equal(await control('memory').textContent(), 'No earlier alert saved.');
    results.checks.push('History cannot roll back/double commit, replay suppresses same input, reset requires explicit clear');

    await choose('valid'); await control('play').click();
    try {
        await page.waitForFunction(() => document.querySelector('[data-forexalert-journey]').dataset.stage === '3', null, { timeout: 15000 });
    } catch (error) {
        console.log('Motion diagnostics:', await fx.evaluate(element => ({ ...element.dataset, hidden: document.hidden, y: element.getBoundingClientRect().y, h: element.getBoundingClientRect().height, play: element.querySelector('[data-fx-play]').textContent })));
        throw error;
    }
    await page.waitForTimeout(400);
    const first = await control('marker').getAttribute('transform');
    const bid = await control('bid').textContent();
    await page.waitForTimeout(300);
    assert.notEqual(await control('marker').getAttribute('transform'), first);
    assert.notEqual(await control('bid').textContent(), bid);
    await control('play').click();
    const paused = await control('marker').getAttribute('transform');
    await page.waitForTimeout(200);
    assert.equal(await control('marker').getAttribute('transform'), paused);
    const pausedMid = await control('mid').textContent();
    await page.setViewportSize({ width: 768, height: 900 });
    await page.waitForTimeout(100);
    assert.equal(await control('mid').textContent(), pausedMid, 'Responsive reflow preserves paused price');
    await page.setViewportSize({ width: 1536, height: 900 });
    await page.waitForTimeout(100);
    await capture('1536-motion-paused');
    await control('play').click();
    await page.waitForFunction(() => document.querySelector('[data-forexalert-journey]').dataset.outcome === 'success');
    await capture('1536-animated-success');
    await captureSlide(page, '1536-complete-slide');
    results.checks.push('Real chart marker and synchronized quotes move; Pause freezes; Continue reaches success');

    await choose('valid'); await control('play').click();
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(150);
    const offscreen = await control('marker').getAttribute('transform');
    await page.waitForTimeout(1200);
    assert.equal(await control('marker').getAttribute('transform'), offscreen);
    assert.equal(await fx.getAttribute('data-running'), 'false');
    await fx.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await choose('valid'); await control('play').click(); await choose('closed');
    await page.waitForTimeout(1200);
    assert.equal(await fx.getAttribute('data-stage'), '0');
    await control('play').click();
    await page.getByRole('button', { name: 'Show Home Lab, 5 of 5', exact: true }).click();
    const interrupted = await fx.getAttribute('data-stage');
    await page.waitForTimeout(1200);
    assert.equal(await fx.getAttribute('data-stage'), interrupted);
    await page.getByRole('button', { name: 'Show ForexAlert, 2 of 5', exact: true }).click();
    assert.equal(await fx.getAttribute('data-running'), 'false');
    await page.getByRole('button', { name: 'Resume project rotation', exact: true }).click();
    assert.equal(await fx.getAttribute('data-stage'), '0');
    await page.waitForTimeout(2200);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-schedule-booker');
    results.checks.push('Offscreen and slide changes cancel motion, scenario switches remove stale work, explicit Resume restores 2s static previews');

    await page.getByRole('button', { name: 'Show ForexAlert, 2 of 5', exact: true }).focus();
    await page.keyboard.press('Enter');
    for (const selector of ['[data-slide-to="2"]', '[data-slide-to="3"]', '[data-slide-to="4"]', '[data-carousel-resume]', '#featured-forexalert h2 a', '[data-fx-scenario]']) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(selector => document.activeElement.matches(selector), selector), true, 'Tab reaches ' + selector);
    }
    await control('next').focus(); await page.keyboard.press('Enter');
    assert.equal(await fx.getAttribute('data-stage'), '1');

    const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const reducedPage = await reduced.newPage(); await reducedPage.goto(url);
    await reducedPage.waitForTimeout(2200);
    assert.equal(await reducedPage.locator('.featured-slide.is-active').getAttribute('id'), 'featured-fincore');
    await reducedPage.getByRole('button', { name: 'Show ForexAlert, 2 of 5', exact: true }).click();
    await reducedPage.locator('[data-fx-next]').click(); await reducedPage.locator('[data-fx-next]').click();
    await reducedPage.locator('[data-fx-play]').click();
    const fixed = await reducedPage.locator('[data-fx-marker]').getAttribute('transform');
    await reducedPage.waitForTimeout(350);
    assert.equal(await reducedPage.locator('[data-fx-marker]').getAttribute('transform'), fixed);
    await reducedPage.locator('[data-fx-play]').click();
    await reducedPage.locator('[data-forexalert-journey]').screenshot({ path: resolve(output, '390-reduced-motion.png') });
    await reduced.close();
    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const staticPage = await nojs.newPage(); await staticPage.goto(url);
    assert.equal(await staticPage.locator('.featured-slide.is-active').getAttribute('id'), 'featured-fincore');
    assert.equal(await staticPage.locator('.carousel-toolbar').isVisible(), false);
    await staticPage.screenshot({ path: resolve(output, '390-no-js.png') });
    await nojs.close();
    results.checks.push('Reduced motion retains discrete decisions without spatial movement; no-JS retains the portfolio and project list');

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const touchPage = await touch.newPage(); await touchPage.goto(url);
    await touchPage.getByRole('button', { name: 'Show ForexAlert, 2 of 5', exact: true }).tap();
    await touchPage.locator('[data-fx-play]').tap();
    assert.equal(await touchPage.locator('[data-fx-play]').textContent(), 'Pause');
    await touchPage.locator('[data-fx-play]').tap();
    await captureSlide(touchPage, '390-complete-slide');
    await touch.close();
    results.checks.push('390px synthesized touch runs/pauses signal with simple readouts');
    assert.deepEqual(results.errors, []);
    assert.deepEqual(results.external, []);
    results.screenshots.push('390-reduced-motion.png', '390-no-js.png');
    console.log(JSON.stringify({ checks: results.checks, screenshotCount: results.screenshots.length, errors: results.errors, external: results.external }, null, 2));
} finally {
    await writeFile(resolve(output, process.argv.includes('--interaction-only') ? 'interactions.json' : 'results.json'), JSON.stringify(results, null, 2));
    await browser.close(); await new Promise(done => server.close(done));
}
