export function initUi() {
    initTheme();
    initContactForm();
    initScrollProgress();
}

function initTheme() {
    const root = document.documentElement;
    const themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;

    const detectInitialTheme = () => {
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const applyTheme = (mode) => {
        root.setAttribute('data-theme', mode);
        themeBtn.textContent = mode === 'dark' ? 'Dark' : 'Light';
        themeBtn.setAttribute('aria-pressed', String(mode === 'dark'));
    };

    themeBtn.addEventListener('click', () => {
        const current = root.getAttribute('data-theme') || detectInitialTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        applyTheme(next);
    });

    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSchemeChange = (event) => {
        if (!localStorage.getItem('theme')) {
            applyTheme(event.matches ? 'dark' : 'light');
        }
    };

    if (typeof colorSchemeQuery.addEventListener === 'function') {
        colorSchemeQuery.addEventListener('change', handleSchemeChange);
    } else if (typeof colorSchemeQuery.addListener === 'function') {
        colorSchemeQuery.addListener(handleSchemeChange);
    }

    applyTheme(detectInitialTheme());
}

function initContactForm() {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('status');

    if (!form || !status) return;

    const EMAILJS_SERVICE_ID = 'service_nadr8zr';
    const EMAILJS_TEMPLATE_ID = 'template_8e39ouv';
    const EMAILJS_PUBLIC_KEY = 'MBOb696Mp80gE40Rf';

    let firstInteractionAt = 0;
    form.addEventListener('input', () => {
        if (!firstInteractionAt) firstInteractionAt = Date.now();
    }, { once: true });

    if (window.emailjs && !window.__emailjs_inited) {
        emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
        window.__emailjs_inited = true;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = '';

        const data = Object.fromEntries(new FormData(form));
        const name = (data.name || '').trim();
        const email = (data.email || '').trim();
        const message = (data.message || '').trim();
        const honeypot = (data.website || '').trim();

        const tookMs = Date.now() - (firstInteractionAt || Date.now());
        if (honeypot || tookMs < 1200) return;

        if (!name || !email || !message) {
            status.textContent = 'Please fill in all fields.';
            return;
        }

        const button = form.querySelector('button[type="submit"]');
        button?.setAttribute('disabled', 'true');
        button?.classList.add('is-loading');

        try {
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                name,
                email,
                message,
                time: new Date().toLocaleString(),
                from_name: name,
                from_email: email,
                reply_to: email
            });

            status.style.color = '#79e27d';
            status.textContent = 'Thanks! Your message has been sent.';
            form.reset();
            firstInteractionAt = 0;
        } catch (error) {
            console.error(error);
            status.style.color = '#ff9b9b';
            status.textContent = 'Oops, failed to send. Please try again.';
        } finally {
            button?.removeAttribute('disabled');
            button?.classList.remove('is-loading');
        }
    });
}

function initScrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;

    const onScroll = () => {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - doc.clientHeight;
        const scrolled = scrollable > 0 ? doc.scrollTop / scrollable : 0;
        bar.style.width = `${(scrolled * 100).toFixed(2)}%`;
    };

    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

