export function initUi() {
    initContactForm();
    initScrollProgress();
    initTheme();
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

    if (!form || !status || form.dataset.initialized) return;
    form.dataset.initialized = 'true';

    const EMAILJS_SERVICE_ID = 'service_nadr8zr';
    const EMAILJS_TEMPLATE_ID = 'template_8e39ouv';
    const EMAILJS_PUBLIC_KEY = 'MBOb696Mp80gE40Rf';

    let firstInteractionAt = null;
    let sending = false;
    const button = form.querySelector('button[type="submit"]');
    const showStatus = (message, state = 'error') => {
        status.dataset.state = state;
        status.textContent = message;
    };

    form.addEventListener('input', () => {
        if (!sending && firstInteractionAt === null) firstInteractionAt = Date.now();
    });
    form.addEventListener('reset', () => { firstInteractionAt = null; });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (sending) {
            showStatus('Your message is still sending. Please wait.', 'pending');
            return;
        }

        const data = Object.fromEntries(new FormData(form));
        const name = (data.name || '').trim();
        const email = (data.email || '').trim();
        const message = (data.message || '').trim();
        const honeypot = (data.website || '').trim();

        if (honeypot) {
            showStatus('Your message was blocked by the spam check. Please reload and try again.');
            return;
        }

        if (!name || !email || !message) {
            showStatus('Please fill in all fields.');
            return;
        }

        const emailInput = form.elements.namedItem('email');
        emailInput.value = email;
        if (!emailInput.checkValidity()) {
            showStatus('Please enter a valid email address.');
            emailInput.focus();
            return;
        }

        // Autofill may not emit input; start the same waiting period on submit.
        if (firstInteractionAt === null) firstInteractionAt = Date.now();
        if (Date.now() - firstInteractionAt < 1200) {
            showStatus('Please wait a moment before sending, then try again.');
            return;
        }

        sending = true;
        button?.setAttribute('disabled', 'true');
        button?.classList.add('is-loading');
        form.setAttribute('aria-busy', 'true');
        showStatus('Sending your message...', 'pending');

        try {
            if (!window.emailjs) throw new Error('EmailJS is unavailable.');
            if (!window.__emailjs_inited) {
                window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
                window.__emailjs_inited = true;
            }
            await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                name,
                email,
                message,
                time: new Date().toLocaleString(),
                from_name: name,
                from_email: email,
                reply_to: email
            });

            showStatus('Thanks! Your message has been sent.', 'success');
            form.reset();
        } catch (error) {
            console.error(error);
            showStatus(error?.status === 429
                ? 'Too many messages. Please wait a minute and try again.'
                : 'Oops, failed to send. Please try again.');
        } finally {
            sending = false;
            form.removeAttribute('aria-busy');
            button?.removeAttribute('disabled');
            button?.classList.remove('is-loading');
        }
    });
    button?.removeAttribute('disabled');
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



