# Portfolio performance pass — 2026-10-12

Branch: `Side-quests`. Baseline commit: `1ab062f1bf9f672329541a3e8ef9b8453a7d0452`.

Audit scope: the actual `npm run build:pages` `_site/` artifact, not the working tree or dependencies. Sizes are bytes on disk unless stated otherwise. The baseline was recorded before modifying production sources/assets. No redesign or feature removal.

## Results

| Measurement | Before | After |
| --- | ---: | ---: |
| Deployable bytes | 8,586,666 | 7,915,871 |
| Production file count | 64 | 50 |
| Initial HTML | 63,689 | 64,616 |
| Total CSS | 44,825 | 44,525 |
| Application JS (excluding viewer) | 24,362 | 26,690 |
| Initial local response bodies | 626,439 | 223,855 |
| Initial local requests | 50 | 15 |
| CSS requests | 18 | 1 |
| Collapsed runtime/GLB requests | 0 | 0 |

Total deployment: **8.19 → 7.55 MiB**, saving **670,795 bytes (7.8%)**. Added responsive variants count toward the final total. Initial local payload falls **64.3%**. The small HTML/JS increase buys responsive candidates, SDK retry handling, and visibility-aware rotation.

## Largest 15 baseline production files

| File | Before | After |
| --- | ---: | ---: |
| `assets/homelab/models/thinkpad-t16-gen2.glb` | 3,763,392 | 2,894,800 |
| `assets/homelab/models/raspberry-pi-4.glb` | 1,849,388 | 1,734,552 |
| `assets/homelab/model-viewer/model-viewer.min.js` | 979,139 | 979,139 |
| `assets/homelab/prominence-ii-world.webp` | 319,720 | 319,720 |
| `assets/me.webp` | 218,782 | 218,782 |
| `assets/ITEssentialCisco.pdf` | 214,054 | 214,054 |
| `assets/homelab/debian-operations-960.webp` | 136,994 | 136,994 |
| `assets/homelab/pihole-dashboard-960.webp` | 135,392 | 135,392 |
| `assets/QuyVuLuong_CV.pdf` | 124,982 | 124,982 |
| `assets/homelab/prominence-ii-world-960.webp` | 111,228 | 111,228 |
| `assets/homelab/thinkpad-t16-gen2-poster.webp` | 97,508 | 97,508 |
| `assets/homelab/debian-operations.webp` | 89,446 | 89,446 |
| `index.html` | 63,689 | 64,616 |
| `assets/homelab/pihole-dashboard.webp` | 63,350 | 63,350 |
| `assets/homelab/raspberry-pi-4-poster.webp` | 60,196 | 60,196 |

Complete before/after inventories: [baseline](performance/baseline-assets.json), [after](performance/after-assets.json). These include files outside the top 15.

## Models and textures

| Model | Triangles | Vertices | Nodes / meshes / materials | GLB before → after |
| --- | ---: | ---: | --- | --- |
| `thinkpad-t16-gen2.glb` | 28,510 | 26,048 | 42 / 41 / 20 | 3,763,392 → 2,894,800 |
| `raspberry-pi-4.glb` | 41,610 | 47,126 | 22 / 21 / 22 | 1,849,388 → 1,734,552 |

Neither mesh count warrants decimation for these detailed hardware models. All scene nodes are reachable; all materials are used. Indices already use 16-bit integers. Small generator/provenance metadata was retained. No transform, accessor, geometry buffer, material, sampler, node, or scene was changed.

Original embedded textures:

| Model / texture | Dimensions | PNG bytes |
| --- | --- | ---: |
| thinkpad-t16-gen2 / `screen.png` | 1920 × 1200 | 2,775,253 |
| thinkpad-t16-gen2 / `key-legends.png` | 2048 × 1024 | 67,626 |
| thinkpad-t16-gen2 / `speaker-grille.png` | 1536 × 64 | 1,094 |
| thinkpad-t16-gen2 / `underside.png` | 1882 × 1329 | 13,520 |
| thinkpad-t16-gen2 / `underside-normal.png` | 1882 × 1329 | 11,572 |
| thinkpad-t16-gen2 / `thinkpad-decal.png` | 1024 × 220 | 27,005 |
| thinkpad-t16-gen2 / `lenovo-decal.png` | 120 × 500 | 6,799 |
| raspberry-pi-4 / `hat-top.png` | 1024 × 1024 | 95,995 |
| raspberry-pi-4 / `pi-top.png` | 1024 × 1024 | 80,090 |
| raspberry-pi-4 / `powder-coat-normal.png` | 256 × 256 | 148,046 |
| raspberry-pi-4 / `oled.png` | 512 × 128 | 2,765 |

