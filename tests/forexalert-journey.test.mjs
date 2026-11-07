import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { renderPage } from '../scripts/build.mjs';

const source = await readFile(new URL('../scripts/modules/forexalert-journey.js', import.meta.url), 'utf8');
const { FX, getFxFixture, freshMidpoint, canSendFx, createFxState, advanceFx, replayFx, fxPlotPoint } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const finish = state => {
    for (let i = 0; !state.terminal && i < 10; i++) state = advanceFx(state);
    assert.equal(state.terminal, true);
    return state;
};

test('fictional midpoint and inclusive daily trigger use completed previous close', () => {
    const fixture = getFxFixture();
    assert.equal(freshMidpoint(fixture), 1.1066);
    assert.ok(Math.abs((freshMidpoint(fixture) - FX.baseline) / FX.baseline * 100 - 0.6) < 1e-10);
    assert.equal(FX.trigger, FX.baseline * (1 + FX.threshold / 100));
    const exact = createFxState();
    exact.fixture = { ...exact.fixture, bid: 1.1054, ask: 1.1056 };
    assert.equal(finish(exact).outcome, 'success');
    for (const patch of [{ bid: null }, { ask: null }, { bid: 1.2 }, { bidAge: -1 }, { askAge: 61 }, { skew: 2.1 }]) {
        assert.equal(freshMidpoint({ ...fixture, ...patch }), null);
    }
    assert.equal(freshMidpoint({ ...fixture, bidAge: 60, askAge: 60, skew: 2 }), 1.1066);
});

test('all scenario outcomes stop at the correct gate with no downstream passes', () => {
    const cases = { valid: [7, 'success', 'commit'], below: [4, 'below', 'rule'],
        duplicate: [5, 'duplicate', 'cooldown'], cooldown: [5, 'cooldown', 'cooldown'], closed: [1, 'closed', 'market'] };
    for (const [name, [stage, outcome, gate]] of Object.entries(cases)) {
        const input = createFxState(name);
        const originalLedger = structuredClone(input.ledger);
        const output = finish(input);
        assert.deepEqual([output.stage, output.outcome, output.gate], [stage, outcome, gate]);
        assert.equal(advanceFx(output), output, 'Terminal transitions are idempotent');
        assert.equal(input.stage, 0, 'Transitions do not mutate prior snapshots');
        if (outcome !== 'success') {
            assert.deepEqual(output.ledger, originalLedger);
            assert.equal(output.logs.length, 0);
            assert.equal(output.committed, false);
            assert.equal(output.passed.includes(gate), false);
            assert.equal(output.passed.includes('commit'), false);
        }
        if (stage < 4 || outcome === 'below') assert.equal(output.candidate, null);
        if (stage < 6) assert.equal(output.attempted, false);
    }
    const badBaseline = createFxState();
    badBaseline.fixture.baselineComplete = false;
    assert.equal(finish(badBaseline).outcome, 'baseline');
    const closedWithStaleQuote = createFxState('closed');
    closedWithStaleQuote.fixture.bidAge = 90;
    assert.equal(finish(closedWithStaleQuote).outcome, 'closed', 'Market schedule precedes quote gate');
});

test('sender acceptance appends before cooldown commit and replay cannot duplicate a pending commit', () => {
    let state = createFxState();
    for (let i = 0; i < 5; i++) state = advanceFx(state);
    assert.equal(state.attempted, false);
    const accepted = advanceFx(state);
    assert.equal(accepted.sent, true);
    assert.equal(accepted.logs.length, 1);
    assert.deepEqual(accepted.ledger, {});
    const replayBeforeCommit = finish(replayFx(accepted));
    assert.equal(replayBeforeCommit.outcome, 'duplicate', 'Replay settles a pending successful send, avoiding a second append');
    assert.equal(replayBeforeCommit.logs.length, 1);
    const committed = advanceFx(accepted);
    assert.equal(committed.ledger[FX.key].sentAt, FX.now);
    assert.equal(committed.logs.length, 1);
    assert.deepEqual(accepted.ledger, {});
});

test('fingerprints require both changed identity and elapsed cooldown; replay preserves and reset clears', () => {
    const record = { fingerprint: 'candidate-A', sentAt: FX.now };
    assert.equal(canSendFx(record, 'candidate-A', '2026-07-10T16:00:00Z'), false);
    assert.equal(canSendFx(record, 'candidate-B', '2026-07-08T16:59:59Z'), false);
    assert.equal(canSendFx(record, 'candidate-B', '2026-07-08T17:00:00Z'), true);
    const success = finish(createFxState());
    const replay = finish(replayFx(success));
    assert.equal(replay.outcome, 'duplicate');
    assert.deepEqual(replay.ledger, success.ledger);
    assert.deepEqual(replay.logs, success.logs);
    assert.equal(finish(createFxState()).outcome, 'success');
    assert.deepEqual(createFxState().ledger, {});
});

