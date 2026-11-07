// Deterministic illustration of the C# source. Never a service client.
export const FX = Object.freeze({ baseline: 1.1, threshold: 0.5, trigger: 1.1055,
    now: '2026-07-08T16:00:00Z', key: 'daily-movement|EUR/USD', cooldown: 3600000 });
const samples = [1.1002, 1.1011, 1.1024, 1.1040, 1.1052, 1.1066];
const gates = ['market', 'quote', 'rule', 'cooldown', 'send', 'commit'];
const stages = [null, 'market', 'quote', 'rule', 'rule', 'cooldown', 'send', 'commit'];
const titles = ['Ready to try it?', 'The market is open', 'The price is reliable', 'Watching the price change',
    'The price has moved enough', 'Ready for another alert', 'Alert added to the demo log', 'Alert recorded (demo)'];
const details = ['Choose an example, then press Run signal to see what happens.',
    'It is Wednesday during trading hours. The demo can check the price.',
    'Both price quotes are recent and agree on timing. The demo can use their average.',
    'The line shows made-up prices moving away from the previous close.',
    'The price rose 0.60%, above the 0.50% alert level. The demo checks whether to send an alert.',
    'This price move has not been reported, and no recent alert requires a wait.',
    'The alert was recorded successfully. Next, the demo remembers it to avoid repeats.',
    'The price rose 0.60%, enough for a new alert. The demo recorded it and saved a reminder to prevent repeats.'];
const previews = {
    valid: 'See whether a 0.60% price rise leads to an alert.',
    below: 'The price rises only 0.40%. See why a small change does not trigger an alert.',
    duplicate: 'This price move already triggered an alert two hours ago. Try the same move again.',
    cooldown: 'A different alert was recorded 30 minutes ago. See why the demo waits before another one.',
    closed: 'It is Saturday, outside the demo trading hours. See why price checks stop here.'
};

export function getFxFixture(name = 'valid') {
    const scenario = ['valid', 'below', 'duplicate', 'cooldown', 'closed'].includes(name) ? name : 'valid';
    const below = scenario === 'below';
    return { scenario, now: scenario === 'closed' ? '2026-07-11T16:00:00Z' : FX.now,
        marketOpen: scenario !== 'closed', bid: below ? 1.1043 : 1.1065, ask: below ? 1.1045 : 1.1067,
        bidAge: 0, askAge: 0, skew: 0,
        baseline: FX.baseline, baselineComplete: true, threshold: FX.threshold,
        fingerprint: 'candidate-A',
        samples: below ? [1.1002, 1.1008, 1.1017, 1.1028, 1.1037, 1.1044] : [...samples] };
}

export function freshMidpoint(input) {
    const { bid, ask, bidAge, askAge, skew } = input;
    return [bid, ask].every(value => Number.isFinite(value) && value > 0) && bid <= ask
        && bidAge >= 0 && askAge >= 0 && bidAge <= 60 && askAge <= 60 && Math.abs(skew) <= 2
        ? (bid + ask) / 2 : null;
}

export function canSendFx(record, fingerprint, now) {
    return !record || (record.fingerprint !== fingerprint && Date.parse(now) >= Date.parse(record.sentAt) + FX.cooldown);
}

export function createFxState(name = 'valid', preserved = null) {
    const fixture = getFxFixture(name);
    const seeded = ['duplicate', 'cooldown'].includes(fixture.scenario) ? { [FX.key]: {
        fingerprint: fixture.scenario === 'duplicate' ? 'candidate-A' : 'candidate-B',
        sentAt: fixture.scenario === 'duplicate' ? '2026-07-08T14:00:00Z' : '2026-07-08T15:30:00Z'
    } } : {};
    return { fixture, stage: 0, gate: null, passed: [], outcome: '', terminal: false, candidate: null,
        ledger: structuredClone(preserved?.ledger ?? seeded), logs: [...(preserved?.logs ?? [])],
        attempted: false, sent: false, committed: false, title: titles[0], detail: previews[fixture.scenario] };
}

