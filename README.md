# OpsSim Africa

**v2.0 · BrightMart receiving practice + a six-page business website**

**Train your team before mistakes cost you money.**

A focused, hands-first operations-training MVP for African retail and logistics teams. The main lesson is **Receive and Shelf-Check a Supplier Delivery**, set in fictional **BrightMart Mini Store**, with the learner acting as a **Stock Receiving Assistant**.

**Brief → inspect → check labels and quantities → record → sort / isolate → Review → Confirm → score and improve.**

This is one complete receiving simulation, not an ERP. Other immersive scenarios on the public website are explicitly marked **coming soon**. The earlier browser workflows, five coaching contexts, roles and historical receiving engine remain available without rewriting saved results.

## Run the project

Requires **Node.js 20.19+** and npm; verified in this environment with Node 20.20.2.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000** for the public website, or **http://localhost:3000/app#brightmart** to start practice immediately. No external database or account service is needed for the fictional shared demo.

```sh
npm run build
npm start
```

Production uses the same-origin Express API and compiled frontend on port 3000. SQLite is created at `data/opssim.sqlite` on first start. `PORT`, `DB_PATH` and `BACKUP_DIR` can be changed with environment variables or `.env`; see `.env.example`.

**Do not deploy `dist/` alone to a static host.** A Node server and a writable, persistent SQLite volume are required. Frontend code uses relative API URLs; it does not call a visitor's localhost.

### Routes

| Route             | Purpose                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| `/`               | Business-first home, available lesson, illustrative manager view, demo player |
| `/product`        | Workflow, actual receiving screens, hands-only explanation, rubric            |
| `/scenarios`      | One available MVP and five clearly labelled roadmap scenarios                 |
| `/for-businesses` | Lightweight team onboarding and working demo-request form                     |
| `/about`          | Mission, African operating context, privacy and responsible-AI limits         |
| `/contact`        | Demo / waitlist request, receipt and FAQs                                     |
| `/app#brightmart` | Current eight-carton lesson and manager / trainer views                       |
| `/app#receiving`  | Preserved v1 ten-carton receiving lesson and historical scorecards            |
| `/app#overview`   | Original workspace, library, team, reports, builder and settings              |

Historical root hash links, including `/#receiving?run=…`, still work. The public website is the new `/` landing page.

## BrightMart: the complete loop

1. **Start immediately.** Use a fictional demo learner, or join a named practice team. Choose standard / harder, target time and coaching focus.
2. **Read the brief and delivery note.** Supplier, delivery reference, items, expected units, fixed lesson date and handling instructions are available before and during receiving.
3. **Inspect the physical carton.** Check packaging, seals and condition. Compare product / SKU, batch and expiry against the note. The inspector supplies the observed unit-count evidence.
4. **Record the item.** Large **+ / −** controls set received units; select Good, Damaged, Expired or Mismatch and Accept, Quarantine or Return. Optional notes use short preset choices. There is no first-version free-text quantity field.
5. **Sort real stock.** Health & Wellness is on the left; Grocery & Household is on the right; quarantine / returns is separate. Use grab / drag / release or accessible placement buttons. Unsafe moves explain the risk and do not silently advance the task. Damaged physical stock can be isolated immediately after condition inspection and recorded afterwards.
6. **Reconcile every line.** Accepted units, quarantined physical units, shortages and overages are kept separate.
7. **Review, then Confirm.** Review does not complete the run. Confirmation needs the current review token; editing a line invalidates it. The last carton placement never auto-submits.
8. **Improve.** The saved scorecard shows four fixed scoring dimensions, active time, exceptions, the two highest-priority coaching recommendations, comparable previous results and same / harder replay.

Server-saved progress survives reload. Unfinished runs restore **paused**, awaiting explicit resume. Unsent item choices are device-local drafts, isolated by **run and carton identity**; they are not submissions. API connectivity is required to save work—this is not an offline training application.

### The eight physical cartons

