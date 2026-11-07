import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const source = await readFile(new URL('../scripts/modules/pomodoroyt-journey.js', import.meta.url), 'utf8');
const { EXAMPLES, createPomodoroState: create, nextPomodoroMoment: next, tickPomodoro: tick,
    togglePomodoroSession: toggle, pomodoroPlayback: playback, formatPomodoroTime: time } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('five examples start deterministically and selected playback requires connected running focus', () => {
    assert.deepEqual(EXAMPLES, ['start', 'break', 'pause', 'ad', 'disconnected']);
    for (const example of EXAMPLES) assert.deepEqual(create(example), create(example));
    const ready = create(); const started = next(ready);
    assert.equal(playback(ready), 'pause'); assert.equal(playback(started), 'play');
    assert.equal(started.remaining, 1500000); assert.equal(ready.status, 'idle');
    for (const status of ['idle', 'paused', 'countdown']) assert.equal(playback({ ...started, status }), 'pause');
    for (const mode of ['shortBreak', 'longBreak']) assert.equal(playback({ ...started, mode }), 'pause');
    assert.equal(playback({ ...started, connected: false }), 'pause');
});
test('focus expiry pauses at full five-second preparation then starts a five-minute break', () => {
    const nearEnd = create('break');
    assert.equal(time(nearEnd.remaining), '0:03');
    const almost = tick(nearEnd, 2999); assert.equal(playback(almost), 'play');
    const countdown = tick(almost, 1);
    assert.equal(countdown.status, 'countdown'); assert.equal(countdown.remaining, 5000);
    assert.equal(playback(countdown), 'pause');
    const preparing = tick(countdown, 4999); assert.equal(time(preparing.remaining), '0:01');
    const rest = tick(preparing, 1);
    assert.equal(rest.mode, 'shortBreak'); assert.equal(rest.status, 'running');
    assert.equal(rest.remaining, 300000); assert.equal(playback(rest), 'pause');
    assert.equal(tick(rest, 1000).videoTime, rest.videoTime);
    assert.equal(tick(nearEnd, 100000).remaining, 5000, 'A delayed frame cannot swallow preparation');
    const regular = tick(next(create()), 1500000);
    assert.equal(regular.status, 'countdown'); assert.equal(playback(regular), 'pause');
    assert.equal(tick(regular, 5000).remaining, 300000);
});
test('session pause freezes both clock and video; resume does not consume paused time', () => {
    const running = tick(next(create()), 1234); const paused = toggle(running);
    assert.equal(paused.remaining, 1498766); assert.equal(playback(paused), 'pause');
    assert.equal(tick(paused, 60000), paused);
    const resumed = tick(toggle(paused), 1000);
    assert.equal(resumed.remaining, paused.remaining - 1000);
    assert.equal(resumed.videoTime, paused.videoTime + 1);
    const pauseExample = tick(create('pause'), 4000);
    assert.equal(pauseExample.status, 'paused'); assert.equal(next(pauseExample).status, 'running');
});
test('ad detection saves and restores the original volume without changing playback', () => {
    const initial = { ...create('ad'), volume: 37 };
    const ad = tick(initial, 4000);
    assert.equal(ad.ad, true); assert.equal(ad.volume, 0); assert.equal(ad.savedVolume, 37);
    assert.equal(playback(ad), 'play');
    const restored = tick(ad, 4000);
    assert.equal(restored.ad, false); assert.equal(restored.volume, 37);
    assert.equal(playback(restored), 'play'); assert.equal(initial.volume, 37);
    assert.equal(next(restored), restored);
});
test('no-lock cannot start or advance until explicit connect, then start is separate', () => {
    const disconnected = create('disconnected');
    assert.equal(next(disconnected), disconnected); assert.equal(toggle(disconnected), disconnected);
    assert.equal(tick(disconnected, 100000), disconnected);
    const connected = next(disconnected, 'connect');
    assert.equal(connected.status, 'idle'); assert.equal(connected.connected, true);
    assert.equal(playback(connected), 'pause'); assert.equal(playback(next(connected)), 'play');
});
test('replays are immutable, invalid deltas do not advance and terminal moments are bounded', () => {
    for (const example of EXAMPLES) {
        const initial = Object.freeze(create(example));
        for (const delta of [0, -1, NaN, Infinity]) assert.equal(tick(initial, delta), initial);
        next(initial); tick(initial, 100); assert.deepEqual(create(example), initial);
    }
    assert.equal(time(-1), '0:00'); assert.equal(time(1500000), '25:00'); assert.equal(time(5000), '0:05');
    assert.throws(() => create('closed-tab'));
});

