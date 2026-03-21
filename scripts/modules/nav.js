const compactQuery = window.matchMedia('(max-width: 768px)');

function isCompactLayout() {
    return compactQuery.matches;
}

export function initNav() {
    const navToggle = document.getElementById('navToggle');
    const menuEl = document.getElementById('menu');
    const headerEl = document.querySelector('.header');
    const contactItem = document.querySelector('.menu .has-sub');

    if (!navToggle || !menuEl) return;

    const setMenuOpen = (open) => {
        menuEl.classList.toggle('open', open);
        navToggle.setAttribute('aria-expanded', String(open));
        headerEl?.classList.toggle('menu-open', open);
    };

    navToggle.addEventListener('click', () => {
        setMenuOpen(!menuEl.classList.contains('open'));
    });

    menuEl.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link && isCompactLayout()) {
            setMenuOpen(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setMenuOpen(false);
        }
    });

    if (contactItem) {
        const trigger = contactItem.querySelector('a[href="#contact"]');
        const setExpanded = (open) => trigger?.setAttribute('aria-expanded', String(open));

        contactItem.addEventListener('mouseenter', () => {
            if (!isCompactLayout()) setExpanded(true);
        });
        contactItem.addEventListener('mouseleave', () => setExpanded(false));
        contactItem.addEventListener('focusin', () => setExpanded(true));
        contactItem.addEventListener('focusout', () => {
            window.requestAnimationFrame(() => {
                if (!contactItem.contains(document.activeElement)) setExpanded(false);
            });
        });
    }

    const handleCompactChange = () => {
        if (!isCompactLayout()) {
            setMenuOpen(false);
        }
    };

    if (typeof compactQuery.addEventListener === 'function') {
        compactQuery.addEventListener('change', handleCompactChange);
    } else if (typeof compactQuery.addListener === 'function') {
        compactQuery.addListener(handleCompactChange);
    }
}
