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
- Contact form with EmailJS
- LinkedIn badge embed
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

The initial HTML contains every section. No section fetches are needed, and content
stays visible without JavaScript. With JavaScript, the first four projects are featured
and See More reveals the rest. Certifications remain under About.

`npm run build:pages` also creates `_site/` containing only deployable HTML, assets,
styles, and browser scripts. The existing GitHub Pages workflow runs this command
before uploading; it needs no build dependencies or paid service. Commit the regenerated
`index.html` alongside source edits. CI checks that it is current.

## Home lab case study

The infrastructure case study follows Featured Projects. Edit `partials/homelab.html`
and `styles/sections/homelab.css`; its images live in `assets/homelab/`.
With JavaScript, the introduction and technology labels stay visible while
**Explore Home Lab** expands the full case study. **Show Less** controls at the top
and bottom collapse it; the bottom control returns keyboard focus to the top control.
Without JavaScript, the complete case study remains visible.
The five SVGs are labeled placeholders, not screenshots or photos:

- `homelab-hardware.svg`
- `minecraft-server.svg`
- `server-monitoring.svg`
- `pihole-dashboard.svg`
- `homelab-architecture.svg`

To add real images, place them in that directory with the same descriptive basenames
(for example, `homelab-hardware.webp`) and update each image's `src`, intrinsic `width`
and `height`, and descriptive `alt` in the partial. Remove the corresponding
`homelab-placeholder-label` element, retain the captions and lazy loading, then run
`npm run build`. Images scale to their container while preserving their aspect ratio.
Keep private addresses and other sensitive details out of screenshots and diagrams.

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
