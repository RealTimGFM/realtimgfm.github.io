import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const moduleSource = await readFile(new URL('../scripts/modules/schedulebooker-journey.js', import.meta.url), 'utf8');
const { createBookingState, advanceBooking, bookingView } = await import('data:text/javascript;base64,' + Buffer.from(moduleSource).toString('base64'));

const next = (state, count) => { for (let i = 0; i < count; i++) state = advanceBooking(state); return state; };

test('viewing and sending do not reserve; only the locked final check commits A', () => {
    const ready = createBookingState();
    const request = advanceBooking(ready);
    const locked = advanceBooking(request);
    assert.deepEqual(ready.records, []);
    assert.deepEqual(request.records, []);
    assert.equal(locked.lock, 'A');
    assert.deepEqual(locked.records, []);
    const committed = advanceBooking(locked);
    assert.equal(committed.records.length, 1);
    assert.equal(locked.records.length, 0);
});

test('one winner then a rejected competitor, release between transactions, no phantom record', () => {
    let state = next(createBookingState(), 2);
    const badLock = { ...state, lock: 'B' };
    assert.equal(advanceBooking(badLock), badLock);
    const snapshots = [state];
    state = advanceBooking(state); snapshots.push(state);
    assert.deepEqual(state.records, [{ customer: 'A', time: '14:00', duration: 30 }]);
    assert.equal(state.lock, null);
    state = advanceBooking(state); snapshots.push(state);
    assert.equal(state.lock, 'B');
    state = advanceBooking(state); snapshots.push(state);
    assert.equal(state.lock, null);
    assert.equal(state.stage, 5);
    assert.equal(state.records.length, 1);
    assert.equal(bookingView(state).terminal, true);
    for (let i = 0; i < 20; i++) assert.equal(advanceBooking(state), state);
    assert.equal(snapshots[0].records.length, 0, 'Historical snapshots cannot mutate');
    assert.ok(snapshots.every(snapshot => snapshot.records.filter(record => record.time === '14:00').length <= 1));
});

test('recovery requires rejection and a new locked check, then commits once at 2:30', () => {
    for (let stage = 0; stage < 5; stage++) {
        const state = next(createBookingState(), stage);
        assert.equal(advanceBooking(state, 'recover'), state);
    }
    let state = next(createBookingState(), 5);
    state = advanceBooking(state, 'recover');
    assert.equal(state.stage, 6);
    assert.equal(state.records.length, 1);
    assert.equal(advanceBooking(state, 'recover'), state);
    state = advanceBooking(state);
    assert.equal(state.lock, 'B');
    assert.equal(state.records.length, 1);
    state = advanceBooking(state);
    assert.equal(state.lock, null);
    assert.deepEqual(state.records.map(record => [record.customer, record.time]), [['A', '14:00'], ['B', '14:30']]);
    assert.equal(advanceBooking(state), state);
    assert.equal(advanceBooking(state, 'recover'), state);
});

test('single customer has one confirmation, no competitor and terminal commit', () => {
    const state = next(createBookingState('single'), 20);
    assert.equal(state.stage, 3);
    assert.equal(state.records.length, 1);
    assert.equal(state.records[0].customer, 'A');
    assert.equal(bookingView(state).terminal, true);
    assert.equal(advanceBooking(state, 'recover'), state);
});

test('new runs clear local state without mutating earlier records or duplicating slots', () => {
    for (let i = 0; i < 30; i++) {
        const old = next(createBookingState(), 5);
        const fresh = createBookingState(i % 2 ? 'race' : 'single');
        assert.equal(fresh.records.length, 0);
        assert.equal(old.records.length, 1);
        assert.equal(next(fresh, 20).records.length, 1);
    }
});

test('scene is isolated, locally simulated, integrated, and does not own generic PomodoroYT', async () => {
    const [source, partial, main, css, carousel] = await Promise.all([
        readFile(new URL('../scripts/modules/schedulebooker-journey.js', import.meta.url), 'utf8'),
        readFile(new URL('../partials/featured-schedule-booker.html', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/main.js', import.meta.url), 'utf8'),
        readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
        readFile(new URL('../partials/featured-carousel.html', import.meta.url), 'utf8')
    ]);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage/);
    assert.match(main, /initSchedulebookerJourney/);
    assert.match(css, /schedulebooker-journey.css/);
    assert.match(partial, /data-schedulebooker-journey/);
    assert.doesNotMatch(partial, /data-journey="schedule-booker"/);
    assert.deepEqual([...partial.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]), ['race', 'single']);
    for (const event of ['featured:activate', 'featured:deactivate', 'journey:preview', 'visibilitychange']) assert.ok(source.includes(event));
});