| Carton | Evidence                                                     | Correct handling                                     |
| ------ | ------------------------------------------------------------ | ---------------------------------------------------- |
| C01    | Paracetamol packs, 24 sound units                            | Accept → Health & Wellness                           |
| C02    | Hand sanitiser, 12 sound units                               | Accept → Health & Wellness                           |
| C03    | Golden grain rice, 6 sound units                             | Accept → Grocery & Household                         |
| C04    | Laundry soap, 12 sound units                                 | Accept → Grocery & Household                         |
| C05    | Antiseptic bottles, 12 units with damage                     | Record Damaged → quarantine / returns                |
| C06    | Vitamin C, 12 expired units                                  | Record Expired → quarantine / returns                |
| C07    | Disposable gloves, **24 expected / 22 sound units received** | **Accept 22 → Health & Wellness; record shortage 2** |
| C08    | Cooking oil, 6 units with a product-label mismatch           | Record Mismatch → quarantine / returns               |

**108 expected / 106 received = 76 accepted sound units + 30 quarantined physical units; shortage 2.** Missing units do not exist to be quarantined.

The harder variation contains **12 physical cartons**, including an additional damaged carton and an overage. Its shortage of 2 and overage of 2 stay separate even though total expected and received units both equal 156. Default target: standard **6 minutes**, harder **5 minutes**. Custom targets are disclosed and saved with the run.

The inspection date is fixed at **8 November 2026**, so expiry decisions do not change between retries. These are fictional, non-clinical procedures, not certification or professional pharmacy instruction.

### Fixed 100-point rubric

| Dimension          | Maximum | Explicit allocation                                                                                                                                                                                                       |
| ------------------ | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accuracy           |  **35** | Accepted placements up to 5 × 5 = 25; correct quantities 5; correct identification 5. Wrong quantity or shelf attempts deduct 5 within this cap.                                                                          |
| Exception handling |  **25** | Damage 5; expiry 5; label mismatch 5; quantity discrepancy 5; safe isolation 3; keeping sound stock sellable 2. Missed physical exceptions deduct 5; unnecessary quarantine deducts 2, without double-charging one event. |
| Process            |  **25** | Note before handling, all cartons inspected, label / date checks, complete item form, explicitly submitted: **five checks × 5**.                                                                                          |
| Efficiency         |  **15** | Standard active time ≤6 min: 15; ≤7 min: 10; ≤8 min: 5; over 8 min: 0. Custom targets shift these boundaries by the same 60-second increments.                                                                            |

Each dimension is clamped to its own maximum. Extra cartons, hints or repeat clicks cannot inflate the fixed total above 100. Identical saved lines and stale / duplicate actions are guarded. Paused time is excluded; the server supplies the authoritative clock and score, not client-submitted totals.

**≥90 Excellent · ≥75 Good · ≥55 Developing · below 55 Needs practice.**

Example tested result: one wrong shelf, one unnecessary quarantine and one wrong count, all corrected, produces **88 = 25 + 23 + 25 + 15**. A clean comparable replay produces 100 and shows **+12** improvement. Comparison requires the same learner, variant, target and focus; legacy scoring is not presented as a comparable v2 attempt.

## Hands-only, desktop and touch

The room is designed for seated or stationary use in approximately **1.5 × 1.5 m**. Do not walk to the virtual racks; use ray reach. A central task panel presents the objective, progress, remaining target time, one primary action and a hint. A separate portable tablet progressively exposes the current decision.

- **Ray + pinch:** activate menus and distant controls.
- **Pinch / grip:** grab a carton or the reference document; move and rotate nearby objects.
- **Hold, drag, release:** place stock inside a forgiving labelled drop zone. Rejected placements return safely and explain why.
- **Near poke:** activate large tablet controls; retract before another activation.
- **Tablet closer / closer inspection:** bring the tablet or selected stock nearer. Grab the tablet's top edge to reposition it.
- **Comfort:** seated / stationary adjustment, distance and larger text. Subtle audio is optional; feedback always includes text / visual information.
- **Pause:** explicit controls, XR focus / session loss and sustained tracking loss pause the shift. Tracking recovery does not auto-resume it or record an accidental drop.

The essential trainee path and in-world menus support one hand; controllers are optional. The engine uses kinematic transforms, validated drop volumes and snapping—not rigid-body physics.

