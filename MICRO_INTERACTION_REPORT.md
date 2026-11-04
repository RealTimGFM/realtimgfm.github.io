# Balanced Folio micro-interaction polish

Implemented locally on November 3, 2026. No commit, push, merge, or deployment was performed. Existing unrelated working-tree changes were preserved.

## Interactions added

- Shared 160ms surface, border, color, and opacity feedback; 140ms restrained pressed scale for enabled controls. Disabled/loading controls are excluded from pressed and hover feedback. Existing hit areas and keyboard focus outlines are retained.
- Quiet text-link underline transitions and matching navigation/resume feedback.
- CSS-drawn chevrons on Experience and Home Lab triggers, rotating over 200ms.
- Reversible 240ms Experience/Home Lab reveal and collapse.
- 180ms hover emphasis on informational container services and network boundaries, limited to fine pointers. Architecture, text, arrows, semantics, and tab order are unchanged.
- 180ms contact focus/validation border transitions, existing submission opacity with smooth state feedback, and gentle success/error message appearance. EmailJS configuration and form JavaScript are unchanged, including live announcements, duplicate-submit protection, failed-submission drafts, retry behavior, and LinkedIn fallback.

## Disclosure behavior

The dependency-free shared controller uses the Web Animations API. It reads the current rendered height/opacity/margin, cancels any active animation, measures the natural endpoint once, and animates to the new intended state. Rapid repeated actions reverse from the visible state; stale completion callbacks cannot finish a newer transition. Finished panels retain no animation or fixed height, so wrapped or asynchronously loaded content can grow. Resize and font-loading events settle any active transition.

Collapsed content becomes inert and aria-hidden immediately; hidden is applied after closing finishes. Opening removes those restrictions before the reveal. ARIA state and labels follow the intended state. The bottom Home Lab collapse command always returns focus with preventScroll, moving the viewport only when needed to expose its offscreen owner. Top-toggle activation does not request scrolling.

Initialization does not animate. A short pre-paint guard is released by bootstrap, or by window load if module loading fails. With JavaScript disabled, Experience and Home Lab content remain visible in the static HTML and their enhancement-only buttons remain hidden. Matching fragments open panels immediately.

The Home Lab viewer checks include inert state, so closing immediately pauses rotation and defers new model activation even while its visual collapse is running. Re-expansion requests fresh intersection callbacks, including after an interrupted close. Existing camera controls, previews, deferred runtime/GLBs, and rotation preferences are retained.

## Project case-study discrepancy

The supplied brief describes four existing project-case-study details elements. This checkout has none. DESIGN.md and existing content tests explicitly record their earlier removal at the owner's request.

No project content was restored, rewritten, or invented. A scoped native-details enhancement and chevron styles are included for details.project-case-study if present. They preserve summary keyboard activation, native external toggles, links inside summaries, fragment navigation, and no-JavaScript native details behavior. All 11 current project records and their anchors/evidence links remain intact.

## Reduced motion

The global prefers-reduced-motion override removes CSS transitions/animations entirely. The controller skips animation when reduced motion is requested or WAAPI is unavailable; changing the preference during animation settles immediately. The carousel retains its existing reduced-motion behavior, 3-second interval, and 420ms normal crossfade.

## Files changed in this task

- `index.template.html`
- `index.html`
- `scripts/main.js`
- `scripts/modules/experience-toggle.js`
- `scripts/modules/homelab-toggle.js`
- `scripts/modules/homelab-viewers.js`
- `styles/base.css`
- `styles/components/buttons.css`
- `styles/components/navbar.css`
- `styles/sections/featured-carousel.css`
- `styles/sections/projects.css`
- `styles/sections/experience.css`
- `styles/sections/homelab.css`
- `styles/sections/contact.css`
- `tests/site.test.mjs`
- `DESIGN.md`
- `tests/homelab-viewers.test.mjs`
- `scripts/modules/disclosure.js`
- `scripts/modules/project-case-studies.js`
- `tests/disclosures.test.mjs`
- `MICRO_INTERACTION_REPORT.md`

Generated _site copies were refreshed by the Pages build. Existing content partials, package/dependency files, carousel JavaScript, and contact-form JavaScript were not changed by this task. The obsolete immediate-hide Home Lab unit test in site.test.mjs was replaced by broader disclosure regression coverage.

## Validation

Passed:

- npm run build
- npm run build:check
- npm run lint — 20 CSS sources; zero problems
- npm test — 38 tests passed; zero failures
- npm run build:pages
- git diff --check

Regression coverage includes interrupted/rapid reversal, stale callbacks, simulated keyboard-origin clicks, expanded labels/ARIA, focus restoration including pointer activation without button focus, reduced motion and runtime preference changes, resize/font reflow, unsupported animation API fallback, fragments, startup failure recovery, static no-JavaScript content, viewer activation/rotation during animated collapse, and existing project/experience/carousel/contact behavior.

The required Impeccable detector ran once. It returned 39 findings (3 warnings and 36 advisories) about the existing Geist/Roboto choices, existing type/radius values, and existing functional form colors, including reuse of those colors for invalid field borders. These are intentionally retained under the motion-only brief; the detector is not reported as a clean pass.

## Visual-testing limitation

No browser surfaces were available, and creating an in-app browser preview returned "Browser is not available: iab". Saved screenshots were inspected as historical style references only. No new rendered screenshots or live visual/keyboard/touch checks were captured. The requested 320px, 390px, 768px, 1280px, and 1536px light/dark viewport matrix remains unverified in a browser. DOM/animation tests use controlled mocks and do not establish real-browser smoothness, clipping, scrolling, or screen-reader behavior.

The local preview server was stopped after verification.