function setup(reduced = false) {
    const element = () => ({
        dataset: {}, attrs: {}, handlers: {}, hidden: false, open: false, style: {}, textContent: '',
        classList: { toggle() {}, contains: () => true },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); },
        emit(name) { this.handlers[name]?.forEach(callback => callback()); }, focus() {}, scrollIntoView() {}
    });
    const root = element(), slide = element();
    let onscreen = true, engaged = 0;
    root.getBoundingClientRect = () => onscreen ? { top: 0, bottom: 800, left: 0, right: 600 } : { top: -900, bottom: -100, left: 0, right: 600 };
    root.dispatchEvent = event => { if (event.type === 'journey:interact' && event.bubbles) engaged++; };
    const names = [...new Set([...moduleSource.matchAll(/find\('([^']+)'\)/g)].map(match => match[1]))];
    const dynamic = ['a', 'b'].flatMap(customer => ['receipt', 'time', 'status', 'detail', 'mark', 'slot'].map(name => `${name}-${customer}`));
    const controls = Object.fromEntries([...names, ...dynamic].map(name => [name, element()]));
    controls.scenario.value = 'race';
    const slots = { '14:00': element(), '14:30': element() };
    const actors = ['browser', 'calendar', 'database'].map(name => Object.assign(element(), { dataset: { sbInspect: name } }));
    root.querySelector = query => query.startsWith('[data-sb-slot=') ? slots[query.slice(15, -2)] : controls[query.slice(9, -1)];
    root.querySelectorAll = () => actors;
    root.closest = () => slide;
    const document = Object.assign(element(), { querySelector: () => root, hidden: false });
    const motion = { matches: reduced, addEventListener(name, callback) { this.change = callback; } };
    const frames = new Map(); let id = 0, observer;
    class Observer { constructor(callback) { observer = callback; } observe() {} }
    const window = { matchMedia: () => motion, innerHeight: 900, innerWidth: 1536, IntersectionObserver: Observer,
        requestAnimationFrame(callback) { frames.set(++id, callback); return id; }, cancelAnimationFrame(key) { frames.delete(key); } };
    const context = vm.createContext({ document, window, IntersectionObserver: Observer,
        CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } } });
    vm.runInContext(moduleSource.replaceAll('export function', 'function'), context);
    context.initSchedulebookerJourney();
    return { root, slide, controls, actors, document, frames, motion, context,
        click: name => controls[name].emit('click'),
        choose(name) { controls.scenario.value = name; controls.scenario.emit('change'); },
        tick(time) { const pending = frames.entries().next().value; if (pending) { frames.delete(pending[0]); pending[1](time); } },
        visibility(value) { onscreen = value; observer(); }, engagements: () => engaged };
}

test('controller keeps committed data through historical views, rejects once, recovers once and resets explicitly', () => {
    const ui = setup();
    assert.equal(ui.frames.size, 0);
    for (let i = 0; i < 10; i++) ui.click('next');
    assert.equal(ui.root.dataset.stage, '5');
    assert.equal(ui.root.dataset.saved, '1');
    assert.equal(ui.controls['status-b'].textContent, 'Choose another time');
    const ledger = ui.root.dataset.saved;
    for (let i = 0; i < 5; i++) ui.click('previous');
    assert.equal(ui.controls.history.hidden, false);
    assert.match(ui.controls.history.textContent, /read-only snapshot/);
    assert.equal(ui.root.dataset.saved, ledger);
    assert.equal(ui.controls.recover.hidden, true);
    for (let i = 0; i < 10; i++) ui.click('next');
    ui.click('recover'); ui.click('play');
    for (let i = 0; i < 10; i++) ui.click('next');
    assert.equal(ui.root.dataset.saved, '2');
    assert.equal(ui.controls['time-b'].textContent, '2:30 PM');
    assert.equal(ui.controls['status-b'].textContent, 'Confirmed');
    ui.click('play'); ui.click('play');
    assert.equal(ui.root.dataset.saved, '0');
    assert.match(ui.controls.fixture.textContent, /Watch again cleared/);
    ui.click('reset'); assert.equal(ui.root.dataset.stage, '0');
    assert.equal(ui.frames.size, 0);
    assert.ok(ui.engagements() > 0);
});

test('one animation owner: pause, tab hiding, offscreen, slide change, motion preference and scenario changes stop work', () => {
    const ui = setup();
    ui.click('play'); ui.tick(0); ui.tick(80);
    const moving = ui.controls['ticket-a'].style.left;
    ui.tick(160); assert.notEqual(ui.controls['ticket-a'].style.left, moving);
    ui.click('play');
    assert.equal(ui.frames.size, 0);
    const paused = ui.controls['ticket-a'].style.left;
    ui.tick(1000); assert.equal(ui.controls['ticket-a'].style.left, paused);
    for (const stop of [() => ui.slide.emit('featured:deactivate'), () => ui.visibility(false),
        () => { ui.document.hidden = true; ui.document.emit('visibilitychange'); },
        () => ui.motion.change(), () => ui.choose('single'), () => ui.slide.emit('journey:preview')]) {
        ui.document.hidden = false; ui.visibility(true);
        ui.click('play'); assert.equal(ui.frames.size, 1);
        stop(); assert.equal(ui.frames.size, 0);
        const stage = ui.root.dataset.stage;
        ui.tick(5000); assert.equal(ui.root.dataset.stage, stage);
        ui.slide.emit('featured:activate'); assert.equal(ui.frames.size, 0);
    }
    ui.context.initSchedulebookerJourney();
    assert.equal(ui.controls.play.handlers.click.length, 1);
});

test('reduced motion uses discrete states', () => {
    const ui = setup(true);
    ui.click('play'); const position = ui.controls['ticket-a'].style.left;
    ui.tick(0); ui.tick(80); ui.tick(160);
    assert.equal(ui.controls['ticket-a'].style.left, position);
    ui.choose('single');
    for (let i = 0; i < 5; i++) ui.click('next');
    assert.equal(ui.controls['status-b'].textContent, 'Just browsing');
});
