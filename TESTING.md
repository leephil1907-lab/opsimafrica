# Verification and acceptance

**OpsSim Africa v2.0 — BrightMart + business website**

Environment: Node 20.20.2, Chromium headless / software WebGL, Linux. Release work date: **8 November 2026**.

## Verification status

| Check                                                                           | Result                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| API / unit / persistence / gesture tests                                        | **66 / 66 passed**                                           |
| BrightMart one-right-hand XR loop + AR / document / tracking test               | **2 / 2 passed in the targeted run**                         |
| Draft identity and nine-state accessibility regression                          | **2 / 2 passed in the targeted run**                         |
| Complete serial browser regression                                              | **45 / 45 passed; 0 retries / skips / flaky tests**          |
| TypeScript + production build                                                   | **Passed**                                                   |
| Dependency audit                                                                | **0 reported vulnerabilities**                               |
| Offline design kit: 320 / 390 / 1440 layouts, embedded assets / video, axe      | **Passed; 0 axe violations**                                 |
| Compiled production smoke for public site, current lesson and historical lesson | **Passed**                                                   |
| Fresh backup / isolated restore                                                 | **Passed**                                                   |
| Formatting / final package / remote source                                      | **Format passed; see delivery manifest for packaged source** |
| Physical Quest hands, actual passthrough, comfort / performance                 | **Not tested**                                               |
| Docker build / run                                                              | **Not tested**                                               |
| Permanent hosting / competition eligibility / submission                        | **Not completed**                                            |

Machine-readable results are in `docs/VERIFICATION.json`; the readable release summary is `docs/RELEASE.md`. Detailed release evidence is included under `release-evidence/` in the delivery archive; development runs use the ignored `artifacts/` directory. A failed or interrupted development report is not release evidence.

## Reproduce

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run format:check
npm audit
```

The **45 browser checks** run serially with **no configured retries**, against port **3100** and a disposable `.cache/e2e.sqlite`. They do not reset or use `data/opssim.sqlite`. Do not run another suite on 3100 or edit application source during verification. Reference captures are written to `artifacts/brightmart/`; they do not mutate live public images. Generated docs, scripts, test outputs and private data are excluded from the Vite watcher.

Allow several minutes for the full suite. Software-rendered XR is deliberately slower than an actual task and is not a device benchmark. Browser-dependent iframe / WebXR permissions should be checked on the deployment host.

### Standalone production smoke

After building, use two terminals and an **isolated database**:

```sh
# Terminal 1: keep running. Never use a private/live DB for this test.
PORT=3200 DB_PATH=.cache/production-smoke.sqlite npm start