The ThinkPad screen PNG (2,775,253 bytes) was the single largest texture cost. Every embedded PNG was converted to lossless WebP when smaller. The maintenance tool compares every decoded RGBA channel before accepting the result. A separate comparison verified that all geometry buffers and structural data match the baseline. Texture dimensions remain unchanged, including screen/key legends, normal maps, and decals.

PNG already compresses file storage; these were not raw texture dumps. Neither PNG nor WebP compresses the GPU texture allocation. This change improves transfer/storage, not GPU texture memory. Further resolution reduction was deliberately avoided to preserve close-up details.

The existing 979,139-byte local runtime contains `EXT_texture_webp` support. Both real GLBs were loaded in Chromium with outside requests blocked; no Draco/Basis/WASM decoder request occurred. The GLBs declare WebP in both `extensionsUsed` and `extensionsRequired`, following the [Khronos extension specification](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_texture_webp/README.md). Static WebP posters remain the fallback. The runtime itself is unchanged (264,115 bytes with local gzip, illustrative only; the local HTTP server did not compress responses).

### Reversal / regeneration

Original binaries remain in the baseline Git commit, not in the deployed assets. Recover either into a temporary directory:

```bash
git show 1ab062f1bf9f672329541a3e8ef9b8453a7d0452:assets/homelab/models/thinkpad-t16-gen2.glb > /tmp/thinkpad-original.glb
git show 1ab062f1bf9f672329541a3e8ef9b8453a7d0452:assets/homelab/models/raspberry-pi-4.glb > /tmp/raspberry-original.glb
# Optional one-off regeneration; requires Python + Pillow, not needed for deployment:
python3 scripts/optimize-glb.py /tmp/thinkpad-original.glb assets/homelab/models/thinkpad-t16-gen2.glb
python3 scripts/optimize-glb.py /tmp/raspberry-original.glb assets/homelab/models/raspberry-pi-4.glb
```

To undo the asset optimization, copy those recovered originals over the two asset paths and remove/update the WebP-extension assertion in `tests/site.test.mjs`.

## Images

| Home Lab image | Dimensions | Before | After |
| --- | --- | ---: | ---: |
| `prominence-ii-world.webp` | 1914 × 1002 | 319,720 | 319,720 |
| `debian-operations-960.webp` | 960 × 600 | 136,994 | 136,994 |
| `pihole-dashboard-960.webp` | 960 × 496 | 135,392 | 135,392 |
| `prominence-ii-world-960.webp` | 960 × 503 | 111,228 | 111,228 |
| `thinkpad-t16-gen2-poster.webp` | 1200 × 900 | 97,508 | 97,508 |
| `debian-operations.webp` | 1920 × 1200 | 89,446 | 89,446 |
| `pihole-dashboard.webp` | 1879 × 970 | 63,350 | 63,350 |
| `raspberry-pi-4-poster.webp` | 1200 × 900 | 60,196 | 60,196 |
| `prominence-ii-world-1280.webp` | 1280 × 670 | — | 125,172 |

- **Portrait:** original `me.webp` is 218,782 bytes (1200 × 1800). Added 360 × 540 (56,992 bytes) and 720 × 1080 (127,514 bytes), WebP quality 90. Both portrait placements share candidates. The measured initial desktop/mobile view requests the 360px image; the larger candidates cover denser/larger displays. Original retained for high-density screens.
- **Operations:** browser measurements confirmed existing full-width `sizes`: 1052px at a 1440px viewport, 714.81px at 820px, 326px at 390px, 256px at 320px. They were already correct; no change was needed. Minecraft now uses the new 1280px candidate on 1× desktop (125,172 instead of 319,720 bytes); full resolution remains available for dense screens and full-size links.
- **Terminal/Pi-hole:** original and 960px images are unchanged lossless WebP. Resampling introduces more colors and makes the existing 960px files larger than their originals. Re-encoding tests made them larger, not smaller; more intermediate variants were not justified. No lossy recompression of text.
- **Posters:** retained at 1200 × 900 (97,508 / 60,196 bytes). They are already compact; lossless re-encoding increased them to 229,510 / 169,582 bytes. They stay lazy; adding a second fallback size risks a duplicate fetch when the viewer initializes its poster.
- **Skill logos:** 18 below-the-fold PNGs now use native lazy loading and async decoding. Their combined 243,749 bytes leave the initial request set. Hero social icons remain eager. Existing intrinsic dimensions on portraits, screenshots, and posters are preserved.

