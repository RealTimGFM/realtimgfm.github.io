# Portfolio engineering upgrade — 2026-11-03

## Changes completed

- Home Lab now includes a hardware/workload register, owner-reported Nextcloud/Compose architecture, application/database/cron responsibilities, persistence and restart explanations, and separate private tailnet, public game tunnel, and local DNS paths. Static HTML figures explain their relationships without JavaScript. Configuration is distinguished from current operational status, and ambiguous resource specifications are not assigned to the pictured ThinkPad. Existing hardware models, runtime deferral, posters, redacted screenshots, and expansion controls remain.
- Experience now leads with Machine Builder, followed by Activists of Tomorrow and DART. A visible note explains relevance-based ordering. Dates, roles, Montreal locations, employer links, all technology tags, and all 14 detailed responsibility bullets remain. Summaries are shorter; financial correctness, accountant validation, and production diagnostics are easier to scan. DART's existing Present date has an explicit owner-review source comment.
- Projects retains all 11 records, original order, all 19 distinct original project URLs, and See More/Less. Engineering case-study disclosures were removed at the owner's subsequent request. Stable project-* anchors, concise overviews, and direct test/document links remain. Text badges distinguish In Development, Implemented, and Published Extension; implementation does not certify completion or current hosting. Demo links clearly say availability is unverified. Carousel sources, illustrations, navigation, 3000ms timing, and crossfade are unchanged.
- Metadata adds a descriptive backend title, canonical URL, Open Graph and Twitter image cards, image descriptions, and conservative Person JSON-LD. A locally authored 1200 × 630 PNG matches the existing colors and Roboto type. No portrait or third-party imagery was invented.
- Contact keeps the existing EmailJS integration, honeypot, client validation, accessible status, and duplicate-send guard. Fast entry and autofill no longer trigger an elapsed-time rejection. Required fields have associated errors and invalid-state semantics. Success resets the form; failed delivery retains the draft. Missing SDK, rate limits, and failures explain recovery through retry or visible LinkedIn links. No mailto address was inferred or published.
- About copy is grammatical and personal, retains books, Hans Zimmer, learning, applications, APIs, automation, and helping others, and avoids an unverified currently-employed assertion. AI Note Search wording was corrected using its public README and workflow: Streamlit semantic retrieval and a manual wake workflow, rather than Flask summarization and a scheduled wake job.

## Files created or changed by this task

| Files | Purpose |
| --- | --- |
| index.template.html; generated index.html | Search/social metadata and generated section content. index.html was regenerated only through the build. |
| partials/experience-records.html; partials/experience.html | Relevance ordering, concise contributions/summaries, ordering explanation, preserved dates and factual review note. |
| partials/projects.html | Project overviews, stable anchors, direct verified evidence, standard text statuses, demo qualifications, AI Note Search corrections. |
| partials/homelab.html; new partials/homelab-infrastructure.html | Integrate infrastructure register, container diagram, private/public/local network diagram, and status qualifications. |
| partials/about.html | Natural copy and employment-consistent wording. |
| partials/contact.html; scripts/modules/ui.js | Visible fallback, required labels, associated errors, immediate/autofill sends, draft-preserving recovery. |
| styles/sections/projects.css; styles/sections/homelab.css; styles/sections/contact.css | Native disclosures, ruled registers, responsive static diagrams, field errors; existing theme tokens. |
| tests/contact-form.test.mjs | Update timing expectations and add field/error/autofill/rate-limit regressions. |
| new tests/engineering-content.test.mjs | Employment, project overviews/direct evidence, all projects, references, static content, metadata, image dimensions, generated HTML, Pages asset checks. |
| new tests/featured-carousel.test.mjs | Four slides, manual/automatic navigation, unchanged delay, pause conditions, reduced motion. |
| new assets/social-preview.png; assets/social-preview.png.json; scripts/create-social-preview.ps1 | Small static preview, provenance, and reproducible Windows authoring utility; no production dependency. |
| README.md; DESIGN.md; assets/PROVENANCE.md; new IMPLEMENTATION_REPORT.md | Maintenance guidance, design extensions, provenance, evidence and unresolved questions. |

