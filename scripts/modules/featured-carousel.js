const ROTATION_DELAY = 4000;

export function initFeaturedCarousel() {
    const carousel = document.querySelector('[data-featured-carousel]');
    if (!carousel || carousel.dataset.ready) return;
    const slides = [...carousel.querySelectorAll('.featured-slide')];
    const selectors = [...carousel.querySelectorAll('[data-slide-to]')];
    if (slides.length < 2) return;
    const announcement = carousel.querySelector('[data-carousel-announcement]');
    const slideFrame = carousel.querySelector('.carousel-slides');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let focused = slides.some(slide => slide.contains(document.activeElement));
    let visible = true;
    let pinned = false;
    const resume = carousel.querySelector('[data-carousel-resume]');
    let timer;

    // Measure the natural slide, never the frame being animated. This also
    // retargets an interrupted transition from its currently rendered height.
    function syncHeight() {
        slideFrame.style.height = Math.ceil(slides[current].getBoundingClientRect().height) + 'px';
    }

    function schedule() {
        window.clearTimeout(timer);
        if (!pinned && !motion.matches && !focused && visible && !document.hidden) {
            timer = window.setTimeout(() => show(current + 1), ROTATION_DELAY);
        }
    }

    function pin(value) {
        pinned = value;
        carousel.dataset.pinned = String(value);
        resume.textContent = value ? 'Resume project rotation' : 'Pause project rotation';
        resume.setAttribute('aria-label', resume.textContent);
        schedule();
    }

    function show(index, manual = false) {
        const outgoing = slides[current];
        current = (index + slides.length) % slides.length;
        if (outgoing !== slides[current]) outgoing.dispatchEvent(new CustomEvent('featured:deactivate'));
        // Return focus before an outgoing slide becomes inert.
        if (outgoing !== slides[current] && outgoing.contains(document.activeElement)) selectors[current].focus();
        focused = slides.some(slide => slide.contains(document.activeElement));
        slides.forEach((slide, i) => {
            const active = i === current;
            slide.classList.toggle('is-active', active);
            slide.inert = !active;
            slide.setAttribute('aria-hidden', String(!active));
            if (active) selectors[i].setAttribute('aria-current', 'true');
            else selectors[i].removeAttribute('aria-current');
        });
        slides[current].dispatchEvent(new CustomEvent('featured:activate'));
        syncHeight();
        if (manual) {
            pin(true);
            announcement.textContent = slides[current].getAttribute('aria-label');
        }
        schedule();
    }

    selectors.forEach((button, index) => button.addEventListener('click', () => show(index, true)));
    carousel.addEventListener('journey:interact', () => pin(true));
    resume.addEventListener('click', () => {
        if (pinned) {
            slides[current].dispatchEvent(new CustomEvent('journey:preview'));
            pin(false);
        } else pin(true);
    });
    carousel.addEventListener('focusin', event => {
        // A selected tab must not prevent the requested timed rotation.
        // Keep focused journey controls and links available until focus leaves.
        focused = slides.some(slide => slide.contains(event.target));
        schedule();
    });
    carousel.addEventListener('focusout', event => {
        focused = slides.some(slide => slide.contains(event.relatedTarget));
        schedule();
    });
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener('change', schedule);
    window.addEventListener('resize', syncHeight);
    if ('ResizeObserver' in window) {
        const observer = new window.ResizeObserver(entries => {
            if (entries.some(entry => entry.target === slides[current])) syncHeight();
        });
        slides.forEach(slide => observer.observe(slide));
    }
    document.fonts?.ready.then(syncHeight);
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            schedule();
        });
        observer.observe(carousel);
    }
    carousel.querySelector('.carousel-toolbar').hidden = false;
    show(0);
    carousel.dataset.ready = 'true';
    schedule();
}