For immersive mode, use a **direct HTTPS URL** in a compatible WebXR browser with hand tracking enabled. An embedded desktop preview is not a headset launch surface. `Try passthrough` appears only when `immersive-ar` is reported as supported; the renderer becomes transparent and hides the room shell. The application does not record or upload camera imagery.

**Physical Quest hand tracking, passthrough, comfort and performance are not yet verified.** Raw one-right-hand IWER emulator tests exercise the implemented loop; they are not a substitute for device acceptance. This is custom Three.js / WebXR, not an IWSDK or native Meta SDK conversion.

Desktop and touch share the same authoritative task state. Text / button practice still works when WebGL is unavailable. Colour is supplemented by icons and labels. Local fonts, readable type, visible focus, responsive layouts and automated axe checks support accessibility; this is not a claim of manual accessibility certification.

## Manager / trainer MVP and preserved workspace

- Name the shared practice team; join with an invite link or code and a fictional learner name.
- Assign standard / harder practice with a deadline, time target and complete / exceptions / recording focus.
- Review saved results, exceptions and common mistake categories; assign focused follow-up.
- Complete assignments only with matching learner, engine, variant, target and focus.
- Save lightweight trainer defaults. Imports, arbitrary product catalogues and full receiving-checklist authoring are later work.

**Role views and invitation codes are not authentication, server-side permissions or tenant isolation.** Everyone on one demo server shares the workspace. Do not enter real staff, customer, patient or supplier information.

The original overview, team, reports, CSV export, settings, scenario builder and four question-based workflows remain. The previous Pharmacy / Supermarket / Spare Parts / Restaurant / Logistics contexts and learner-role selections remain in the **legacy receiving view**, using the same disclosed fictional dataset rather than five new authored VR simulations. Old ten-carton runs retain their stored manifests, reconciliation and original scoring. The builder edits the earlier question-based workflows; it does not pretend to author BrightMart.

The 93 seeded completions are labelled **synthetic sample data**, not real customer or trainee evidence. Settings can remove samples without deleting real attempts.

## Working demo / waitlist form

Both `/contact` and `/for-businesses` validate and save name, business, email, optional phone, industry, team size, main challenge, request type and consent time. The user receives an opaque receipt.

**A receipt is not a calendar booking.** No automatic email, WhatsApp, calendar or CRM message is sent. Unprovided public contact details, biographies, testimonials and partner logos are deliberately omitted.

Contact records are not returned by the public or shared-demo API. A local owner can export recent requests:

```sh
npm run leads:export                   # last 90 days, private CSV in backups/
npm run leads:export -- --days 30
```

The export is formula-safe, created with owner-only file permissions and never prints contact fields to the console. Restrict access and follow up manually. Request cleanup runs at startup and on new submissions, removing database rows older than 90 days. **Backups and exports need their own access and deletion policy.** A basic honeypot and in-memory five-per-five-minute IP limit are included; they are not an enterprise anti-abuse service.

Before collecting real requests on a public host, review HTTPS, storage permissions, privacy notices, retention, logging and responsible ownership. If an HTTPS reverse proxy is used, set `TRUST_PROXY=1` only for a correctly controlled one-hop proxy; do not blindly trust forwarded headers or expose bypass paths.

## Design and media handoff

Open **`docs/OpsSim-Design-Kit.html`** for an offline, self-contained handoff containing:

- Logo, exact palette, Manrope type, measured contrast and component states.
- Desktop / mobile home and product information wireframes.
- Actual inspector, receiving-tablet and scorecard screenshots.
- Spatial task panel, stockroom, tablet and illustrative manager concepts.
- Request-form layout and the captioned 60-second walkthrough / storyboard.

Separate editable SVG wireframes are in `docs/wireframes/`; font-embedded SVG concepts are in `docs/concepts/`. Brand marks are in `public/brand/`. See **[docs/ASSET-REGISTER.md](docs/ASSET-REGISTER.md)** and **[docs/60-SECOND-STORYBOARD.md](docs/60-SECOND-STORYBOARD.md)** for provenance and regeneration.

**Visual honesty:** the promotional trainee image is AI-generated and labelled illustrative. Product screenshots are real desktop captures. The 60-second MP4 uses those stills plus an illustrative opening, with English VTT captions and no audio. It is **not physical headset footage**, a customer pilot or measured business-outcome evidence.

