import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../scripts/modules/homelab-viewers.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

class Element extends EventTarget {
    constructor() {
        super();
        this.dataset = {};
        this.attributes = new Map();
        this.hidden = false;
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name); }
}

function setup({ intersection = true, webgl = true, reducedMotion = false, runtime } = {}) {
    let imports = 0;
    let observer;
    let now = 0;
    let timerId = 0;
    const timers = new Map();
    const motion = Object.assign(new EventTarget(), { matches: reducedMotion });
    const window = Object.assign(new EventTarget(), {
        customElements: { get: () => class {} },
        matchMedia: () => motion
    });
    const details = new Element();
    details.hidden = true;
    const cards = ['thinkpad-t16-gen2', 'raspberry-pi-4'].map(name => {
        const card = new Element();
        const viewer = new Element();
        viewer.dataset = {
            modelSrc: `assets/homelab/models/${name}.glb`,
            initialOrbit: '32deg 65deg 110%'
        };
        viewer.getCameraOrbit = () => ({ theta: 1, phi: 1.2, radius: 1 });
        viewer.jumps = 0;
        viewer.jumpCameraToGoal = () => viewer.jumps++;
        viewer.turntableRotation = 1;
        viewer.resetTurntableRotation = () => { viewer.turntableRotation = 0; };
        const fallback = new Element();
        const status = new Element();
        const tools = new Element();
        tools.hidden = true;
        const buttons = ['zoom-in', 'zoom-out', 'reset'].map(action => {
            const button = new Element();
            button.dataset.modelAction = action;
            return button;
        });
        tools.querySelectorAll = () => buttons;
        card.querySelector = selector => ({
            'model-viewer[data-model-src]': viewer,
            '.homelab-model-fallback': fallback,
            '.homelab-model-status': status,
            '.homelab-model-tools': tools
        })[selector];
        return Object.assign(card, { viewer, fallback, status, tools, buttons });
    });
    details.querySelectorAll = () => cards;
    const context = vm.createContext({
        document: Object.assign(new EventTarget(), {
            hidden: false,
            getElementById: () => details,
            createElement: () => ({ getContext: () => webgl ? { getExtension: () => null } : null })
        }),
        window,
        setTimeout(callback, delay) {
            timers.set(++timerId, { callback, at: now + delay });
            return timerId;
        },
        clearTimeout: id => timers.delete(id),
        ...(intersection ? { IntersectionObserver: class {
            constructor(callback, options) {
                observer = this;
                this.callback = callback;
                this.options = options;
                this.observed = new Set();
            }
            observe(card) { this.observed.add(card); }
            unobserve(card) { this.observed.delete(card); }
        } } : {})
    });
    vm.runInContext(source.replace('export function', 'function'), context);
    context.initHomelabViewers(() => {
        imports++;
        return runtime ? runtime() : Promise.resolve();
    });
    const expand = () => {
        details.hidden = false;
        details.dispatchEvent(new Event('homelab:expanded'));
    };
    const near = (card = cards[0]) => observer.callback([{ target: card, isIntersecting: true }]);
    const advance = milliseconds => {
        now += milliseconds;
        for (const [id, timer] of timers) {
            if (timer.at > now) continue;
            timers.delete(id);
            timer.callback();
        }
    };
    return { document: context.document, cards, details, expand, near, window, motion, advance, imports: () => imports, observer: () => observer };
}

const emit = (target, type, properties = {}) => target.dispatchEvent(Object.assign(new Event(type), properties));
const rotating = viewer => viewer.getAttribute('auto-rotate') !== undefined;
const activeLab = () => {
    const lab = setup();
    lab.expand();
    for (const card of lab.cards) {
        lab.near(card);
        emit(card.viewer, 'load');
    }
    return lab;
};

test('both models rotate unless reduced motion is requested, including live preference changes', () => {
    const lab = activeLab();
    assert.ok(lab.cards.every(card => rotating(card.viewer)));
    lab.motion.matches = true;
    emit(lab.motion, 'change');
    assert.ok(lab.cards.every(card => !rotating(card.viewer)));
    emit(lab.cards[0].viewer, 'wheel');
    lab.advance(5000);
    assert.ok(lab.cards.every(card => !rotating(card.viewer)));
    lab.motion.matches = false;
    emit(lab.motion, 'change');
    assert.ok(lab.cards.every(card => rotating(card.viewer)));
    assert.ok(setup({ reducedMotion: true }).cards.every(card => !rotating(card.viewer)));
});

