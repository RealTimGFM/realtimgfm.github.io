import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { renderPage } from '../scripts/build.mjs';

test('static page includes sections once in the intended order and all projects', async () => {
    const html = await renderPage();
    const sections = [...html.matchAll(/<section id="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(sections, ['home', 'experience', 'projects', 'homelab', 'skills', 'about', 'certifications', 'contact']);
    assert.ok(!html.includes('data-include='));
    const projects = html.slice(html.indexOf('<section id="projects"'), html.indexOf('<section id="homelab"'));
    const titles = [...projects.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match => match[1]);
    assert.deepEqual(titles.slice(0, 4), ['FinCore', 'ForexAlert', 'PomodoroYT', 'Schedule Booker']);
    assert.equal(titles.length, 11);
    assert.equal(new Set(titles).size, 11);
    assert.match(projects, /In Development/);
});

test('build fails clearly for missing or circular partials', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'portfolio-build-'));
    try {
        await writeFile(join(directory, 'index.template.html'), '<div data-include="missing.html"></div>');
        await assert.rejects(renderPage(directory), /ENOENT/);
        await writeFile(join(directory, 'missing.html'), '<div data-include="index.template.html"></div>');
        await assert.rejects(renderPage(directory), /Circular include/);
    } finally {
        assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + '/portfolio-build-')
            || resolve(directory).startsWith(resolve(tmpdir()) + '\\portfolio-build-'));
        await rm(directory, { recursive: true, force: true });
    }
});

test('See More and See Less preserve the first four cards', async () => {
    const cards = Array.from({ length: 11 }, () => ({
        hidden: false,
        setAttribute() { this.hidden = true; },
        removeAttribute() { this.hidden = false; }
    }));
    let click;
    const button = {
        setAttribute(name, value) { this[name] = value; },
        addEventListener(name, callback) { click = callback; }
    };
    const context = vm.createContext({ document: {
        getElementById: id => id === 'projectsGrid' ? { querySelectorAll: () => cards } : button
    } });
    const source = await readFile(new URL('../scripts/modules/projects-toggle.js', import.meta.url), 'utf8');
    vm.runInContext(source.replace('export function', 'function'), context);
    context.initProjectsToggle();
    assert.equal(cards.filter(card => !card.hidden).length, 4);
    click();
    assert.equal(cards.filter(card => !card.hidden).length, 11);
    assert.equal(button['aria-expanded'], 'true');
    click();
    assert.deepEqual(cards.map(card => card.hidden), Array.from({ length: 11 }, (_, i) => i >= 4));
    assert.equal(button['aria-expanded'], 'false');
});

test('Home Lab disclosure preserves accessible labels and returns focus when collapsed from the bottom', async () => {
    const events = [];
    const elements = new Map(['homelabToggle', 'homelabCollapse', 'homelabDetails'].map(id => [id, {
        hidden: false,
        handlers: new Map(),
        setAttribute(name, value) { this[name] = value; },
        addEventListener(name, callback) { this.handlers.set(name, callback); },
        dispatchEvent(event) { events.push(event.type); },
        focus(options) { this.focused = options; },
        scrollIntoView(options) { this.scrolled = options; }
    }]));
    const context = vm.createContext({ document: { getElementById: id => elements.get(id) }, Event });
    const source = await readFile(new URL('../scripts/modules/homelab-toggle.js', import.meta.url), 'utf8');
    vm.runInContext(source.replace('export function', 'function'), context);
    context.initHomelabToggle();
    const toggle = elements.get('homelabToggle');
    const collapse = elements.get('homelabCollapse');
    const details = elements.get('homelabDetails');
    assert.equal(details.hidden, true);
    assert.equal(toggle.hidden, false);
    assert.equal(collapse.hidden, false);
    assert.equal(toggle['aria-expanded'], 'false');
    toggle.handlers.get('click')();
    assert.equal(details.hidden, false);
    assert.equal(toggle.textContent, 'Show Less');
    assert.equal(toggle['aria-expanded'], 'true');
    assert.equal(collapse['aria-expanded'], 'true');
    assert.deepEqual(events, ['homelab:expanded']);
    collapse.handlers.get('click')();
    assert.equal(details.hidden, true);
    assert.equal(toggle.textContent, 'Explore Home Lab');
    assert.equal(toggle['aria-expanded'], 'false');
    assert.equal(collapse['aria-expanded'], 'false');
    assert.equal(toggle.focused.preventScroll, true);
    assert.equal(toggle.scrolled.behavior, 'instant');
    toggle.handlers.get('click')();
    toggle.handlers.get('click')();
    assert.equal(details.hidden, true);
});

