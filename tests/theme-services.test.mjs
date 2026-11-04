import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const uiSource = (await readFile(new URL('../scripts/modules/ui.js', import.meta.url), 'utf8'))
    .replaceAll('export function', 'function');

function theme(saved, storageBlocked = false) {
    const root = new Map();
    const attributes = new Map();
    let click;
    const context = vm.createContext({
        document: {
            documentElement: {
                setAttribute: (name, value) => root.set(name, value),
                getAttribute: name => root.get(name)
            },
            getElementById: () => ({
                setAttribute: (name, value) => attributes.set(name, value),
                addEventListener(name, handler) { if (name === 'click') click = handler; }
            })
        },
        localStorage: {
            getItem() { if (storageBlocked) throw new Error('Storage blocked'); return saved; },
            setItem(name, value) { if (storageBlocked) throw new Error('Storage blocked'); saved = value; }
        }
    });
    vm.runInContext(uiSource, context);
    context.initTheme();
    return { root, attributes, click: () => click(), saved: () => saved };
}

test('intentional light-first theme preserves saved choices, accessible toggle state and blocked-storage fallback', () => {
    for (const saved of [undefined, 'invalid', 'light', 'dark']) {
        const ui = theme(saved);
        assert.equal(ui.root.get('data-theme'), saved === 'dark' ? 'dark' : 'light');
        ui.click();
        const next = saved === 'dark' ? 'light' : 'dark';
        assert.equal(ui.root.get('data-theme'), next);
        assert.equal(ui.attributes.get('aria-pressed'), String(next === 'dark'));
        assert.equal(ui.attributes.get('aria-label'), `Switch to ${next === 'dark' ? 'light' : 'dark'} theme`);
        assert.equal(ui.saved(), next);
    }
    const blocked = theme('dark', true);
    assert.equal(blocked.root.get('data-theme'), 'light');
    blocked.click();
    assert.equal(blocked.root.get('data-theme'), 'dark');
});

test('analytics and EmailJS load only on the exact production hostname', async () => {
    const source = await readFile(new URL('../scripts/services.js', import.meta.url), 'utf8');
    for (const hostname of ['realtimgfm.github.io', 'localhost', '127.0.0.1', '', 'preview.example.com', 'realtimgfm.github.io.example.com']) {
        const scripts = [];
        const window = {};
        vm.runInNewContext(source, {
            location: { hostname }, window, Date,
            document: {
                createElement: () => ({ setAttribute(name, value) { this[name] = value; } }),
                head: { append: script => scripts.push(script) }
            }
        });
        assert.equal(scripts.length, hostname === 'realtimgfm.github.io' ? 3 : 0, hostname);
        if (scripts.length) {
            assert.ok(scripts.every(script => script.async && script.src.startsWith('https://')));
            assert.ok(scripts.some(script => script.src.includes('@emailjs/browser@4/')));
            assert.equal(window.dataLayer.length, 2);
        } else {
            assert.equal(window.dataLayer, undefined);
        }
    }
});
