export function initSectionObservers() {
    initScrollSpy();
    initRevealAnimations();
}

function initScrollSpy() {
    const links = [...document.querySelectorAll('#menu a[href^="#"]')];
    const sections = links
        .map((anchor) => document.querySelector(anchor.getAttribute('href')))
        .filter(Boolean);

    if (!sections.length) return;

    const spy = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                const id = `#${entry.target.id}`;
                const link = links.find((anchor) => anchor.getAttribute('href') === id);
                if (!link || !entry.isIntersecting) return;
                links.forEach((anchor) => anchor.classList.remove('active'));
                link.classList.add('active');
            });
        },
        { rootMargin: '-45% 0px -45% 0px', threshold: 0.01 }
    );

    sections.forEach((section) => spy.observe(section));
}

function initRevealAnimations() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        document.querySelectorAll('.observe').forEach((element) => {
            element.setAttribute('data-inview', 'true');
        });
        return;
    }

    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.setAttribute('data-inview', 'true');
                revealObserver.unobserve(entry.target);
            });
        },
        { threshold: 0.12 }
    );

    document.querySelectorAll('.observe').forEach((element) => revealObserver.observe(element));
}