// Each call is one meaningful decision. Animation time never decides eligibility.
export function advanceFx(state) {
    if (state.terminal) return state;
    const next = { ...state, stage: state.stage + 1, passed: [...state.passed] };
    const f = next.fixture;
    next.gate = stages[next.stage];
    next.title = titles[next.stage];
    next.detail = details[next.stage];
    const reject = (outcome, title, detail) => Object.assign(next, { outcome, title, detail, terminal: true });
    if (next.stage === 1 && !f.marketOpen) return reject('closed', 'Market closed — no alert',
        'It is Saturday, outside the demo trading hours. The price is not checked and no alert is recorded.');
    if (next.stage === 2 && freshMidpoint(f) === null) return reject('unreliable', 'Price cannot be used — no alert',
        'The price quotes do not pass the reliability checks. No alert is recorded.');
    if (next.stage === 4) {
        const mid = freshMidpoint(f);
        const change = (mid - f.baseline) / f.baseline * 100;
        if (!f.baselineComplete || !Number.isFinite(f.baseline) || f.baseline <= 0 || !Number.isFinite(f.threshold) || f.threshold < 0)
            return reject('baseline', 'Cannot compare prices — no alert', 'A valid previous close and alert level are needed. No alert is recorded.');
        if (Math.abs(change) + 1e-10 < f.threshold) return reject('below', 'Small change — no alert',
            'The price rose 0.40%, below the 0.50% alert level. The move is too small, so no alert is recorded.');
        next.candidate = { key: FX.key, fingerprint: f.fingerprint, mid, change };
    }
    if (next.stage === 5 && !canSendFx(next.ledger[FX.key], f.fingerprint, f.now)) {
        const same = next.ledger[FX.key].fingerprint === f.fingerprint;
        return reject(same ? 'duplicate' : 'cooldown', same ? 'Already reported — no new alert' : 'Too soon — no new alert',
            same ? 'This exact price move was already reported. Waiting longer does not make it new, so no repeat alert is recorded.'
                : 'This is a different price move, but the last alert was only 30 minutes ago. The demo waits one hour between new alerts.');
    }
    if (next.stage === 6) {
        next.attempted = true;
        next.sent = true;
        next.logs = [...next.logs, { fingerprint: f.fingerprint, time: f.now, mid: next.candidate.mid }];
    }
    if (next.stage === 7) {
        next.ledger = { ...next.ledger, [FX.key]: { fingerprint: f.fingerprint, sentAt: f.now } };
        next.committed = true; next.terminal = true; next.outcome = 'success';
    }
    if (next.stage !== 3) next.passed = [...new Set([...next.passed, next.gate])];
    return next;
}

export function replayFx(state) {
    // Starting another attempt settles a successful append's pending commit first.
    // Inspecting history never calls this and never mutates the latest ledger.
    const settled = state.sent && !state.committed ? advanceFx(state) : state;
    const next = createFxState(state.fixture.scenario, settled);
    next.fixture = { ...state.fixture };
    return next;
}

// Point on the actual sample polyline in time order; also drives the quote strip.
export function fxPlotPoint(values, progress, width = 640, height = 280) {
    const position = Math.max(0, Math.min(1, progress)) * (values.length - 1);
    const index = Math.min(Math.floor(position), values.length - 2);
    const fraction = position - index;
    const price = values[index] + (values[index + 1] - values[index]) * fraction;
    return { x: 58 + position / (values.length - 1) * (width - 80), y: height - 44 - (price - 1.1) / 0.008 * (height - 62), price };
}

