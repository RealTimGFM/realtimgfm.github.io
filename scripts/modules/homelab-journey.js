// Offline, deterministic story. These are conceptual service boundaries, not packet capture.
const step = (title, detail, actor, route = null, flow = 'request', extra = {}) =>
    ({ title, detail, actor, route, flow, ...extra });
const idle = step('Open private files', 'Follow a fictional file-list request. Nothing connects to the lab.', 'client', null, 'request', { window: 'idle' });
const entry = step('Entering the private route', 'This fictional device is authorized and connected to the tailnet.', 'gate', 'entry');
const serve = step('Private HTTPS → local upstream', 'Tailscale Serve forwards / to http://127.0.0.1:8080 on Debian. No public Nextcloud port is implied.', 'host', 'serve');
const upstream = step('Crossing the Docker boundary', 'The loopback-bound host port 8080 maps to Nextcloud Apache container port 80.', 'app', 'upstream');
const responseSteps = [
    step('Response leaves Nextcloud', 'The illustrative file-list response returns through the same local mapping.', 'host', 'upstream', 'response', { reverse: true }),
    step('Back through Serve', 'The return follows the private route. This animation measures no latency.', 'gate', 'serve', 'response', { reverse: true }),
    step('Returning to your device', 'The client receives the illustrative outcome over the private connection.', 'client', 'entry', 'response', { reverse: true })
];
const scenarios = {
    success: [idle, entry, serve, upstream,
        step('Nextcloud is processing', 'A hypothetical file-list operation asks for metadata. This is illustrative application behavior.', 'app'),
        step('Metadata dependency', 'A separate branch queries PostgreSQL 17. Redis and Cron are not HTTP request hops.', 'database', 'database'),
        step('Metadata returns to the app', 'The database supplies illustrative metadata; its database volume persists separately from app storage.', 'app', 'database', 'response', { reverse: true }),
        ...responseSteps,
        step('File list loaded (illustrative)', 'The response is home. The laptop now shows a fictional file list; no user files were accessed.', 'client', null, 'response', { outcome: 'success', window: 'loaded' })],
    denied: [idle,
        step('Private route is unavailable', 'The fictional device is outside the tailnet or is not authorized. The request cannot reach Serve.', 'gate', 'entry', 'request', { end: 0.76 }),
        step('Access unavailable', 'Connect an authorized device to the tailnet before retrying. Serve and Nextcloud were never reached. This is not a live ACL test.', 'gate', 'entry', 'error', { end: 0.76, fault: 'gate', outcome: 'denied', window: 'error' })]
};

export function getLabScenario(name) {
    return scenarios[name] || scenarios.success;
}

const layouts = {
    wide: {
        box: '0 0 1200 520',
        actors: { client: [24, 100], gate: [300, 100], host: [600, 100], app: [940, 100], database: [780, 360], redis: [530, 360], storage: [1030, 360], cron: [300, 360] },
        paths: { entry: 'M144 148H300', serve: 'M420 148H600', upstream: 'M720 148H940', database: 'M1054 140H1080V308H840V361', redis: 'M1054 160H1108V284H590V369', storage: 'M1054 175H1136V332H1090V374', cron: 'M394 399H450V496H1170V429H1140' },
        boundary: 'M276 44H1180V264H276Z', label: [300, 68], https: [222, 128], http: [830, 128]
    },
    medium: {
        box: '0 0 900 640',
        actors: { client: [30, 90], gate: [320, 90], host: [650, 90], app: [650, 320], database: [420, 320], redis: [190, 320], storage: [650, 500], cron: [320, 500] },
        paths: { entry: 'M150 138H320', serve: 'M440 138H650', upstream: 'M758 130H830V360H770', database: 'M656 350H560V333H515', redis: 'M656 370H590V455H160V350H205', storage: 'M764 390H810V470H710V514', cron: 'M414 539H600V576H660' },
        boundary: 'M292 30H875V465H625V250H292Z', label: [316, 54], https: [235, 118], http: [810, 280]
    },
    narrow: {
        box: '0 0 400 800',
        actors: { client: [10, 42], gate: [250, 42], host: [250, 240], app: [10, 240], database: [10, 470], redis: [250, 470], storage: [10, 660], cron: [250, 660] },
        paths: { entry: 'M130 90H250', serve: 'M360 114H384V220H310V240', upstream: 'M262 277H130', database: 'M16 295H5V412H70V471', redis: 'M124 307H200V430H310V479', storage: 'M104 319H172V620H70V674', cron: 'M276 699H144V736H120' },
        boundary: 'M237 10H394V398H4V218H237Z', label: [12, 204], https: [190, 70], http: [190, 257]
    }
};