## CSS and application JavaScript

The baseline has 18 stylesheet requests: `main.css` plus 17 imports. The dependency-free Pages build now resolves those imports, in the same cascade order, into one 44,525-byte deployed `styles/main.css`. Authored CSS stays split into the existing source files; JS remains modular. The source-root preview can still use CSS imports. Only two demonstrably unused selectors (`.hero-hi`, `.hero-sub`) were removed. Theme defaults/overrides, responsive states, and animation rules are intentional, not dead CSS.

| CSS source | Baseline bytes |
| --- | ---: |
| `styles/sections/homelab.css` | 12,284 |
| `styles/responsive.css` | 6,006 |
| `styles/base.css` | 3,696 |
| `styles/sections/skills.css` | 3,563 |
| `styles/components/navbar.css` | 2,938 |
| `styles/sections/hero.css` | 2,733 |
| `styles/components/buttons.css` | 2,403 |
| `styles/sections/experience.css` | 2,159 |
| `styles/components/popups.css` | 1,779 |
| `styles/components/cards.css` | 1,734 |
| `styles/tokens.css` | 1,305 |
| `styles/sections/contact.css` | 1,301 |
| `styles/sections/about.css` | 889 |
| `styles/sections/certifications.css` | 760 |
| `styles/main.css` | 636 |
| `styles/sections/projects.css` | 474 |
| `styles/layout.css` | 127 |
| `styles/sections/footer.css` | 38 |

| JavaScript | Before | After |
| --- | ---: | ---: |
| `assets/homelab/model-viewer/model-viewer.min.js` | 979,139 | 979,139 |
| `scripts/modules/homelab-viewers.js` | 7,296 | 8,301 |
| `scripts/modules/ui.js` | 5,698 | 7,002 |
| `scripts/modules/skills-popup.js` | 3,285 | 3,285 |
| `scripts/modules/nav.js` | 2,170 | 2,170 |
| `scripts/modules/section-observer.js` | 2,079 | 2,079 |
| `scripts/modules/projects-toggle.js` | 1,018 | 1,018 |
| `scripts/main.js` | 1,006 | 1,006 |
| `scripts/modules/homelab-toggle.js` | 1,002 | 1,021 |
| `scripts/modules/experience-toggle.js` | 808 | 808 |

- **3D lifecycle:** runtime remains a dynamic import; GLB `src` remains unset until expansion and hardware proximity. The existing 240px margin is retained to prepare before arrival. A late runtime completion checks both collapse and proximity before setting `src`.
- **Rotation:** observers continue watching loaded cards. Rotation requires ready, expanded, nearby, visible-tab state and no reduced-motion preference or active interaction/resume delay. Collapse stops rotation immediately; reopening re-observes cards. Existing camera interaction and three-second resume delay remain.
- **Other JS:** no measured initial long-task bottleneck justified changing navigation, reveal, scroll progress, project controls, or popup behavior. Nine small modules are retained rather than introducing a JS bundler.

## Fonts and third parties

- Google Fonts: Manrope 400/600/800 and Space Grotesk 600/700, with `display=swap`, Google API preconnect and cross-origin font preconnect. Kept to avoid typography changes; external font timings were not measured in the controlled audit.
- Google Analytics (`G-Z6FYNPRYBW`) and GoatCounter remain asynchronous and unchanged. Delaying them until interaction would lose short-visit analytics; no such feature change was made.
- EmailJS: removed the unconditional head script. One shared, retryable SDK request starts on contact-form focus; valid submit also awaits it (including autofill). A 15-second SDK timeout restores the form after a stalled request. Initialization IDs and sending logic remain the same. Failed loads can retry; drafts and duplicate-submit protection are preserved.
- LinkedIn has ordinary links/icons; there is no active badge/iframe embed to defer. README corrected accordingly.

## Controlled browser performance

Lighthouse was not installed. The equivalent local audit used Playwright with Chrome for Testing 156.0.8078.4, three fresh contexts per viewport and snapshot, 150ms network latency, 200,000 bytes/sec download, 93,750 bytes/sec upload, and 4× CPU slowdown. Viewports: 1440 × 900 at DPR 1, 390 × 900 at DPR 2. Default motion behavior was enabled. Both snapshots came from `_site/` and used the same Python HTTP server without HTTP compression.