The checkout already contained many modified and untracked Balanced Folio files. They were retained and edits were made against that working state. The whole-tree git diff/stat includes those earlier changes and is not a task-only statistic. DESIGN.md and PROVENANCE.md are ignored by existing .gitignore rules; their local documentation was updated without changing those rules or staging files. Temporary QA logs and the PDF reader are confined to ignored build/task-qa/. No package manifest or lockfile changes, commits, pushes, merges, deployments, or resume/certificate edits were made.

## Evidence and verification

| Claim | Basis and limits |
| --- | --- |
| Employment responsibilities, titles, locations, dates; thousands of financial transactions | Existing owner-authored experience content. Local resume text corroborates the dates, roles, backend stack, and thousands wording. Not independent confirmation of employment or transaction counts. No more precise count or performance metric added. |
| Certificate name and issuer | Existing certificate PDF text matches IT Essentials: PC Hardware and Software and Cisco Networking Academy. Wording and PDF preserved. |
| Nextcloud, Compose, separate app/database/cron, Tailscale Serve, loopback port 8080 | Explicit owner-provided task context, labeled configured rather than active. No private endpoints or Compose files published. |
| Resource specifications | Explicit owner report: 13th Gen i7, approximately 16 GB RAM / 512 GB SSD. Device attribution explicitly unconfirmed. ThinkPad T16 Gen 2, Debian 12, Raspberry Pi 4, Pi-hole, SSH, Prominence II and playit.gg come from existing lab content/media. Screenshots are historical evidence, not live monitoring. |
| General Nextcloud background jobs and private HTTPS forwarding | [Nextcloud background-job documentation](https://docs.nextcloud.com/server/latest/admin_manual/configuration_server/background_jobs_configuration.html), [Tailscale Serve documentation](https://tailscale.com/docs/features/tailscale-serve). These explain product behavior; they do not verify the owner's host. |
| FinCore layers and account/transaction behavior | Existing portfolio, public repository structure, [account tests](https://github.com/RealTimGFM/FinCore/blob/main/FinCore.Tests/Accounts/AccountTests.cs), and [transaction tests](https://github.com/RealTimGFM/FinCore/blob/main/FinCore.Tests/Transactions/TransactionTests.cs). Inspected transition/history, validation, and reversal test source; did not run FinCore tests. |
| ForexAlert reliability and alert-only scope | Existing portfolio, [public architecture README](https://github.com/RealTimGFM/ForexAlert/blob/main/README.md), [monitor tests](https://github.com/RealTimGFM/ForexAlert/blob/main/tests/ForexAlert.Tests/ForexMonitorTests.cs), and [notification tests](https://github.com/RealTimGFM/ForexAlert/tree/main/tests/ForexAlert.Tests/Notifications). Inspected reconnection/stale-data test source and Twilio fake-HTTP tests. No project test execution, broker session, or SMS delivery claimed. |
| PomodoroYT published extension, playback workflow and ad muting | Existing content plus [Chrome Web Store listing](https://chromewebstore.google.com/detail/pomodoroyt/dkhilbkmbjlphkofidchfbnapbmfcnam). Source/tests were unavailable for review; tasks/themes/settings/TypeScript remain existing owner-authored claims. SoundCloud web timer stays explicitly separate. No ad-skipping claim added. |
| Schedule Booker locking and database integration tests | Existing portfolio and supplied task context only. No public repository/test URL was supplied or verified. The implementation report records this evidence limit. Demo retrieval failed; that does not establish an outage. |
| AI Note Search technology, retrieval and manual wake behavior | [Public README](https://github.com/RealTimGFM/SmartNoteSystem/blob/main/README.md) and [workflow source](https://github.com/RealTimGFM/SmartNoteSystem/blob/main/.github/workflows/uptime.yml), inspected for this update. No live demo success claimed. |
| Original GitHub destinations | All ten linked repository roots returned public repository metadata through the GitHub connector: FinCore, ForexAlert, Pomodoro, FaceRecognitionPython, ProjectUnknown, SmartNoteSystem, PrjSimpleTrading, Winter2024_PrjBankATM, WaterReminder, and realtimgfm.github.io. New deeper links were checked against directory listings/file responses; no branch names guessed. |

Demo checks: Schedule Booker, Facial Authentication, Mini ATS, the SoundCloud web timer, Water Reminder, and the portfolio live URL could not be retrieved by the web tool. AI Note Search returned a redirect-loop error. Those outcomes are verification limits, not proof that the services are down. Existing URLs remain. The Chrome listing was readable. Existing LinkedIn profile/post destinations were retained; no authenticated LinkedIn UI verification was performed.

## Questions requiring owner confirmation

1. Is DART still current, and is July 2026 – Present accurate today? All original dates were kept; no end date invented. The resume agrees with the existing page but cannot establish present employment.
2. Which physical server has the reported processor, RAM, and SSD? Confirm the ThinkPad association and exact resources before removing the attribution qualifier.
3. Which lab services are currently running: Nextcloud, database/cron, Tailscale Serve, SSH access, Minecraft/playit.gg, and Pi-hole? Current health, uptime, utilization, and throughput were not measured.
4. Confirm the actual database engine, mount/volume arrangement, backup/restore practice, image versions, restart policy, boot behavior, and any historical versus still-configured service distinctions before publishing those details. No secrets or private paths are needed for this confirmation.
5. Supply an exact email address explicitly approved for publication on this portfolio. None was inferred from PDFs, the extension listing, or account metadata. LinkedIn is already available without JavaScript.
6. Supply shareable PomodoroYT extension source/test evidence and Schedule Booker source/integration-test evidence if public technical verification is desired. Existing behavior is qualified rather than assigned invented test results.
7. Confirm current demo availability and project maturity where relevant. Implemented describes documented functions, not completion, reliability, or a live deployment. Verify other projects' CI/deploy behavior before treating tooling badges as present health.

## Quality assurance

| Check | Result |
| --- | --- |
| Initial npm ci | Failed: npm reported Exit handler never called; sandbox registry requests had EACCES and default cache logs were unwritable. |
| Dependency recovery | npm ci --cache build/task-qa/npm-cache --fetch-retries=0 --no-audit --no-fund succeeded with approved registry access; 118 locked packages installed. No manifest/lockfile changed. |
| Baseline build / build:check / build:pages | Passed before source edits. |
| Baseline tests | 17 passed, 0 failed. |
| Baseline lint | Could not run after the failed install because stylelint was unavailable. Tooling problem resolved by the successful installation. |
| Final npm run build | Passed. |
| Final npm run build:check | Passed; generated HTML matches sources. |
| Final npm run lint | Passed; 20 CSS files, 0 problems. |
| Final npm test | 29 passed, 0 failed. EmailJS is mocked; no real emails sent. |
| Final npm run build:pages | Passed; tests also compare emitted HTML and required new/preserved binary assets. |
| git diff --check / git diff --stat | Executed successfully. Git reported existing LF→CRLF normalization notices; status also warns that the user's global Git ignore file cannot be read. No whitespace errors. |
| Static HTML check | Python HTMLParser nesting check passed; IDs, anchors, labels/descriptions/controls are covered by regression tests. |
| Asset QA | Social PNG visually inspected; dimensions 1200 × 630, approximately 17 KB. Both hardware GLBs/posters, screenshots, resume, and certificate are retained; existing model and fallback regressions pass. |
| Design detector | Executed once over changed UI sources: 37 advisory color/type-ramp findings, no non-advisory findings. Partial HTML inspected without its full stylesheet reports default black; section CSS uses existing type sizes/feedback colors and semantic theme tokens. No blanket suppression or design-system replacement applied. The pre-existing sidecar-staleness advisory remains outside this upgrade. |
| Browser QA | Unavailable: browser inventory was empty and creating an in-app browser returned Browser is not available: iab. No browser rendering, console, real keyboard/touch, zoom, layout-shift, or live WebGL checks were completed. |

Responsive visual checks at **320, 360, 390, 768, 1000, 1280, and 1536px, light and dark**, remain unexecuted. Static CSS review confirms stacking rules and inherited theme/focus/reduced-motion styles, but is not evidence of overflow-free rendering. Real keyboard activation of disclosures, navigation, contact error states, JavaScript-disabled browsing, and model interaction need a browser pass. The full engineering content is in generated HTML; native details provide non-JavaScript disclosure.

Baseline/final command outputs, the source snapshot used to preserve local work, the detector output, and a static nesting checker are retained locally in ignored build/task-qa/. These are QA artifacts, not deployment content.

## Before and after

Professional positioning now leads with the most relevant financial backend work while preserving history. Technical credibility improves through qualified infrastructure claims, linked test source, and explicit evidence limits. Projects offer concise overviews and direct engineering evidence without expandable case studies. Home Lab explains container and network responsibilities alongside its existing physical media. Contact supports immediate and autofilled submissions with specific recovery paths. Search and sharing now have a consistent canonical profile and local preview image. Balanced Folio and the static GitHub Pages architecture remain intact; all changes stay local.

Owner-requested follow-up: removed all four engineering case-study disclosures and their unused CSS, retained direct evidence links with the project actions, updated social description and regression expectations, and regenerated the static page.


## Nextcloud evidence integration — 2026-11-04

This record supersedes earlier uncertainty about the Nextcloud database engine, image tags and service count. The owner supplied two authentic captures; their contents establish point-in-time deployment facts, without establishing current availability, Redis configuration, volume paths or backup procedures.

### Files changed in this task

| Files | Change |
| --- | --- |
| partials/homelab-infrastructure.html | Four-container architecture, image tags, persistent storage, and compact capture status linking to Docker evidence. |
| partials/homelab.html | Two new captures grouped as Self-hosted File Storage inside expanded Operational Evidence. |
| styles/sections/homelab.css | Group heading, service image labels, shared storage and capture summary styles using existing theme tokens and breakpoints. |
| index.html | Regenerated by the build; never edited directly. |
| README.md | Five-capture inventory, architecture facts, redaction and replacement workflow. |
| tests/engineering-content.test.mjs | Architecture, gallery uniqueness, paths, opaque redactions, sanitized checksums, original exclusion, Pages copies and unchanged-model checks. |
| tests/fixtures/nextcloud-evidence.json | Reviewed asset hashes, dimensions, redaction rectangles, original exclusion fingerprints and retained-media/script hashes. No original images. |
| scripts/prepare-nextcloud-evidence.ps1 | Reproducible, dimension-guarded pixel redaction and thumbnail preparation using System.Drawing. |
| assets/homelab/nextcloud-files.png and nextcloud-files-960.png | Sanitized 1874 × 970 original-size capture and 960 × 497 thumbnail. |
| assets/homelab/nextcloud-docker.png and nextcloud-docker-960.png | Sanitized/cropped 1919 × 474 capture and 960 × 237 thumbnail. |
| Four matching .png.json sidecars | Owner-supplied screenshot provenance; no generated UI. |
| IMPLEMENTATION_REPORT.md | This completion record. |
| DESIGN.md and assets/PROVENANCE.md | Updated local design/provenance documentation. These files remain ignored by the existing .gitignore. |
| _site/ | Refreshed local GitHub Pages artifact including every sanitized image and existing asset; ignored by Git. |

Existing changes to styles/responsive.css and tests/site.test.mjs were present before this task and were preserved. The six-part hierarchy, private/public/local access regions, Raspberry Pi information and existing gallery captures remain.

### Architecture and evidence

Authorized device → Tailscale → Tailscale Serve HTTPS leads into a conceptual Debian/Docker Compose environment. Four services are distinguished: Nextcloud App (nextcloud:apache), PostgreSQL 17 (postgres:17-alpine), Redis 7 (redis:7-alpine), and independent Cron (nextcloud:apache). Storage is a separate durable-data layer, rather than a fifth container. PostgreSQL holds application metadata, while user file contents reside in persistent file storage. Cron shares application configuration and file resources; no connector asserts a direct Cron → PostgreSQL dependency. Redis responsibilities are intentionally limited to the confirmed service label.

The compact status strip reports four running containers, about seven days up and healthy PostgreSQL at capture, and links directly to the evidence. These are historical observations. No live metric or host-memory claim was added.

Operational Evidence now contains exactly five unique captures: Debian Operations, Prominence II, Pi-hole Dashboard, Nextcloud Files and Docker Compose. The last two share Self-hosted File Storage. Every capture retains proportions, descriptive alt text, intrinsic dimensions, lazy responsive loading and full-size links. No screenshot is repeated elsewhere.

### Privacy and asset inspection

The actual local originals were located in Pictures/Screenshots and visually matched to both supplied chat images. Originals were never copied into the repository or Pages artifact.

- Files: opaque black rectangles permanently replace the suggested personal folder label and both personal folder labels in the grid.
- Docker: the terminal title bar and trailing prompt were cropped; opaque rectangles remove all remaining shell identities, the sudo identity, the local Compose path, and the container-ID column.
- Container names, image tags, running/healthy statuses, Compose project and resource values remain readable and unchanged.
- Both derivatives were drawn onto fresh RGB bitmaps, discarding source metadata. Thumbnails derive only from those sanitized bitmaps. Full-size PNGs total approximately 154 KiB; no conversion dependency was added.

Both sanitized full-size images were visually inspected. Regression checks decode every PNG, verify opaque RGB format, inspect all masked pixels, pin reviewed asset hashes, reject original file fingerprints in deployable trees and compare Pages copies. All five gallery files and responsive variants exist with valid paths. Rendered gallery display remains unverified because browser access was unavailable.

### Verification results

| Command/check | Result |
| --- | --- |
| npm run build | Passed. |
| npm run build:check | Passed; generated HTML matches partials. |
| npm run lint | Passed; 20 CSS sources, zero problems. |
| npm test | Passed; 46 tests, zero failures. |
| npm run build:pages | Passed; sanitized and retained image bytes included in _site. |
| git diff --check | Passed; only existing Git LF/CRLF normalization notices. |
| Models, previews and behavior preservation | SHA-256 checks confirm both GLBs, both posters, homelab-toggle.js and homelab-viewers.js are unchanged. Hardware-section markup also matches the pre-task source byte for byte. Existing model controls, visibility, motion, fallback and disclosure behavior tests pass. |
| Accessibility and internal paths | Unique IDs, fragment targets, ARIA references, local image/model paths, captions and full-size links pass automated checks. |
| Design detector | Ran once; 27 advisory color/type findings and zero non-advisory findings. Isolated partials report unstyled default black; styles retain semantic colors and existing type sizes. No palette or typography replacement was made. |
| Browser QA | Browser inventory empty; opening iab returned Browser is not available: iab. |

Rendered checks at 320, 390, 768, 1280 and 1536px in light and dark themes remain unexecuted. Overflow, line placement, actual caption wrapping, keyboard/touch use and live WebGL interaction require a browser pass. Automated behavior checks and preserved responsive/theme/reduced-motion CSS do not substitute for that visual pass.

The pre-existing Impeccable sidecar is older than DESIGN.md; the document command can refresh it while preserving the design document. No commit, push, merge, deployment, dependency installation or hosting change was performed.