export function initHomelabJourney() {
    const root = document.querySelector('[data-homelab-journey]');
    if (!root || root.dataset.ready) return;
    const find = name => root.querySelector('[data-lab-' + name + ']');
    const slide = root.closest('.featured-slide');
    const svg = find('svg');
    const packet = find('packet');
    const stop = find('stop');
    const actors = [...root.querySelectorAll('[data-lab-actor]')];
    const paths = Object.fromEntries([...root.querySelectorAll('[data-lab-path]')].map(path => [path.dataset.labPath, path]));
    const play = find('play');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = window.matchMedia('(max-width: 720px)');
    const medium = window.matchMedia('(max-width: 1000px)');
    let sequence = getLabScenario('success');
    let index = 0;
    let running = false;
    let visible = true;
    let frame = null;
    let elapsed = 0;
    let lastTime = null;
    const duration = 1050;
    const engage = () => root.dispatchEvent(new CustomEvent('journey:interact', { bubbles: true }));
    const allowed = () => visible && !document.hidden && slide.classList.contains('is-active');

    function paint(progress = 1) {
        const current = sequence[index];
        const fault = sequence.slice(0, index + 1).find(s => s.fault)?.fault;
        root.dataset.flow = current.flow;
        root.dataset.outcome = current.outcome || '';
        root.dataset.fault = fault || '';
        actors.forEach(actor => {
            actor.classList.toggle('is-current', actor.dataset.labActor === current.actor);
            actor.classList.toggle('is-failed', actor.dataset.labActor === fault);
        });
        // Main-route arrows follow the response once it leaves the app. The DB
        // metadata return is a separate branch and does not reverse HTTP yet.
        const headingHome = current.flow === 'response' && current.route !== 'database';
        Object.entries(paths).forEach(([key, path]) => {
            path.classList.toggle('is-current', key === current.route);
            if (['entry', 'serve', 'upstream'].includes(key)) {
                path.setAttribute('marker-start', headingHome ? 'url(#lab-arrow)' : 'none');
                path.setAttribute('marker-end', headingHome ? 'none' : 'url(#lab-arrow)');
            }
        });
        root.querySelectorAll('[data-lab-window]').forEach(view => view.setAttribute('visibility', view.dataset.labWindow === (current.window || 'waiting') ? 'visible' : 'hidden'));
        find('gate-check').setAttribute('visibility', fault === 'gate' ? 'hidden' : 'visible');
        find('gate-stop').setAttribute('visibility', fault === 'gate' ? 'visible' : 'hidden');
        // A square envelope goes out; a circular response comes back. Failure has a cross.
        packet.querySelector('rect').setAttribute('rx', current.flow === 'response' ? '7' : '2');
        packet.querySelector('path').setAttribute('d', current.flow === 'error' ? 'M-4 -4 4 4M4 -4 -4 4' : current.flow === 'response' ? 'M-4 0 -1 3 5 -3' : 'M-5 -3 0 2 5 -3');
        packet.setAttribute('visibility', current.route && !current.fault ? 'visible' : 'hidden');
        if (current.route) {
            const path = paths[current.route];
            const portion = current.reverse ? 1 - progress : progress * (current.end || 1);
            const point = path.getPointAtLength(path.getTotalLength() * portion);
            packet.setAttribute('transform', `translate(${point.x} ${point.y})`);
        }
        stop.setAttribute('visibility', fault ? 'visible' : 'hidden');
        if (fault) {
            const blocked = sequence.find(s => s.fault);
            const path = paths[blocked.route];
            const point = path.getPointAtLength(path.getTotalLength() * blocked.end);
            stop.setAttribute('transform', `translate(${point.x} ${point.y})`);
        }
    }

    function show() {
        const current = sequence[index];
        find('result').textContent = current.title;
        find('phase').textContent = current.detail;
        find('count').textContent = index === 0 ? 'Ready' : `${index} / ${sequence.length - 1}`;
        find('previous').setAttribute('aria-disabled', String(index === 0));
        find('next').setAttribute('aria-disabled', String(index === sequence.length - 1));
        paint(running && !motion.matches ? elapsed / duration : 1);
    }

    function pause() {
        running = false;
        if (frame !== null) window.cancelAnimationFrame(frame);
        frame = null;
        lastTime = null;
        play.textContent = index === 0 ? 'Play journey' : index === sequence.length - 1 ? 'Play again' : 'Continue';
        play.setAttribute('aria-pressed', 'false');
    }

    function tick(time) {
        frame = null;
        if (!running || !allowed()) { pause(); return; }
        if (lastTime !== null) elapsed += Math.max(0, time - lastTime);
        lastTime = time;
        paint(motion.matches ? 1 : Math.min(1, elapsed / duration));
        if (elapsed >= duration) {
            if (index === sequence.length - 1) { pause(); return; }
            index++;
            elapsed = 0;
            show();
            if (index === sequence.length - 1) { pause(); return; }
        }
        frame = window.requestAnimationFrame(tick);
    }

    function move(target) {
        pause();
        index = Math.max(0, Math.min(target, sequence.length - 1));
        elapsed = duration;
        show();
        pause();
    }

    function layout() {
        // Layout and route coordinates change together, including a packet paused mid-path.
        const spec = layouts[narrow.matches ? 'narrow' : medium.matches ? 'medium' : 'wide'];
        svg.setAttribute('viewBox', spec.box);
        actors.forEach(actor => actor.setAttribute('transform', `translate(${spec.actors[actor.dataset.labActor].join(' ')})`));
        Object.entries(paths).forEach(([name, path]) => path.setAttribute('d', spec.paths[name]));
        find('boundary').setAttribute('d', spec.boundary);
        find('boundary-label').setAttribute('x', spec.label[0]);
        find('boundary-label').setAttribute('y', spec.label[1]);
        for (const name of ['https', 'http']) {
            find(name + '-label').setAttribute('x', spec[name][0]);
            find(name + '-label').setAttribute('y', spec[name][1]);
        }
        paint(motion.matches ? 1 : Math.min(1, elapsed / duration));
    }

    function start() {
        if (!allowed()) return;
        if (index === sequence.length - 1) { index = 0; elapsed = 0; }
        if (index === 0) { index = 1; elapsed = 0; }
        else if (elapsed >= duration) { index++; elapsed = 0; }
        running = true;
        lastTime = null;
        play.textContent = 'Pause';
        play.setAttribute('aria-pressed', 'true');
        show();
        frame = window.requestAnimationFrame(tick);
    }
    play.addEventListener('click', () => {
        engage();
        if (running) pause();
        else start();
    });
    find('previous').addEventListener('click', () => { engage(); move(index - 1); });
    find('next').addEventListener('click', () => { engage(); move(index + 1); });
    find('replay').addEventListener('click', () => { engage(); move(0); start(); });
    find('scenario').addEventListener('change', event => {
        engage();
        sequence = getLabScenario(event.target.value);
        move(0);
    });
    slide.addEventListener('featured:deactivate', pause);
    slide.addEventListener('featured:activate', () => move(0));
    slide.addEventListener('journey:preview', () => move(0));
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    motion.addEventListener('change', () => { pause(); show(); });
    narrow.addEventListener('change', layout);
    medium.addEventListener('change', layout);
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            if (!visible) pause();
        }).observe(root);
    }
    root.querySelectorAll('[data-lab-controls]').forEach(control => { control.hidden = false; });
    root.dataset.ready = 'true';
    layout();
    show();
    pause();
}
