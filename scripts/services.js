// Third-party services run on the hosted site; local previews stay self-contained.
if (location.hostname === 'realtimgfm.github.io') {
    const loadScript = (src, attributes = {}) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
        document.head.append(script);
    };
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', 'G-Z6FYNPRYBW');
    loadScript('https://www.googletagmanager.com/gtag/js?id=G-Z6FYNPRYBW');
    loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js');
    loadScript('https://gc.zgo.at/count.js', { 'data-goatcounter': 'https://timgfm.goatcounter.com/count' });
}
