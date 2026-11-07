// The HTML is the content source and the no-JavaScript explanation.
// This controller only selects a stage; it never calls project services.
export function initFeaturedJourneys() {
    document.querySelectorAll('[data-journey]').forEach(journey => {
        if (journey.dataset.ready) return;
        const steps = [...journey.querySelectorAll('[data-journey-step]')];
        const nodes = [...journey.querySelectorAll('[data-journey-node]')];
        const previous = journey.querySelector('[data-journey-previous]');
        const next = journey.querySelector('[data-journey-next]');
        const replay = journey.querySelector('[data-journey-replay]');
        const count = journey.querySelector('[data-journey-count]');
        const inspector = journey.querySelector('[data-journey-inspector]');
        let current = 0;

        function show(index, announce = false) {
            current = Math.max(0, Math.min(index, steps.length - 1));
            inspector.setAttribute('aria-live', announce ? 'polite' : 'off');
            steps.forEach((step, i) => { step.hidden = i !== current; });
            nodes.forEach(node => {
                const active = Number(node.dataset.journeyNode) === current;
                node.classList.toggle('is-current', active);
                if (active) node.setAttribute('aria-current', 'step');
                else node.removeAttribute('aria-current');
            });
            count.textContent = 'Step ' + (current + 1) + ' / ' + steps.length;
            // Keep focus on the control at the endpoints for keyboard users.
            previous.setAttribute('aria-disabled', String(current === 0));
            next.setAttribute('aria-disabled', String(current === steps.length - 1));
            if (announce) journey.dispatchEvent(new CustomEvent('journey:interact', { bubbles: true }));
        }

        previous.addEventListener('click', () => show(current - 1, true));
        next.addEventListener('click', () => show(current + 1, true));
        replay.addEventListener('click', () => show(0, true));
        journey.closest('.featured-slide').addEventListener('featured:activate', () => show(0));
        show(0);
        journey.dataset.ready = 'true';
        journey.querySelector('[data-journey-controls]').hidden = false;
    });
}
