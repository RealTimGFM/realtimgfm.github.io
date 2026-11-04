# Portfolio / main integration

Local integration completed on 2026-11-04 on `integration/portfolio-main`, created from `redesign/impeccable-portfolio`. Nothing was pushed, published, or merged into either original branch.

## Inputs and safety

- Fetched `origin` before starting; the working tree was clean.
- Redesign parent: `3159358876a3e650f0bc254ad253042f87c4bd40`.
- Main parent: `a6fe9efd6be44e28f291170e0b9e4aa48e731fcd` (`origin/main`).
- Both original local branches remain at those commits.

## Conflict resolutions

| Conflicted file | Resolution |
| --- | --- |
| `partials/homelab.html` | Kept the redesigned six-part study, both models, manual rotation controls, updated infrastructure include, and all five sanitized operational captures. Added main's useful explanation of process-level versus host-level resource readings within the existing operations caption. |
| `styles/sections/homelab.css` | Retained the redesign version in full. All site CSS remains unchanged relative to the redesign parent, including its responsive breakpoints. |
| `scripts/modules/homelab-viewers.js` | Integrated main's interaction safeguards into the redesign's readiness, visibility, collapse, reduced-motion and manual rotation state. One three-second timer per viewer owns resume timing; the runtime's additional delay is zero. |
| `tests/homelab-viewers.test.mjs` | Combined both event/timer harnesses and preserved both branches' behavioral coverage. Main's rotation tests now activate visible, ready models; toolbar delay tests exclude the explicit rotation toggle, which has separate coverage. |
| `index.html` | Regenerated from the resolved sources using `npm run build`; generated conflict text was not manually combined. |

`tests/site.test.mjs` merged automatically but needed its conflicting expectations resolved: models must remain deferred in static HTML; the controller supplies the 12-degree speed and zero internal delay when enhanced. Main's older disclosure test is covered by the redesign's fuller animation, focus, accessibility and interrupted-collapse tests in `tests/disclosures.test.mjs`.

## Preserved and integrated behavior

- Preserved the portfolio composition, all CSS, all 11 project records, all four featured carousel compositions and controls, experience, contact UI, social metadata, assets and downloads.
- Preserved the Nextcloud request/service/storage diagrams and separate private, public Minecraft, and configured local DNS paths. Added main's DNS-resolution versus service-reachability explanation to existing access notes.
- Did not restore main's obsolete roadmap: Tailscale, containers, and Nextcloud are already presented as implemented infrastructure in the redesign. No duplicate old Home Lab sections were introduced.
- Preserved deferred runtime/GLB loading, hardware previews and unavailable-WebGL recovery, manual pause/start, visibility suspension, animated-collapse handling, and explicit rotation with reduced motion.
- Integrated held and multiple pointers, release outside the viewer, cancellation, lost capture, window blur, held keys, wheel and user camera movement. Automatic rotation resumes three seconds after interaction ends and only when the model is ready, visible, expanded, and enabled. Explicit Start clears a pending cooldown; it still respects held input and visibility. Manual pause survives preference changes and expired timers.
- Reset now clears turntable rotation as well as restoring the initial camera orbit. Repeated initialization is guarded against duplicate listeners.
- Retained intentional light-first theme behavior with persisted manual light/dark selection and blocked-storage fallback. The existing design brief and DESIGN.md explicitly require a light first visit, so main's automatic operating-system theme following was not restored. Operating-system reduced-motion support remains active.
- Kept the exact production-host guard for EmailJS and analytics, the existing public client configuration, contact validation, spam honeypot, duplicate-send protection, draft retention, retry/rate-limit feedback and LinkedIn recovery. No credentials were added or changed.

## Tests and generated assets

The old evidence fixture froze the viewer's source checksum for a prior image-only task. That source is intentionally changed by this integration. Its checksum assertion was replaced with source-to-deployment equality and the expanded behavioral viewer tests. Model, poster, disclosure, sanitized-image checksums and opaque-redaction checks remain enforced.

| Verification | Result |
| --- | --- |
| `npm.cmd run build` | Passed |
| `npm.cmd run build:pages` | Passed |
| `npm.cmd run build:check` | Passed; generated HTML matches sources |
| `npm.cmd run lint` | Passed; 20 CSS sources, zero problems |
| `npm.cmd test` | Passed; 54 tests, zero failures |
| JavaScript syntax | All 13 authored scripts passed `node --check`; reset API confirmed in the vendored viewer |
| HTML structure | Balanced tags; existing tests also verify unique IDs, fragments and accessibility references |
| Navigation | DOM-double check passed for compact-menu toggle, link dismissal, Escape/focus return and desktop-breakpoint reset |
| Content and links | All 49 original distinct href values preserved; all local file targets resolve |
| Public URL requests | 28 of 30 distinct HTTPS hrefs succeeded after retry; remaining cases below |
| `git diff --check` | Passed |

The 54 tests cover carousel timing/manual navigation/reduced motion, contact validation and transport recovery using a fake EmailJS service, disclosures, model loading/fallbacks, gesture and rotation state, theme persistence, exact hostname restrictions, infrastructure content, privacy redactions and deployment packaging. Interaction evidence uses Node event/DOM doubles with simulated timers, not a browser engine or physical touch device. No test email was sent.

The mechanical design detector reported only two advisory black-text findings from standalone partials without their stylesheet context. No palette or stylesheet changes were made.

## Files changed relative to the redesign parent

- `index.html` (generated)
- `partials/homelab.html`
- `partials/homelab-infrastructure.html`
- `scripts/modules/homelab-viewers.js`
- `tests/homelab-viewers.test.mjs`
- `tests/site.test.mjs`
- `tests/engineering-content.test.mjs`
- `tests/fixtures/nextcloud-evidence.json`
- `tests/theme-services.test.mjs` (new)
- `INTEGRATION_REPORT.md` (new)

## Remaining concerns and review readiness

No integration-related automated failures remain. The integration is ready for local review and a pull request when the owner authorizes publishing. Before final merge, review desktop/mobile rendering and real WebGL/touch behavior in a browser: no browser provider was available in this session, so screenshots and physical gesture checks could not be completed. Responsive CSS and project/carousel source were retained unchanged, but that does not replace rendered verification.

Two unchanged public destinations could not be confirmed: `https://www.lachancecapital.com` timed out on both attempts, and `https://www.linkedin.com/in/timvu2003` returned status 999 (already excluded by the repository's link-check configuration). All four previously timed-out Render URLs succeeded on retry. These are external availability/checker limitations; no authored links were changed.

Local ignored evidence is under `build/`: `integration-link-results.json`, `integration-design-detector.json`, and the navigation/link-check scripts. The integration report and resolved source are included in the local merge commit. No PR or remote update was created.