function setup(reduced = false) {
    const element = () => ({ dataset: {}, attrs: {}, handlers: {}, hidden: false, textContent: '',
        style: { setProperty(name, value) { this[name] = value; } },
        setAttribute(name, value) { this.attrs[name] = String(value); }, focus() {},
        addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); },
        emit(name) { this.handlers[name]?.forEach(fn => fn()); },
        classList: { contains: () => true } });
    const root = element(), slide = element(); let onscreen = true, engaged = 0;
    root.getBoundingClientRect = () => onscreen ? { top: 0, bottom: 700 } : { top: 1000, bottom: 1800 };
    root.dispatchEvent = e => { if (e.type === 'journey:interact' && e.bubbles) engaged++; };
    const names = [...new Set([...source.matchAll(/find\('([^']+)'\)/g)].map(m => m[1]))];
    const controls = Object.fromEntries(names.map(name => [name, element()]));
    controls.scenario.value = 'start';
    root.querySelector = selector => controls[selector.slice(9, -1)]; root.closest = () => slide;
    const document = Object.assign(element(), { querySelector: () => root, hidden: false });
    const motion = { matches: reduced, addEventListener(name, fn) { this.change = fn; } };
    const frames = new Map(); let id = 0, observer;
    class Observer { constructor(fn) { observer = fn; } observe() {} }
    const window = { matchMedia: () => motion, innerHeight: 900, IntersectionObserver: Observer,
        requestAnimationFrame(fn) { frames.set(++id, fn); return id; }, cancelAnimationFrame(key) { frames.delete(key); } };
    const context = vm.createContext({ document, window, IntersectionObserver: Observer,
        CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } } });
    vm.runInContext(source.replaceAll('export function', 'function').replace('export const', 'const'), context);
    context.initPomodoroytJourney();
    return { root, slide, controls, document, motion, frames, context,
        click: name => controls[name].emit('click'),
        choose(name) { controls.scenario.value = name; controls.scenario.emit('change'); },
        tick(time) { const pending = frames.entries().next().value; if (pending) { frames.delete(pending[0]); pending[1](time); } },
        visibility(value) { onscreen = value; observer(); }, engagements: () => engaged };
}
test('controller owns one clock, actual Pause freezes rendered timer and progress, session resume continues', () => {
    const ui = setup(); assert.equal(ui.frames.size, 0);
    ui.click('play'); ui.tick(0); ui.tick(100); ui.tick(200);
    const progress = ui.controls.progress.style['--py-progress'];
    ui.click('play'); assert.equal(ui.frames.size, 0);
    ui.tick(60000); assert.equal(ui.controls.progress.style['--py-progress'], progress);
    ui.click('play'); ui.tick(60000); ui.tick(60100);
    assert.notEqual(ui.controls.progress.style['--py-progress'], progress);
    ui.click('session'); assert.equal(ui.controls.video.textContent, 'Paused'); assert.equal(ui.frames.size, 0);
    ui.click('session'); assert.equal(ui.controls.video.textContent, 'Playing'); assert.equal(ui.frames.size, 1);
    ui.context.initPomodoroytJourney(); assert.equal(ui.controls.play.handlers.click.length, 1);
});
test('previous is a read-only snapshot and Continue restores the live clock, replay clears all state', () => {
    const ui = setup(); ui.choose('ad'); ui.click('next'); ui.click('next');
    assert.equal(ui.controls.volume.textContent, 'Sound 60%');
    ui.click('previous'); assert.equal(ui.controls.volume.textContent, 'Muted');
    assert.equal(ui.controls.history.hidden, false); assert.equal(ui.controls.session.disabled, true);
    ui.click('play'); assert.equal(ui.controls.volume.textContent, 'Sound 60%');
    assert.equal(ui.controls.history.hidden, true);
    ui.click('replay'); assert.equal(ui.root.dataset.stage, '0'); assert.equal(ui.frames.size, 0);
    assert.equal(ui.controls['video-time'].textContent, '0:00');
});
test('scenario, slide, offscreen, visibility, preview and preference interruptions cancel frames without automatic return', () => {
    const ui = setup();
    for (const stop of [() => ui.choose('ad'), () => ui.slide.emit('featured:deactivate'),
        () => ui.visibility(false), () => { ui.document.hidden = true; ui.document.emit('visibilitychange'); },
        () => ui.slide.emit('journey:preview'), () => ui.motion.change()]) {
        ui.document.hidden = false; ui.visibility(true); ui.choose('start');
        ui.click('play'); ui.tick(0); ui.tick(100); assert.equal(ui.frames.size, 1);
        stop(); assert.equal(ui.frames.size, 0); const snapshot = ui.controls.time.textContent;
        ui.tick(60000); assert.equal(ui.controls.time.textContent, snapshot);
        ui.slide.emit('featured:activate'); assert.equal(ui.frames.size, 0);
    }
    assert.ok(ui.engagements() > 0);
});
test('reduced motion keeps manual states, no connection cannot run', () => {
    const ui = setup(true); ui.choose('disconnected'); ui.click('play');
    assert.equal(ui.frames.size, 0); assert.equal(ui.controls.play.disabled, true);
    ui.click('connect'); assert.equal(ui.controls.play.disabled, false); assert.equal(ui.frames.size, 0);
    ui.click('session'); assert.equal(ui.controls.video.textContent, 'Playing');
    ui.choose('break'); ui.click('next'); assert.equal(ui.controls.time.textContent, '0:05');
    assert.equal(ui.controls.video.textContent, 'Paused');
    ui.click('next'); assert.equal(ui.controls.time.textContent, '5:00');
    ui.click('previous'); assert.equal(ui.controls.time.textContent, '0:05');
});
test('source isolation, static fallback and wiring use no actual YouTube or Chrome operation', async () => {
    const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
    const [partial, main, css, carousel] = await Promise.all(['partials/featured-pomodoroyt.html', 'scripts/main.js', 'styles/main.css', 'partials/featured-carousel.html'].map(read));
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|chrome\.|new Audio|localStorage|setTimeout|setInterval/);
    assert.doesNotMatch(partial, /<iframe|<video|<audio|data-journey="pomodoroyt"|closing the locked tab leads/);
    assert.deepEqual([...partial.matchAll(/<option value="([^"]+)"/g)].map(m => m[1]), EXAMPLES);
    assert.match(partial, /data-py-controls hidden/); assert.match(main, /initPomodoroytJourney/);
    assert.doesNotMatch(main, /initFeaturedJourneys/); assert.match(css, /pomodoroyt-journey.css/);
    assert.doesNotMatch(partial, /inspector|Optional technical details/);
});