export function initForexalertJourney() {
    const root = document.querySelector('[data-forexalert-journey]');
    if (!root || root.dataset.ready) return;
    const find = name => root.querySelector('[data-fx-' + name + ']');
    const slide = root.closest('.featured-slide');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = window.matchMedia('(max-width: 600px)');
    const gateElements = [...root.querySelectorAll('[data-fx-gate]')];
    let state = createFxState();
    let history = [state];
    let review = 0;
    let running = false;
    let frame = null;
    let elapsed = 0;
    let lastTime = null;
    let progress = 1;
    let visible = true;
    const duration = current => current.stage === 3 ? 2400 : current.stage === 4 ? 950 : 1050;
    const engage = () => root.dispatchEvent(new CustomEvent('journey:interact', { bubbles: true }));
    const allowed = () => visible && !document.hidden && slide.classList.contains('is-active');
    // Observer delivery may lag a click that has just scrolled its control into view.
    const measureVisible = () => {
        if (!root.getBoundingClientRect) return visible;
        const rect = root.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    };
    const viewed = () => history[review];
    const format = value => value.toFixed(4);
    const chartWidth = () => narrow.matches ? 340 : Math.max(340, find('chart').clientWidth || 640);
    const chartHeight = () => narrow.matches ? 250 : 280;
    const svgNode = (tag, attributes, value) => {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attributes).forEach(([key, v]) => element.setAttribute(key, v));
        if (value !== undefined) element.textContent = value;
        return element;
    };
    function plotProgress(current, fraction = 1) {
        if (current.stage < 3) return 0;
        const values = current.fixture.samples;
        const target = current.fixture.scenario === 'below' ? 0.75 : (4 + (FX.trigger - values[4]) / (values[5] - values[4])) / 5;
        if (current.stage === 3) return target * fraction;
        if (current.stage === 4) return target + (1 - target) * fraction;
        return 1;
    }
    function paint(fraction = 1) {
        const current = viewed();
        const width = chartWidth();
        const height = chartHeight();
        const values = current.fixture.samples;
        const progress = plotProgress(current, fraction);
        const point = fxPlotPoint(values, progress, width, height);
        const path = (upto = 1) => {
            const points = values.map((_, i) => fxPlotPoint(values, i / 5, width, height)).filter((_, i) => i / 5 <= upto);
            if (upto < 1) points.push(fxPlotPoint(values, upto, width, height));
            return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('');
        };
        find('chart').setAttribute('viewBox', `0 0 ${width} ${height}`);
        find('preview').setAttribute('d', path());
        find('trace').setAttribute('d', current.outcome === 'unreliable' || current.outcome === 'closed' ? '' : path(progress));
        find('marker').setAttribute('transform', `translate(${point.x} ${point.y})`);
        find('cursor').setAttribute('d', `M${point.x} ${point.y + 12}V${height - 44}`);
        const crossed = current.stage >= 3 && point.price + 1e-10 >= FX.trigger && !['unreliable', 'closed'].includes(current.outcome);
        root.dataset.crossed = String(crossed);
        find('crossing').setAttribute('visibility', crossed ? 'visible' : 'hidden');
        const crossing = fxPlotPoint(values, (4 + (FX.trigger - values[4]) / (values[5] - values[4])) / 5, width, height);
        find('crossing').setAttribute('transform', `translate(${crossing.x} ${fxPlotPoint([FX.trigger, FX.trigger], 0, width, height).y})`);
        const trusted = freshMidpoint(current.fixture) !== null;
        find('bid').textContent = format(point.price - 0.0001);
        find('ask').textContent = format(point.price + 0.0001);
        find('mid').textContent = trusted ? format(point.price) : '—';
        find('movement').textContent = trusted ? `+${((point.price - FX.baseline) / FX.baseline * 100).toFixed(2)}%` : 'unavailable';
        find('plot-note').textContent = 'Made-up prices for this demo';
        // Candidate ticket on the same decision rail; it cannot pass a rejected gate.
        const gateIndex = Math.max(0, gates.indexOf(current.gate));
        const previousGate = current.stage === 4 ? 2 : Math.max(0, gateIndex - 1);
        const position = current.stage === 3 || current.stage === 4 ? 2 : previousGate + (gateIndex - previousGate) * fraction;
        root.style.setProperty('--fx-signal-position', String(position));
    }
    function layout() {
        const width = chartWidth();
        const height = chartHeight();
        const baseline = height - 44;
        const y = price => fxPlotPoint([price, price], 0, width, height).y;
        find('grid').setAttribute('d', [1.102, 1.104, 1.108].map(price => `M58 ${y(price)}H${width - 22}`).join(''));
        find('baseline').setAttribute('d', `M58 ${baseline}H${width - 22}`);
        find('trigger').setAttribute('d', `M58 ${y(FX.trigger)}H${width - 22}`);
        for (const [name, label, top] of [['baseline', 'Previous close · 1.1000', baseline - 12], ['trigger', 'Alert level +0.50% · 1.1055', y(FX.trigger) - 10]]) {
            const text = find(name + '-label');
            text.setAttribute('x', name === 'baseline' ? width - 36 : 65);
            text.setAttribute('text-anchor', name === 'baseline' ? 'end' : 'start');
            text.setAttribute('y', top); text.textContent = label;
        }
        find('axes').replaceChildren(...[1.1, 1.104, 1.108].map(price => svgNode('text', { x: 49, y: y(price) + 4, 'text-anchor': 'end' }, format(price))),
            ...['09:00', '12:30', '16:00'].map((time, i) => svgNode('text', { x: 58 + (width - 80) * i / 2, y: height - 12, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle' }, time + (i === 2 ? ' UTC' : ''))));
        find('samples').replaceChildren(...viewed().fixture.samples.map((_, i) => {
            const p = fxPlotPoint(viewed().fixture.samples, i / 5, width, height);
            return svgNode('circle', { cx: p.x, cy: p.y, r: 2.5 });
        }));
        paint(motion.matches ? 1 : progress);
    }
    function show() {
        const current = viewed(); const reviewing = review < history.length - 1;
        root.dataset.stage = String(current.stage); root.dataset.outcome = current.outcome;
        root.dataset.gate = current.gate || ''; root.dataset.running = String(running); root.dataset.reviewing = String(reviewing);
        const result = (reviewing ? 'Earlier step · ' : '') + current.title;
        const detail = reviewing ? current.detail + ' This is a look back; saved alerts stay unchanged.' : current.detail;
        if (find('result').textContent !== result) find('result').textContent = result;
        if (find('detail').textContent !== detail) find('detail').textContent = detail;
        find('market').textContent = current.fixture.marketOpen ? 'Wednesday · market open' : 'Saturday · market closed';
        find('clock').textContent = `${current.fixture.marketOpen ? '08' : '11'} Jul 2026 · 16:00 UTC`;
        find('integrity').textContent = !current.fixture.marketOpen ? 'Not checked · market closed' : freshMidpoint(current.fixture) === null ? 'Price unavailable' : 'Recent quotes · in sync';
        gateElements.forEach((element, i) => {
            const name = element.dataset.fxGate;
            const failed = current.terminal && current.outcome !== 'success' && current.gate === name;
            const passed = current.passed.includes(name);
            element.dataset.status = failed ? 'blocked' : passed ? 'passed' : current.gate === name ? 'active' : 'waiting';
            element.querySelector('[data-fx-mark]').textContent = failed ? '×' : passed ? '✓' : String(i + 1);
            if (current.gate === name) element.setAttribute('aria-current', 'step'); else element.removeAttribute('aria-current');
        });
        find('output').textContent = current.sent ? '✓ Alert recorded (demo)' : current.terminal ? 'No new alert recorded' : current.candidate ? 'Price move found · checking alert history' : 'No alert recorded in this run';
        find('log-line').textContent = `${state.logs.length} alert${state.logs.length === 1 ? '' : 's'} in the demo log`;
        find('ledger-status').textContent = state.committed ? 'updated' : 'unchanged';
        find('memory').textContent = state.ledger[FX.key] ? 'An earlier alert is saved here to avoid repeats or alerts too close together.' : 'No earlier alert saved.';
        find('play').textContent = running ? 'Pause' : reviewing ? 'Continue from latest' : state.terminal ? 'Signal complete' : state.stage ? 'Continue' : 'Run signal';
        find('play').setAttribute('aria-disabled', String(state.terminal && !reviewing));
        find('previous').setAttribute('aria-disabled', String(review === 0));
        find('next').setAttribute('aria-disabled', String(!reviewing && state.terminal));
        find('chart-desc').textContent = `Fictional EUR/USD samples. Previous completed daily close 1.1000; +0.50% trigger 1.1055. ${current.title}. ${current.detail}`;
        layout();
    }
    function pause() {
        running = false;
        if (frame !== null) window.cancelAnimationFrame(frame);
        frame = null; lastTime = null;
        find('play').textContent = state.terminal ? 'Signal complete' : state.stage ? 'Continue' : 'Run signal';
        root.dataset.running = 'false';
    }
    function step() {
        if (review < history.length - 1) { review++; show(); return; }
        if (state.terminal) return;
        state = advanceFx(state); history.push(state); review++;
        elapsed = 0; lastTime = null; progress = running && !motion.matches ? 0 : 1; show();
    }
    function tick(time) {
        frame = null;
        if (!running || !allowed()) { pause(); return; }
        if (lastTime !== null) elapsed += Math.min(80, time - lastTime);
        lastTime = time;
        progress = Math.min(1, elapsed / duration(state));
        if (!motion.matches) paint(progress);
        if (elapsed >= duration(state)) {
            if (state.terminal) { pause(); show(); return; }
            step();
        }
        frame = window.requestAnimationFrame(tick);
    }
    function run() {
        visible = measureVisible();
        if (!allowed()) return;
        review = history.length - 1;
        if (state.terminal) { show(); return; }
        running = true;
        if (!state.stage || progress === 1) step();
        show(); frame = window.requestAnimationFrame(tick);
    }
    function reset(nextState, label) {
        pause(); state = nextState; history = [state]; review = 0; elapsed = 0; progress = 1;
        find('confirm').hidden = true;
        if (label) find('fixture').textContent = label;
        show();
    }
    find('play').addEventListener('click', () => { engage(); if (running) pause(); else run(); });
    find('next').addEventListener('click', () => { engage(); pause(); step(); });
    find('previous').addEventListener('click', () => { engage(); pause(); review = Math.max(0, review - 1); show(); });
    find('replay').addEventListener('click', () => { engage(); reset(replayFx(state), 'The same prices are ready to try again. Earlier alerts are still remembered.'); });
    find('scenario').addEventListener('change', () => {
        engage(); const name = find('scenario').value;
        reset(createFxState(name), 'Each example starts with its own demo alert history.');
    });
    find('reset').addEventListener('click', () => { engage(); pause(); find('confirm').hidden = false; find('confirm-reset').focus(); });
    find('cancel-reset').addEventListener('click', () => { find('confirm').hidden = true; find('reset').focus(); });
    find('confirm-reset').addEventListener('click', () => {
        engage(); find('scenario').value = 'valid';
        reset(createFxState(), 'Demo history cleared. You can try the price rise again.'); find('reset').focus();
    });
    slide.addEventListener('featured:deactivate', pause);
    slide.addEventListener('featured:activate', () => { pause(); show(); });
    slide.addEventListener('journey:preview', () => reset(replayFx(state), 'Preview paused. Earlier demo alerts are still remembered.'));
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    motion.addEventListener('change', () => { pause(); show(); }); narrow.addEventListener('change', layout);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting || measureVisible(); if (!visible) pause();
    }).observe(root);
    if ('ResizeObserver' in window) new window.ResizeObserver(layout).observe(find('chart'));
    show(); root.dataset.ready = 'true'; find('controls').hidden = false;
}
