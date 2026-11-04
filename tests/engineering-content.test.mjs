import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import test from 'node:test';
import { build, renderPage } from '../scripts/build.mjs';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('experience is ordered by backend relevance with all original dates and locations', async () => {
    const html = await read('partials/experience-records.html');
    assert.deepEqual([...html.matchAll(/<article class="featured-record" aria-labelledby="([^"]+)"/g)].map(m => m[1]),
        ['workplace-machine-builder', 'workplace-activists', 'workplace-dart']);
    for (const date of ['June 2023 – July 2026 · Montreal', 'May 2026 – July 2026 · Montreal', 'July 2026 – Present · Montreal']) assert.ok(html.includes(date));
    assert.match(html, /thousands of financial transactions/);
    assert.equal([...html.matchAll(/<div class="xp-details">/g)].length, 3);
    assert.match(html, /Owner review: confirm/);
});

test('project overviews and direct evidence remain without engineering case-study disclosures', async () => {
    const html = await renderPage();
    assert.doesNotMatch(html, /class="project-case-study"|class="case-study-register"|engineering case study/i);
    for (const slug of ['fincore', 'forexalert', 'pomodoroyt', 'schedule-booker']) {
        assert.ok(html.includes('id="project-' + slug + '"'));
    }
    assert.match(html, /href="https:\/\/github.com\/RealTimGFM\/FinCore"/);
    assert.match(html, /href="https:\/\/github.com\/RealTimGFM\/ForexAlert"/);
    const projects = html.slice(html.indexOf('<section id="projects"'), html.indexOf('<section id="homelab"'));
    assert.doesNotMatch(projects, />Account tests<|>Transaction tests<|>Connection tests<|>Notification tests<|>Architecture README<|Demo \(availability unverified\)|[Dd]emo availability is unverified/);
    assert.match(projects, /href="https:\/\/schedulebooker-web.onrender.com"[\s\S]*?>Demo<\/a>/);
    assert.doesNotMatch(html, /unverified|independently confirmed running|No live operational check/i);
    assert.equal([...html.matchAll(/class="badge project-status"/g)].length, 11);
});

test('all fragment links and accessibility references resolve without duplicate IDs', async () => {
    const html = await renderPage();
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    const known = new Set(ids);
    assert.equal(ids.length, known.size);
    for (const [, fragment] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(known.has(fragment), 'Missing anchor: ' + fragment);
    for (const [, values] of html.matchAll(/(?:aria-labelledby|aria-describedby|aria-controls)="([^"]+)"/g)) {
        for (const id of values.split(/\s+/)) assert.ok(known.has(id), 'Missing accessibility target: ' + id);
    }
});

test('essential content is in static HTML and both diagrams carry explanations', async () => {
    const html = await renderPage();
    assert.match(html, /<div id="homelabDetails">/);
    assert.equal([...html.matchAll(/<div class="xp-details">/g)].length, 3);
    assert.equal([...html.matchAll(/<div class="card sticker-sm" data-stagger/g)].length, 11);
    assert.doesNotMatch(html, /<div class="card sticker-sm"[^>]* hidden/);
    for (const id of ['lab-containers-caption', 'lab-network-caption']) assert.ok(html.includes('id="' + id + '"'));
    for (const text of ['Docker Compose', 'Nextcloud App', 'Cron', 'Tailscale Serve', 'Public', 'Minecraft', 'Local', 'DNS Filtering', 'Owner-reported']) assert.ok(html.toLowerCase().includes(text.toLowerCase()));
    assert.match(html, /<noscript>[\s\S]*?LinkedIn/);
});

