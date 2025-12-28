![CI](https://github.com/RealTimGFM/realtimgfm.github.io/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/RealTimGFM/realtimgfm.github.io/actions/workflows/deploy-pages.yml/badge.svg)
![Link Check](https://github.com/RealTimGFM/realtimgfm.github.io/actions/workflows/link-check.yml/badge.svg)

# Tim’s Portfolio — `realtimgfm.github.io`

A lightweight personal portfolio site hosted on GitHub Pages.

Live site: <https://realtimgfm.github.io>

## What’s inside

- Responsive single-page portfolio (mobile + desktop)
- Light/Dark theme toggle
- Projects + Experience sections
- Contact form (EmailJS)
- LinkedIn badge embed
- Optional analytics (GA4)

## Tech stack

- HTML
- CSS
- Vanilla JavaScript
- GitHub Pages (deploy)
- GitHub Actions (CI)

## Project structure

- `index.html` — main page
- `styles.css` — styling
- `scripts.js` — interactions (menu, theme toggle, form submission, etc.)
- `assets/` — images, icons, resume PDF

## Run locally

Option A: Open `index.html` directly in your browser.

Option B: Serve locally (recommended):

```bash
# from the repo root
python -m http.server 8080
# then open
# http://localhost:8080
```

## Stylelint error
```bash
cd C:\Users\User\Documents\GitHub\PersonalWebpage
npm ci
npx stylelint "**/*.css" --fix
npx stylelint "**/*.css"
```