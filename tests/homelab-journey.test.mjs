import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../scripts/modules/homelab-journey.js', import.meta.url), 'utf8')).replaceAll('export function', 'function');

function setup(reduced = false) {
    const element = () => {
        const classes = new Set();
        return {
            dataset: {}, attrs: {}, handlers: {}, children: [], hidden: true, open: false, textContent: '',
            classList: { contains: name => classes.has(name), toggle: (name, active) => active ? classes.add(name) : classes.delete(name) },
            setAttribute(name, value) { this.attrs[name] = String(value); },
            getAttribute(name) { return this.attrs[name]; },
            addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); },
            emit(name, event = {}) { this.handlers[name]?.forEach(callback => callback(event)); },
            append(...children) { this.children.push(...children); },
            replaceChildren(...children) { this.children = children; }
        };
    };
    const root = element();
    const slide = element();
    slide.classList.toggle('is-active', true);
    const controls = Object.fromEntries(['svg', 'packet', 'stop', 'play', 'previous', 'next', 'replay', 'scenario', 'result', 'phase', 'count', 'boundary', 'boundary-label', 'gate-check', 'gate-stop', 'https-label', 'http-label'].map(name => [name, element()]));
    const packetShape = element(), packetMark = element();
    controls.packet.querySelector = query => query === 'rect' ? packetShape : packetMark;
    const actors = ['client', 'gate', 'host', 'app', 'database', 'redis', 'storage', 'cron'].map(name => Object.assign(element(), { dataset: { labActor: name } }));
    const paths = ['entry', 'serve', 'upstream', 'database', 'redis', 'storage', 'cron'].map(name => Object.assign(element(), {
        dataset: { labPath: name }, getTotalLength: () => 100,
        getPointAtLength: length => ({ x: length, y: 0 })
    }));
    const windows = ['idle', 'waiting', 'loaded', 'error'].map(name => Object.assign(element(), { dataset: { labWindow: name } }));
    root.querySelector = query => controls[query.slice('[data-lab-'.length, -1)];
    root.querySelectorAll = query => ({ '[data-lab-actor]': actors, '[data-lab-path]': paths, '[data-lab-window]': windows, '[data-lab-controls]': [controls.scenario, controls.play] })[query];
    root.closest = () => slide;
    let engagements = 0;
    root.dispatchEvent = event => { if (event.type === 'journey:interact') engagements++; };
    const document = Object.assign(element(), { querySelector: () => root, createElement: element, hidden: false });
    const motion = { matches: reduced, addEventListener(name, callback) { this.change = callback; } };
    const narrow = { matches: false, addEventListener(name, callback) { this.change = callback; } };
    const frames = new Map();
    let id = 0;
    let observer;
    class Observer { constructor(callback) { observer = callback; } observe() {} }
    const window = {
        matchMedia: query => query.includes('reduce') ? motion : narrow,
        requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
        cancelAnimationFrame(key) { frames.delete(key); }, IntersectionObserver: Observer
    };
    const context = vm.createContext({ document, window, IntersectionObserver: Observer, CustomEvent: class { constructor(type) { this.type = type; } } });
    vm.runInContext(source, context);
    context.initHomelabJourney();
    return { root, slide, controls, actors, windows, frames, motion, narrow, document, context,
        click: name => controls[name].emit('click'),
        choose: name => controls.scenario.emit('change', { target: { value: name } }),
        tick(time) { const next = frames.entries().next().value; if (next) { frames.delete(next[0]); next[1](time); } },
        visibility: value => observer([{ isIntersecting: value }]),
        engagements: () => engagements
    };
}

test('scenario routes preserve causality: blocked requests cannot reach app success or dependencies', () => {
    const { context } = setup();
    const success = context.getLabScenario('success');
    const denied = context.getLabScenario('denied');
    assert.equal(success.at(-1).outcome, 'success');
    assert.equal(success.at(-1).window, 'loaded');
    assert.equal(denied.at(-1).outcome, 'denied');
    assert.ok(denied.every(stage => !stage.route || stage.route === 'entry'));
    assert.ok(denied.every(stage => !['app', 'host', 'database'].includes(stage.actor)));
    assert.deepEqual(Array.from(success.filter(stage => stage.reverse).map(stage => stage.route)), ['database', 'upstream', 'serve', 'entry']);
    for (const name of ['success', 'denied']) {
        assert.ok(context.getLabScenario(name).every(stage => !['redis', 'cron', 'storage'].includes(stage.route)));
    }
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|setTimeout|setInterval/);
});

