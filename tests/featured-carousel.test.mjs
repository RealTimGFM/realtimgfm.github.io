import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { renderPage } from '../scripts/build.mjs';

const source = (await readFile(new URL('../scripts/modules/featured-carousel.js', import.meta.url), 'utf8')).replace('export function', 'function');
const journeySource = (await readFile(new URL('../scripts/modules/featured-journeys.js', import.meta.url), 'utf8')).replace('export function', 'function');

function setup(reduced = false, observe = false) {
    const element = () => ({
        attrs: {}, handlers: {}, dataset: {}, hidden: false, classes: new Set(),
        addEventListener(name, callback) { this.handlers[name] = callback; },
        setAttribute(name, value) { this.attrs[name] = value; },
        removeAttribute(name) { delete this.attrs[name]; },
        getAttribute(name) { return this.attrs[name]; },
        classList: { toggle() {} },
        contains() { return false; },
        focus() { document.activeElement = this; },
        dispatchEvent(event) { this.handlers[event.type]?.(event); }
    });
    const slides = Array.from({ length: 5 }, (_, i) => {
        const slide = element();
        slide.attrs['aria-label'] = (i + 1) + ' of 5';
        slide.attrs['aria-hidden'] = String(i !== 0);
        slide.inert = i !== 0;
        slide.height = 450 + i * 100;
        slide.getBoundingClientRect = () => ({ height: slide.height });
        if (i === 0) slide.classes.add('is-active');
        slide.classList.toggle = (name, on) => on ? slide.classes.add(name) : slide.classes.delete(name);
        return slide;
    });
    const selectors = slides.map(element);
    selectors[0].attrs['aria-current'] = 'true';
    const controls = { announcement: element(), resume: element() };
    const toolbar = element();
    const slideFrame = { style: {} };
    toolbar.hidden = true;
    const carousel = element();
    carousel.contains = target => target === selectors[0];
    carousel.querySelectorAll = selector => selector === '.featured-slide' ? slides : selectors;
    carousel.querySelector = selector => selector === '.carousel-toolbar' ? toolbar : selector === '.carousel-slides' ? slideFrame : controls[selector.slice('[data-carousel-'.length, -1)];
    const document = element();
    document.querySelector = () => carousel;
    const journey = element();
    const steps = Array.from({ length: 6 }, element);
    const nodes = steps.map((_, i) => Object.assign(element(), { dataset: { journeyNode: String(i) } }));
    const journeyControls = Object.fromEntries(['previous', 'next', 'replay', 'count', 'inspector', 'controls'].map(name => [name, element()]));
    journey.querySelectorAll = selector => selector === '[data-journey-step]' ? steps : nodes;
    journey.querySelector = selector => journeyControls[selector.slice('[data-journey-'.length, -1)];
    journey.closest = () => slides[0];
    journey.dispatchEvent = event => carousel.handlers[event.type]?.(event);
    document.querySelectorAll = () => [journey];
    const motion = { matches: reduced, addEventListener(name, callback) { this.change = callback; } };
    let nextId = 0;
    let now = 0;
    const timers = new Map();
    let resize;
    let resizeEntries;
    const window = {
        addEventListener(name, callback) { if (name === 'resize') resize = callback; },
        ResizeObserver: class { constructor(callback) { resizeEntries = callback; } observe() {} },
        matchMedia: () => motion,
        clearTimeout: id => timers.delete(id),
        setTimeout: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, delay }); return id; }
    };
    let intersection;
    const Observer = class {
        constructor(callback) { intersection = callback; }
        observe() {}
    };
    if (observe) window.IntersectionObserver = Observer;
    const context = vm.createContext({ document, window, Date: { now: () => now }, IntersectionObserver: Observer,
        CustomEvent: class { constructor(type) { this.type = type; } } });
    vm.runInContext(journeySource + '\n' + source, context);
    context.initFeaturedJourneys();
    context.initFeaturedCarousel();
    return { carousel, slides, selectors, controls, toolbar, document, motion, timers, journeyControls, steps, slideFrame,
        resize() { resize(); },
        contentResize(slide) { resizeEntries([{ target: slide }]); },
        visibility(visible) { intersection([{ isIntersecting: visible }]); },
        elapse(milliseconds) { now += milliseconds; },
        tick() { const [id, timer] = timers.entries().next().value; now += timer.delay; timers.delete(id); timer.callback(); } };
}

