// Deterministic local illustration. No extension, network or media APIs.
export const EXAMPLES = ['start', 'break', 'pause', 'ad', 'disconnected'];
export function createPomodoroState(example = 'start') {
    if (!EXAMPLES.includes(example)) throw new Error('Unknown PomodoroYT example');
    return { example, stage: 0, connected: example !== 'disconnected', mode: 'focus',
        status: ['break', 'pause', 'ad'].includes(example) ? 'running' : 'idle',
        remaining: example === 'break' ? 3000 : 1500000, videoTime: 0, ad: false, volume: 60, savedVolume: 60, elapsed: 0 };
}
export function pomodoroPlayback(state) {
    return state.connected && state.status === 'running' && state.mode === 'focus' ? 'play' : 'pause';
}
export function nextPomodoroMoment(state, action = 'next') {
    const s = { ...state, elapsed: 0 };
    if (s.example === 'disconnected') {
        if (!s.connected) return action === 'connect' ? { ...s, connected: true, stage: 1 } : state;
        return s.stage === 1 ? { ...s, stage: 2, status: 'running' } : state;
    }
    if (s.example === 'start') return s.stage === 0 ? { ...s, stage: 1, status: 'running' } : state;
    if (s.example === 'break') {
        if (s.stage === 0) return { ...s, stage: 1, status: 'countdown', remaining: 5000 };
        return s.stage === 1 ? { ...s, stage: 2, mode: 'shortBreak', status: 'running', remaining: 300000 } : state;
    }
    if (s.example === 'pause') {
        if (s.stage === 0) return { ...s, stage: 1, status: 'paused' };
        return s.stage === 1 ? { ...s, stage: 2, status: 'running' } : state;
    }
    if (s.stage === 0) return { ...s, stage: 1, ad: true, volume: 0, savedVolume: s.volume };
    return s.stage === 1 ? { ...s, stage: 2, ad: false, volume: s.savedVolume } : state;
}
export function tickPomodoro(state, milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0 || !['running', 'countdown'].includes(state.status)) return state;
    const s = { ...state, elapsed: state.elapsed + milliseconds,
        remaining: Math.max(0, state.remaining - milliseconds),
        videoTime: state.videoTime + (pomodoroPlayback(state) === 'play' ? milliseconds / 1000 : 0) };
    // Boundaries always show the full preparation and break, even on large injected ticks.
    if (!s.remaining && state.status === 'countdown') return { ...s, stage: s.stage + 1, mode: 'shortBreak', status: 'running', remaining: 300000, elapsed: 0 };
    if (!s.remaining && state.mode === 'focus') return { ...s, stage: s.stage + 1, status: 'countdown', remaining: 5000, elapsed: 0 };
    if (!s.remaining) return { ...s, status: 'paused' };
    if (state.example === 'ad' && state.stage < 2 && s.elapsed >= 4000) return nextPomodoroMoment(s);
    if (state.example === 'pause' && state.stage === 0 && s.elapsed >= 4000) return nextPomodoroMoment(s);
    return s;
}
export function togglePomodoroSession(state) {
    if (!state.connected || state.status === 'countdown') return state;
    return { ...state, status: state.status === 'running' ? 'paused' : 'running' };
}
export function pomodoroOutcome(s) {
    if (!s.connected) return ['Choose a YouTube tab first.', 'Connect the example tab to make Start focus available.'];
    if (s.status === 'countdown') return ['Focus finished. Video paused.', 'Five seconds to settle in, then your short break begins.'];
    if (s.mode === 'shortBreak') return ['Break started. Video paused.', 'Take five minutes. Your chosen video stays paused.'];
    if (s.status === 'paused') return ['Session paused. Video paused.', 'Your timer and selected video wait for you to resume.'];
    if (s.ad) return ['An ad started. Sound muted.', 'The illustrative ad keeps playing, with its sound turned off.'];
    if (s.example === 'ad' && s.stage === 2) return ['Ad finished. Sound restored.', `The previous ${s.volume}% volume returns. The ad was not skipped.`];
    if (s.status === 'running') return ['Focus started. Video playing.', 'Playback requested for your chosen tab. Successful playback is simulated.'];
    if (s.example === 'disconnected') return ['Video connected. Ready to focus.', 'Only this YouTube tab will receive playback requests.'];
    return ['Ready to focus?', 'Start the timer and watch the selected video respond.'];
}
export function formatPomodoroTime(milliseconds) {
    const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function initPomodoroytJourney() {
    const root = document.querySelector('[data-pomodoroyt-journey]');
    if (!root || root.dataset.ready) return;
    const find = name => root.querySelector(`[data-py-${name}]`);
    const slide = root.closest('.featured-slide');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let state = createPomodoroState();
    let history = [state], review = 0, running = false, started = false, frame = null, lastTime = null;
    const visible = () => { const b = root.getBoundingClientRect(); return b.bottom > 0 && b.top < window.innerHeight; };
    const allowed = () => !document.hidden && slide.classList.contains('is-active') && visible();
    const engage = () => root.dispatchEvent(new CustomEvent('journey:interact', { bubbles: true }));
    const historical = () => review < history.length - 1;
    function record(updated) {
        if (updated === state) return;
        state = updated; history.push(state); review = history.length - 1;
    }
    function render() {
        const s = historical() ? history[review] : state;
        const playing = pomodoroPlayback(s) === 'play';
        const [title, message] = pomodoroOutcome(s);
        root.dataset.stage = String(s.stage); root.dataset.running = String(running);
        root.dataset.playback = playing ? 'playing' : 'paused'; root.dataset.scenario = s.example;
        find('connection').textContent = s.connected ? 'Connected' : 'Not connected';
        find('connection').dataset.connected = String(s.connected);
        find('video').textContent = playing ? 'Playing' : 'Paused';
        find('play-icon').setAttribute('d', playing ? 'M7 5h3v14H7zM14 5h3v14h-3z' : 'm8 5 11 7-11 7z');
        find('video-time').textContent = formatPomodoroTime(s.videoTime * 1000);
        find('volume').textContent = s.ad ? 'Muted' : `Sound ${s.volume}%`;
        find('ad').hidden = !s.ad;
        find('player').dataset.ad = String(s.ad);
        find('progress').style.setProperty('--py-progress', `${Math.min(98, 12 + (motion.matches ? Math.floor(s.videoTime) : s.videoTime) / 3)}%`);
        find('phase').textContent = s.status === 'countdown' ? 'Switching to break' : s.mode === 'shortBreak' ? 'Short break' : 'Focus';
        find('time').textContent = formatPomodoroTime(s.remaining);
        find('session-status').textContent = s.status === 'idle' ? 'Ready when you are' : s.status === 'countdown' ? 'Video stays paused' : s.status === 'paused' ? 'Session paused' : 'Session running';
        const total = s.status === 'countdown' ? 5000 : s.mode === 'shortBreak' ? 300000 : 1500000;
        find('ring').style.strokeDasharray = `${100 * (motion.matches ? Math.ceil(s.remaining / 1000) * 1000 : s.remaining) / total} 100`;
        find('ring').dataset.phase = s.status === 'countdown' || s.mode === 'shortBreak' ? 'break' : 'focus';
        find('session').textContent = s.status === 'running' ? 'Pause session' : s.status === 'paused' ? 'Resume session' : s.status === 'countdown' ? 'Preparing your break' : 'Start focus';
        find('session').disabled = !s.connected || s.status === 'countdown' || historical();
        find('connect').hidden = s.connected;
        find('connect').disabled = historical();
        find('command').textContent = !s.connected ? 'Choose a YouTube tab first.' : s.status === 'idle' ? 'Choose when to begin.' : playing ? 'Timer → chosen tab: play' : 'Timer → chosen tab: pause';
        find('cue').textContent = s.ad ? 'Ad detected → sound muted' : s.stage || s.status === 'running' ? playing ? 'Chosen video received play request' : 'Chosen video received pause request' : 'One timer. One chosen video.';
        find('timeline-status').textContent = historical() ? 'Read-only snapshot' : running ? 'Demo running · 2× time' : started ? 'Timeline paused' : 'Static preview';
        // Only semantic transitions touch the live region, never timer ticks.
        if (find('outcome').textContent !== title) find('outcome').textContent = title;
        if (find('message').textContent !== message) find('message').textContent = message;
        find('play').textContent = running ? 'Pause' : historical() || started ? 'Continue' : 'Watch it work';
        find('play').disabled = !state.connected;
        find('previous').setAttribute('aria-disabled', String(review === 0));
        find('next').setAttribute('aria-disabled', String(!historical() && nextPomodoroMoment(state) === state));
        find('history').hidden = !historical();
        find('example-note').textContent = s.example === 'break' ? 'Fast-forwarded to the end of focus.' : 'All playback and sound changes are simulated.';
    }
    function pause() {
        running = false; window.cancelAnimationFrame(frame); frame = null; lastTime = null; render();
    }
    function tick(now) {
        if (!running || !allowed()) { pause(); return; }
        if (lastTime !== null) {
            const updated = tickPomodoro(state, Math.min(100, now - lastTime) * 2);
            if (updated.stage !== state.stage) record(updated);
            else { state = updated; history[history.length - 1] = state; }
            if (state.status === 'paused') { pause(); return; }
        }
        lastTime = now; render(); frame = window.requestAnimationFrame(tick);
    }
    function run() {
        if (!allowed() || !state.connected) return;
        review = history.length - 1; started = true;
        if (state.status === 'idle') record(nextPomodoroMoment(state));
        else if (state.status === 'paused') record(state.example === 'pause' && state.stage === 1 ? nextPomodoroMoment(state) : togglePomodoroSession(state));
        running = true; lastTime = null; render(); frame = window.requestAnimationFrame(tick);
    }
    function reset() {
        pause(); state = createPomodoroState(find('scenario').value); history = [state]; review = 0; started = false; render();
    }
    find('play').addEventListener('click', () => { engage(); if (running) pause(); else run(); });
    find('next').addEventListener('click', () => { engage(); pause(); if (historical()) review++; else record(nextPomodoroMoment(state)); started = true; render(); });
    find('previous').addEventListener('click', () => { engage(); pause(); review = Math.max(0, review - 1); render(); });
    find('replay').addEventListener('click', () => { engage(); reset(); });
    find('scenario').addEventListener('change', () => { engage(); reset(); });
    find('connect').addEventListener('click', () => { engage(); pause(); record(nextPomodoroMoment(state, 'connect')); render(); find('session').focus({ preventScroll: true }); });
    find('session').addEventListener('click', () => {
        engage(); pause();
        if (state.example === 'pause' && state.stage < 2) record(nextPomodoroMoment(state));
        else if (state.status === 'idle') record(nextPomodoroMoment(state));
        else record(togglePomodoroSession(state));
        started = true; render(); if (state.status === 'running') run();
    });
    slide.addEventListener('featured:deactivate', pause);
    slide.addEventListener('featured:activate', pause);
    slide.addEventListener('journey:preview', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    motion.addEventListener('change', pause);
    if ('IntersectionObserver' in window) new IntersectionObserver(() => { if (!visible()) pause(); }).observe(root);
    render(); root.dataset.ready = 'true'; find('controls').hidden = false; find('session-controls').hidden = false;
}