test('plot geometry and quote values share exact sample interpolation; below never crosses', () => {
    for (const width of [340, 640]) {
        const values = getFxFixture().samples;
        const last = fxPlotPoint(values, 1, width);
        assert.equal(last.price, 1.1066);
        assert.equal(last.x, width - 22);
        const halfway = fxPlotPoint(values, 0.5, width);
        assert.equal(halfway.price, (values[2] + values[3]) / 2);
        for (let i = 0; i <= 100; i++) assert.ok(fxPlotPoint(getFxFixture('below').samples, i / 100, width).price < FX.trigger);
    }
});

function setup(reduced = false) {
    const element = () => ({
        dataset: {}, attrs: {}, handlers: {}, children: [], hidden: false, open: false, textContent: '',
        style: { setProperty() {} }, classList: { contains: () => true },
        setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; },
        addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); },
        emit(name, event = {}) { this.handlers[name]?.forEach(callback => callback(event)); },
        append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; }, focus() {}
    });
    const root = element(), slide = element();
    let onscreen = true;
    root.getBoundingClientRect = () => onscreen ? { top: 0, bottom: 800, left: 0, right: 600 } : { top: -900, bottom: -100, left: 0, right: 600 };
    const names = [...new Set([...source.matchAll(/find\('([^']+)'\)/g)].map(match => match[1]))];
    const controls = Object.fromEntries([...names, 'baseline-label', 'trigger-label'].map(name => [name, element()]));
    const gates = ['market', 'quote', 'rule', 'cooldown', 'send', 'commit'].map(name => {
        const e = element(); e.dataset.fxGate = name; e.mark = element(); e.querySelector = () => e.mark; return e;
    });
    const actors = ['market', 'quote', 'rule', 'cooldown', 'output'].map(name => Object.assign(element(), { dataset: { fxInspect: name } }));
    root.querySelector = query => controls[query.slice('[data-fx-'.length, -1)];
    root.querySelectorAll = query => query === '[data-fx-gate]' ? gates : actors;
    root.closest = () => slide;
    let engagements = 0;
    root.dispatchEvent = event => { if (event.type === 'journey:interact' && event.bubbles) engagements++; };
    const document = Object.assign(element(), { querySelector: () => root, createElement: element, createElementNS: element, hidden: false });
    const motion = { matches: reduced, addEventListener(name, callback) { this.change = callback; } };
    const narrow = { matches: false, addEventListener(name, callback) { this.change = callback; } };
    const frames = new Map(); let id = 0; let observer;
    class Observer { constructor(callback) { observer = callback; } observe() {} }
    const window = { matchMedia: query => query.includes('reduce') ? motion : narrow, IntersectionObserver: Observer,
        innerWidth: 1536, innerHeight: 900,
        requestAnimationFrame(callback) { frames.set(++id, callback); return id; }, cancelAnimationFrame(key) { frames.delete(key); } };
    const context = vm.createContext({ document, window, IntersectionObserver: Observer, structuredClone,
        CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } } });
    vm.runInContext(source.replaceAll('export function', 'function').replaceAll('export const', 'const'), context);
    context.initForexalertJourney();
    return { root, slide, controls, gates, actors, motion, frames, narrow, document, context,
        click: name => controls[name].emit('click'),
        choose(name) { controls.scenario.value = name; controls.scenario.emit('change'); },
        tick(time) { const next = frames.entries().next().value; if (next) { frames.delete(next[0]); next[1](time); } },
        visibility(value) { onscreen = value; observer([{ isIntersecting: value }]); }, engagements: () => engagements };
}

test('UI failure consequences, fixture switches and history inspection cannot double commit', () => {
    const ui = setup();
    assert.equal(ui.frames.size, 0);
    for (let i = 0; i < 7; i++) ui.click('next');
    assert.equal(ui.root.dataset.outcome, 'success');
    const ledger = ui.controls.memory.textContent;
    const log = ui.controls['log-line'].textContent;
    for (let i = 0; i < 7; i++) ui.click('previous');
    assert.match(ui.controls.result.textContent, /Earlier step/);
    assert.equal(ui.controls.memory.textContent, ledger);
    for (let i = 0; i < 10; i++) ui.click('next');
    assert.equal(ui.controls['log-line'].textContent, log);
    ui.click('replay');
    for (let i = 0; i < 7; i++) ui.click('next');
    assert.equal(ui.root.dataset.outcome, 'duplicate');
    ui.click('reset');
    assert.equal(ui.controls.confirm.hidden, false);
    ui.click('cancel-reset');
    assert.equal(ui.controls.memory.textContent, ledger);
    ui.click('reset'); ui.click('confirm-reset');
    assert.equal(ui.controls.memory.textContent, 'No earlier alert saved.');
    ui.choose('closed'); ui.click('next');
    assert.equal(ui.root.dataset.outcome, 'closed');
    assert.equal(ui.gates[1].dataset.status, 'waiting');
    assert.ok(ui.engagements() > 0);
});