test('five slides retain matching selectors and ARIA in the exact software-first order with four-second rotation', async () => {
    const html = await renderPage();
    const ids = [...html.matchAll(/<article id="(featured-[^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(ids, ['featured-fincore', 'featured-forexalert', 'featured-schedule-booker', 'featured-pomodoroyt', 'featured-homelab']);
    const selectors = [...html.matchAll(/data-slide-to="(\d)" aria-controls="([^"]+)" aria-label="([^"]+)"/g)];
    assert.equal(selectors.length, 5);
    ids.forEach((id, i) => {
        assert.equal(selectors[i][1], String(i));
        assert.equal(selectors[i][2], id);
        assert.ok(selectors[i][3].includes((i + 1) + ' of 5'));
    });
    assert.doesNotMatch(html, /data-carousel-count|data-carousel-playback|data-carousel-previous|data-carousel-next/);
    const articles = [...html.matchAll(/<article id="featured-[^"]+"[^>]+>/g)].map(m => m[0]);
    articles.forEach((article, i) => {
        assert.match(article, new RegExp('aria-label="' + (i + 1) + ' of 5:'));
        assert.equal(article.includes('is-active'), i === 0);
        assert.equal(article.includes(' inert'), i !== 0);
        assert.equal(article.includes('aria-hidden="true"'), i !== 0);
    });
    const ui = setup();
    assert.equal(ui.toolbar.hidden, false);
    assert.equal(ui.timers.size, 1);
    for (let current = 1; current <= 5; current++) {
        assert.equal([...ui.timers.values()][0].delay, 4000);
        ui.tick();
        const index = current % 5;
        assert.equal(ui.selectors[index].attrs['aria-current'], 'true');
        assert.equal(ui.slides[index].inert, false);
        assert.equal(ui.slides.filter(slide => slide.classes.has('is-active')).length, 1);
        assert.equal(ui.slides.filter(slide => slide.attrs['aria-hidden'] === 'true').length, 4);
        assert.equal(ui.controls.announcement.textContent, undefined);
    }
});

test('tab selection pins indefinitely until explicit resume, even after focus leaves', () => {
    const ui = setup();
    ui.document.activeElement = ui.selectors[4];
    ui.carousel.handlers.focusin({ target: ui.selectors[4] });
    ui.selectors[4].handlers.click();
    assert.equal(ui.controls.announcement.textContent, '5 of 5');
    assert.equal(ui.timers.size, 0);
    ui.elapse(60000);
    ui.carousel.handlers.focusout({ relatedTarget: null });
    assert.equal(ui.selectors[4].attrs['aria-current'], 'true');
    assert.equal(ui.timers.size, 0);
    assert.equal(ui.controls.resume.textContent, 'Resume project rotation');
    ui.controls.resume.handlers.click();
    assert.equal([...ui.timers.values()][0].delay, 4000);
    ui.tick();
    assert.equal(ui.selectors[0].attrs['aria-current'], 'true');
});

test('another selector stays pinned; pause and resume never create duplicate timers', () => {
    const ui = setup();
    ui.selectors[1].handlers.click();
    ui.elapse(5000);
    ui.selectors[3].handlers.click();
    assert.equal(ui.timers.size, 0);
    ui.controls.resume.handlers.click();
    assert.equal(ui.timers.size, 1);
    ui.controls.resume.handlers.click();
    assert.equal(ui.timers.size, 0);
    ui.controls.resume.handlers.click();
    ui.tick();
    assert.equal(ui.selectors[4].attrs['aria-current'], 'true');
    assert.equal([...ui.timers.values()][0].delay, 4000);
});

test('reduced motion retains manual navigation and disables automatic rotation', () => {
    const ui = setup(true);
    assert.equal(ui.timers.size, 0);
    ui.selectors[2].handlers.click();
    assert.equal(ui.slides[2].inert, false);
    assert.equal(ui.timers.size, 0);
    ui.motion.matches = false;
    ui.motion.change();
    assert.equal(ui.timers.size, 0, 'A reduced-motion preference change cannot clear explicit engagement');
    ui.controls.resume.handlers.click();
    assert.equal([...ui.timers.values()][0].delay, 4000);
    ui.motion.matches = true;
    ui.motion.change();
    assert.equal(ui.timers.size, 0);
});

test('journey interaction pins until explicit resume and resets when revisited', () => {
    const ui = setup();
    ui.journeyControls.next.handlers.click();
    assert.equal(ui.steps[1].hidden, false);
    assert.equal(ui.selectors[0].attrs['aria-current'], 'true');
    assert.equal(ui.timers.size, 0);
    ui.controls.resume.handlers.click();
    ui.tick();
    assert.equal(ui.selectors[1].attrs['aria-current'], 'true');
    ui.selectors[0].handlers.click();
    assert.equal(ui.steps[0].hidden, false);
    assert.equal(ui.journeyControls.count.textContent, 'Step 1 / 6');
});

test('hidden and offscreen pauses stop preview; persistent pin survives both', () => {
    const ui = setup(false, true);
    ui.visibility(false);
    assert.equal(ui.timers.size, 0);
    ui.visibility(true);
    assert.equal([...ui.timers.values()][0].delay, 4000);
    ui.document.hidden = true;
    ui.document.handlers.visibilitychange();
    assert.equal(ui.timers.size, 0);
    ui.elapse(10000);
    ui.document.hidden = false;
    ui.document.handlers.visibilitychange();
    assert.equal([...ui.timers.values()][0].delay, 4000);
    ui.selectors[2].handlers.click();
    ui.visibility(false);
    ui.visibility(true);
    ui.document.hidden = true;
    ui.document.handlers.visibilitychange();
    ui.document.hidden = false;
    ui.document.handlers.visibilitychange();
    assert.equal(ui.timers.size, 0);
});

test('focused slide content remains available and manual navigation restores outgoing focus', () => {
    const ui = setup();
    const focusedStep = {};
    ui.document.activeElement = focusedStep;
    ui.slides[0].contains = target => target === focusedStep;
    ui.carousel.handlers.focusin({ target: focusedStep });
    assert.equal(ui.timers.size, 0);
    let reset = 0;
    ui.slides[1].handlers['featured:activate'] = () => reset++;
    ui.selectors[1].handlers.click();
    assert.equal(ui.document.activeElement, ui.selectors[1]);
    assert.equal(reset, 1);
    assert.equal(ui.timers.size, 0);
    ui.carousel.handlers.focusout({ relatedTarget: null });
    assert.equal(ui.timers.size, 0);
});


test('height follows the selected slide, live content and responsive reflow without hidden-slide interference', () => {
    const ui = setup();
    assert.equal(ui.slideFrame.style.height, '450px');
    ui.selectors[4].handlers.click();
    assert.equal(ui.slideFrame.style.height, '850px');
    ui.selectors[0].handlers.click();
    assert.equal(ui.slideFrame.style.height, '450px');
    ui.slides[4].height = 1400;
    ui.contentResize(ui.slides[4]);
    assert.equal(ui.slideFrame.style.height, '450px');
    ui.slides[0].height = 612.25;
    ui.contentResize(ui.slides[0]);
    assert.equal(ui.slideFrame.style.height, '613px');
    ui.slides[0].height = 500;
    ui.resize();
    assert.equal(ui.slideFrame.style.height, '500px');
    ui.selectors[2].handlers.click();
    ui.selectors[1].handlers.click();
    assert.equal(ui.slideFrame.style.height, '550px');
});
