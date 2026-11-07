import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { renderPage } from '../scripts/build.mjs';

const source = (await readFile(new URL('../scripts/modules/featured-journeys.js', import.meta.url), 'utf8'))
    .replace('export function', 'function');

function setup() {
    const element = () => ({
        dataset: {}, attrs: {}, handlers: {}, hidden: false,
        addEventListener(type, callback) { this.handlers[type] = callback; },
        setAttribute(name, value) { this.attrs[name] = value; },
        removeAttribute(name) { delete this.attrs[name]; },
        classList: { toggle() {} }
    });
    const journeys = [5].map(length => {
        const root = element();
        const slide = element();
        const steps = Array.from({ length }, element);
        const nodes = steps.map((_, i) => {
            const node = element();
            node.dataset.journeyNode = String(i);
            return node;
        });
        const controls = Object.fromEntries(['previous', 'next', 'replay', 'count', 'inspector', 'controls'].map(name => [name, element()]));
        controls.controls.hidden = true;
        root.querySelectorAll = selector => selector === '[data-journey-step]' ? steps : nodes;
        root.querySelector = selector => controls[selector.slice('[data-journey-'.length, -1)];
        root.closest = () => slide;
        root.events = [];
        root.dispatchEvent = event => root.events.push(event);
        return { root, slide, steps, nodes, controls };
    });
    const context = vm.createContext({
        document: { querySelectorAll: () => journeys.map(journey => journey.root) },
        CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } }
    });
    vm.runInContext(source, context);
    context.initFeaturedJourneys();
    return { journeys, initialize: () => context.initFeaturedJourneys() };
}

test('retired generic journey utility remains compatible with its existing test consumers', () => {
    const { journeys, initialize } = setup();
    for (const journey of journeys) {
        const { steps, nodes, controls, root, slide } = journey;
        assert.equal(controls.controls.hidden, false);
        assert.equal(steps.filter(step => !step.hidden).length, 1);
        assert.equal(nodes[0].attrs['aria-current'], 'step');
        controls.previous.handlers.click();
        assert.equal(controls.count.textContent, 'Step 1 / ' + steps.length);
        for (let i = 1; i < steps.length; i++) {
            controls.next.handlers.click();
            assert.equal(steps[i].hidden, false);
            assert.equal(steps.filter(step => !step.hidden).length, 1);
            assert.equal(nodes[i].attrs['aria-current'], 'step');
            assert.equal(nodes.filter(node => node.attrs['aria-current']).length, 1);
        }
        assert.equal(controls.next.attrs['aria-disabled'], 'true');
        controls.next.handlers.click();
        assert.equal(controls.count.textContent, 'Step ' + steps.length + ' / ' + steps.length);
        controls.previous.handlers.click();
        assert.equal(steps[steps.length - 2].hidden, false);
        assert.equal(controls.inspector.attrs['aria-live'], 'polite');
        assert.ok(root.events.every(event => event.type === 'journey:interact' && event.bubbles));
        controls.replay.handlers.click();
        assert.equal(steps[0].hidden, false);
        controls.next.handlers.click();
        slide.handlers['featured:activate']();
        assert.equal(steps[0].hidden, false);
        assert.equal(controls.inspector.attrs['aria-live'], 'off');
        assert.equal(controls.previous.attrs['aria-disabled'], 'true');
        for (const other of journeys.filter(other => other !== journey)) assert.equal(other.steps[0].hidden, false);
    }
    const handler = journeys[0].controls.next.handlers.click;
    initialize();
    assert.equal(journeys[0].controls.next.handlers.click, handler);
});

test('hero keeps static scenes and working links without technical inspection panels', async () => {
    const html = await renderPage();
    const hero = html.slice(html.indexOf('<section id="home"'), html.indexOf('<section id="experience"'));
    const articles = [...hero.matchAll(/<article id="featured-([^"]+)"[\s\S]*?<\/article>/g)];
    assert.equal(articles.length, 5);
    for (const [i, article] of articles.entries()) {
        const steps = [...article[0].matchAll(/<li data-journey-step>/g)];
        assert.equal(steps.length, 0);
        if (i === 3) {
            assert.match(article[0], /data-pomodoroyt-journey/);
            assert.match(article[0], /data-py-controls[^>]+hidden/);
            assert.match(article[0], /data-py-previous/);
            assert.match(article[0], /data-py-next/);
            assert.match(article[0], /data-py-replay/);
        }
    }
    assert.doesNotMatch(hero, /inspector|data-(?:fx|sb)-inspect|Select an object|Optional technical details/);
    const lab = articles[4][0];
    assert.deepEqual([...lab.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]), ['success', 'denied']);
    for (const fact of ['PostgreSQL 17', 'Redis 7', 'No live connection', 'href="#homelab"']) assert.ok(lab.includes(fact), fact);
    assert.match(lab, /data-lab-controls[^>]+hidden/);
    assert.match(articles[2][0], /data-schedulebooker-journey/);
    assert.doesNotMatch(articles[2][0], /data-journey="schedule-booker"/);
    assert.match(articles[0][0], /In development/);
    assert.doesNotMatch(hero, /https?:\/\/[^"\s<]*\.ts\.net|100\.\d+\.\d+\.\d+|fetch\(|XMLHttpRequest|WebSocket/);
    assert.doesNotMatch(source, /fetch\(|setTimeout|setInterval|chrome\.|XMLHttpRequest|WebSocket/);
    const css = await readFile(new URL('../styles/sections/featured-projects.css', import.meta.url), 'utf8');
    assert.doesNotMatch(css, /@media\s*\(scripting:\s*none\)/, 'Inactive, inert slides must not be revealed without JavaScript');
});
