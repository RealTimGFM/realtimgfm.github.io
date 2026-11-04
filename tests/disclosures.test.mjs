import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { renderPage } from '../scripts/build.mjs';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const sources = await Promise.all(['disclosure', 'experience-toggle', 'homelab-toggle', 'project-case-studies']
    .map(name => read('scripts/modules/' + name + '.js')));
const source = sources.map(text => text.replace(/^import .*;\n/gm, '').replaceAll('export function', 'function')).join('\n');

function setup({ reduced = false, animate = true, native = false, hash = '' } = {}) {
    const ids = new Map();
    const animations = [];
    let document;
    class Element extends EventTarget {
        constructor(className = '', id = '') {
            super();
            this.className = className;
            this.id = id;
            this.dataset = {};
            this.hidden = false;
            this.inert = false;
            this.open = false;
            this.attributes = new Map();
            this.childNodes = [];
            this.naturalHeight = 300;
            this.marginTop = '24px';
            this.classList = {
                add: name => { if (!this.classList.contains(name)) this.className += ' ' + name; },
                remove: name => { this.className = this.className.split(' ').filter(value => value !== name).join(' '); },
                contains: name => this.className.split(' ').includes(name)
            };
            if (id) ids.set(id, this);
            if (!animate) this.animate = undefined;
        }
        append(child) {
            if (child.parent) child.parent.childNodes = child.parent.childNodes.filter(item => item !== child);
            child.parent = this;
            this.childNodes.push(child);
        }
        contains(target) { return !!target && (target === this || this.childNodes.some(child => child.contains(target))); }
        setAttribute(name, value) { this.attributes.set(name, value); }
        removeAttribute(name) { this.attributes.delete(name); }
        getAttribute(name) { return this.attributes.get(name); }
        focus(options) { document.activeElement = this; this.focusOptions = options; }
        scrollIntoView(options) { (this.scrolls ??= []).push(options); }
        getBoundingClientRect() {
            return { height: this.hidden ? 0 : this.current?.height ?? this.naturalHeight,
                top: this.top ?? 20, bottom: (this.top ?? 20) + 44 };
        }
        animate(frames, options) {
            const panel = this;
            const animation = {
                frames, options, cancelled: false, height: parseFloat(frames[0].height),
                opacity: frames[0].opacity, margin: frames[0].marginTop,
                cancel() { this.cancelled = true; if (panel.current === this) panel.current = null; },
                progress(fraction) {
                    this.height = parseFloat(frames[0].height) + (parseFloat(frames[1].height) - parseFloat(frames[0].height)) * fraction;
                    this.opacity = String(Number(frames[0].opacity) + (Number(frames[1].opacity) - Number(frames[0].opacity)) * fraction);
                    this.margin = parseFloat(frames[0].marginTop) * (1 - fraction) + parseFloat(frames[1].marginTop) * fraction + 'px';
                },
                finish() { this.onfinish?.(); }
            };
            panel.current = animation;
            animations.push(animation);
            return animation;
        }
        querySelector(selector) { return selector === ':scope > summary' ? this.summary : null; }
        closest() { return null; }
    }
    document = Object.assign(new EventTarget(), {
        fonts: new EventTarget(), activeElement: null,
        getElementById: id => ids.get(id) ?? null,
        createElement: () => new Element(),
        querySelectorAll: selector => selector === '.xp-toggle' ? [xpButton] : native ? [details] : []
    });
    const panel = new Element('xp-details');
    const xpButton = new Element('btn xp-toggle');
    xpButton.nextElementSibling = panel;
    const lab = new Element('', 'homelabDetails');
    const toggle = new Element('btn homelab-toggle', 'homelabToggle');
    const collapse = new Element('btn', 'homelabCollapse');
    lab.append(collapse);
    const anchor = new Element('', 'lab-anchor');
    lab.append(anchor);
    const details = new Element('project-case-study');
    const summary = new Element();
    details.summary = summary;
    details.append(summary);
    const evidence = new Element('', 'case-evidence');
    details.append(evidence);
    const motion = Object.assign(new EventTarget(), { matches: reduced });
    const window = Object.assign(new EventTarget(), {
        innerHeight: 800, location: { hash }, matchMedia: () => motion
    });
    const context = vm.createContext({
        document, window, Event,
        getComputedStyle: element => ({
            opacity: element.current?.opacity ?? '1',
            marginTop: element.current?.margin ?? element.marginTop
        })
    });
    vm.runInContext(source, context);
    const click = (element, detail = 1) => {
        const event = new Event('click', { cancelable: true });
        Object.defineProperty(event, 'detail', { value: detail });
        element.dispatchEvent(event);
        return event;
    };
    return { context, window, document, motion, panel, xpButton, lab, toggle, collapse,
        details, summary, evidence, anchor, animations, click, Element };
}

