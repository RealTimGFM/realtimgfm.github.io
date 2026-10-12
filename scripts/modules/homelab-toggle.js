export function initHomelabToggle() {
    const toggle = document.getElementById('homelabToggle');
    const collapse = document.getElementById('homelabCollapse');
    const details = document.getElementById('homelabDetails');

    if (!toggle || !collapse || !details) return;

    const setExpanded = (expanded) => {
        details.hidden = !expanded;
        toggle.setAttribute('aria-expanded', String(expanded));
        collapse.setAttribute('aria-expanded', String(expanded));
        toggle.textContent = expanded ? 'Show Less' : 'Explore Home Lab';
        if (expanded) details.dispatchEvent(new Event('homelab:expanded'));
    };

    toggle.addEventListener('click', () => setExpanded(details.hidden));
    collapse.addEventListener('click', () => {
        setExpanded(false);
        toggle.focus({ preventScroll: true });
        toggle.scrollIntoView({ block: 'center', behavior: 'instant' });
    });

    setExpanded(false);
    toggle.hidden = false;
    collapse.hidden = false;
}