test('canonical, social preview, and Person data agree with the public identity', async () => {
    const html = await renderPage();
    assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
    assert.match(html, /rel="canonical" href="https:\/\/realtimgfm.github.io\/"/);
    for (const field of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:image', 'twitter:image:alt']) assert.ok(html.includes('"' + field + '"'));
    assert.equal([...html.matchAll(/content="https:\/\/realtimgfm.github.io\/assets\/social-preview.png"/g)].length, 2);
    const profile = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(profile.name, 'Tim Vu');
    assert.equal(profile['@type'], 'Person');
    assert.equal(profile.url, 'https://realtimgfm.github.io/');
    assert.equal(profile.sameAs.length, 2);
    const png = await readFile(new URL('../assets/social-preview.png', import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
});

test('generated page matches its sources and Pages includes social and existing assets', async () => {
    const expected = '<!-- Generated by npm run build. Edit index.template.html and partials/. -->\n' + await renderPage();
    assert.equal((await read('index.html')).replace(/\r\n/g, '\n'), expected);
    await build({ pages: true });
    assert.equal(await read('_site/index.html'), expected);
    for (const path of ['assets/social-preview.png', 'assets/QuyVuLuong_CV.pdf', 'assets/ITEssentialCisco.pdf', 'assets/homelab/models/thinkpad-t16-gen2.glb', 'assets/homelab/models/raspberry-pi-4.glb', 'scripts/services.js']) {
        assert.deepEqual(await readFile(new URL('../_site/' + path, import.meta.url)), await readFile(new URL('../' + path, import.meta.url)));
    }
});

const homeLab = async () => {
    const html = await renderPage();
    return html.slice(html.indexOf('<section id="homelab"'), html.indexOf('<section id="skills"'));
};

test('Home Lab presents six scan-first groups and retains the hardware resource qualification', async () => {
    const html = await homeLab();
    const headings = [...html.matchAll(/<h[34] id="homelab-(?:title|nextcloud|private-access|hardware|evidence|lessons)">([^<]+)<\/h[34]>/g)]
        .map(match => match[1]);
    assert.deepEqual(headings, ['Home Lab at a Glance', 'Nextcloud Deployment', 'Network &amp; Access', 'Meet the Machines', 'Operational Evidence', 'What I Learned']);
    for (const text of ['Debian Server', 'Raspberry Pi 4', '13th Gen Intel Core i7', '~16 GB RAM', '512 GB SSD']) assert.ok(html.includes(text));
    assert.match(html, /Owner-reported resources; not yet matched to the pictured ThinkPad/);
    assert.doesNotMatch(html, /Hardware &amp; workload register|One network, distinct responsibilities/);
});

test('Nextcloud separates request flow, metadata, file storage and independent cron work', async () => {
    const html = await homeLab();
    const deployment = html.slice(html.indexOf('aria-labelledby="homelab-nextcloud"'), html.indexOf('aria-labelledby="homelab-private-access"'));
    const flow = deployment.match(/<ol class="lab-access-flow lab-request-flow"[\s\S]*?<\/ol>/)[0];
    assert.deepEqual([...flow.matchAll(/<strong>([^<]+)<\/strong>/g)].map(m => m[1]), ['Authorized device', 'Tailscale', 'Tailscale Serve']);
    assert.match(flow, /HTTPS/);
    assert.match(deployment, /Debian Server[\s\S]*Docker Compose environment[\s\S]*Nextcloud App/);
    assert.match(deployment, /<dt>PostgreSQL 17<\/dt><dd>Application database; file metadata./);
    assert.match(deployment, /<dt>Redis 7<\/dt><dd>Redis service./);
    assert.match(deployment, /<dt>Persistent Storage<\/dt><dd>Durable application files and database data.<\/dd>/);
    assert.match(deployment, /<dt>Cron<\/dt><dd>Scheduled Nextcloud background jobs./);
    assert.match(deployment, /Uses shared application resources[\s\S]*Shared application configuration and file storage; runs independently of web visits/);
    assert.match(deployment, /not a literal Docker network topology/);
});

test('private, public and local paths preserve their distinct audiences and services', async () => {
    const html = await homeLab();
    const regions = [...html.matchAll(/<section class="lab-access-region"[\s\S]*?<\/section>/g)].map(m => m[0]);
    assert.equal(regions.length, 3);
    const labels = region => [...region.matchAll(/<li><strong>([^<]+)<\/strong>/g)].map(m => m[1]);
    assert.deepEqual(labels(regions[0]), ['My Device', 'Tailscale', 'Debian Server']);
    assert.match(regions[0], /Tailscale Serve[\s\S]*Forwards to Nextcloud/);
    assert.match(regions[0], /<dt>SSH<\/dt><dd>Connects to administration/);
    assert.deepEqual(labels(regions[1]), ['External Players', 'playit.gg', 'Minecraft Server']);
    assert.doesNotMatch(regions[1], /Nextcloud/);
    assert.deepEqual(labels(regions[2]), ['Home Devices', 'Raspberry Pi 4', 'Pi-hole \/ DNS']);
    assert.match(regions[2], /Configured DNS clients/);
    assert.match(html, /not automatically to every tailnet device/);
    assert.match(html, /does not imply that Tailscale SSH is enabled/);
});

test('Home Lab details remain native and no private identifiers are published', async () => {
    const html = await homeLab();
    const disclosures = [...html.matchAll(/<details class="lab-notes">([\s\S]*?)<\/details>/g)].map(m => m[1]);
    assert.equal(disclosures.length, 2);
    assert.match(disclosures[0], /<summary>Technical notes<\/summary>/);
    assert.match(disclosures[1], /<summary>Access &amp; security notes<\/summary>/);
    assert.ok(disclosures.every(content => !/\bhidden\b|\binert\b/.test(content)));
    assert.doesNotMatch(html, /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2})\b/);
    assert.doesNotMatch(html, /[a-z0-9-]+\.ts\.net|tskey-[a-z0-9-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|token|secret)\s*[:=]\s*["'][^"']+["']/i);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
    for (const id of ['homelab-specifications', 'homelab-nextcloud', 'homelab-private-access', 'homelab-architecture', 'homelab-hardware', 'homelab-debian', 'homelab-workload', 'homelab-pi', 'homelab-lessons']) assert.ok(ids.has(id), 'Missing existing lab anchor: ' + id);
    assert.match(html, /id="homelabToggle"[\s\S]*?aria-controls="homelabDetails" hidden/);
    assert.match(html, /<div id="homelabDetails">/);
    assert.match(html, /id="homelabCollapse"[\s\S]*?aria-controls="homelabDetails" hidden/);
});

const evidenceFixture = async () => JSON.parse(await read('tests/fixtures/nextcloud-evidence.json'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// Decode the opaque RGB PNGs without adding a runtime or test dependency.
function rgbPng(bytes) {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes[24], 8, 'Use 8-bit channels');
    assert.equal(bytes[25], 2, 'Redactions must ship as opaque RGB, without an alpha channel');
    assert.equal(bytes[28], 0, 'Use non-interlaced PNGs');
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const chunks = [];
    for (let offset = 8; offset < bytes.length;) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString('ascii', offset + 4, offset + 8);
        assert.ok(['IHDR', 'IDAT', 'IEND', 'gAMA', 'sRGB', 'pHYs'].includes(type), 'Unexpected metadata: ' + type);
        if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
        offset += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(chunks));
    const stride = width * 3;
    assert.equal(raw.length, (stride + 1) * height);
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        assert.ok(filter <= 4, 'Invalid PNG filter');
        for (let x = 0; x < stride; x++) {
            const index = y * stride + x;
            const left = x >= 3 ? pixels[index - 3] : 0;
            const up = y ? pixels[index - stride] : 0;
            const upperLeft = y && x >= 3 ? pixels[index - stride - 3] : 0;
            const prediction = left + up - upperLeft;
            const distances = [Math.abs(prediction - left), Math.abs(prediction - up), Math.abs(prediction - upperLeft)];
            const paeth = distances[0] <= distances[1] && distances[0] <= distances[2] ? left : distances[1] <= distances[2] ? up : upperLeft;
            const value = [0, left, up, Math.floor((left + up) / 2), paeth][filter];
            pixels[index] = (raw[y * (stride + 1) + 1 + x] + value) & 255;
        }
    }
    return { width, height, pixels };
}

