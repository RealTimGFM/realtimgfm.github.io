import { loadIncludes } from './includes.js';
import { initNav } from './modules/nav.js';
import { initSkillsPopups } from './modules/skills-popup.js';
import { initSectionObservers } from './modules/section-observer.js';
import { initExperienceToggles } from './modules/experience-toggle.js';
import { initUi } from './modules/ui.js';

async function bootstrap() {
    await loadIncludes();
    initUi();
    initNav();
    initSkillsPopups();
    initExperienceToggles();
    initSectionObservers();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bootstrap().catch((error) => console.error(error));
    }, { once: true });
} else {
    bootstrap().catch((error) => console.error(error));
}