test('Home Lab ships both deferred interactive models and accessible real media without duplicate IDs', async () => {
    const html = await renderPage();
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'The page must not contain duplicate IDs');
    assert.equal(ids.filter(id => id === 'homelab').length, 1);
    const start = html.indexOf('<section id="homelab"');
    const homelab = html.slice(start, html.indexOf('<section id="skills"', start));
    assert.doesNotMatch(homelab, /(?:src|href)="temp\//);
    assert.doesNotMatch(homelab, /homelab-placeholder-label/);
    const viewers = [...homelab.matchAll(/<model-viewer\b([^>]+)>/g)].map(match => match[1]);
    assert.equal(viewers.length, 2);
    const models = viewers.map(viewer => viewer.match(/data-model-src="([^"]+)"/)[1]);
    assert.deepEqual(models, [
        'assets/homelab/models/thinkpad-t16-gen2.glb',
        'assets/homelab/models/raspberry-pi-4.glb'
    ]);
    for (const viewer of viewers) {
        assert.doesNotMatch(viewer, /\ssrc=/, 'A collapsed lab must not request a GLB');
        assert.match(viewer, /\scamera-controls(?:\s|$)/);
        assert.match(viewer, /touch-action="pan-y"/);
        assert.match(viewer, /loading="lazy"/);
        assert.match(viewer, /\salt="[^"]+"/);
        assert.match(viewer, /poster="assets\/homelab\/[^"/]+\.webp"/);
        assert.doesNotMatch(viewer, /\sauto-rotate(?:\s|$)/);
    }
    const images = [...homelab.matchAll(/<img\b([^>]+)>/g)].map(match => match[1]);
    for (const filename of ['debian-operations.webp', 'prominence-ii-world.webp', 'pihole-dashboard.webp']) {
        const image = images.find(attributes => attributes.includes(`src="assets/homelab/${filename}"`));
        assert.ok(image, `Missing real screenshot: ${filename}`);
        assert.match(image, /\salt="[^"]+"/);
        assert.match(image, /width="[1-9]\d*"/);
        assert.match(image, /height="[1-9]\d*"/);
        assert.match(image, /loading="lazy"/);
    }
    // Models are single-file GLBs: no texture, buffer or decoder dependency in temp.
    for (const path of models) {
        const bytes = await readFile(new URL(`../${path}`, import.meta.url));
        assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
        assert.equal(bytes.readUInt32LE(4), 2);
        assert.equal(bytes.readUInt32LE(8), bytes.length);
        assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
        const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
        assert.ok(gltf.meshes.length > 0);
        assert.ok(gltf.buffers.every(buffer => !buffer.uri));
        assert.ok(gltf.images.every(image => image.bufferView !== undefined && !image.uri));
        assert.equal((gltf.extensionsRequired || []).length, 0);
    }
    for (const filename of ['debian-operations.webp', 'prominence-ii-world.webp', 'pihole-dashboard.webp',
        'thinkpad-t16-gen2-poster.webp', 'raspberry-pi-4-poster.webp']) {
        const bytes = await readFile(new URL(`../assets/homelab/${filename}`, import.meta.url));
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
        assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
        assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
    }
});
