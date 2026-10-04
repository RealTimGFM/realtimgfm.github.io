import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../scripts/modules/ui.js', import.meta.url), 'utf8'))
    .replaceAll('export function', 'function');

function setup(send = async () => {}) {
    let now = 1000;
    const listeners = new Map();
    const attributes = new Map();
    const classes = new Set();
    const calls = [];
    const status = { dataset: {}, textContent: '' };
    const button = {
        disabled: true,
        setAttribute() { this.disabled = true; },
        removeAttribute() { this.disabled = false; },
        classList: { add: value => classes.add(value), remove: value => classes.delete(value) }
    };
    const emailInput = {
        value: '',
        checkValidity() { return /^[^\s@]+@[^\s@]+$/.test(this.value); },
        focus() { this.focused = true; }
    };
    const form = {
        dataset: {},
        data: {},
        elements: { namedItem: () => emailInput },
        querySelector: () => button,
        addEventListener(name, callback) {
            const callbacks = listeners.get(name) ?? [];
            callbacks.push(callback);
            listeners.set(name, callbacks);
        },
        setAttribute: (name, value) => attributes.set(name, value),
        removeAttribute: name => attributes.delete(name),
        reset() {
            this.data = {};
            for (const callback of listeners.get('reset') ?? []) callback();
        }
    };
    const context = vm.createContext({
        document: { getElementById: id => ({ contactForm: form, status })[id] },
        window: { emailjs: { init() {}, async send(...args) { calls.push(args); return send(); } } },
        Date: class extends Date { static now() { return now; } },
        FormData: class { constructor(target) { return Object.entries(target.data); } },
        console: { error() {} }
    });
    vm.runInContext(source, context);
    context.initContactForm();
    return {
        form, status, button, calls, context, attributes, classes, listeners, emailInput,
        advance(ms = 1200) { now += ms; },
        fill(overrides = {}, input = true) {
            form.data = { name: 'Visitor', email: 'visitor@example.com', message: 'A message', website: '', ...overrides };
            if (input) for (const callback of listeners.get('input')) callback();
        },
        async submit() {
            for (const callback of listeners.get('submit')) await callback({ preventDefault() {} });
        }
    };
}

test('multiple messages each start a fresh timing window with one set of listeners', async () => {
    const ui = setup();
    ui.context.initContactForm();
    for (const callbacks of ui.listeners.values()) assert.equal(callbacks.length, 1);
    for (let i = 0; i < 3; i++) {
        ui.fill({ message: `Message ${i}` });
        await ui.submit();
        assert.match(ui.status.textContent, /wait a moment/);
        assert.equal(ui.calls.length, i);
        ui.advance();
        await ui.submit();
        assert.equal(ui.calls.length, i + 1);
        assert.equal(ui.status.dataset.state, 'success');
        assert.deepEqual(ui.form.data, {});
        assert.equal(ui.button.disabled, false);
    }
    assert.equal(ui.calls[0][0], 'service_nadr8zr');
    assert.equal(ui.calls[0][1], 'template_8e39ouv');
    assert.equal(ui.calls[2][2].message, 'Message 2');
});

test('autofill without an input event can retry after the visible timing warning', async () => {
    const ui = setup();
    ui.fill({}, false);
    await ui.submit();
    assert.match(ui.status.textContent, /wait a moment/);
    ui.advance();
    await ui.submit();
    assert.equal(ui.calls.length, 1);
});

test('required fields, malformed email and honeypot show feedback without sending', async () => {
    for (const [values, expected] of [
        [{ name: '  ' }, /fill in all fields/],
        [{ email: 'invalid-address' }, /valid email/],
        [{ website: 'spam' }, /spam check/]
    ]) {
        const ui = setup();
        ui.fill(values);
        ui.advance();
        await ui.submit();
        assert.match(ui.status.textContent, expected);
        assert.equal(ui.status.dataset.state, 'error');
        assert.equal(ui.calls.length, 0);
        assert.equal(ui.button.disabled, false);
    }
});

test('in-flight submissions cannot send twice and restore button and busy state', async () => {
    let finish;
    const ui = setup(() => new Promise(resolve => { finish = resolve; }));
    ui.fill();
    ui.advance();
    const pending = ui.submit();
    assert.equal(ui.button.disabled, true);
    assert.equal(ui.attributes.get('aria-busy'), 'true');
    await ui.submit();
    assert.equal(ui.calls.length, 1);
    assert.match(ui.status.textContent, /still sending/);
    finish();
    await pending;
    assert.equal(ui.button.disabled, false);
    assert.equal(ui.attributes.has('aria-busy'), false);
    assert.equal(ui.classes.size, 0);
});

test('delivery errors and rate limits retain the draft and allow retry', async () => {
    for (const error of [new Error('offline'), { status: 429 }]) {
        let fail = true;
        const ui = setup(async () => { if (fail) throw error; });
        ui.fill();
        ui.advance();
        await ui.submit();
        assert.equal(ui.status.dataset.state, 'error');
        assert.match(ui.status.textContent, error.status === 429 ? /wait a minute/ : /failed to send/);
        assert.equal(ui.form.data.message, 'A message');
        assert.equal(ui.button.disabled, false);
        fail = false;
        await ui.submit();
        assert.equal(ui.status.dataset.state, 'success');
        assert.equal(ui.calls.length, 2);
    }
});

test('missing EmailJS is visible and recovers if the SDK becomes available', async () => {
    const ui = setup();
    const transport = ui.context.window.emailjs;
    delete ui.context.window.emailjs;
    ui.fill();
    ui.advance();
    await ui.submit();
    assert.match(ui.status.textContent, /failed to send/);
    assert.equal(ui.button.disabled, false);
    ui.context.window.emailjs = transport;
    await ui.submit();
    assert.equal(ui.status.dataset.state, 'success');
});
