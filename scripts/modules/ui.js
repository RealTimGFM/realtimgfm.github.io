export function initUi() {
    initContactForm();
    initScrollProgress();
    initTheme();
}

function initTheme() {
    const root = document.documentElement;
    const themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;
    let initial = 'light';
    try { if (localStorage.getItem('theme') === 'dark') initial = 'dark'; } catch { /* Storage is optional. */ }
    const applyTheme = (mode) => {
        root.setAttribute('data-theme', mode);
        themeBtn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        themeBtn.setAttribute('aria-pressed', String(mode === 'dark'));
    };
    themeBtn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem('theme', next); } catch { /* The theme still works without persistence. */ }
    });
    applyTheme(initial);
}

function initContactForm() {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('status');

    if (!form || !status || form.dataset.initialized) return;
    form.dataset.initialized = 'true';

    const EMAILJS_SERVICE_ID = 'service_nadr8zr';
    const EMAILJS_TEMPLATE_ID = 'template_8e39ouv';
    const EMAILJS_PUBLIC_KEY = 'MBOb696Mp80gE40Rf';

    let sending = false;
    const button = form.querySelector('button[type="submit"]');
    const showStatus = (message, state = 'error') => {
        status.dataset.state = state;
        status.textContent = message;
    };

    const fieldIds = { name: 'name', email: 'email', message: 'msg' };
    const setFieldError = (name, message = '') => {
        const field = form.elements.namedItem(name);
        const error = document.getElementById(fieldIds[name] + '-error');
        if (message) field?.setAttribute('aria-invalid', 'true');
        else field?.removeAttribute('aria-invalid');
        if (error) {
            error.textContent = message;
            error.hidden = !message;
        }
    };
    form.addEventListener('input', (event) => {
        if (Object.hasOwn(fieldIds, event.target?.name)) setFieldError(event.target.name);
    });
    form.addEventListener('reset', () => {
        for (const name of Object.keys(fieldIds)) setFieldError(name);
    });

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

        for (const field of Object.keys(fieldIds)) setFieldError(field);
        const missing = Object.entries({ name, email, message }).filter(([, value]) => !value);
        if (missing.length) {
            for (const [field] of missing) setFieldError(field, 'Please enter your ' + field + '.');
            showStatus('Please fill in all required fields.');
            form.elements.namedItem(missing[0][0])?.focus();
            return;
        }

        const emailInput = form.elements.namedItem('email');
        emailInput.value = email;
        if (!emailInput.checkValidity()) {
            setFieldError('email', 'Enter an email address such as name@example.com.');
            showStatus('Please enter a valid email address.');
            emailInput.focus();
            return;
        }

        // Autofill and fast keyboard entry are legitimate. The honeypot and
        // in-flight guard provide local protection; service limits apply remotely.
        sending = true;
        button?.setAttribute('disabled', 'true');
        button?.classList.add('is-loading');
        form.setAttribute('aria-busy', 'true');
        showStatus('Sending your message...', 'pending');

        try {
            if (typeof window.emailjs?.send !== 'function' || typeof window.emailjs?.init !== 'function') {
                showStatus('The email service has not loaded or is blocked. Your draft is still here. Try again, or message me on LinkedIn.');
                return;
            }
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
            showStatus(Number(error?.status) === 429
                ? 'Too many messages. Please wait a minute and try again. Your draft is saved in this form, or you can message me on LinkedIn.'
                : 'The message failed to send. Your draft is still here. Please try again, or message me on LinkedIn.');
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



