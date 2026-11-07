import { initProjectCaseStudies } from './modules/project-case-studies.js';
import { initFeaturedCarousel } from './modules/featured-carousel.js';
import { initPomodoroytJourney } from './modules/pomodoroyt-journey.js';
import { initHomelabJourney } from './modules/homelab-journey.js';
import { initForexalertJourney } from './modules/forexalert-journey.js';
import { initSchedulebookerJourney } from './modules/schedulebooker-journey.js';
import { initNav } from './modules/nav.js';
import { initSkillsPopups } from './modules/skills-popup.js';
import { initSectionObservers } from './modules/section-observer.js';
import { initExperienceToggles } from './modules/experience-toggle.js';
import { initProjectsToggle } from './modules/projects-toggle.js';
import { initHomelabToggle } from './modules/homelab-toggle.js';
import { initHomelabViewers } from './modules/homelab-viewers.js';
import { initUi } from './modules/ui.js';

function bootstrap() {
    for (const initialize of [initUi, initNav, initPomodoroytJourney, initHomelabJourney, initForexalertJourney, initSchedulebookerJourney, initFeaturedCarousel, initSkillsPopups, initExperienceToggles,
        initProjectsToggle, initProjectCaseStudies, initHomelabToggle, initHomelabViewers, initSectionObservers]) {
        try {
            initialize();
        } catch (error) {
            console.error(`Could not initialize ${initialize.name}:`, error);
        }
    }
    document.documentElement.classList.remove('disclosures-pending');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
    bootstrap();
}