test('held and multi-pointer gestures pause rotation until three seconds after the last release', () => {
    const lab = activeLab();
    const viewer = lab.cards[0].viewer;
    emit(viewer, 'pointerdown', { pointerId: 1 });
    emit(viewer, 'pointerdown', { pointerId: 2 });
    assert.equal(rotating(viewer), false);
    assert.equal(rotating(lab.cards[1].viewer), true);
    lab.advance(10000);
    assert.equal(rotating(viewer), false);
    emit(lab.window, 'pointerup', { pointerId: 1 });
    lab.advance(5000);
    assert.equal(rotating(viewer), false);
    emit(lab.window, 'pointercancel', { pointerId: 2 });
    lab.advance(2999);
    assert.equal(rotating(viewer), false);
    lab.advance(1);
    assert.equal(rotating(viewer), true);

    emit(viewer, 'pointerdown', { pointerId: 3 });
    emit(viewer, 'lostpointercapture', { pointerId: 3 });
    lab.advance(3000);
    assert.equal(rotating(viewer), true);
});

test('keyboard, wheel, user camera movement, and toolbar actions pause and restart the delay', () => {
    const lab = activeLab();
    const card = lab.cards[0];
    emit(card.viewer, 'load');
    emit(card.viewer, 'keydown', { key: 'ArrowLeft' });
    lab.advance(10000);
    assert.equal(rotating(card.viewer), false);
    emit(lab.window, 'keyup', { key: 'ArrowLeft' });
    lab.advance(3000);
    assert.equal(rotating(card.viewer), true);

    for (const action of [
        () => emit(card.viewer, 'wheel'),
        () => emit(card.viewer, 'camera-change', { detail: { source: 'user-interaction' } }),
        ...card.buttons.map(button => () => emit(button, 'click'))
    ]) {
        action();
        assert.equal(rotating(card.viewer), false);
        lab.advance(2000);
        action();
        lab.advance(2000);
        assert.equal(rotating(card.viewer), false);
        lab.advance(1000);
        assert.equal(rotating(card.viewer), true);
    }
    emit(card.viewer, 'camera-change', { detail: { source: 'none' } });
    assert.equal(rotating(card.viewer), true);
    emit(card.viewer, 'keydown', { key: 'ArrowLeft' });
    emit(lab.window, 'blur');
    lab.advance(3000);
    assert.equal(rotating(card.viewer), true);
});

test('models and runtime stay deferred until the lab is expanded and hardware is near the viewport', async () => {
    const lab = setup();
    assert.equal(lab.imports(), 0);
    assert.equal(lab.observer(), undefined);
    assert.ok(lab.cards.every(card => card.viewer.getAttribute('src') === undefined));
    lab.expand();
    assert.equal(lab.imports(), 0);
    assert.equal(lab.observer().observed.size, 2);
    lab.observer().callback([{ target: lab.cards[0], isIntersecting: false }]);
    await settle();
    assert.equal(lab.imports(), 0);

    lab.near();
    await settle();
    assert.equal(lab.imports(), 1);
    assert.equal(lab.cards[0].viewer.getAttribute('src'), lab.cards[0].viewer.dataset.modelSrc);
    assert.equal(lab.cards[1].viewer.getAttribute('src'), undefined);
    assert.equal(lab.cards[0].fallback.hidden, false);
    assert.equal(lab.cards[0].tools.hidden, true);
    lab.near(lab.cards[1]);
    await settle();
    assert.equal(lab.imports(), 1);
    assert.equal(lab.cards[1].viewer.getAttribute('src'), lab.cards[1].viewer.dataset.modelSrc);

    lab.details.hidden = true;
    lab.expand();
    await settle();
    assert.equal(lab.imports(), 1);
    assert.equal(lab.observer().observed.size, 2);
});

