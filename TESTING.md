# Verification and acceptance

## Status — 8 November 2026

This project is a working browser/WebXR demo MVP. Automated hand-input emulation is not a substitute for testing real hands on a physical headset.

| Check                                                     | Status                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| TypeScript + production build                             | **Passed**                                                                                    |
| API/unit/gesture suite                                    | **37/37 passed**                                                                              |
| Complete browser regression                               | **28/28 passed**, no retries or skips, 9.1 min                                                |
| Targeted desktop receiving + report reload                | Passed                                                                                        |
| Targeted pause/reload + draft counts                      | Passed                                                                                        |
| Targeted receiving accessibility                          | Passed                                                                                        |
| Hands-only standard operational loop                      | **Passed in IWER**, 100 points, ten hand-dragged cartons, same-session harder replay and exit |
| Near poke/grab/tracking/focus/keyboard                    | **Passed in IWER**, including immersive text entry                                            |
| Alpha-blended AR rendering path                           | **Passed in IWER**, room hidden and transparent renderer asserted                             |
| Physical Quest hands, comfort and performance             | **Not tested**                                                                                |
| Physical passthrough                                      | **Not tested**                                                                                |
| Docker build/run                                          | **Not tested**                                                                                |
| Competition eligibility, permanent deployment, submission | **Not completed**                                                                             |

The final browser run completed all 28 tests with **zero failures, retries, flaky tests or skips**. The standard hands-only journey was then rerun successfully with an added in-world purchase-order/reference-page check (`xr-reference-results.json`). The standard XR journey took 147.6 seconds including setup/tutorial; near/interruption/keyboard took 109.3 seconds; AR took 9.3 seconds. These are software-emulator test durations, not hardware performance or human training timings. Formatting passed and the dependency audit reported zero vulnerabilities. Read the table alongside the machine-readable reports, not an earlier screenshot alone.

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

A SQLite online backup was also restored to an isolated copy: integrity check **ok**, saved completed receiving score **100**, and the frozen ten-carton manifest and 8/2/0 record were preserved.

The compiled production build also passed a separate smoke test: ten cartons, manual 8/2/0 reconciliation, explicit submission, **100 points**, scorecard reload, harder twelve-carton replay and explicit pause; no browser errors or failed resources. Development XR diagnostics and the Vite client were absent.

To reproduce that smoke test, use **two terminals and an isolated database** after building:

```sh
# Terminal 1 — keep running; do not use a private/live database.
PORT=3200 DB_PATH=.cache/production-smoke.sqlite npm start

# Terminal 2 — creates fictional practice records on that instance.
BASE_URL=http://127.0.0.1:3200 node tests/production-smoke.mjs
```

For an individually reproducible XR run:

```sh
npx playwright test tests/e2e/xr.spec.ts
```

The browser suite starts an isolated same-origin app on port **3100**, uses `.cache/e2e.sqlite` and runs serially. The default live app on port 3000 and `data/opssim.sqlite` are not the test database. The long XR tests intentionally allow up to six and four minutes; the full browser suite takes several minutes. Tests use headless Chromium with software WebGL in this environment.

## What the 37 API/unit tests cover

- **16 original workspace tests:** bootstrap/health, four playable browser workflows, authoritative scoring/time, duplicate/stale-step guards, validation, members, assignment lifecycle, custom scenario publishing/deletion, settings, sample removal, CSV formula protection and database persistence.
- **16 receiving tests:** idempotent installation, hidden marking fields, full ten-carton submission, harder twelve-carton shortage, damage/expiry/SKU/cold-chain feedback, quarantine reasons, optimistic versions, paused/completed guards, manual reconciliation, active-time penalties, legacy endpoint isolation, workspace/invites/defaults, focused assignment matching, comparable-run improvement, recurring mistakes, malformed requests and persisted manifest snapshots.
- **5 pure gesture/spatial tests:** pinch/grip hysteresis, cancellation on tracking loss, poke/retraction, accepted drop volumes and distinct carton/shelf positions.

A run's private lesson manifest is stored with its state. A regression test changes the stored fixture and verifies that inspection, marking and public facts use that snapshot rather than silently regenerating a different lesson.

## What the 28 browser tests cover

### Existing workspace — 17 tests

Original workflows, learner creation, assignments, resume/abandon, library search/filter, builder/publishing, reports/downloads, settings, keyboard access, mobile layout, synthetic-data labels/removal and automated accessibility checks.

### Receiving — 8 tests

1. Complete standard practice with deliberate mistakes, manual final form and explicit confirmation; scorecard, saved manager result, focused assignment, clean retry/comparison, harder replay, report deep link and reload.
2. Harder delivery with three exceptions and a real one-carton shortfall.
3. Pause/reload/explicit resume with frozen active clock, saved inspection/placement and unsent form drafts.
4. Named team, invitation join, validated defaults and remedial assignment.
5. Complete text/button fallback with WebGL disabled.
6. 390 × 844 touch layout without document-width overflow.
7. Actual Three.js hit-testing and carton dragging into storage, including a rejected move returning to its prior position.
8. Automated serious/critical axe checks across profile, briefing, active floor, form, pause, manager and in-world-keyboard DOM views. The standard scorecard is also scanned in the full flow.

