import { createDisclosure, revealFragment } from './disclosure.js';

// Scoped to native project disclosures; no content or controls are synthesized.
export function initProjectCaseStudies() {
    document.querySelectorAll('details.project-case-study').forEach(details => {
        const summary = details.querySelector(':scope > summary');
        if (!summary || details.dataset.disclosureReady) return;
        details.dataset.disclosureReady = 'true';
        const content = document.createElement('div');
        content.className = 'project-case-study-content';
        for (const child of [...details.childNodes]) {
            if (child !== summary) content.append(child);
        }
        details.append(content);
        let nativeOpen = details.open;
        const setNativeOpen = (value) => { nativeOpen = details.open = value; };
        const disclosure = createDisclosure(content, {
            expanded: details.open,
            onChange: expanded => {
                details.dataset.expanded = String(expanded);
                if (expanded) setNativeOpen(true);
            },
            onSettled: expanded => setNativeOpen(expanded),
            beforeCollapse: () => {
                if (content.contains(document.activeElement)) summary.focus({ preventScroll: true });
            }
        });
        details.dataset.expanded = String(disclosure.expanded);
        summary.addEventListener('click', event => {
            // Genuine links/controls inside a summary retain their action.
            if (event.target.closest('a, button, input, select, textarea')) return;
            event.preventDefault();
            disclosure.setExpanded(!disclosure.expanded);
        });
        // Native fragment navigation and assistive-technology toggles still work.
        details.addEventListener('toggle', () => {
            if (details.open !== nativeOpen) {
                nativeOpen = details.open;
                disclosure.setExpanded(nativeOpen, { immediate: true });
            }
        });
        revealFragment(content, disclosure);
    });
}