test('successful models expose camera controls and reduced motion zoom/reset snaps to its goal', async () => {
    const lab = setup({ reducedMotion: true });
    lab.expand();
    lab.near();
    await settle();
    const card = lab.cards[0];
    card.viewer.dispatchEvent(new Event('load'));
    assert.equal(card.fallback.hidden, true);
    assert.equal(card.tools.hidden, false);
    assert.equal(card.viewer.inert, false);
    assert.equal(card.viewer.getAttribute('aria-hidden'), undefined);
    card.buttons[0].dispatchEvent(new Event('click'));
    assert.equal(card.viewer.cameraOrbit, '1rad 1.2rad 0.8m');
    card.buttons[1].dispatchEvent(new Event('click'));
    assert.equal(card.viewer.cameraOrbit, '1rad 1.2rad 1.25m');
    card.buttons[2].dispatchEvent(new Event('click'));
    assert.equal(card.viewer.cameraOrbit, card.viewer.dataset.initialOrbit);
    assert.equal(card.viewer.turntableRotation, 0);
    assert.equal(card.viewer.jumps, 3);
    assert.match(card.status.textContent, /Interactive 3D ready/);

    card.viewer.dispatchEvent(new Event('error'));
    assert.equal(card.fallback.hidden, false);
    assert.equal(card.tools.hidden, true);
    assert.equal(card.viewer.inert, true);
    assert.equal(card.viewer.getAttribute('aria-hidden'), 'true');
});

test('opening without IntersectionObserver loads once and blocked runtime preserves both previews', async () => {
    const lab = setup({ intersection: false, runtime: () => Promise.reject(new Error('Blocked runtime')) });
    lab.expand();
    await settle();
    assert.equal(lab.imports(), 1);
    for (const card of lab.cards) {
        assert.equal(card.dataset.modelState, 'unavailable');
        assert.equal(card.viewer.getAttribute('src'), undefined);
        assert.equal(card.fallback.hidden, false);
        assert.equal(card.tools.hidden, true);
        assert.match(card.status.textContent, /Hardware preview shown/);
    }
});

test('unavailable WebGL does not download the runtime or leave an empty hardware viewport', async () => {
    const lab = setup({ intersection: false, webgl: false });
    lab.expand();
    await settle();
    assert.equal(lab.imports(), 0);
    assert.ok(lab.cards.every(card => card.dataset.modelState === 'unavailable' && !card.fallback.hidden));
});

test('collapsing during the runtime download defers GLBs until the next expansion', async () => {
    let ready;
    const lab = setup({ runtime: () => new Promise(resolve => { ready = resolve; }) });
    lab.expand();
    lab.near();
    await settle();
    lab.details.hidden = true;
    ready();
    await settle();
    assert.equal(lab.cards[0].viewer.getAttribute('src'), undefined);
    lab.expand();
    lab.near();
    await settle();
    assert.equal(lab.imports(), 1);
    assert.equal(lab.cards[0].viewer.getAttribute('src'), lab.cards[0].viewer.dataset.modelSrc);
});

test('rotation pauses offscreen, on collapse, and in hidden tabs, then resumes only when eligible', () => {
    const lab = activeLab();
    const card = lab.cards[0];
    lab.observer().callback([{ target: card, isIntersecting: false }]);
    assert.equal(rotating(card.viewer), false);
    lab.advance(5000);
    assert.equal(rotating(card.viewer), false);
    lab.near(card);
    assert.equal(rotating(card.viewer), true);
    lab.document.hidden = true;
    emit(lab.document, 'visibilitychange');
    assert.ok(lab.cards.every(c => !rotating(c.viewer)));
    lab.document.hidden = false;
    emit(lab.document, 'visibilitychange');
    assert.ok(lab.cards.every(c => rotating(c.viewer)));
    lab.details.hidden = true;
    emit(lab.details, 'homelab:collapsed');
    assert.ok(lab.cards.every(c => !rotating(c.viewer)));
    lab.expand();
    assert.ok(lab.cards.every(c => !rotating(c.viewer)));
    lab.near(card);
    assert.equal(rotating(card.viewer), true);
    lab.motion.matches = true;
    emit(lab.motion, 'change');
    lab.near(card);
    assert.equal(rotating(card.viewer), false);
});

test('leaving hardware during runtime loading postpones GLB assignment', async () => {
    let ready;
    const lab = setup({ runtime: () => new Promise(resolve => { ready = resolve; }) });
    lab.expand();
    lab.near();
    await settle();
    lab.observer().callback([{ target: lab.cards[0], isIntersecting: false }]);
    ready();
    await settle();
    assert.equal(lab.cards[0].viewer.getAttribute('src'), undefined);
    lab.near();
    await settle();
    assert.equal(lab.cards[0].viewer.getAttribute('src'), lab.cards[0].viewer.dataset.modelSrc);
});