### Immersive hands — 3 tests

The test-only **Meta IWER 2.8.0 Quest 3 profile** installs an XR device before the application loads. Both controllers and the left hand are disconnected; the right hand is the only connected input source. There is no application runtime dependency on IWER.

Only initial immersive entry uses a browser click. After entry, tests send raw emulated hand poses, transforms, pinches, finger poses and frame-synchronized input. They do not invoke application callbacks, set form state directly, or call the receiving API to complete XR tasks. A development-only read-only diagnostic attribute exposes visible target transforms, not the marking key.

1. **One controller-free session, full operational loop:** hands tutorial and pagination; briefing/rules; start; select and inspect all ten cartons; open/close the reference document; physically drag each carton with the emulated hand; select quarantine reasons; enter 8/2/0 via the virtual keypad; review and explicitly confirm; verify 100 points and 2/2 exceptions; read recommendations; replay a harder twelve-item delivery in the same XR session; exit.
2. **Near interaction and interruption:** close tablet, poke once while held, retract/re-poke, close-inspect a carton, near-fist grab/move/rotate, lose tracking while held, pause without recording an unintended drop, explicitly resume, pause on XR focus loss, resume, return to manager and type/save a team name on the immersive keyboard. No controller is connected.
3. **AR rendering path:** request supported alpha-blended `immersive-ar`; verify the room shell is hidden and the renderer transparent while hands/UI remain usable; exit cleanly.

The helper handles only the emulator's expected `XR session ended` rejection when a hand select itself activates Exit XR. Other input failures are not swallowed.

### Evidence

The `artifacts/` directory contains labelled desktop/mobile views and XR emulator screenshots. In particular:

- `receiving-xr-briefing.png`
- `receiving-xr-sorted.png`
- `receiving-xr-scorecard.png`
- `receiving-xr-near-grab.png`
- `xr-emulation.json` — operational observations, explicitly `physicalQuestVerified: false`

When present, `browser-results.json` is the full Playwright result report, and `verification.json` is the final release verification summary. Evidence is generated from the isolated test workspace; its run IDs need not exist in a fresh demo install.

## Physical headset acceptance — still required

Use a compatible Quest with a current browser, direct HTTPS access, hand tracking enabled and **no paired controller**. Use only fictional names and training data. Have a tester read the operational briefing rather than using the answer key.

- [ ] From the browser page, enter immersive hands mode without a controller.
- [ ] Test both a seated initial head pose and standing/stationary use; tablet starts readable and controls remain within comfortable view/reach.
- [ ] Select role, business context, target and focus with hands.
- [ ] Read every briefing/tutorial page, PO and invoice without clipped text.
- [ ] Near-poke a button once; hold contact without repeat activation; retract and activate it again.
- [ ] Point/pinch distant controls and cartons reliably under ordinary room lighting.
- [ ] Bring a carton closer; near-grab, move and rotate it; inspect all sides/labels without accidental drops.
- [ ] Grab/move/rotate the document and tablet; their targets follow their transforms.
- [ ] Drag/release stock to dry, cold and quarantine; rejected placements return safely and explain why.
- [ ] Complete all ten cartons, enter manual counts and explicitly submit without leaving XR.
- [ ] Read score, time, accuracy, exceptions and all recommendations; retry and start the harder twelve-carton variant.
- [ ] Repeat key interactions left-handed and with both hands. The automated single-hand test does not validate these physical cases.
- [ ] Pause mid-grab; remove hands from view; cover a hand; lose/recover tracking; no stale held object continues moving.
- [ ] Open headset/system UI or change XR focus; the run pauses and waits for explicit resume.
- [ ] Exit/re-enter XR and reload the page; positions and active time restore without silently resuming.
- [ ] Create a named team, use the immersive keyboard, join with a short code, assign practice and open a saved scorecard.
- [ ] If the browser supports immersive AR, verify actual passthrough, transparent room shell, physical-space awareness and readable contrast against light/dark backgrounds.
- [ ] Measure draw calls, frame time, input latency and sustained thermal behavior on target hardware. Emulator timings are not headset performance data.
- [ ] Ask the trainee to explain stock acceptance, exception isolation and correct recording after a sub-ten-minute run.

Record headset model/OS/browser, date, lighting, handedness, errors and video evidence. Do not sign off a checkbox based only on screenshots or the emulator.

## Known boundaries

- Custom Three/WebXR implementation; no native APK, Meta Interaction SDK or IWSDK conversion is claimed.
- Hand poses and grasp/drop behavior are kinematic, not rigid-body physics.
- Physical hand tracking, occlusion, comfort, passthrough and performance remain unverified.
- Business contexts share one disclosed food-retail lesson; no production ERP or inventory import.
- Trainer defaults are configurable; arbitrary receiving product/checklist authoring is not included.
- Shared-demo roles and invitations are not authorization. No real staff data should be entered into a public demo.
- Local draft form counts are not synchronized between devices until final submission.
- The temporary workspace preview is not permanent competition hosting.
- Automated axe checks do not certify headset readability, hand accessibility, or overall WCAG conformance.