test('manual outcomes, previous and replay are deterministic across scenario switches', () => {
    const ui = setup();
    assert.equal(ui.frames.size, 0);
    for (const [name, length] of [['success', 10], ['denied', 2], ['success', 10], ['denied', 2]]) {
        ui.choose(name);
        assert.equal(ui.root.dataset.fault, '');
        assert.equal(ui.root.dataset.outcome, '');
        for (let i = 0; i < length; i++) ui.click('next');
        assert.equal(ui.root.dataset.outcome, name);
        for (const path of ui.root.querySelectorAll('[data-lab-path]').filter(path => ['entry', 'serve', 'upstream'].includes(path.dataset.labPath))) {
            assert.equal(path.attrs['marker-start'], name === 'success' ? 'url(#lab-arrow)' : 'none');
            assert.equal(path.attrs['marker-end'], name === 'success' ? 'none' : 'url(#lab-arrow)');
        }
        assert.equal(ui.frames.size, 0);
        assert.equal(ui.windows.find(view => view.attrs.visibility === 'visible').dataset.labWindow, name === 'success' ? 'loaded' : 'error');
        ui.click('previous');
        assert.equal(ui.root.dataset.outcome, '');
        ui.click('replay');
        assert.equal(ui.root.dataset.fault, '');
        assert.equal(ui.frames.size, 1, 'Replay restarts the selected scenario');
        ui.click('play');
        ui.click('previous');
        assert.equal(ui.controls.result.textContent, 'Open private files');
    }
    ui.choose('denied');
    ui.click('next'); ui.click('next');
    ui.click('previous');
    assert.equal(ui.root.dataset.fault, '', 'Stepping backward removes a future failure');
});

test('motion freezes on pause and resize, resumes remaining travel, and has one pending frame', () => {
    const ui = setup();
    ui.click('play');
    ui.tick(0); ui.tick(300);
    assert.equal(ui.controls.packet.attrs.transform, 'translate(28.57142857142857 0)');
    ui.click('play');
    assert.equal(ui.frames.size, 0);
    const position = ui.controls.packet.attrs.transform;
    ui.narrow.matches = true;
    ui.narrow.change();
    assert.equal(ui.controls.packet.attrs.transform, position);
    ui.click('play');
    assert.equal(ui.frames.size, 1);
    ui.tick(600); ui.tick(900);
    assert.notEqual(ui.controls.packet.attrs.transform, position);
    assert.equal(ui.frames.size, 1);
    ui.click('next');
    assert.equal(ui.frames.size, 0);
});

test('scenario changes and slide/visibility interruptions cancel motion and never auto-resume', () => {
    const ui = setup();
    ui.click('play'); ui.tick(0); ui.tick(200);
    ui.choose('denied');
    assert.equal(ui.frames.size, 0);
    assert.equal(ui.controls.result.textContent, 'Open private files');
    ui.click('play');
    ui.slide.emit('featured:deactivate');
    assert.equal(ui.frames.size, 0);
    ui.slide.emit('featured:activate');
    assert.equal(ui.frames.size, 0);
    ui.click('play');
    ui.visibility(false);
    assert.equal(ui.frames.size, 0);
    ui.visibility(true);
    assert.equal(ui.frames.size, 0);
    ui.click('play');
    ui.document.hidden = true;
    ui.document.emit('visibilitychange');
    assert.equal(ui.frames.size, 0);
    ui.document.hidden = false;
    ui.document.emit('visibilitychange');
    assert.equal(ui.frames.size, 0);
    ui.click('play');
    ui.slide.emit('journey:preview');
    assert.equal(ui.frames.size, 0);
    assert.equal(ui.controls.result.textContent, 'Open private files');
});

test('reduced motion snaps stages without spatial travel; scene objects remain non-interactive and initialization is idempotent', () => {
    const ui = setup(true);
    ui.click('play'); ui.tick(0);
    const position = ui.controls.packet.attrs.transform;
    ui.tick(300);
    assert.equal(ui.controls.packet.attrs.transform, position);
    ui.motion.matches = false;
    ui.motion.change();
    assert.equal(ui.frames.size, 0);
    assert.ok(ui.actors.every(actor => !actor.attrs.role && !actor.attrs.tabindex));
    ui.choose('denied');
    const listeners = ui.controls.play.handlers.click.length;
    ui.context.initHomelabJourney();
    assert.equal(ui.controls.play.handlers.click.length, listeners);
});
