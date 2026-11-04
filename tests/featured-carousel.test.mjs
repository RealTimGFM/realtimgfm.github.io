import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { renderPage } from '../scripts/build.mjs';

const source = (await readFile(new URL('../scripts/modules/featured-carousel.js', import.meta.url), 'utf8')).replace('export function', 'function');

function setup(reduced = false) {
    const element = () => ({
        attrs: {}, handlers: {}, dataset: {}, hidden: false, classes: new Set(),
        addEventListener(name, callback) { this.handlers[name] = callback; },
        setAttribute(name, value) { this.attrs[name] = value; },
        removeAttribute(name) { delete this.attrs[name]; },
        getAttribute(name) { return this.attrs[name]; },
        classList: { toggle() {} }
    });
    const slides = Array.from({ length: 4 }, (_, i) => {
        const slide = element();
        slide.attrs['aria-label'] = (i + 1) + ' of 4';
        slide.classList.toggle = (name, on) => on ? slide.classes.add(name) : slide.classes.delete(name);
        return slide;
    });
    const selectors = slides.map(element);
    const controls = Object.fromEntries(['playback', 'count', 'announcement', 'previous', 'next'].map(name => [name, element()]));
    const toolbar = element();
    toolbar.hidden = true;
    const carousel = element();
    carousel.contains = target => target === selectors[0];
    carousel.querySelectorAll = selector => selector === '.featured-slide' ? slides : selectors;
    carousel.querySelector = selector => selector === '.carousel-toolbar' ? toolbar : controls[selector.slice('[data-carousel-'.length, -1)];
    const document = element();
    document.querySelector = () => carousel;
    const motion = { matches: reduced, addEventListener(name, callback) { this.change = callback; } };
    let nextId = 0;
    const timers = new Map();
    const window = {
        matchMedia: () => motion,
        clearTimeout: id => timers.delete(id),
        setTimeout: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, delay }); return id; }
    };
    const context = vm.createContext({ document, window });
    vm.runInContext(source, context);
    context.initFeaturedCarousel();
    return { carousel, slides, selectors, controls, toolbar, document, motion, timers,
        tick() { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.callback(); } };
}

test('four real slides remain wired to selectors and preserve the three-second rotation', async () => {
    const html = await renderPage();
    const ids = [...html.matchAll(/<article id="(featured-[^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(ids, ['featured-fincore', 'featured-forexalert', 'featured-pomodoroyt', 'featured-schedule-booker']);
    for (const id of ids) assert.ok(html.includes('aria-controls="' + id + '"'));
    const ui = setup();
    assert.equal(ui.toolbar.hidden, false);
    assert.equal(ui.timers.size, 1);
    for (let current = 1; current <= 4; current++) {
        assert.equal([...ui.timers.values()][0].delay, 3000);
        ui.tick();
        const index = current % 4;
        assert.equal(ui.controls.count.textContent, (index + 1) + ' / 4');
        assert.equal(ui.slides[index].inert, false);
        assert.equal(ui.slides.filter(slide => slide.classes.has('is-active')).length, 1);
        assert.equal(ui.slides.filter(slide => slide.attrs['aria-hidden'] === 'true').length, 3);
    }
});

test('manual selectors, previous/next, pause/play, and focus preserve navigation semantics', () => {
    const ui = setup();
    ui.selectors[3].handlers.click();
    assert.equal(ui.controls.count.textContent, '4 / 4');
    assert.equal(ui.controls.announcement.textContent, '4 of 4');
    assert.equal(ui.timers.size, 0);
    ui.controls.next.handlers.click();
    assert.equal(ui.controls.count.textContent, '1 / 4');
    ui.controls.previous.handlers.click();
    assert.equal(ui.controls.count.textContent, '4 / 4');
    ui.controls.playback.handlers.click();
    assert.equal(ui.timers.size, 1);
    ui.carousel.handlers.focusin();
    assert.equal(ui.timers.size, 0);
    ui.carousel.handlers.focusout({ relatedTarget: null });
    assert.equal(ui.timers.size, 1);
    ui.carousel.handlers.pointerenter({ pointerType: 'mouse' });
    assert.equal(ui.timers.size, 0);
    ui.carousel.handlers.pointerleave({ pointerType: 'mouse' });
    assert.equal(ui.timers.size, 1);
    ui.document.hidden = true;
    ui.document.handlers.visibilitychange();
    assert.equal(ui.timers.size, 0);
});

test('reduced motion disables autoplay while retaining manual project selection', () => {
    const ui = setup(true);
    assert.equal(ui.timers.size, 0);
    assert.equal(ui.controls.playback.hidden, true);
    ui.selectors[2].handlers.click();
    assert.equal(ui.controls.count.textContent, '3 / 4');
    assert.equal(ui.slides[2].inert, false);
});