test('one frame owner; pause, scenario, slide, visibility and preview cancel in-flight work', () => {
    const ui = setup();
    ui.click('next'); ui.click('next'); ui.click('play');
    let now = 0;
    for (let i = 0; i < 17; i++) ui.tick(now += 80);
    const moving = ui.controls.marker.attrs.transform;
    for (let i = 0; i < 4; i++) ui.tick(now += 80);
    assert.notEqual(ui.controls.marker.attrs.transform, moving);
    ui.click('play');
    assert.equal(ui.frames.size, 0);
    const paused = ui.controls.marker.attrs.transform;
    const pausedPrice = ui.controls.mid.textContent;
    ui.tick(now += 1000);
    assert.equal(ui.controls.marker.attrs.transform, paused);
    ui.narrow.matches = true;
    ui.narrow.change();
    assert.equal(ui.controls.mid.textContent, pausedPrice, 'Paused responsive reflow retains the same plotted price');
    ui.click('play'); assert.equal(ui.frames.size, 1);
    ui.choose('below'); assert.equal(ui.frames.size, 0);
    for (const stop of [() => ui.slide.emit('featured:deactivate'), () => ui.visibility(false),
        () => { ui.document.hidden = true; ui.document.emit('visibilitychange'); }, () => ui.slide.emit('journey:preview')]) {
        ui.visibility(true); ui.document.hidden = false;
        ui.click('play'); assert.equal(ui.frames.size, 1);
        stop(); assert.equal(ui.frames.size, 0);
        ui.visibility(true); ui.document.hidden = false; ui.slide.emit('featured:activate');
        assert.equal(ui.frames.size, 0);
    }
    const handler = ui.controls.play.handlers.click[0];
    ui.context.initForexalertJourney();
    assert.equal(ui.controls.play.handlers.click.length, 1);
    assert.equal(ui.controls.play.handlers.click[0], handler);
});

test('reduced motion uses discrete decisions', () => {
    const ui = setup(true);
    ui.click('play'); const initial = ui.controls.marker.attrs.transform;
    ui.tick(0); ui.tick(80); ui.tick(160);
    assert.equal(ui.controls.marker.attrs.transform, initial);
    ui.choose('closed');
    assert.equal(ui.root.dataset.stage, '0');
});

test('Run rechecks actual geometry when observer delivery lags a control scrolled into view', () => {
    const ui = setup();
    ui.visibility(false);
    ui.root.getBoundingClientRect = () => ({ top: -300, bottom: 600, left: 0, right: 300 });
    ui.click('play');
    assert.equal(ui.frames.size, 1);
    assert.equal(ui.root.dataset.stage, '1');
    ui.visibility(false); // A queued stale entry must not stop a currently visible journey.
    assert.equal(ui.frames.size, 1);
    ui.root.getBoundingClientRect = () => ({ top: -1300, bottom: -100, left: 0, right: 300 });
    ui.visibility(false);
    assert.equal(ui.frames.size, 0);
});

test('static fallback, ownership and isolated integration preserve the portfolio contract', async () => {
    const html = await renderPage();
    const fx = html.match(/<article id="featured-forexalert"[\s\S]*?<\/article>/)[0];
    assert.doesNotMatch(fx, /data-journey[=\s-]/);
    assert.match(fx, /data-fx-controls hidden/);
    assert.deepEqual([...fx.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map(match => [match[1], match[2]]), [
        ['valid', 'Price goes up'], ['below', 'Small price change'], ['duplicate', 'Repeated alert'],
        ['cooldown', 'Another alert too soon'], ['closed', 'Market closed']
    ]);
    assert.doesNotMatch(fx, /data-fx-retry|Outdated price|Notification failed|Trusted midpoint|Cooldown permits/);
    assert.doesNotMatch(source, /'stale'|'send-fails'|senderSucceeds|find\('retry'\)/);
    assert.match(fx, /Is the price reliable\?/);
    assert.match(fx, /Ready for another alert\?/);
    assert.doesNotMatch(fx, /inspector|data-fx-inspect|data-fx-ledger[\s>]|fingerprint|cooldown\.json/);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|localStorage|setTimeout|setInterval/);
    const main = await readFile(new URL('../scripts/main.js', import.meta.url), 'utf8');
    assert.match(main, /initForexalertJourney/);
    assert.match(main, /initHomelabJourney/);
});