# Terminal 2: creates only fictional request and training records.
BASE_URL=http://127.0.0.1:3200 node tests/production-smoke.mjs
```

This checks:

- Health and six direct public routes, local assets and the 60-second player.
- A real form receipt, clear no-automatic-booking message and no public lead listing.
- BrightMart: all eight cartons; correct per-item condition / disposition; **22 received / shortage 2**; explicit Review then Confirm; **100 = 35 + 25 + 25 + 15**; reload; harder twelve-carton entry and pause.
- Historical receiving: ten cartons; manual 8 accepted / 2 quarantined / 0 short reconciliation; explicit submission; 100; restored scorecard.
- No browser errors or failed resources; no Vite development client or development XR diagnostic poses exposed by the compiled bundle.

The smoke report records `physicalQuestVerified: false`.

### Backups and restore

`npm run backup` uses SQLite's online backup API. A ready-made private-copy check is available:

```sh
node scripts/verify-backup.mjs backups/current.sqlite backups/pre-update.sqlite
```

The second path is optional and adds exact preservation checks for pre-update completed results and frozen manifests. No contact fields are printed. To validate a restore manually, copy the resulting file into an isolated directory, open it using `openDatabase`, install the idempotent routes, and run `PRAGMA integrity_check`. Check original session IDs / statuses / scores, frozen manifests, per-carton records, assignments and contact-request counts before and after reopening. Do not publish backup contents or contact rows as evidence. A count / equality / integrity summary is sufficient.

The final release must not package live SQLite files, private CSVs, credential helpers, `.env` or tokens. Keep an existing source database and its backup separately.

## What the 66 API / unit tests cover

- **16 original workspace tests:** health / bootstrap, four playable question-based workflows, authoritative time and scoring, duplicate / stale guards, validation, members, assignments, custom publishing / deletion, settings, sample removal, formula-safe CSV and persistence.
- **16 historical receiving tests:** hidden marking fields; ten / twelve-carton manifests; damage, expiry, SKU and cold-chain feedback; version, paused and completed guards; manual reconciliation; time penalties; legacy-endpoint isolation; team / invitations / defaults; comparable assignments and previous results; frozen manifests and reopen behaviour.
- **5 gesture / spatial tests:** pinch and grip hysteresis; tracking cancellation; poke / retraction; drop volumes; distinct carton and shelf positions.
- **20 BrightMart tests:** exactly eight cartons and the 22/24 sound partial delivery; perfect 35/25/25/15 rubric; harder shortage / overage separation; exact deductions; early isolation; process order; optimistic versions; duplicate records; review-token invalidation; immutable completed results; persistent pause / time; compatible replay comparison; assignments / defaults; invalid input; engine isolation and frozen state across database reopen.
- **8 lead tests:** validated, consented SQLite storage; demo / waitlist separation; receipt not booking; honeypot; rate limiting; no public listing; 90-day cleanup; SQL / reflected-data safety.
- **1 owner-export test:** recent private contact export, spreadsheet-formula neutralisation, safe quoting, owner-only file mode, source/public-directory rejection and bounded retention window.

Scores and completion criteria come from the server; a client cannot submit a fabricated score or use the old answer endpoint to complete a BrightMart run.

## What the 45 browser checks cover

### Original workspace — 17

Search / category / difficulty filters; all four earlier workflows; Three.js raycasting; save / reload / resume; learner creation and assignments; scenario builder / local drafts; filtered report downloads; settings; notifications and keyboard access; mobile navigation; no-WebGL fallback; labelled sample removal; automated WCAG A / AA checks.

### BrightMart desktop / touch — 8

1. Correct deliberate errors, accept the 22 sound gloves, record shortage 2, explicitly review / confirm and save **88**; reload; clean comparable replay **100 / +12**; harder replay.
2. Local quantity / note draft, pause, reload, resume and server-saved line without auto-submission.
3. Team naming, invitation join, focused assignment, duplicate-assignment feedback and trainer defaults.
4. 320 / 390-pixel touch layout, at-least-48-pixel quantity targets, no free-text quantity input.
5. Axe checks across profile, briefing, delivery note, inspector, record, sort, manager, hand keyboard and trainer; the completed scorecard is also checked in the full loop.
6. Full operational loop and report with WebGL unavailable.
7. Labelled real product captures for the site / walkthrough, including expected 24 / received 22.
8. Instrument every draft-storage write while switching unsaved cartons and starting another run. No transient value is written under a different carton / run identity.

### Six-page public website — 7

Direct routes and one main heading; local image / font / video assets; honest available / coming-soon labels; mobile navigation and no overflow at 320 / 390 / 768; validated contact request and receipt; business waitlist intent; recoverable network / server errors; video captions / modal / Escape / focus restoration; desktop / mobile axe checks; immediate practice entry, root-site historical hash links, cross-engine deep-link isolation, invite query changes and browser Back / Forward navigation.

### Immersive hands — 5

Tests inject **Meta IWER 2.8.0**, using its Quest 3 preset, before loading the application. **Both controllers and the left hand are disconnected; only the right hand is connected.** IWER is test-only; it is not IWSDK and is not part of the shipped runtime.

After the initial browser click to enter immersive mode, the tests send raw hand poses, transforms, pinch / grip values and finger movements. They do not call application callbacks, set form state, or use task-action APIs to complete the XR journey. API reads verify saved outcomes; setup configures an extended target for software-emulator timing.

1. **Current eight-carton loop:** manager and guide / comfort navigation; all delivery-note pages; inspect / label / record every carton; eight real ray-drag / release placements; condition and quarantine choices; near-poke received quantity from 24 to 22; all review pages; prove Review is still in progress; explicitly Confirm; saved 100; scorecard / coaching pages; twelve-carton harder replay in the **same** session; explicit exit / pause.
2. **Current physical-document and interruption path:** grab the reference paper with the emulated hand, move / rotate it and replace it; opening it records note reading before handling; begin; lose tracking; pause; reconnect and explicitly resume; verify alpha-blended immersive-AR hides the virtual room shell.
3. **Historical full ten-carton loop:** roles / guide / briefing; paged PO / invoice; all carton inspections and hand drags; quarantine reasons; virtual numeric keypad; manual 8/2/0 reconciliation; Review / Confirm; scorecard / recommendations; harder twelve-carton replay; exit in one controller-free session.
4. **Historical near and manager interaction:** poke latch / retraction; near-grab, move and rotate a carton; tracking loss cancels a held object without placing it; XR focus loss pauses; explicit resumes; immersive team-name keyboard and save.
5. **Historical AR path:** alpha-blended session, transparent renderer and hidden room shell while hands / UI remain available.

Development-only diagnostics expose read-only scene transforms to target raw input. They do not expose the private marking key, are not an action API, and are removed from production. The input helper only suppresses IWER's expected session-ended rejection when the hand itself activates Exit; other failures are not swallowed.

**Do not conflate these tests with hardware proof.** Single-eye software-rendered screenshots and extended 900-second emulator targets are not human completion-time, stereo comfort, hand-tracking quality, physical reach, passthrough or frame-rate evidence.

## Design / media validation

```sh
node scripts/concepts.mjs
python scripts/design-kit.py
BASE_URL=http://127.0.0.1:3000 node scripts/visual-qa.mjs
```

The handoff is self-contained: fonts, screenshots, SVG wireframes, MP4 and VTT are embedded. Layout checks cover 320 / 390 / 1440, image decoding, a 60-second embedded video and zero axe violations. Main website captures explicitly await rendered content and fonts rather than recording the lazy-loading screen.

Colour measurements are saved in `docs/CONTRAST-CHECKS.json`. Normal text needs 4.5:1; large text / essential UI boundaries need 3:1. **White on brand green #00A86B is only 3.08:1 and must not be normal body text.** Use navy-on-green actions or accessible dark-green links. The handoff labels the unsuitable normal-text pair rather than claiming all palette combinations pass.

Product screenshots are actual desktop captures. The opening trainee illustration is AI-generated. The 60-second promotional MP4 is a captioned still-image walkthrough, **not a physical headset recording**. See `docs/ASSET-REGISTER.md` for file-level provenance.

## Physical-headset acceptance — still required

Use a compatible Quest, a current browser, a direct HTTPS URL and hand tracking enabled, with **no paired controller**. Use fictional data and record the headset / OS / browser, date, lighting, handedness, failures and footage. Ask a trainee to read the operational instructions rather than using a test answer key.

- [ ] Enter from the direct page with hands and no controller; test fresh, returning and deep-linked runs.
- [ ] Test seated and standing / stationary initial head poses; no walking or large movement is needed.
- [ ] Read the task panel and tablet comfortably; adjust distance, seated mode and text size. Verify no clipping, uncomfortable gaze or inaccessible targets in each mode.
- [ ] Navigate trainee, guide, brief, paged note, inspector, form, review, confirmation, scorecard and replay without leaving XR.
- [ ] Ray-pinch distant controls; poke near controls once while held, retract and activate again.
- [ ] Grab, move, rotate and replace the document and tablet; their targets follow their transforms.
- [ ] Bring a carton closer, rotate and inspect it; release into each labelled Health & Wellness, Grocery & Household and separate Quarantine zone. Rejected moves return safely.
- [ ] Complete all **eight** standard cartons, including accepting **22 sound units / shortage 2**, and explicitly Review then Confirm.
- [ ] Read saved 35 / 25 / 25 / 15 scoring, time, exceptions and two next priorities. Replay same / harder and reopen a saved result.
- [ ] Repeat essential actions right-handed, left-handed and with both hands. Emulator coverage of one right hand is not proof of physical left-hand usability.
- [ ] Pause while holding an object; remove / occlude the hand; lose / regain tracking; no stale object movement or accidental placement occurs.
- [ ] Open system UI / lose XR focus; the run pauses and waits for explicit resume. Exit / re-enter and reload without silently restarting the clock.
- [ ] Name / join a team with the in-world keyboard, assign focused practice and open the resulting scorecard.
- [ ] If immersive AR is supported, verify **actual passthrough**, physical-space awareness and contrast against real light / dark backgrounds. Transparent emulator rendering does not prove this.
- [ ] Measure sustained frame time, draw calls, input latency, thermal behaviour and session stability on the target device.
- [ ] Have a real trainee complete and explain the workflow within the intended session duration; evaluate instruction clarity and comfort without coaching from the test script.

Do not sign off these checkboxes from emulator screenshots.

## Remaining product / deployment boundaries

- Shared-demo identities are not authentication, secure roles or multi-tenancy.
- Private contact requests need an accountable owner, controlled storage / exports, follow-up and a reviewed retention policy before real public use.
- In-memory anti-abuse limits are per process, not distributed or a security certification.
- No external booking / email / CRM delivery, arbitrary ERP import, native SDK migration or additional immersive roadmap module is implemented.
- No physical Quest, Docker, public-pilot outcome, permanent deployment or competition-eligibility claim is made.
