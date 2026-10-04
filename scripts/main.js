import { initNav } from './modules/nav.js';
import { initSkillsPopups } from './modules/skills-popup.js';
import { initSectionObservers } from './modules/section-observer.js';
import { initExperienceToggles } from './modules/experience-toggle.js';
import { initProjectsToggle } from './modules/projects-toggle.js';
import { initHomelabToggle } from './modules/homelab-toggle.js';
import { initUi } from './modules/ui.js';

function bootstrap() {
    for (const initialize of [initUi, initNav, initSkillsPopups, initExperienceToggles,
        initProjectsToggle, initHomelabToggle, initSectionObservers]) {
        try {
            initialize();
        } catch (error) {
            console.error(`Could not initialize ${initialize.name}:`, error);
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
    bootstrap();
}



