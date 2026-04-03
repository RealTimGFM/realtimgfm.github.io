export function initProjectsToggle() {
    const grid = document.getElementById('projectsGrid');
    const button = document.getElementById('projectsToggle');

    if (!grid || !button) return;

    const cards = [...grid.querySelectorAll('.card')];
    const collapsedCount = 4;
    let isExpanded = false;

    const render = () => {
        cards.forEach((card, index) => {
            const shouldHide = !isExpanded && index >= collapsedCount;

            if (shouldHide) {
                card.setAttribute('hidden', '');
            } else {
                card.removeAttribute('hidden');
            }
        });

        button.textContent = isExpanded ? 'See Less' : 'See More Projects';
        button.setAttribute('aria-expanded', String(isExpanded));
    };

    if (cards.length <= collapsedCount) {
        button.hidden = true;
        return;
    }

    button.hidden = false;
    render();

    button.addEventListener('click', () => {
        isExpanded = !isExpanded;
        render();
    });
}