test('Nextcloud architecture represents exactly four captured services, with storage separate', async () => {
    const html = await homeLab();
    const deployment = html.slice(html.indexOf('aria-labelledby="homelab-nextcloud"'), html.indexOf('aria-labelledby="homelab-private-access"'));
    assert.deepEqual([...deployment.matchAll(/data-container="([^"]+)"/g)].map(m => m[1]),
        ['nextcloud-app-1', 'nextcloud-db-1', 'nextcloud-redis-1', 'nextcloud-cron-1']);
    assert.equal([...deployment.matchAll(/>nextcloud:apache</g)].length, 2);
    for (const value of ['postgres:17-alpine', 'redis:7-alpine', '4 running at capture', 'Up ~7 days', 'PostgreSQL healthy']) assert.ok(deployment.includes(value));
    assert.match(deployment, /class="lab-cron"[\s\S]*?Shared application configuration and file storage/);
    assert.doesNotMatch(deployment.match(/<dl class="lab-cron">[\s\S]*?<\/dl>/)[0], /PostgreSQL|lab-arrow/);
    assert.match(deployment, /Redis caching and locking settings, mount paths and backup procedures are not established by the capture/);
});

test('all five unique operational captures stay in the expanded lab with full-size access', async () => {
    const html = await homeLab();
    const expanded = html.slice(html.indexOf('<div id="homelabDetails">'));
    const evidence = expanded.slice(expanded.indexOf('aria-labelledby="homelab-evidence"'), expanded.indexOf('aria-labelledby="homelab-lessons"'));
    const captures = [...evidence.matchAll(/<figure id="[^"]+" class="homelab-figure homelab-capture[^\"]*"[\s\S]*?<\/figure>/g)].map(m => m[0]);
    assert.equal(captures.length, 5);
    const names = ['debian-operations.webp', 'prominence-ii-world.webp', 'pihole-dashboard.webp', 'nextcloud-files.png', 'nextcloud-docker.png'];
    for (const name of names) {
        const capture = captures.find(item => item.includes('src="assets/homelab/' + name + '"'));
        assert.ok(capture, 'Missing capture: ' + name);
        assert.equal([...html.matchAll(new RegExp('src="assets/homelab/' + name.replace('.', '\\.') + '"', 'g'))].length, 1);
        assert.match(capture, /loading="lazy" decoding="async"/);
        assert.match(capture, /srcset="[^"]+-960\.(?:webp|png) 960w, [^"]+"/);
        assert.match(capture, /sizes="[^"]+"/);
        assert.match(capture, /alt="[^\"]{30,}"/);
        assert.ok(capture.includes('href="assets/homelab/' + name + '"'));
        assert.match(capture, /View full-size/);
    }
    const group = evidence.slice(evidence.indexOf('class="homelab-evidence-group"'));
    assert.match(group, /role="group" aria-labelledby="homelab-file-storage-title"/);
    assert.match(group, /Self-hosted File Storage[\s\S]*nextcloud-files.png[\s\S]*nextcloud-docker.png/);
    for (const [, path] of html.matchAll(/(?:src|poster|data-model-src)="(assets\/[^"]+)"/g)) await stat(new URL('../' + path, import.meta.url));
});

