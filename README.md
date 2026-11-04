![CI](https://github.com/RealTimGFM/realtimgfm.github.io/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/RealTimGFM/realtimgfm.github.io/actions/workflows/deploy-pages.yml/badge.svg)
![Link Check](https://github.com/RealTimGFM/realtimgfm.github.io/actions/workflows/link-check.yml/badge.svg)

# Tim's Portfolio - `realtimgfm.github.io`

A lightweight personal portfolio site hosted on GitHub Pages.

Live site: [https://realtimgfm.github.io](https://realtimgfm.github.io)

## What's inside

- Responsive single-page portfolio
- Light/Dark theme toggle
- Projects and Experience sections
- Featured-project carousel with three-second autoplay, manual navigation, and reduced-motion support
- Contact form with EmailJS
- LinkedIn and GitHub contact links
- Optional analytics integrations

## Tech stack

- HTML
- CSS
- Vanilla JavaScript
- GitHub Pages
- GitHub Actions

## Project structure

- `index.template.html` - page shell and section order (edit this)
- `partials/` - section sources (edit these)
- `index.html` - generated, committed static page; do not edit directly
- `styles/` - split CSS for tokens, base styles, components, sections, and responsive rules
- `scripts/` - dependency-free build script, main entry, and behavior modules
- `assets/` - images, icons, logos, and resume PDF

## Run locally

Requires Node.js 20 or later. After editing the template or partials, rebuild the page,
then serve it locally so browser JavaScript modules work:

```bash
npm run build
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Featured carousel content lives in `partials/featured-*.html`; shared controls and transitions use
`partials/featured-carousel.html` and `scripts/modules/featured-carousel.js`. Each project has its own
composition in `styles/sections/featured-projects.css`.

The initial HTML contains every section. No section fetches are needed, and content
stays visible without JavaScript. Skills use native disclosures for their repository evidence,
and work-history details remain readable when JavaScript is unavailable. With JavaScript, the first four projects are featured
and See More reveals the rest. Certifications remain under About.

`npm run build:pages` also creates `_site/` containing only deployable HTML, assets,
styles, and browser scripts. The existing GitHub Pages workflow runs this command
before uploading; it needs no build dependencies or paid service. Commit the regenerated
`index.html` alongside source edits. CI checks that it is current.

## Home lab case study

The infrastructure case study follows Projects. Edit `partials/homelab.html`
and `styles/sections/homelab.css`; production media lives in `assets/homelab/`.
With JavaScript, the introduction and technology labels stay visible while
**Explore Home Lab** expands the full case study. **Show Less** controls at the top
and bottom collapse it; the bottom control returns keyboard focus to the top control.
Without JavaScript, the complete case study and hardware previews remain visible.

The large ThinkPad T16 Gen 2 and Raspberry Pi 4 viewers use the supplied local
`model-viewer/model-viewer.min.js` runtime and self-contained GLBs in `models/`.
The runtime and models load only after expansion as the hardware approaches the
viewport. Drag or use the keyboard to orbit, scroll/pinch to zoom, or use the
Zoom in, Zoom out, and Reset view controls. Models rotate gently only while expanded and visible. Pause/start rotation and reduced-motion
controls are respected. Static WebP previews remain available during loading and if JavaScript,
WebGL, or model loading is unavailable. No external viewer CDN is required.

Three real screenshots document earlier lab operation; they are not live status checks:

- `debian-operations.webp` shows the server console, htop, and playit.gg.
- `prominence-ii-world.webp` shows the hosted Prominence II multiplayer workload.
- `pihole-dashboard.webp` shows DNS activity and filtering on the Raspberry Pi.

Each screenshot also has a `-960.webp` responsive variant. The Debian and Pi-hole
images use lossless WebP to preserve fine text; the Minecraft image uses quality 90.
All images preserve their aspect ratio and have intrinsic dimensions, descriptive
alt text, and lazy loading. The network topology is conceptual HTML/CSS without
addresses. Original privacy redactions are retained; tunnel/resolver identifiers and
player names are additionally masked, and every raster carries its known repository origin as provenance metadata.

When replacing media, retain redactions and inspect both standalone screenshots and
any embedded model screen textures. Never publish private addresses, hostnames,
credentials, MAC addresses, or tokens. Keep only production GLBs, previews, images,
and the viewer runtime/license in the deployed assets; import packages and their QA
or source files do not belong in the deployment. Run `npm run build` after source edits.

## Lint CSS

```bash
cd C:\Users\User\Documents\GitHub\PersonalWebpage
npm ci
npm run lint:css:fix
npm run lint
```

## Preflight Checklist

Run these before pushing changes:

```bash
npm ci
npm run build
npm run build:check
npm run lint
npm test
git diff --check
git diff --stat
```

The Node regression tests use a fake EmailJS transport; they never send email.
Before release, check desktop and mobile navigation, both themes, See More/See Less,
experience details, and two consecutive real contact messages in one page session.
Also check invalid email, immediate submission feedback, and a blocked EmailJS request.

## Balanced Folio design

The portfolio uses self-hosted Geist and Roboto, cool blue surfaces, navy text, and coral actions.
The opening exhibit leads with FinCore and production backend experience; the portrait remains in About.
See `DESIGN.md` for the design system and responsive rules, and `assets/fonts/SOURCES.md`
and `assets/PROVENANCE.md` for asset origins.

Third-party analytics and the EmailJS SDK load through `scripts/services.js` on the canonical
`realtimgfm.github.io` host. Local previews remain self-contained; contact delivery is tested
with mocks locally and real messages are not sent during automated checks.

## Engineering content and maintenance

- Edit project overviews, statuses, technology tags, and direct evidence links in `partials/projects.html`. Preserve the `project-*` anchors. Engineering case-study disclosures have been removed at the owner's request; the hero carousel remains a short introduction.
- Status vocabulary: **In Development** means unfinished work; **Implemented** means documented functionality and does not certify completion or live deployment; **Published Extension** requires a verified store listing. Keep availability separate from implementation status. Existing hosting and CI badges describe tooling, not current passing runs. Only use Deployed, Completed, or Demo Unavailable after checking evidence; a failed verification request alone does not prove an outage.
- Verify a public file or directory before linking it. Prefer specific tests or architecture documents, keep existing project links, and record the date and basis in `IMPLEMENTATION_REPORT.md`. Test source is evidence of coverage intent, not proof of a passing run. Do not add fabricated CI or coverage badges.
- `partials/homelab-infrastructure.html` adds the resource/workload register, Compose architecture, and separate private/public/local network paths. Keep owner-reported configuration distinct from current operational checks. Publish conceptual labels only; never add live endpoints, keys, mounts, or secret Compose files.
- `partials/contact.html` exposes LinkedIn as the form fallback, including without JavaScript. No approved portfolio email is configured. Add a `mailto:` link only after the owner explicitly approves the exact public address for this portfolio; do not infer permission from a resume, account metadata, or extension listing. Contact validation in `scripts/modules/ui.js` associates errors with fields, accepts fast/autofill submissions, retains the honeypot and in-flight guard, preserves failed drafts, and explains unavailable SDK and rate-limit recovery. EmailJS settings remain the existing public frontend integration.
- `index.template.html` owns canonical, Open Graph, Twitter card, and Person JSON-LD data. The local 1200 × 630 preview is `assets/social-preview.png`. Regenerate it on Windows with `powershell -NoProfile -File scripts/create-social-preview.ps1`; it uses the existing Roboto font and System.Drawing, with no production dependency. Keep the image alt metadata and provenance current.
- `tests/contact-form.test.mjs` covers validation, autofill, immediate sends, duplicate prevention, mocked success/failure, rate limits, reset, and SDK recovery. `tests/engineering-content.test.mjs` checks experience order/dates, project overviews and direct evidence, IDs/references, static content, metadata, image dimensions, generated output, and Pages assets. `tests/featured-carousel.test.mjs` checks the four slides, navigation, unchanged 3000ms rotation, focus/hover/visibility pauses, and reduced motion. No automated test sends real email.
- Run `npm run build`, `npm run build:check`, `npm run lint`, `npm test`, `npm run build:pages`, and `git diff --check` before review. Check 320, 360, 390, 768, 1000, 1280, and 1536px in both themes, increased zoom, keyboard operation, no JavaScript, model fallbacks, and browser console errors when a browser is available. See `IMPLEMENTATION_REPORT.md` for verification limits and factual questions.
