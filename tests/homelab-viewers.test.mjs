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
        const fallback = new Element();
        const status = new Element();
        const tools = new Element();
        tools.hidden = true;
        const buttons = ['zoom-in', 'zoom-out', 'reset', 'rotate'].map(action => {
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
    const motion = new Element();
    motion.matches = reducedMotion;
    const document = Object.assign(new Element(), {
        getElementById: () => details,
        createElement: () => ({ getContext: () => webgl ? { getExtension: () => null } : null })
    });
    const context = vm.createContext({
        document, CustomEvent,
        window: {
            customElements: { get: () => class {} },
            matchMedia: () => motion
        },
        ...(intersection ? { IntersectionObserver: class {
            constructor(callback, options) {
                observer = this;
                this.callback = callback;
                this.options = options;
                this.observed = new Set();
                this.refreshes = 0;
            }
            observe(card) { this.observed.add(card); }
            unobserve(card) { this.observed.delete(card); this.refreshes++; }
        } } : {})
    });
    vm.runInContext(source.replace('export function', 'function'), context);
    context.initHomelabViewers(() => {
        imports++;
        return runtime ? runtime() : Promise.resolve();
    });
    const expand = () => {
        details.hidden = false;
        details.inert = false;
        details.dispatchEvent(new Event('homelab:expanded'));
    };
    const near = (card = cards[0]) => observer.callback([{ target: card, isIntersecting: true }]);
    return { cards, details, document, motion, expand, near, imports: () => imports, observer: () => observer };
}

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
    assert.equal(card.viewer.getAttribute('auto-rotate'), undefined);
    assert.equal(card.buttons[3].textContent, 'Start rotation');
    card.buttons[0].dispatchEvent(new Event('click'));
    assert.equal(card.viewer.cameraOrbit, '1rad 1.2rad 0.8m');
    card.buttons[1].dispatchEvent(new Event('click'));
    assert.equal(card.viewer.cameraOrbit, '1rad 1.2rad 1.25m');
    card.buttons[2].dispatchEvent(new Event('click'));
    assert.equal(card.viewer.cameraOrbit, card.viewer.dataset.initialOrbit);
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


test('rotation starts when ready and pauses for visitor choice, visibility, collapse, and motion preferences', async () => {
    const lab = setup();
    lab.expand();
    lab.near();
    await settle();
    const { viewer, buttons } = lab.cards[0];
    assert.equal(viewer.getAttribute('auto-rotate'), undefined);
    viewer.dispatchEvent(new Event('load'));
    const spinning = () => viewer.getAttribute('auto-rotate') === '';
    assert.equal(spinning(), true);
    assert.equal(viewer.getAttribute('rotation-per-second'), '12deg');
    buttons[3].dispatchEvent(new Event('click'));
    assert.equal(spinning(), false);
    assert.equal(buttons[3].textContent, 'Start rotation');
    lab.near();
    assert.equal(spinning(), false);
    buttons[3].dispatchEvent(new Event('click'));
    assert.equal(spinning(), true);
    lab.observer().callback([{ target: lab.cards[0], isIntersecting: false }]);
    assert.equal(spinning(), false);
    lab.near();
    assert.equal(spinning(), true);
    lab.document.hidden = true;
    lab.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(spinning(), false);
    lab.document.hidden = false;
    lab.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(spinning(), true);
    lab.details.hidden = true;
    lab.details.dispatchEvent(new Event('homelab:collapsed'));
    assert.equal(spinning(), false);
    lab.expand();
    assert.equal(spinning(), true);
    lab.motion.matches = true;
    lab.motion.dispatchEvent(new Event('change'));
    assert.equal(spinning(), false);
    buttons[3].dispatchEvent(new Event('click'));
    assert.equal(spinning(), true, 'explicit start is available with reduced motion');
    viewer.dispatchEvent(new Event('error'));
    assert.equal(spinning(), false);
});

test('a visually closing, inert lab pauses rotation and blocks loading until it is expanded again', async () => {
    const lab = setup();
    lab.expand();
    lab.near();
    await settle();
    const card = lab.cards[0];
    card.viewer.dispatchEvent(new Event('load'));
    assert.equal(card.viewer.getAttribute('auto-rotate'), '');
    lab.details.inert = true; // hidden stays false until the collapse animation ends.
    lab.details.dispatchEvent(new Event('homelab:collapsed'));
    assert.equal(card.viewer.getAttribute('auto-rotate'), undefined);
    lab.near(lab.cards[1]);
    await settle();
    assert.equal(lab.cards[1].viewer.getAttribute('src'), undefined);
    const refreshes = lab.observer().refreshes;
    lab.expand();
    assert.equal(lab.observer().refreshes, refreshes + 2);
    lab.near(lab.cards[1]);
    await settle();
    assert.equal(lab.imports(), 1);
    assert.equal(card.viewer.getAttribute('auto-rotate'), '');
    assert.equal(lab.cards[1].viewer.getAttribute('src'), lab.cards[1].viewer.dataset.modelSrc);
});

test('runtime resolving during animated collapse defers the GLB and retries after expansion', async () => {
    let ready;
    const lab = setup({ runtime: () => new Promise(resolve => { ready = resolve; }) });
    lab.expand();
    lab.near();
    await settle();
    lab.details.inert = true;
    lab.details.dispatchEvent(new Event('homelab:collapsed'));
    ready();
    await settle();
    assert.equal(lab.cards[0].viewer.getAttribute('src'), undefined);
    assert.equal(lab.cards[0].dataset.modelState, 'idle');
    lab.expand();
    lab.near();
    await settle();
    assert.equal(lab.imports(), 1);
    assert.equal(lab.cards[0].viewer.getAttribute('src'), lab.cards[0].viewer.dataset.modelSrc);
});
