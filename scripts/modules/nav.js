const compactQuery = window.matchMedia('(max-width: 1000px)');

export function initNav() {
    const toggle = document.getElementById('navToggle');
    const menu = document.getElementById('menu');
    const header = document.querySelector('.header');
    if (!toggle || !menu || !header) return;
    document.documentElement.classList.add('nav-ready');
    toggle.hidden = false;
    const setOpen = (open) => {
        menu.classList.toggle('open', open);
        header.classList.toggle('menu-open', open);
        toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
    menu.addEventListener('click', event => {
        if (event.target.closest('a') && compactQuery.matches) setOpen(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && menu.classList.contains('open')) {
            setOpen(false);
            toggle.focus();
        }
    });
    const onResize = () => { if (!compactQuery.matches) setOpen(false); };
    if (compactQuery.addEventListener) compactQuery.addEventListener('change', onResize);
    else compactQuery.addListener(onResize);
}
