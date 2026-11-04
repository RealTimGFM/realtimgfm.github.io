import { createDisclosure, fragmentTarget, revealFragment } from './disclosure.js';

export function initHomelabToggle() {
    const toggle = document.getElementById('homelabToggle');
    const collapse = document.getElementById('homelabCollapse');
    const details = document.getElementById('homelabDetails');

    if (!toggle || !collapse || !details || toggle.dataset.disclosureReady) return;
    toggle.dataset.disclosureReady = 'true';
    const render = (expanded) => {
        toggle.setAttribute('aria-expanded', String(expanded));
        collapse.setAttribute('aria-expanded', String(expanded));
        toggle.textContent = expanded ? 'Show Less' : 'Explore Home Lab';
        details.dispatchEvent(new Event(expanded ? 'homelab:expanded' : 'homelab:collapsed'));
    };
    const restoreFocus = (force = false) => {
        if (!force && !details.contains(document.activeElement)) return;
        toggle.focus({ preventScroll: true });
        const bounds = toggle.getBoundingClientRect();
        // Only move the viewport when the bottom control would disappear
        // with its owner offscreen. Top-toggle activation does not scroll.
        if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
            toggle.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        }
    };
    const disclosure = createDisclosure(details, {
        expanded: details.contains(fragmentTarget()),
        onChange: render,
        beforeCollapse: () => restoreFocus()
    });
    render(disclosure.expanded);
    toggle.addEventListener('click', () => disclosure.setExpanded(!disclosure.expanded));
    collapse.addEventListener('click', () => {
        restoreFocus(true);
        disclosure.setExpanded(false);
    });
    toggle.hidden = false;
    collapse.hidden = false;
    revealFragment(details, disclosure);
}
