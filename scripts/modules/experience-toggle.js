export function initExperienceToggles() {
    const toggles = [...document.querySelectorAll('.xp-toggle')];

    toggles.forEach((button) => {
        button.addEventListener('click', () => {
            const details = button.nextElementSibling;
            if (!details || !details.classList.contains('xp-details')) return;

            const isHidden = details.hasAttribute('hidden');

            if (isHidden) {
                details.removeAttribute('hidden');
                button.textContent = 'Show Less';
                button.setAttribute('aria-expanded', 'true');
            } else {
                details.setAttribute('hidden', '');
                button.textContent = 'Show Details';
                button.setAttribute('aria-expanded', 'false');
            }
        });
    });
}



