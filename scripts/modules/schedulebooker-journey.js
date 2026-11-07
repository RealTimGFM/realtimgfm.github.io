// Deterministic offline fixture: one barber, adjacent 30-minute appointments.
// Only a final check inside an owned transaction may append a record.
export function createBookingState(scenario = 'race') {
    return { scenario: scenario === 'single' ? 'single' : 'race', stage: 0, records: [], lock: null };
}

export function advanceBooking(state, action = 'next') {
    const { stage, scenario } = state;
    if (action === 'recover') return scenario === 'race' && stage === 5 ? { ...state, stage: 6 } : state;
    if (action !== 'next' || stage === 5 || stage === 8 || (scenario === 'single' && stage === 3)) return state;
    const next = { ...state, stage: stage + 1 };
    if (next.stage === 2) next.lock = 'A';
    if (next.stage === 4 || next.stage === 7) next.lock = 'B';
    if (next.stage === 3 || next.stage === 8) {
        const time = next.stage === 3 ? '14:00' : '14:30';
        const customer = next.stage === 3 ? 'A' : 'B';
        if (state.lock !== customer || state.records.some(record => record.time === time)) return state;
        next.records = [...state.records, { customer, time, duration: 30 }];
        next.lock = null;
    }
    // B's 2:00 check fails. Roll back and release; no receipt or record.
    if (next.stage === 5) {
        if (state.lock !== 'B' || !state.records.some(record => record.time === '14:00')) return state;
        next.lock = null;
    }
    return next;
}

export function bookingView(state) {
    const single = state.scenario === 'single';
    const stories = [
        [single ? 'Customer A sees 2:00 PM available' : 'Both see 2:00 PM available', single ? 'Customer A picked Friday at 2:00 PM.' : 'Both customers picked Friday at 2:00 PM.'],
        [single ? 'Customer A sends a booking request' : 'Two requests, the same appointment', single ? 'Choosing a time did not reserve it.' : 'Both try to book the same time. Choosing it did not reserve it.'],
        ['Only one booking can be saved at a time', single ? 'A checks the time again before saving.' : 'A checks the time again. B waits for A to finish.'],
        ['Customer A books 2:00 PM', single ? 'The final check passed. One appointment is saved.' : 'One appointment is saved. The lock opens before B checks.'],
        ['Customer B checks again', 'B gets a turn to check. The calendar now shows 2:00 PM taken.'],
        ['2:00 PM was just booked', 'A is confirmed. B must choose another time.'],
        ['Customer B tries 2:30 PM', 'A new request, for a different appointment.'],
        ['Check the new time before saving', 'B holds the lock. 2:30 PM is still available.'],
        ['Customer B books 2:30 PM', 'Two customers, two different appointments. No double-booking.']
    ];
    return { title: stories[state.stage][0], message: stories[state.stage][1],
        terminal: state.stage === 5 || state.stage === 8 || (single && state.stage === 3) };
}

