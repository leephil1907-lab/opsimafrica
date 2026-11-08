# OpsSim Africa — Receiving Practice Lab

**v1.1 · Retail Stock Receiving & Shelf Audit MVP**

A hands-first operational practice loop for small teams:

**Choose role → read briefing → inspect → classify → record → submit → review → improve.**

The primary experience is one compact receiving stockroom, not an ERP or a collection of half-built simulations. Desktop, touch and immersive WebXR share the same task state and server-validated results. The four earlier browser training workflows remain available in the library.

## Start locally

Requires **Node.js 20.19+** and npm. Tested with Node 20.20.2.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. The app starts in **Practice lab** with a ready-to-use, fictional demo business. No account or database service is required.

For a production build:

```sh
npm run build
npm start
```

The Express process serves both the built frontend and the API on port 3000. `PORT` and `DB_PATH` are configurable; see `.env.example`. The default persistent SQLite database is `data/opssim.sqlite`, created and seeded on first start. Do not serve only `dist/` on a static host: the API and a writable persistent database are required.

## The receiving experience

1. **Choose a role.** Trainee, manager/owner, or trainer. Trainees can select warehouse assistant, shop attendant, cashier, dispatcher, or supervisor.
2. **Set up practice.** Choose a business context, difficulty, coaching focus and target duration. Start immediately with a demo learner or create/join a named team.
3. **Read the briefing.** Objective, PO and invoice, fixed lesson date, handling rules, time target and completion criteria are presented before the shift starts.
4. **Inspect ten cartons.** Read product/SKU, temperature, seal/condition and expiry details; open the invoice/PO for comparison.
5. **Sort and flag.** Move suitable stock to the dry shelf or cold storage. Quarantine damage, expiry or label mismatches with the correct reason. Wrong moves explain the operational risk, do not advance the checklist, and provide extra coaching after repeated mistakes.
6. **Record manually.** Enter accepted, quarantined and short-supplied carton counts in the receiving form. Counts are not automatically filled with the answers.
7. **Explicitly submit.** All cartons must be inspected and correctly placed. Review the counts, then confirm and submit. Saving is never silently triggered by the last drop.
8. **Review and improve.** See score, accuracy, active time versus target, exception handling, mistakes, recommendations and comparison with the previous comparable run. Retry the same delivery or choose a twelve-carton harder delivery with a label mismatch and a genuine shortage.

A visible checklist tracks inspection, sorting, recording and submission. The reference documents remain available during the shift. Progress and pauses persist on the server; unsent form counts are device-local drafts until final submission. Reloading an unfinished run restores it paused and requires an explicit resume.

### Lesson content

- **Standard:** ten delivered cartons, dry/cold storage, damaged milk and expired beans.
- **Harder:** twelve delivered against thirteen ordered; adds a mislabelled oil carton and a flour shortfall.
- Lesson date is fixed at **8 November 2026**, so expiry decisions remain consistent on later retries.
- Beginner, standard, time-pressure and harder presets; 5/10/15-minute choices plus the six-minute standard target.
- Pharmacy, supermarket, spare parts, restaurant and logistics are **coaching contexts for the same disclosed food-retail dataset**, not five separately authored simulations.
- These are fictional procedures for practice, not accredited safety or pharmacy training.

### Scoring

Receiving scores are calculated by the server, not accepted from the client:

`max(0, round(100 − 8 × mistakes − min(20, overtime_ratio × 15)))`

Accuracy measures correct operational decisions, excluding inspection clicks. The scorecard separately reports exception handling and active time. Paused time is excluded. Recommendations address the actual error categories and, where necessary, fluency against the time target. Previous-attempt comparison uses the same learner, delivery variant, target and coaching focus.

## Hands, desktop and touch

### Immersive hands

Open the **direct HTTPS URL** in a WebXR-capable browser with hand tracking enabled. The embedded website preview is useful for desktop practice but is not the headset launch surface.

- **Point + pinch:** activate distant controls and select objects.
- **Pinch and hold on a carton:** drag it along the ray; release into a labelled storage zone.
- **Near grasp:** close fingers around a nearby carton, move and rotate it, then release.
- **Poke:** activate the tablet with the index fingertip; retract before another activation.
- **Closer inspection / Tablet closer:** bring items or the task tablet into seated reach.
- **Documents:** open/close, grab, move and rotate the invoice/PO.
- **Menus:** role selection, briefing, tutorial, reference pages, form keypad, confirmation, scorecard, replay, invitations and named-team keyboard are available on the in-world tablet.
- **Pause/resume:** explicit tablet controls. XR focus loss, session exit and sustained loss of all hands pause the shift; tracking recovery does not silently restart the clock.

The first immersive tablet pose adapts to the user's initial head height and direction. Stay seated or stationary; use the ray and close-inspection controls rather than walking to the virtual racks.

Interaction uses **kinematic transforms, validated drop volumes and snapping**, not rigid-body physics. Controller rays are optional, not required by the implemented core loop.

### Mixed reality / passthrough path

An **Enter mixed reality** option is shown only when the browser reports `immersive-ar` support. It requests an alpha-blended session, hides the virtual room shell and uses a transparent renderer while retaining stock, shelves, tablet and hands.

This rendering path has an emulator test. **Passthrough on physical Quest hardware is not yet verified.** No camera imagery is captured or uploaded by this application.

