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