export function initSchedulebookerJourney() {
    const root = document.querySelector('[data-schedulebooker-journey]');
    if (!root || root.dataset.ready) return;
    const find = name => root.querySelector(`[data-sb-${name}]`);
    const slide = root.closest('.featured-slide');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let state = createBookingState();
    let history = [state];
    let review = 0;
    let running = false;
    let frame = null;
    let elapsed = 0;
    let lastTime = null;
    const engage = () => root.dispatchEvent(new CustomEvent('journey:interact', { bubbles: true }));
    const visible = () => {
        const rect = root.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    };
    const allowed = () => !document.hidden && slide.classList.contains('is-active') && visible();
    const timeLabel = time => time === '14:00' ? '2:00 PM' : '2:30 PM';
    const recordsLabel = records => records.map(record => `${record.customer} · ${timeLabel(record.time)}`).join(' / ') || 'No bookings yet';

    function paint(fraction = 1) {
        const stage = history[review].stage;
        let a = 15, b = 85;
        if (stage === 1) { a = 15 + 24 * fraction; b = 85 - 5 * fraction; }
        if (stage === 2) { a = 39 + 11 * fraction; b = 80; }
        if (stage === 3) b = 80;
        if (stage === 4) b = 80 - 30 * fraction;
        if (stage === 6) b = 85 - 5 * fraction;
        if (stage === 7) b = 80 - 30 * fraction;
        find('ticket-a').style.left = `${a}%`;
        find('ticket-b').style.left = `${b}%`;
    }

    function render() {
        const current = history[review];
        const { stage, records, lock } = current;
        const single = current.scenario === 'single';
        const view = bookingView(current);
        root.dataset.stage = String(stage);
        root.dataset.running = String(running);
        root.dataset.scenario = current.scenario;
        root.dataset.saved = String(state.records.length);
        find('title').textContent = view.title;
        find('message').textContent = view.message;
        const historical = review !== history.length - 1;
        find('history').hidden = !historical;
        find('history').textContent = `Earlier step — read-only snapshot. The current demo still has ${state.records.length} saved appointment${state.records.length === 1 ? '' : 's'}. Next step returns through history.`;
        for (const customer of ['a', 'b']) {
            const record = records.find(record => record.customer === customer.toUpperCase());
            const rejected = customer === 'b' && stage === 5;
            const inactive = customer === 'b' && single;
            const checking = lock === customer.toUpperCase();
            const pending = stage > 0 && !record && !rejected && !inactive;
            find(`receipt-${customer}`).dataset.status = record ? 'confirmed' : rejected ? 'rejected' : checking ? 'checking' : 'ready';
            find(`time-${customer}`).textContent = customer === 'b' && stage >= 6 ? '2:30 PM' : '2:00 PM';
            find(`time-${customer}`).classList.toggle('is-taken', rejected);
            find(`status-${customer}`).textContent = record ? 'Confirmed' : rejected ? 'Choose another time' : inactive ? 'Just browsing' : checking ? 'Checking again' : pending ? 'Waiting' : 'Ready to book';
            find(`detail-${customer}`).textContent = record ? `Friday · ${timeLabel(record.time)}` : rejected ? '2:00 PM was just booked.' : inactive ? 'No request sent' : pending ? 'Request sent · not saved yet' : 'Time looks available';
            find(`mark-${customer}`).setAttribute('d', record ? 'm5 12 4 4L19 6' : rejected ? 'm6 6 12 12M6 18 18 6' : 'M5 12h14');
        }
        for (const [time, name] of [['14:00', 'a'], ['14:30', 'b']]) {
            const record = records.find(record => record.time === time);
            root.querySelector(`[data-sb-slot="${time}"]`).dataset.booked = String(Boolean(record));
            find(`slot-${name}`).textContent = record ? `Booked · ${record.customer}` : 'Available';
        }
        find('ticket-a').hidden = ![1, 2].includes(stage);
        find('ticket-b').hidden = single || ![1, 2, 3, 4, 6, 7].includes(stage);
        find('ticket-b').textContent = `B · ${stage >= 6 ? '2:30' : '2:00'} PM`;
        find('queue').hidden = single || ![2, 3].includes(stage);
        find('records').textContent = recordsLabel(records);
        find('lock').dataset.sbLock = lock ? 'closed' : 'open';
        find('lock-title').textContent = lock ? `${lock} is checking · locked` : stage === 0 ? 'Ready for a booking' : 'Lock released';
        find('lock-detail').textContent = lock ? 'Only this request can save now' : 'Check again, then save';
        find('recover').hidden = single || stage !== 5 || historical;
        find('play').textContent = running ? 'Pause' : historical ? 'Continue' : view.terminal ? 'Watch again' : stage === 0 ? 'See what happens' : 'Continue';
        find('previous').setAttribute('aria-disabled', String(review === 0));
        find('next').setAttribute('aria-disabled', String(!historical && view.terminal));
        paint(running && !motion.matches ? Math.min(1, elapsed / 1500) : 1);
    }
    function pause() {
        running = false;
        window.cancelAnimationFrame(frame); frame = null; lastTime = null;
        root.dataset.running = 'false';
        find('play').textContent = review < history.length - 1 ? 'Continue' : bookingView(state).terminal ? 'Watch again' : state.stage ? 'Continue' : 'See what happens';
    }
    function next() {
        if (review < history.length - 1) { review++; render(); return; }
        const updated = advanceBooking(state);
        if (updated !== state) { state = updated; history.push(state); review++; elapsed = 0; }
        render();
    }
    function tick(now) {
        if (!running || !allowed()) { pause(); return; }
        if (lastTime !== null) elapsed += Math.min(80, now - lastTime);
        lastTime = now;
        if (!motion.matches) paint(Math.min(1, elapsed / 1500));
        if (elapsed >= 1500) {
            next();
            if (bookingView(state).terminal) { pause(); render(); return; }
        }
        frame = window.requestAnimationFrame(tick);
    }
    function run() {
        if (!allowed()) return;
        review = history.length - 1;
        if (!state.stage) next();
        running = true; render(); frame = window.requestAnimationFrame(tick);
    }
    function reset(message) {
        pause(); state = createBookingState(find('scenario').value); history = [state]; review = 0; elapsed = 0;
        find('fixture').textContent = message; render();
    }
    find('play').addEventListener('click', () => {
        engage();
        if (running) { pause(); return; }
        if (bookingView(state).terminal && review === history.length - 1) reset('Watch again cleared this fictional run. No real bookings.');
        run();
    });
    find('next').addEventListener('click', () => { engage(); pause(); next(); });
    find('previous').addEventListener('click', () => { engage(); pause(); review = Math.max(0, review - 1); render(); });
    find('reset').addEventListener('click', () => { engage(); reset('Start over cleared this fictional run. No real bookings.'); });
    find('scenario').addEventListener('change', () => { engage(); reset('New example. Fictional records cleared. No real bookings.'); });
    find('recover').addEventListener('click', () => {
        engage(); pause(); const updated = advanceBooking(state, 'recover');
        if (updated === state) return;
        state = updated; history.push(state); review = history.length - 1; elapsed = 0;
        render(); find('play').focus({ preventScroll: true }); run();
    });
    slide.addEventListener('featured:deactivate', pause);
    slide.addEventListener('featured:activate', pause);
    slide.addEventListener('journey:preview', () => reset('Static preview. Fictional run cleared. No real bookings.'));
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    motion.addEventListener('change', () => { pause(); render(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(() => { if (!visible()) pause(); }).observe(root);
    render(); root.dataset.ready = 'true'; find('controls').hidden = false;
}
