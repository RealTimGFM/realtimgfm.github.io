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

- `index.html` - page shell
- `partials/` - section partials loaded into the page
- `styles/` - split CSS for tokens, base styles, components, sections, and responsive rules
- `scripts/` - include loader, main entry, and behavior modules
- `assets/` - images, icons, logos, and resume PDF

## Run locally

Because the site now loads HTML partials with `fetch()`, use a local server instead of opening `index.html` with `file://`.

```bash
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

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
npm run lint
git diff --check
git diff --stat
npm run lint:css:fix
npm run lint
```



