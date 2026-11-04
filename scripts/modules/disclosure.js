// Small, reversible enhancement. Static HTML remains readable without JavaScript.
export function createDisclosure(panel, { expanded = false, onChange = () => {},
    onSettled = () => {}, beforeCollapse = () => {} } = {}) {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation;

    panel.classList.add('disclosure-panel');
    const syncVisibility = () => {
        panel.hidden = !expanded;
        panel.inert = !expanded;
        if (expanded) panel.removeAttribute('aria-hidden');
        else panel.setAttribute('aria-hidden', 'true');
    };
    const cancel = () => {
        if (!animation) return;
        animation.onfinish = null;
        animation.cancel();
        animation = undefined;
    };
    const settle = () => {
        cancel();
        panel.classList.remove('is-animating');
        syncVisibility();
        onSettled(expanded);
    };

    // Initialization never animates.
    syncVisibility();
    const setExpanded = (next, { immediate = false } = {}) => {
        if (next === expanded) {
            if (immediate) settle();
            return;
        }
        if (!next) beforeCollapse();
        const visible = !panel.hidden;
        const start = visible ? panel.getBoundingClientRect().height : 0;
        const style = visible ? getComputedStyle(panel) : null;
        const opacity = style?.opacity ?? '0';
        const margin = style?.marginTop ?? '0px';
        cancel();
        expanded = next;
        panel.hidden = false;
        panel.inert = !expanded;
        if (expanded) panel.removeAttribute('aria-hidden');
        else panel.setAttribute('aria-hidden', 'true');
        // Inform consumers after visibility/inert state is set (including 3D viewers).
        onChange(expanded);

        if (immediate || motion.matches || typeof panel.animate !== 'function') {
            settle();
            return;
        }

        // Read the natural endpoint once, after cancelling the previous animation.
        // No fixed height survives completion; wrapped/async content can grow freely.
        const end = expanded ? panel.getBoundingClientRect().height : 0;
        const endMargin = expanded ? getComputedStyle(panel).marginTop : '0px';
        panel.classList.add('is-animating');
        const current = panel.animate([
            { height: start + 'px', opacity, marginTop: margin },
            { height: end + 'px', opacity: expanded ? '1' : '0', marginTop: endMargin }
        ], { duration: 240, easing: 'ease-in-out', fill: 'both' });
        animation = current;
        current.onfinish = () => {
            if (animation === current) settle();
        };
    };
    // Reflow or a changed preference must not leave a stale measured height.
    window.addEventListener('resize', () => { if (animation) settle(); });
    document.fonts?.addEventListener('loadingdone', () => { if (animation) settle(); });
    motion.addEventListener('change', () => { if (motion.matches && animation) settle(); });

    return { get expanded() { return expanded; }, setExpanded };
}

// Resolve IDs without treating a fragment as a CSS selector.
export function fragmentTarget() {
    try { return document.getElementById(decodeURIComponent(window.location.hash.slice(1))); }
    catch { return null; }
}

export function revealFragment(panel, disclosure) {
    const reveal = (scroll) => {
        const target = fragmentTarget();
        if (!target || !panel.contains(target)) return;
        disclosure.setExpanded(true, { immediate: true });
        if (scroll) target.scrollIntoView({ block: 'start', behavior: 'instant' });
    };
    reveal(false);
    window.addEventListener('hashchange', () => reveal(true));
}