test('Nextcloud images contain flattened opaque redactions and only audited sanitized pixels', async () => {
    const fixture = await evidenceFixture();
    for (const asset of fixture.assets) {
        const bytes = await readFile(new URL('../' + asset.path, import.meta.url));
        assert.equal(digest(bytes), asset.sha256, 'Review privacy before changing ' + asset.path);
        const { width, height, pixels } = rgbPng(bytes);
        assert.equal(width, asset.width);
        assert.equal(height, asset.height);
        for (const [x, y, w, h] of fixture.masks[asset.path] || []) {
            for (let row = y; row < y + h; row++) {
                const masked = pixels.subarray((row * width + x) * 3, (row * width + x + w) * 3);
                assert.ok(masked.every(value => value === 0), 'Recoverable pixels in redaction: ' + asset.path);
            }
        }
    }
    for (const original of fixture.originals) assert.ok(!fixture.assets.some(asset => asset.sha256 === original.sha256));
});

test('Pages packages all five captures and sanitized variants, excludes originals, and retains models', async () => {
    const fixture = await evidenceFixture();
    const files = [...fixture.assets.map(asset => asset.path), ...['debian-operations', 'prominence-ii-world', 'pihole-dashboard'].flatMap(name => ['', '-960'].map(suffix => 'assets/homelab/' + name + suffix + '.webp'))];
    for (const path of files) assert.deepEqual(await readFile(new URL('../_site/' + path, import.meta.url)), await readFile(new URL('../' + path, import.meta.url)));
    for (const [path, expected] of Object.entries(fixture.unchanged)) {
        assert.equal(digest(await readFile(new URL('../' + path, import.meta.url))), expected, 'Existing model/viewer/disclosure changed: ' + path);
    }
    const scan = async directory => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = new URL(encodeURIComponent(entry.name) + (entry.isDirectory() ? '/' : ''), directory);
            if (entry.isDirectory()) await scan(path);
            else {
                const size = (await stat(path)).size;
                for (const original of fixture.originals.filter(item => item.bytes === size)) {
                    assert.notEqual(digest(await readFile(path)), original.sha256, 'Unredacted original in deployable assets');
                }
            }
        }
    };
    await scan(new URL('../assets/', import.meta.url));
    await scan(new URL('../_site/', import.meta.url));
    const nextcloudFiles = (await readdir(new URL('../_site/assets/homelab/', import.meta.url))).filter(name => name.startsWith('nextcloud-')).sort();
    assert.deepEqual(nextcloudFiles, fixture.assets.flatMap(asset => [asset.path.split('/').pop(), asset.path.split('/').pop() + '.json']).sort());
});