**Limits:** fonts, analytics, and all other outside requests were deliberately blocked for repeatability and to avoid sending test analytics. Measurements below are local response-body bytes, not complete internet transfer sizes or Lighthouse scores. Long-task blocking is a simple observed sum above 50ms, not Lighthouse TBT. These results do not establish real-user Core Web Vitals. GPU checks use software WebGL.

| Viewport / metric (median of 3) | Before | After |
| --- | ---: | ---: |
| 1440px / FCP | 1.528s | 1.236s |
| 1440px / LCP | 3.552s | 1.820s |
| 1440px / DOMContentLoaded | 2.353s | 1.639s |
| 1440px / CLS | 0 | 0 |
| 1440px / Observed long-task blocking | 0ms | 0ms |
| 390px / FCP | 1.496s | 1.192s |
| 390px / LCP | 3.548s | 1.780s |
| 390px / DOMContentLoaded | 2.354s | 1.608s |
| 390px / CLS | 0 | 0 |
| 390px / Observed long-task blocking | 0ms | 0ms |

One optimized desktop run recorded a 63ms long task (13ms excess); the other five recorded none. No CLS was observed in any run. Raw measurements: [baseline](performance/baseline-metrics.json), [after](performance/after-metrics.json).

### Reproduce the optional browser audit

No browser tooling is added to package dependencies or deployment. Use an existing Playwright installation/browser or install them in a temporary QA directory. Place the baseline and optimized `_site` snapshots at `/tmp/portfolio-perf/baseline/` and `/tmp/portfolio-perf/after/`. Start:

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory /tmp/portfolio-perf
# In another terminal; supply the local Playwright module and Chromium executable:
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_PATH=/path/to/chrome node docs/performance/measure.cjs baseline
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_PATH=/path/to/chrome node docs/performance/measure.cjs after
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM_PATH=/path/to/chrome node docs/performance/validate.cjs after
```

Audit JSON and screenshots are written under `/tmp/portfolio-perf/`. The validation harness blocks third parties and provides a fake EmailJS transport; it sends no real email.

## Validation

- Passed `npm run build`, `npm run build:check`, `npm run lint`, `npm test`, and `git diff --check`; also rebuilt with `npm run build:pages`.
- 23 Node regression tests cover existing contact behavior plus SDK load sharing/retry, deferred runtime/model loading, collapse-during-load, scroll-away-during-load, fallback, rotation interaction delays, live reduced-motion changes, visibility changes, disclosures, and production CSS assembly.
- Chromium 1440/820/390/320px, dark/light: both actual GLBs loaded using local resources; zoom/reset, keyboard and pointer orbit, rotation offscreen pause/resume, reduced motion, collapse/focus return, no horizontal overflow, correct uncropped Operations images, project See More/Less, responsive navigation, theme toggle, invalid email, SDK failure/retry, and two successful mocked submissions per viewport.
- WebGL draw-call instrumentation over one-second windows found **zero offscreen draw calls in both baseline and optimized builds** (visible windows: 2,052 / 2,160 calls; timing-dependent). The runtime already culled offscreen rendering; the new guards explicitly pause/resume auto-rotation and hidden-tab/collapse state, rather than claiming a pre-existing GPU rendering bottleneck.
- No-JavaScript page exposes the full case study and both static previews. WebGL-unavailable behavior is covered by unit tests and a real-browser fallback check.
- Separate binary comparison: all non-image GLB bufferViews byte-identical; every texture dimension and decoded RGBA channel identical. Both GLBs retain every node/material.
- Production allowlist excludes node_modules, tests, audit reports, maintenance scripts, and build tools. `_site/` is freshly recreated to avoid stale deleted assets.

## Intentionally unchanged / next opportunities

No decimation, texture downscaling, lossy model compression, Draco/Basis decoder dependencies, runtime replacement, analytics removal, font-family changes, or screenshot text recompression. Large GLBs remain deferred; runtime minification is already present. Its potential CDN decoder defaults are not used by these assets.

Highest-value follow-ups: measure the live deployed site with real fonts/analytics and GitHub Pages transfer compression; consider self-hosted/subset fonts only after that measurement. If hardware load latency remains significant on target mobile devices, benchmark locally hosted Meshopt/Draco/KTX2 against decoder cost and close-up visual quality. Lossless WebP does not reduce GPU memory; any future texture-resolution reduction needs device-level visual checks. No further speculative refactor is justified by this audit.
