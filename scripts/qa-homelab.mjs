// Optional real-browser QA. Supply a Playwright module path if it is not installed locally:
// node scripts/qa-homelab.mjs file:///path/to/playwright/index.mjs
// Uses local static files only; screenshots/results go to ignored build/qa-homelab/.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.argv[2] || 'playwright');
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = resolve(root, 'build/qa-homelab');
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
const results = { viewports: [], checks: [], errors: [], screenshots: [], scenarios: [], stateCases: [] };
const context = await browser.newContext({ viewport: { width: 1536, height: 900 } });
const page = await context.newPage();
page.on('pageerror', error => results.errors.push(error.message));
const lab = page.locator('[data-homelab-journey]');
const result = lab.locator('[data-lab-result]');
const next = lab.locator('[data-lab-next]');
const scenario = lab.locator('[data-lab-scenario]');
const play = lab.locator('[data-lab-play]');
const outcomes = {
    success: { title: 'File list loaded (illustrative)', steps: 10, window: 'loaded' },
    denied: { title: 'Access unavailable', steps: 2, window: 'error' }
};
const packetPosition = () => lab.locator('[data-lab-packet]').evaluate(element => {
    const matrix = element.transform.baseVal.getItem(0).matrix;
    return { x: matrix.e, y: matrix.f };
});
async function capture(name) {
    await page.locator('#featured-homelab').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(450); // Settle theme colors and the existing 420ms carousel crossfade.
    await page.screenshot({ path: resolve(output, name + '.png') });
    results.screenshots.push(name + '.png');
    if (/^(320|390|768|1536)-.*-idle$/.test(name)) {
        await lab.locator('.lab-stage').screenshot({ path: resolve(output, name + '-scene.png') });
        results.screenshots.push(name + '-scene.png');
    }
}
async function finish(name, expected, count) {
    await scenario.selectOption(name);
    for (let i = 0; i < count; i++) await next.click();
    assert.equal(await result.textContent(), expected);
    return lab.getAttribute('data-outcome');
}
async function captureWholeJourney(name) {
    await page.waitForTimeout(450);
    await page.locator('#featured-homelab').screenshot({ path: resolve(output, name + '.png') });
    results.screenshots.push(name + '.png');
}
try {
    await page.goto(url);
    await page.locator('[data-featured-carousel][data-ready="true"]').waitFor();
    await page.screenshot({ path: resolve(output, '1536-fincore-initial.png') });
    assert.deepEqual(await page.locator('.carousel-projects button').allTextContents(), ['FinCore', 'ForexAlert', 'Schedule Booker', 'PomodoroYT', 'Home Lab']);
    await page.waitForTimeout(2150);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-forexalert');
    await page.getByRole('button', { name: 'Show Home Lab, 5 of 5', exact: true }).click();
    results.scenarios = await scenario.locator('option').evaluateAll(options => options.map(option => option.value));
    assert.deepEqual(results.scenarios, ['success', 'denied'], 'Only the two user-approved scenarios are selectable');
    await page.waitForTimeout(8300);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-homelab');
    results.checks.push('Five-project order, ~2s autoplay, selection remains pinned beyond 8s');

    for (const width of [320, 360, 390, 768, 1000, 1280, 1536]) {
        await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
        for (const theme of ['light', 'dark']) {
            await page.locator('html').evaluate((element, theme) => element.setAttribute('data-theme', theme), theme);
            const geometry = await lab.evaluate(element => ({
                width: document.documentElement.clientWidth,
                scrollWidth: document.documentElement.scrollWidth,
                statusAboveScene: element.querySelector('[data-lab-result]').getBoundingClientRect().top < element.querySelector('[data-lab-svg]').getBoundingClientRect().top,
                actors: [...element.querySelectorAll('[data-lab-actor]')].map(actor => {
                    const bounds = actor.querySelector('.lab-hit').getBoundingClientRect();
                    return { name: actor.dataset.labActor, width: bounds.width, height: bounds.height };
                })
            }));
            assert.ok(geometry.scrollWidth <= width, 'No page overflow at ' + width);
            assert.ok(geometry.actors.every(actor => actor.width >= 44 && actor.height >= 44), '44px actor targets at ' + width);
            if (width <= 390) assert.ok(geometry.statusAboveScene, 'Mobile status stays next to playback at ' + width);
            results.viewports.push({ width, theme, ...geometry });
            await capture(`${width}-${theme}-idle`);
        }
    }

    await page.setViewportSize({ width: 1536, height: 900 });
    await scenario.selectOption('success');
    await play.click();
    const firstPosition = await lab.locator('[data-lab-packet]').getAttribute('transform');
    const requestStart = await packetPosition();
    await page.waitForTimeout(400);
    assert.notEqual(await lab.locator('[data-lab-packet]').getAttribute('transform'), firstPosition);
    assert.ok((await packetPosition()).x > requestStart.x, 'Desktop request travels toward the gate');
    await play.click();
    const pausedPosition = await lab.locator('[data-lab-packet]').getAttribute('transform');
    await page.waitForTimeout(150);
    assert.equal(await lab.locator('[data-lab-packet]').getAttribute('transform'), pausedPosition);
    await capture('request-midway');
    await play.click();
    await page.waitForFunction(() => document.querySelector('[data-homelab-journey]').dataset.flow === 'response'
        && document.querySelector('[data-lab-path="upstream"]').classList.contains('is-current'));
    const responseStart = await packetPosition();
    await page.waitForTimeout(250);
    assert.ok((await packetPosition()).x < responseStart.x, 'Desktop response travels back toward the client');
    assert.equal(await lab.locator('[data-lab-path="upstream"]').getAttribute('marker-start'), 'url(#lab-arrow)');
    assert.equal(await lab.locator('[data-lab-path="upstream"]').getAttribute('marker-end'), 'none');
    await play.click();
    await capture('response-midway');
    await play.click();
    await page.waitForFunction(() => document.querySelector('[data-homelab-journey]').dataset.outcome === 'success');
    await capture('success-returned');
    results.checks.push('Actual SVG request/response movement, pause freeze, continue and file-window success');

    await scenario.selectOption('success');
    await play.click();
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(100);
    const offscreenPosition = await lab.locator('[data-lab-packet]').getAttribute('transform');
    await page.waitForTimeout(1200);
    assert.equal(await lab.locator('[data-lab-packet]').getAttribute('transform'), offscreenPosition);
    assert.equal(await play.textContent(), 'Continue');
    await page.locator('#featured-homelab').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    assert.equal(await play.textContent(), 'Continue');
    results.checks.push('Real IntersectionObserver pauses an offscreen journey; returning does not auto-resume');

    for (const name of [...results.scenarios, ...results.scenarios]) {
        const outcome = await finish(name, outcomes[name].title, outcomes[name].steps);
        assert.equal(outcome, name);
        await capture(name + '-result');
        await lab.locator('[data-lab-replay]').click();
        assert.equal(await play.textContent(), 'Pause');
        assert.equal(await lab.getAttribute('data-fault'), '');
        assert.equal(await lab.getAttribute('data-outcome'), '');
    }
    results.checks.push('Repeated deterministic outcomes after scenario changes; replay clears failures');

    // Whole-journey images include the controls, complete scene and textual result.
    for (const width of [1536, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        for (const theme of ['light', 'dark']) {
            await page.locator('html').evaluate((element, theme) => element.setAttribute('data-theme', theme), theme);
            for (const name of results.scenarios) {
                await finish(name, outcomes[name].title, outcomes[name].steps);
                assert.equal(await lab.locator(`[data-lab-window="${outcomes[name].window}"]`).getAttribute('visibility'), 'visible');
                assert.equal(await lab.locator('[data-lab-stop]').getAttribute('visibility'), name === 'success' ? 'hidden' : 'visible');
                const filename = `${width}-${theme}-${name}-full`;
                await captureWholeJourney(filename);
                results.stateCases.push({ width, theme, scenario: name, outcome: await result.textContent(), screenshot: filename + '.png' });
            }
        }
    }
    results.checks.push('Desktop/mobile light/dark captures verify client file-list/error windows, boundary stop and textual outcome');
    await page.setViewportSize({ width: 1536, height: 900 });

    await scenario.selectOption('success');
    await play.click();
    await page.waitForTimeout(200);
    await scenario.selectOption('denied');
    await page.waitForTimeout(1300);
    assert.equal(await result.textContent(), 'Open private files');
    await play.click();
    await page.getByRole('button', { name: 'Show FinCore, 1 of 5', exact: true }).click();
    const interrupted = await result.textContent();
    await page.waitForTimeout(1300);
    assert.equal(await result.textContent(), interrupted);
    await page.getByRole('button', { name: 'Show Home Lab, 5 of 5', exact: true }).click();
    assert.equal(await result.textContent(), 'Open private files');
    results.checks.push('Changing scenario or slide during motion cancels pending work');

    // Verify the actual Tab order, not only programmatic focus on individual controls.
    await page.getByRole('button', { name: 'Show Home Lab, 5 of 5', exact: true }).focus();
    await page.keyboard.press('Enter');
    for (const selector of ['[data-carousel-resume]', '#featured-homelab h2 a', '[data-lab-scenario]', '[data-lab-play]', '[data-lab-previous]', '[data-lab-next]', '[data-lab-replay]']) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(selector => document.activeElement.matches(selector), selector), true, 'Tab reaches ' + selector);
    }
    assert.equal(await lab.locator('[role=button]').count(), 0);

    await page.getByRole('button', { name: 'Resume project rotation', exact: true }).click();
    await page.waitForTimeout(2200);
    assert.equal(await page.locator('.featured-slide.is-active').getAttribute('id'), 'featured-fincore');
    results.checks.push('Explicit Resume project rotation exits exploration and restarts 2s preview');

    const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto(url);
    await reducedPage.waitForTimeout(2200);
    assert.equal(await reducedPage.locator('.featured-slide.is-active').getAttribute('id'), 'featured-fincore');
    await reducedPage.getByRole('button', { name: 'Show Home Lab, 5 of 5', exact: true }).click();
    await reducedPage.locator('[data-lab-next]').click();
    const fixed = await reducedPage.locator('[data-lab-packet]').getAttribute('transform');
    await reducedPage.waitForTimeout(200);
    assert.equal(await reducedPage.locator('[data-lab-packet]').getAttribute('transform'), fixed);
    await reducedPage.locator('[data-lab-play]').click();
    const reducedPosition = await reducedPage.locator('[data-lab-packet]').getAttribute('transform');
    await reducedPage.waitForTimeout(250);
    assert.equal(await reducedPage.locator('[data-lab-packet]').getAttribute('transform'), reducedPosition, 'Reduced-motion playback has no spatial travel');
    await reducedPage.locator('[data-lab-play]').click();
    await reducedPage.screenshot({ path: resolve(output, '390-reduced-motion.png') });
    await reduced.close();
    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const staticPage = await nojs.newPage();
    await staticPage.goto(url);
    assert.equal(await staticPage.locator('.featured-slide.is-active').getAttribute('id'), 'featured-fincore');
    assert.equal(await staticPage.locator('.carousel-toolbar').isVisible(), false);
    await staticPage.screenshot({ path: resolve(output, '390-no-js.png') });
    await nojs.close();
    results.checks.push('Reduced motion disables carousel rotation and spatial movement; no-JS FinCore and project links');

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const touchPage = await touch.newPage();
    touchPage.on('pageerror', error => results.errors.push(error.message));
    await touchPage.goto(url);
    await touchPage.getByRole('button', { name: 'Show Home Lab, 5 of 5', exact: true }).tap();
    await touchPage.locator('[data-lab-play]').tap();
    assert.equal(await touchPage.locator('[data-lab-play]').textContent(), 'Pause');
    await touchPage.locator('[data-lab-play]').tap();
    await touchPage.waitForTimeout(450); // Settle the carousel crossfade before the touch capture.
    assert.equal(await touchPage.evaluate(() => document.activeElement.matches('.skip-link')), false);
    // Capture from the header, so fixed offscreen elements are not included by
    // Chrome's captureBeyondViewport while the page is scrolled into the scene.
    await touchPage.locator('#featured-homelab').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await touchPage.locator('#featured-homelab').screenshot({ path: resolve(output, '390-touch-full.png') });
    results.screenshots.push('390-touch-full.png');
    await touch.close();
    results.checks.push('Synthesized mobile touch activates playback, pauses without inspection controls');
    assert.deepEqual(results.errors, []);
    console.log(JSON.stringify({ checks: results.checks, errors: results.errors, scenarios: results.scenarios, viewportCases: results.viewports.length, stateCases: results.stateCases.length, screenshots: results.screenshots.length }, null, 2));
} finally {
    await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
    await browser.close();
    await new Promise(done => server.close(done));
}