## Verification

```sh
npm test                              # 66 API / unit / persistence / gesture tests
npx playwright install --with-deps chromium
npm run test:e2e                       # 45 serial browser checks, including five XR emulator tests
npm run build
npm run format:check
npm audit
```

Browser checks use a disposable `.cache/e2e.sqlite` on **3100**, not the live database. Do not run concurrent suites on that port. Test captures go to `artifacts/`, not public assets, so they cannot hot-reload another test. Regenerate media only after capture tests pass. Do not edit application source during a verification run.

See **[TESTING.md](TESTING.md)** for release evidence, production smoke / backup reproduction and the physical-headset checklist. Timings from software rendering are not headset benchmarks or proof that human trainees finish within six minutes.

## Backup and deployment

```sh
npm run backup
```

Uses SQLite's online backup API to create a consistent backup under `backups/`; `BACKUP_DIR` overrides the destination. This includes both receiving engines, frozen manifests, reports, assignments and private contact requests. Keep it private and outside the publicly served directory.

To restore: stop the app; back up the current database; replace it with a verified backup; remove stale WAL / SHM sidecars if present; restart with the same `DB_PATH`. Test on an isolated copy first. Do not reset `data/` when updating the source.

A Dockerfile is supplied, but **Docker execution is not verified here**:

```sh
docker build -t opssim-africa .
docker run --rm -p 3000:3000 -v opssim-data:/app/data opssim-africa
```

A permanent deployment needs same-origin Node / API hosting, HTTPS, a durable volume, monitored backups and appropriate process / access controls. No permanent external deployment is included. Before private staff use, add and test authentication, tenant / role authorization, invitation expiry and abuse controls. The shared demo is not a hardened multi-tenant service.

## Architecture and source

React 19 / TypeScript / Vite; Three.js and native WebXR hand-joint input; Express / Zod; SQLite (`better-sqlite3`, WAL). BrightMart actions are versioned and transactional; saved manifests and completed results remain authoritative. IWER and axe are development / test tools, not browser runtime dependencies. No external AI service, CDN font or hosted database is required to run the demo.

```text
src/site/                             Six public pages, forms and demo player
src/brightmart/BrightMartLab.tsx       Current operational flow and role views
src/receiving/ReceivingScene.tsx       Shared 3D room, panel and hand interactions
src/receiving/gestures.ts              Gesture hysteresis and spatial helpers
src/receiving/ReceivingLab.tsx         Preserved v1 flow and historical reports
server/brightmart.mjs                  Fixed rubric, manifests, actions, assignments
server/leads.mjs                       Private request persistence and receipt
server/index.mjs                      Same-origin API / development / production host
scripts/leads.mjs                      Owner-only contact CSV export
scripts/backup.mjs                     Consistent SQLite backup
```

Repository: **https://github.com/leephil1907-lab/opsimafrica**. Credentials and live data are not part of the source or delivery archive.

## Competition and licensing boundaries

No competition entry, account change or submission has been made. Physical validation, eligible-stack confirmation, final hosting and the required demonstration are separate gates; see **[COMPETITION.md](COMPETITION.md)**.

Manrope and DM Sans are bundled with their SIL Open Font License notices. Runtime dependency notices remain in `THIRD_PARTY_NOTICES.txt`; development tools retain their own terms. Scene geometry and fictional lesson content are authored for this project. No application license has been selected. Choose an application license and review asset / dependency terms before wider distribution.

## Verified release evidence

See [release summary](docs/RELEASE.md) and [machine-readable verification](docs/VERIFICATION.json). The complete delivery archive includes compiled production output, source-commit and per-file checksum manifests, plus selected non-private test evidence. Generated archives never include live data, backups, contact CSVs, credentials or dependencies.

The release-only finaliser `scripts/verification.mjs` consumes the named raw reports under `artifacts/` and refuses missing / failing evidence; it is not part of an ordinary build. `python scripts/package.py` packages a clean Git checkout with that finalised evidence. Python media / packaging helpers are optional; Node runs the application.