### Desktop and touch

Click or touch a carton, inspect its details, select a reason if needed, then drag it into a shelf/bin or use the accessible placement buttons. The form supports normal input and an on-screen keypad. If WebGL is unavailable, the full text/button workflow remains usable.

## Manager and trainer MVP

- Name the shared team and create learner profiles.
- Share an invitation link or short code; trainees can join without delaying practice.
- Assign standard or harder receiving practice with a deadline, duration and focused coaching.
- See pending/completed assignments, saved attempts, individual scorecards and recurring error categories.
- Assign focused remedial practice, then compare subsequent results.
- Matching receiving assignments complete only for the assigned delivery variant, target duration and coaching focus.
- Trainers can save default context, role, duration, difficulty and coaching emphasis. Product-list imports and bespoke receiving-checklist authoring are later work.

**Important:** these roles, invitation codes and learner selections are a shared-demo workflow, **not authentication, permissions or secure multi-tenancy**. All users of one server share the workspace. “Send result” means save it to the team workspace; it does not send external messages.

## Existing workspace

Overview, team performance, reports, CSV export, settings and the original four browser training workflows are retained. The receiving lab is the default landing experience and the first featured library scenario. Reports open receiving scorecards in the lab, including after a reload.

The 93 original seeded completions are explicitly labelled synthetic sample data, not real trainee evidence. Settings can remove sample completions without deleting real attempts. The legacy scenario builder edits the earlier question-based workflows; it does not pretend to author the receiving manifest.

## Verification

```sh
npm test                       # 37 API, persistence, scoring and gesture tests
npx playwright install --with-deps chromium
npm run test:e2e                # 28 browser tests, including 3 hand-only XR emulator tests
npm run build
npm run format:check
npm audit
```

The full browser suite is intentionally serial and takes several minutes. It uses a separate database under `.cache/`, not the live demo's data.

**Release checks:** 37/37 API/unit tests, 28/28 browser tests, production build, formatting and zero reported dependency vulnerabilities. A separate compiled-production smoke completed the receiving flow with 100 points and restored its scorecard after reload.

See **[TESTING.md](TESTING.md)** for results, emulator methodology, evidence and the physical-headset acceptance checklist. **Emulation is not physical hardware validation.**

## Backups and deployment

```sh
npm run backup
```

Uses SQLite's online backup API to write a consistent backup under `backups/`; `BACKUP_DIR` can override the destination. The backup includes receiving state, frozen lesson manifests, assignments and saved reports. To restore, stop the app, back up the current database, replace it with a backup, remove stale WAL/SHM sidecars if present, and restart with the same `DB_PATH`. Test restores on a copy first.

A Dockerfile is supplied:

```sh
docker build -t opssim-africa .
docker run --rm -p 3000:3000 -v opssim-data:/app/data opssim-africa
```

**Docker execution is not verified in this environment.** For a persistent host, use an HTTPS reverse proxy and a durable volume at `DB_PATH`. Serve frontend and API from the same origin. WebXR also requires that the page not be blocked by iframe permissions or an embedding policy.

### Before private or public production use

This is a working demo MVP, **not a hardened multi-tenant service**. Before entering real staff information or exposing a workplace deployment, add and test authentication, server-side role/tenant authorization, invitation expiry and abuse controls, HTTPS termination, appropriate rate limits and privacy/retention policies. Do not treat the built-in demo identities as access control. Use fictional data for any publicly accessible competition build.

## Architecture

- React 19 + TypeScript + Vite
- Three.js with native WebXR hand-joint input and a shared DOM/in-world task model
- Express + Zod validation + SQLite (`better-sqlite3`, WAL)
- Versioned, transactional receiving actions; stale, paused and completed requests are rejected
- Each new receiving run stores a private manifest snapshot so later source updates cannot silently change the delivery or its marking rules; pre-snapshot runs retain a compatibility fallback
- Playwright + axe-core; Meta IWER is **test-only**, not the application runtime or IWSDK
- Local fonts and generated scene geometry; no CDN dependency or external AI service required

Key implementation files:

```text
src/receiving/ReceivingLab.tsx    Shared operational flow, menus, form, team/trainer views
src/receiving/ReceivingScene.tsx  Stockroom, ray/pinch/poke/grab input and immersive tablet
src/receiving/gestures.ts        Gesture hysteresis and spatial drop helpers
server/receiving.mjs            Manifests, actions, scoring, persistence and assignments
server/index.mjs                API and same-origin production/dev server
server/db.mjs                   Database schema and labelled sample workspace
tests/e2e/xr.spec.ts             Raw emulated hand-input acceptance tests
```

## Competition status

This is a **custom Three.js/WebXR application**, not an IWSDK conversion or a native APK. Hands-only emulation is covered; physical-device acceptance, performance, final hosting, competition-stack eligibility and submission are separate outstanding gates. No competition entry, account change or external deployment has been made.

See **[COMPETITION.md](COMPETITION.md)** for the remaining checks and a short demo outline.

## Assets and licensing

DM Sans and Manrope are bundled locally with their SIL Open Font License files in `public/fonts/`. Icons use Lucide. Scene geometry and training content are authored in this project. Runtime dependency notices are included in `THIRD_PARTY_NOTICES.txt`; dependencies retain their own licenses. No application license has been selected. Choose one and review the dependency/asset terms before external distribution.
