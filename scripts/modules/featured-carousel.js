const ROTATION_DELAY = 3000;

export function initFeaturedCarousel() {
    const carousel = document.querySelector('[data-featured-carousel]');
    if (!carousel || carousel.dataset.ready) return;
    const slides = [...carousel.querySelectorAll('.featured-slide')];
    const selectors = [...carousel.querySelectorAll('[data-slide-to]')];
    if (slides.length < 2) return;
    const playback = carousel.querySelector('[data-carousel-playback]');
    const count = carousel.querySelector('[data-carousel-count]');
    const announcement = carousel.querySelector('[data-carousel-announcement]');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let requested = !motion.matches;
    let hovered = false;
    let focused = carousel.contains(document.activeElement);
    let visible = true;
    let timer;

    function schedule() {
        window.clearTimeout(timer);
        playback.hidden = motion.matches;
        playback.textContent = requested ? 'Pause' : 'Play';
        playback.setAttribute('aria-label', requested
            ? 'Pause automatic project rotation' : 'Start automatic project rotation');
        if (requested && !motion.matches && !hovered && !focused && visible && !document.hidden) {
            timer = window.setTimeout(() => show(current + 1), ROTATION_DELAY);
        }
    }

    function show(index, manual = false) {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
            const active = i === current;
            slide.classList.toggle('is-active', active);
            slide.inert = !active;
            slide.setAttribute('aria-hidden', String(!active));
            if (active) selectors[i].setAttribute('aria-current', 'true');
            else selectors[i].removeAttribute('aria-current');
        });
        count.textContent = (current + 1) + ' / ' + slides.length;
        if (manual) {
            requested = false;
            announcement.textContent = slides[current].getAttribute('aria-label');
        }
        schedule();
    }

    carousel.querySelector('[data-carousel-previous]').addEventListener('click', () => show(current - 1, true));
    carousel.querySelector('[data-carousel-next]').addEventListener('click', () => show(current + 1, true));
    selectors.forEach((button, index) => button.addEventListener('click', () => show(index, true)));
    playback.addEventListener('click', () => {
        requested = !requested;
        schedule();
    });
    carousel.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'mouse') return;
        hovered = true;
        schedule();
    });
    carousel.addEventListener('pointerleave', event => {
        if (event.pointerType !== 'mouse') return;
        hovered = false;
        schedule();
    });
    carousel.addEventListener('focusin', () => {
        focused = true;
        schedule();
    });
    carousel.addEventListener('focusout', event => {
        focused = carousel.contains(event.relatedTarget);
        schedule();
    });
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener('change', () => {
        requested = !motion.matches;
        schedule();
    });
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            schedule();
        });
        observer.observe(carousel);
    }
    carousel.dataset.ready = 'true';
    carousel.querySelector('.carousel-toolbar').hidden = false;
    schedule();
}
