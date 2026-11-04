import { createDisclosure, fragmentTarget, revealFragment } from './disclosure.js';

export function initExperienceToggles() {
    document.querySelectorAll('.xp-toggle').forEach((button, index) => {
        const details = button.nextElementSibling;
        if (!details?.classList.contains('xp-details') || button.dataset.disclosureReady) return;
        button.dataset.disclosureReady = 'true';
        details.id ||= 'experience-details-' + (index + 1);
        button.setAttribute('aria-controls', details.id);
        const render = (expanded) => {
            button.textContent = expanded ? 'Show Less' : 'Show Details';
            button.setAttribute('aria-expanded', String(expanded));
        };
        const disclosure = createDisclosure(details, {
            expanded: details.contains(fragmentTarget()),
            onChange: render,
            beforeCollapse: () => {
                if (details.contains(document.activeElement)) button.focus({ preventScroll: true });
            }
        });
        render(disclosure.expanded);
        button.hidden = false;
        button.addEventListener('click', () => disclosure.setExpanded(!disclosure.expanded));
        revealFragment(details, disclosure);
    });
}