test('opening and closing remain reversible at the rendered height, including stale completion callbacks', () => {
    const ui = setup();
    const states = [];
    const control = ui.context.createDisclosure(ui.panel, { onChange: value => states.push(value) });
    assert.equal(ui.panel.hidden, true);
    assert.equal(ui.animations.length, 0, 'initialization must not animate');
    control.setExpanded(true);
    assert.equal(ui.panel.hidden, false);
    const opening = ui.animations.at(-1);
    opening.progress(0.4);
    const staleFinish = opening.onfinish;
    control.setExpanded(false);
    assert.equal(opening.cancelled, true);
    assert.equal(ui.animations.at(-1).frames[0].height, '120px');
    assert.equal(ui.panel.inert, true, 'closing content must immediately leave the tab order');
    assert.equal(ui.panel.getAttribute('aria-hidden'), 'true');
    const closing = ui.animations.at(-1);
    closing.progress(0.5);
    control.setExpanded(true);
    assert.equal(ui.animations.at(-1).frames[0].height, '60px');
    staleFinish();
    assert.equal(ui.panel.current, ui.animations.at(-1), 'stale completion cannot finalize a newer transition');
    for (let i = 0; i < 15; i++) control.setExpanded(!control.expanded);
    control.setExpanded(true);
    ui.animations.at(-1).finish();
    assert.equal(control.expanded, true);
    assert.equal(ui.panel.inert, false);
    assert.equal(ui.panel.hidden, false);
    assert.equal(ui.panel.current, null);
    assert.equal(ui.panel.classList.contains('is-animating'), false);
    ui.panel.naturalHeight = 840;
    assert.equal(ui.panel.getBoundingClientRect().height, 840, 'finished content must grow without clipping');
    control.setExpanded(false);
    ui.animations.at(-1).finish();
    assert.equal(ui.panel.hidden, true);
    assert.equal(states.at(-1), false);
});

test('reduced motion, missing WAAPI, preference changes, resize and font reflow settle without stale dimensions', () => {
    for (const options of [{ reduced: true }, { animate: false }]) {
        const ui = setup(options);
        const control = ui.context.createDisclosure(ui.panel);
        control.setExpanded(true);
        assert.equal(ui.panel.hidden, false);
        control.setExpanded(false);
        assert.equal(ui.panel.hidden, true);
        assert.equal(ui.animations.length, 0);
    }
    for (const event of ['resize', 'loadingdone', 'change']) {
        const ui = setup();
        const control = ui.context.createDisclosure(ui.panel);
        control.setExpanded(true);
        if (event === 'change') ui.motion.matches = true;
        (event === 'resize' ? ui.window : event === 'loadingdone' ? ui.document.fonts : ui.motion).dispatchEvent(new Event(event));
        assert.equal(ui.panel.current, null);
        assert.equal(ui.panel.hidden, false);
        assert.equal(ui.panel.classList.contains('is-animating'), false);
    }
});

test('Experience uses native keyboard-origin clicks, correct labels/ARIA and restores focus before hiding content', () => {
    const ui = setup();
    ui.context.initExperienceToggles();
    ui.context.initExperienceToggles();
    assert.equal(ui.panel.hidden, true);
    assert.equal(ui.xpButton.getAttribute('aria-controls'), ui.panel.id);
    ui.click(ui.xpButton, 0); // Native Enter/Space activation is delivered as a click.
    assert.equal(ui.xpButton.getAttribute('aria-expanded'), 'true');
    assert.equal(ui.xpButton.textContent, 'Show Less');
    const link = new ui.Element();
    ui.panel.append(link);
    link.focus();
    ui.click(ui.xpButton, 0);
    assert.equal(ui.document.activeElement, ui.xpButton);
    assert.equal(ui.xpButton.focusOptions.preventScroll, true);
    assert.equal(ui.xpButton.getAttribute('aria-expanded'), 'false');
    ui.animations.at(-1).finish();
    assert.equal(ui.panel.hidden, true);
    assert.equal(ui.xpButton.textContent, 'Show Details');
});

