// Local-only browser QA. Supply an existing Playwright module URL; no new dependency.
// node scripts/qa-pomodoroyt.mjs file:///path/to/playwright/index.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.argv[2] || 'playwright');
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = resolve(root, 'build/qa-pomodoroyt');
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
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { checks: [], errors: [], external: [], screenshots: [], geometry: [] };
async function newPage(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1536, height: 1000 }, ...options });
    await context.route('**/*', route => {
        if (route.request().url().startsWith(url)) return route.continue();
        results.external.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', e => results.errors.push(e.message));
    await page.goto(url); return page;
}
const page = await newPage();
const scene = page.locator('[data-pomodoroyt-journey]');
const control = name => scene.locator(`[data-py-${name}]`);
const select = () => page.getByRole('button', { name: 'Show PomodoroYT, 4 of 5', exact: true }).click();
const choose = name => control('scenario').selectOption(name);
async function capture(name, target = scene) {
    await target.evaluate(e => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(450);
    await target.screenshot({ path: resolve(output, name + '.png') }); results.screenshots.push(name + '.png');
}
async function stage(value) { await page.waitForFunction(v => document.querySelector('[data-pomodoroyt-journey]').dataset.stage === String(v), value); }
try {
    assert.deepEqual(await page.locator('.carousel-projects button').allTextContents(), ['FinCore', 'ForexAlert', 'Schedule Booker', 'PomodoroYT', 'Home Lab']);
    await page.waitForTimeout(6200);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-pomodoroyt');
    assert.equal(await scene.getAttribute('data-running'), 'false');
    assert.equal(await scene.getAttribute('data-stage'), '0');
    await scene.hover(); await page.waitForTimeout(2100);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-homelab');
    await select(); await control('next').click();
    assert.equal(await page.locator('[data-featured-carousel]').getAttribute('data-pinned'), 'true');
    await page.waitForTimeout(2200);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-pomodoroyt');
    results.checks.push('Five-project order, 2000ms previews, passive hover continues, no demo autoplay, deliberate engagement pins');
    for (const width of [1536, 768, 390, 320]) {
        await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
        for (const theme of ['light', 'dark']) {
            await page.locator('html').evaluate((e, value) => e.setAttribute('data-theme', value), theme);
            await choose('start');
            const geometry = await scene.evaluate(e => ({
                scrollWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
                targets: [...e.querySelectorAll('button, select, summary')].filter(x => x.checkVisibility()).map(x => { const r = x.getBoundingClientRect(); return { text: x.textContent.trim(), width: r.width, height: r.height }; }),
                boxes: [...e.querySelectorAll('.py-browser, .py-player, .py-widget, .py-tabbar')].map(x => ({ name: x.className, scrollWidth: x.scrollWidth, clientWidth: x.clientWidth }))
            }));
            assert.ok(geometry.scrollWidth <= width, `Page overflow ${width}/${theme}`);
            assert.ok(geometry.targets.every(x => x.height >= 44 && x.width >= 44), `Touch targets ${JSON.stringify(geometry.targets)}`);
            assert.ok(geometry.boxes.every(x => x.scrollWidth <= x.clientWidth + 1), `Inner overflow ${JSON.stringify(geometry.boxes)}`);
            results.geometry.push({ width, theme, ...geometry });
            const prefix = `${width}-${theme}`;
            await capture(prefix + '-idle');
            await control('next').click(); assert.equal(await control('video').textContent(), 'Playing');
            await capture(prefix + '-focus');
            await control('session').click(); assert.equal(await control('video').textContent(), 'Paused');
            await capture(prefix + '-paused');
            await choose('break'); await control('next').click();
            assert.equal(await control('phase').textContent(), 'Switching to break'); assert.equal(await control('time').textContent(), '0:05');
            assert.equal(await control('video').textContent(), 'Paused'); await capture(prefix + '-countdown');
            await control('next').click(); assert.equal(await control('time').textContent(), '5:00');
            assert.equal(await control('video').textContent(), 'Paused'); await capture(prefix + '-break');
            await choose('ad'); await control('next').click(); assert.equal(await control('volume').textContent(), 'Muted');
            assert.equal(await control('ad').isVisible(), true); await capture(prefix + '-ad-muted');
            await control('next').click(); assert.equal(await control('volume').textContent(), 'Sound 60%');
            assert.equal(await control('ad').isVisible(), false); await capture(prefix + '-ad-restored');
            await choose('disconnected'); assert.equal(await control('play').isDisabled(), true); assert.equal(await control('session').isDisabled(), true);
            await capture(prefix + '-no-video');
            const connect = await control('connect').boundingBox(); assert.ok(connect.height >= 44 && connect.width >= 44);
            await control('connect').click(); assert.equal(await control('connection').textContent(), 'Connected');
            assert.equal(await control('video').textContent(), 'Paused');
            await control('next').click(); assert.equal(await control('video').textContent(), 'Playing');
        }
        console.log(`Captured ${width}px in both themes`);
    }
    results.checks.push('64 state screenshots: 4 widths × 2 themes × 8 states; zero horizontal overflow; 44px controls; connect required');
    await page.setViewportSize({ width: 1536, height: 1000 });
    await page.locator('html').evaluate(e => e.setAttribute('data-theme', 'light'));
    await choose('start'); await control('play').click();
    await page.waitForTimeout(650); const moving = await control('progress').getAttribute('style');
    await page.waitForTimeout(650); assert.notEqual(await control('progress').getAttribute('style'), moving);
    await control('play').click(); const frozen = await control('progress').getAttribute('style'), frozenTime = await control('time').textContent();
    await page.waitForTimeout(1200); assert.equal(await control('progress').getAttribute('style'), frozen); assert.equal(await control('time').textContent(), frozenTime);
    await control('play').click(); await page.waitForTimeout(200); await control('session').click();
    const sessionPaused = await control('time').textContent(); await page.waitForTimeout(1200);
    assert.equal(await control('time').textContent(), sessionPaused); assert.equal(await control('video').textContent(), 'Paused');
    await control('session').click(); assert.equal(await control('video').textContent(), 'Playing');
    await choose('break'); await control('play').click(); await stage(1);
    assert.equal(await control('video').textContent(), 'Paused');
    await stage(2); assert.equal(await control('phase').textContent(), 'Short break');
    assert.equal(await control('video').textContent(), 'Paused');
    await choose('ad'); await control('play').click(); await stage(1); assert.equal(await control('volume').textContent(), 'Muted');
    await stage(2); assert.equal(await control('volume').textContent(), 'Sound 60%');
    await choose('pause'); await control('play').click(); await stage(1); assert.equal(await scene.getAttribute('data-running'), 'false');
    await control('session').click(); assert.equal(await scene.getAttribute('data-running'), 'true');
    results.checks.push('Actual progress advances; Pause freezes clock and player; session pause/resume; automatic preparation/break, ad mute/restore, pause example');

    await choose('ad'); await control('next').click(); await control('next').click();
    await control('previous').click(); assert.equal(await control('volume').textContent(), 'Muted');
    assert.equal(await control('history').isVisible(), true); await control('play').click();
    assert.equal(await control('volume').textContent(), 'Sound 60%');
    await control('replay').click(); assert.equal(await scene.getAttribute('data-stage'), '0');
    assert.equal(await control('video-time').textContent(), '0:00');

    for (const interrupt of ['hidden', 'offscreen', 'slide', 'scenario', 'preview']) {
        await choose('start'); await scene.evaluate(e => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await control('play').click();
        if (interrupt === 'hidden') await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        if (interrupt === 'offscreen') await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
        if (interrupt === 'slide') await page.getByRole('button', { name: 'Show Home Lab, 5 of 5', exact: true }).click();
        if (interrupt === 'scenario') await choose('ad');
        if (interrupt === 'preview') await page.locator('[data-carousel-resume]').click();
        await page.waitForTimeout(180); const before = await control('progress').getAttribute('style');
        await page.waitForTimeout(500); assert.equal(await control('progress').getAttribute('style'), before, interrupt);
        assert.equal(await scene.getAttribute('data-running'), 'false', interrupt);
        if (interrupt === 'hidden') await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
        await select(); assert.equal(await scene.getAttribute('data-running'), 'false');
    }
    results.checks.push('Read-only history returns to live state; Watch again resets; visibility/offscreen/slide/scenario/preview cancel without stale work or automatic return');
    await choose('start'); await control('play').focus(); await page.keyboard.press('Enter');
    assert.equal(await control('video').textContent(), 'Playing'); await page.keyboard.press('Space');
    assert.equal(await scene.getAttribute('data-running'), 'false');
    const focus = await control('play').evaluate(e => getComputedStyle(e).outlineStyle); assert.equal(focus, 'solid');
    await capture('1536-complete-slide', page.locator('#featured-pomodoroyt'));
    // 200% zoom-equivalent CSS viewport and Windows high contrast.
    await page.setViewportSize({ width: 768, height: 500 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.emulateMedia({ forcedColors: 'active' }); await choose('break'); await control('next').click();
    await capture('768-forced-colors'); await page.emulateMedia({ forcedColors: 'none' });
    const reduced = await newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    await reduced.waitForTimeout(2150); assert.equal(await reduced.locator('.featured-slide.is-active').getAttribute('id'), 'featured-fincore');
    await reduced.getByRole('button', { name: 'Show PomodoroYT, 4 of 5', exact: true }).click();
    for (const example of ['break', 'ad', 'pause', 'disconnected']) {
        await reduced.locator('[data-py-scenario]').selectOption(example);
        if (example === 'disconnected') await reduced.locator('[data-py-connect]').click();
        for (let i = 0; i < 2; i++) {
            const next = reduced.locator('[data-py-next]');
            if (await next.getAttribute('aria-disabled') !== 'true') await next.click();
        }
    }
    await reduced.locator('[data-pomodoroyt-journey]').screenshot({ path: resolve(output, '390-reduced-motion.png') }); results.screenshots.push('390-reduced-motion.png');
    await reduced.context().close();
    const nojs = await newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    assert.equal(await nojs.locator('[data-py-play]').isVisible(), false);
    await nojs.screenshot({ path: resolve(output, '390-no-js.png') }); results.screenshots.push('390-no-js.png');
    await nojs.context().close();
    const touch = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await touch.getByRole('button', { name: 'Show PomodoroYT, 4 of 5', exact: true }).tap();
    await touch.locator('[data-py-scenario]').selectOption('disconnected'); await touch.locator('[data-py-connect]').tap();
    await touch.locator('[data-py-session]').tap(); assert.equal(await touch.locator('[data-py-video]').textContent(), 'Playing');
    await touch.locator('[data-py-session]').tap(); assert.equal(await touch.locator('[data-py-video]').textContent(), 'Paused');
    await touch.context().close();
    results.checks.push('Enter/Space, visible keyboard outline, 200% zoom-equivalent viewport, forced colors, reduced motion state parity, accessible no-JS portfolio, touch connect/start/pause');
    assert.deepEqual(results.errors, []); assert.deepEqual(results.external, []);
    console.log(JSON.stringify({ checks: results.checks, screenshots: results.screenshots.length, errors: results.errors, external: results.external }, null, 2));
} finally {
    await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
    await browser.close(); await new Promise(done => server.close(done));
}
