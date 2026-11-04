export function initSectionObservers() {
    if (!('IntersectionObserver' in window)) return;
    initScrollSpy();

}

function initScrollSpy() {
    const links = [...document.querySelectorAll('#menu a[href^="#"]')];
    const sections = links
        .map((anchor) => document.querySelector(anchor.getAttribute('href')))
        .filter(Boolean);
    const home = document.getElementById('home');
    if (home) sections.push(home);

    if (!sections.length) return;

    const spy = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                const id = `#${entry.target.id}`;
                const link = links.find((anchor) => anchor.getAttribute('href') === id);
                if (!entry.isIntersecting) return;
                if (id === '#home') {
                    links.forEach(anchor => { anchor.classList.remove('active'); anchor.removeAttribute('aria-current'); });
                    return;
                }
                if (!link) return;
                links.forEach((anchor) => { anchor.classList.remove('active'); anchor.removeAttribute('aria-current'); });
                link.classList.add('active');
                link.setAttribute('aria-current', 'location');
            });
        },
        { rootMargin: '-45% 0px -45% 0px', threshold: 0.01 }
    );

    sections.forEach((section) => spy.observe(section));
}

