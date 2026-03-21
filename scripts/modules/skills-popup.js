const compactQuery = window.matchMedia('(max-width: 768px)');
const hoverCapableQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

function usesTouchStyleSkills() {
    return compactQuery.matches || !hoverCapableQuery.matches;
}

export function initSkillsPopups() {
    const skillCards = [...document.querySelectorAll('.skill--has-popup')];

    const closeAllSkillPopups = (exceptCard = null) => {
        skillCards.forEach((card) => {
            if (card === exceptCard) return;
            card.classList.remove('is-open');
            card.setAttribute('aria-expanded', 'false');
        });
    };

    const toggleSkillPopup = (card, forceOpen) => {
        const nextState = typeof forceOpen === 'boolean' ? forceOpen : !card.classList.contains('is-open');
        closeAllSkillPopups(nextState ? card : null);
        card.classList.toggle('is-open', nextState);
        card.setAttribute('aria-expanded', String(nextState));
    };

    skillCards.forEach((card, index) => {
        const popup = card.querySelector('.skill-popup');
        if (!popup) return;

        const popupId = popup.id || `skill-popup-${index + 1}`;
        popup.id = popupId;
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-label', `${card.querySelector('h4')?.textContent || 'Skill'} details`);
        card.setAttribute('aria-controls', popupId);

        card.addEventListener('click', (event) => {
            const clickedLink = event.target.closest('.skill-popup a');
            if (clickedLink || !usesTouchStyleSkills()) return;
            event.preventDefault();
            toggleSkillPopup(card);
        });

        card.addEventListener('keydown', (event) => {
            if ((event.key === 'Enter' || event.key === ' ') && usesTouchStyleSkills()) {
                event.preventDefault();
                toggleSkillPopup(card);
            }

            if (event.key === 'Escape') {
                toggleSkillPopup(card, false);
                card.blur();
            }
        });

        card.addEventListener('focusout', (event) => {
            if (usesTouchStyleSkills()) return;
            const nextTarget = event.relatedTarget;
            if (!nextTarget || !card.contains(nextTarget)) {
                toggleSkillPopup(card, false);
            }
        });
    });

    document.addEventListener('click', (event) => {
        if (!usesTouchStyleSkills()) return;
        if (!event.target.closest('.skill--has-popup')) {
            closeAllSkillPopups();
        }
    });

    document.addEventListener('focusin', (event) => {
        if (!usesTouchStyleSkills()) return;
        if (!event.target.closest('.skill--has-popup')) {
            closeAllSkillPopups();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeAllSkillPopups();
        }
    });

    const handleModeChange = () => closeAllSkillPopups();

    [compactQuery, hoverCapableQuery].forEach((query) => {
        if (typeof query.addEventListener === 'function') {
            query.addEventListener('change', handleModeChange);
        } else if (typeof query.addListener === 'function') {
            query.addListener(handleModeChange);
        }
    });
}

