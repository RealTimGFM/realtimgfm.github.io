//  Scroll spy (active nav link) 
const links = [...document.querySelectorAll('#menu a[href^="#"]')];
const sections = links
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

const spy = new IntersectionObserver(
    entries => {
        entries.forEach(e => {
            const id = '#' + e.target.id;
            const link = links.find(l => l.getAttribute('href') === id);
            if (!link) return;
            if (e.isIntersecting) {
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: 0.01 }
);

sections.forEach(s => spy.observe(s));

//  Reveal on scroll 
const revealIO = new IntersectionObserver(
    entries => {
        for (const e of entries) {
            if (e.isIntersecting) {
                e.target.setAttribute('data-inview', 'true');
                revealIO.unobserve(e.target);
            }
        }
    },
    { threshold: 0.12 }
);
document.querySelectorAll('.observe').forEach(el => revealIO.observe(el));








// ===== Contact form (EmailJS) =====
const form = document.getElementById('contactForm');
const status = document.getElementById('status');

const EMAILJS_SERVICE_ID = 'service_nadr8zr';
const EMAILJS_TEMPLATE_ID = 'template_8e39ouv';
const EMAILJS_PUBLIC_KEY = 'MBOb696Mp80gE40Rf';

if (form) {
    // mark when the user started typing (anti-bot timing check)
    let firstInteractionAt = 0;
    form.addEventListener('input', () => { if (!firstInteractionAt) firstInteractionAt = Date.now(); }, { once: true });

    // init EmailJS once
    if (window.emailjs && !window.__emailjs_inited) {
        emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
        window.__emailjs_inited = true;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        status.textContent = '';

        const data = Object.fromEntries(new FormData(form));
        const name = (data.name || '').trim();
        const email = (data.email || '').trim();
        const message = (data.message || '').trim();
        const honeypot = (data.website || '').trim();

        // basic anti-bot checks
        const tookMs = Date.now() - (firstInteractionAt || Date.now());
        if (honeypot || tookMs < 1200) return;               // ignore bots
        if (!name || !email || !message) {
            status.textContent = 'Please fill in all fields.'; return;
        }

        const btn = form.querySelector('button[type="submit"]');
        btn?.setAttribute('disabled', 'true');
        btn?.classList.add('is-loading');

        try {
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                // what your template renders
                name,                          // for {{name}}
                email,                         // for {{email}}
                message,                       // for {{message}}
                time: new Date().toLocaleString(), // for {{time}} if you use it

                // helpful mail headers (optional but nice)
                from_name: name,
                from_email: email,
                reply_to: email
            });

            status.style.color = '#79e27d';
            status.textContent = 'Thanks! Your message has been sent.';
            form.reset();
            firstInteractionAt = 0;
        } catch (err) {
            console.error(err);
            status.style.color = '#ff9b9b';
            status.textContent = 'Oops, failed to send. Please try again.';
        } finally {
            btn?.removeAttribute('disabled');
            btn?.classList.remove('is-loading');
        }
    });
}


//  Theme (Light/Dark) 
const root = document.documentElement;
const themeBtn = document.getElementById('themeToggle');

function detectInitialTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(mode) {
    root.setAttribute('data-theme', mode);
    if (themeBtn) {
        themeBtn.textContent = mode === 'dark' ? 'Dark' : 'Light';
        themeBtn.setAttribute('aria-pressed', String(mode === 'dark'));
    }
}

function toggleTheme() {
    const current = root.getAttribute('data-theme') || detectInitialTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
}

applyTheme(detectInitialTheme());
const mql = window.matchMedia('(prefers-color-scheme: dark)');
mql.addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
    }
});
if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

// Contact dropdown aria state
const contactItem = document.querySelector('.menu .has-sub');
if (contactItem) {
    const trigger = contactItem.querySelector('a[href="#contact"]');
    const set = (open) => trigger && trigger.setAttribute('aria-expanded', String(open));
    contactItem.addEventListener('mouseenter', () => set(true));
    contactItem.addEventListener('mouseleave', () => set(false));
    contactItem.addEventListener('focusin', () => set(true));
    contactItem.addEventListener('focusout', (e) => {
        if (!contactItem.contains(document.activeElement)) set(false);
    });
}

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const menuEl = document.getElementById('menu');
if (navToggle && menuEl) {
    navToggle.addEventListener('click', () => {
        const open = menuEl.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', String(open));
    });
    menuEl.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
            menuEl.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
        }
    });
}
function detectInitialTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light'; // default to light when nothing saved
}

(function scrollProgress(){
  const bar = document.getElementById('scroll-progress');
  function onScroll(){
    const h = document.documentElement;
    const scrolled = (h.scrollTop)/(h.scrollHeight - h.clientHeight);
    bar.style.width = (scrolled*100).toFixed(2) + '%';
  }
  document.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();