test('Home Lab events track intended state during animation and bottom collapse restores focus only when necessary', () => {
    const ui = setup();
    const states = [];
    for (const name of ['homelab:expanded', 'homelab:collapsed']) {
        ui.lab.addEventListener(name, () => states.push([name, ui.lab.hidden, ui.lab.inert]));
    }
    ui.context.initHomelabToggle();
    ui.context.initHomelabToggle();
    assert.equal(ui.lab.hidden, true);
    assert.equal(ui.toggle.hidden, false);
    assert.equal(ui.collapse.hidden, false);
    ui.click(ui.toggle, 0);
    assert.equal(ui.toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(ui.collapse.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(states.at(-1), ['homelab:expanded', false, false]);
    ui.collapse.focus();
    ui.toggle.top = -200;
    ui.click(ui.collapse, 0);
    assert.equal(ui.document.activeElement, ui.toggle);
    assert.equal(ui.toggle.focusOptions.preventScroll, true);
    assert.equal(ui.toggle.scrolls[0].block, 'nearest');
    assert.equal(ui.toggle.scrolls[0].behavior, 'instant');
    assert.deepEqual(states.at(-1), ['homelab:collapsed', false, true]);
    ui.click(ui.toggle);
    assert.equal(ui.toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(ui.lab.inert, false);
    ui.animations.at(-1).finish();
    ui.toggle.focus();
    ui.click(ui.toggle);
    assert.equal(ui.toggle.scrolls.length, 1, 'the top toggle does not move the viewport');
    ui.animations.at(-1).finish();
    assert.equal(ui.lab.hidden, true);
    assert.equal(ui.collapse.getAttribute('aria-expanded'), 'false');
    assert.equal(states.length, 5, 'reinitialization does not add duplicate handlers');
});

test('native project details preserve summary activation, reverse safely and follow external native toggles', () => {
    const ui = setup({ native: true });
    ui.context.initProjectCaseStudies();
    ui.context.initProjectCaseStudies();
    const content = ui.details.childNodes[1];
    assert.equal(content.contains(ui.evidence), true);
    assert.equal(ui.details.childNodes.length, 2);
    assert.equal(ui.details.open, false);
    assert.equal(ui.click(ui.summary, 0).defaultPrevented, true);
    assert.equal(ui.details.open, true);
    assert.equal(ui.details.dataset.expanded, 'true');
    ui.click(ui.summary, 0);
    assert.equal(ui.details.open, true, 'native container stays open until collapse finishes');
    assert.equal(ui.details.dataset.expanded, 'false');
    ui.details.dispatchEvent(new Event('toggle'));
    assert.equal(content.inert, true, 'a queued native toggle cannot undo a rapid close');
    ui.click(ui.summary);
    ui.animations.at(-1).finish();
    assert.equal(ui.details.open, true);
    ui.details.open = false;
    ui.details.dispatchEvent(new Event('toggle'));
    assert.equal(content.hidden, true);
    ui.details.open = true;
    ui.details.dispatchEvent(new Event('toggle'));
    assert.equal(content.hidden, false);
    ui.evidence.focus();
    ui.click(ui.summary);
    assert.equal(ui.document.activeElement, ui.summary);
    ui.animations.at(-1).finish();
    assert.equal(ui.details.open, false);
});

test('initial fragments and later hash navigation reveal content immediately without animating or hijacking unrelated anchors', () => {
    const ui = setup({ hash: '#lab-anchor' });
    ui.context.initHomelabToggle();
    assert.equal(ui.lab.hidden, false);
    assert.equal(ui.toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(ui.animations.length, 0);
    ui.click(ui.toggle);
    ui.animations.at(-1).finish();
    ui.window.dispatchEvent(new Event('hashchange'));
    assert.equal(ui.lab.hidden, false);
    assert.equal(ui.anchor.scrolls.length, 1);
    ui.window.location.hash = '#unrelated';
    ui.window.dispatchEvent(new Event('hashchange'));
    assert.equal(ui.anchor.scrolls.length, 1);
    ui.window.location.hash = '#%';
    assert.equal(ui.context.fragmentTarget(), null);
});

test('static content stays readable with JavaScript disabled and startup guard releases after a failed module', async () => {
    const html = await renderPage();
    assert.match(html, /<div id="homelabDetails">/);
    assert.equal([...html.matchAll(/<div class="xp-details">/g)].length, 3);
    assert.doesNotMatch(html, /<html[^>]*class="[^"]*disclosures-pending/);
    assert.match(html, /<button[^>]*class="btn xp-toggle"[^>]*hidden>/);
    assert.equal([...html.matchAll(/<div class="card sticker-sm" data-stagger/g)].length, 11);
    const ui = setup();
    ui.document.documentElement = new ui.Element();
    const guard = html.match(/<script>\s*(\/\/ Avoid an expanded-content flash;[\s\S]*?)<\/script>/)[1];
    vm.runInContext(guard, ui.context);
    assert.equal(ui.document.documentElement.classList.contains('disclosures-pending'), true);
    ui.window.dispatchEvent(new Event('load'));
    assert.equal(ui.document.documentElement.classList.contains('disclosures-pending'), false);
});

test('the bottom collapse command always returns focus, including browsers that do not focus pointer-activated buttons', () => {
    const ui = setup({ reduced: true });
    ui.context.initHomelabToggle();
    ui.click(ui.toggle);
    ui.document.activeElement = null;
    ui.click(ui.collapse);
    assert.equal(ui.document.activeElement, ui.toggle);
    assert.equal(ui.toggle.focusOptions.preventScroll, true);
    assert.equal(ui.toggle.scrolls, undefined, 'visible owner needs no scrolling');
    assert.equal(ui.lab.hidden, true);
    assert.equal(ui.animations.length, 0);
});
