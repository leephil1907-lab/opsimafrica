# Competition readiness — not a submission

**Checked against the official overview on 8 November 2026.**

Official references:

- Overview and submission requirements: https://start-developer-competition-26.devpost.com/
- Rules: https://start-developer-competition-26.devpost.com/rules
- Resources: https://start-developer-competition-26.devpost.com/resources

The published entry deadline is **18 November 2026, noon Pacific / 20:00 UTC / 21:00 Lagos (WAT)**. Recheck the official event pages before acting; this file is not an eligibility determination or legal advice.

## What this build supplies

- One original operational learning loop: Retail Stock Receiving & Shelf Audit.
- Current BrightMart lesson: briefing, eight physical cartons, inspection / labels / dates, actual-unit records, two accepted-stock shelves, exception isolation and explicit Review → Confirm. The ten-carton historical engine is preserved separately.
- Instant explanations, saved scorecard, comparable-attempt improvement and a harder twelve-carton replay.
- In-world role menus, tutorial, documents, large quantity + / − controls, confirmation, scorecard, replay and named-team keyboard. The historical reconciliation keypad remains available.
- Hand-only interaction in emulator acceptance tests, with both controllers disconnected.
- Seated/stationary interaction design, close-inspection controls and pause/resume.
- A conditional transparent immersive-AR rendering path.
- Working Node/SQLite backend and an HTTPS-compatible same-origin production server.
- Six public business pages, saved demo / waitlist receipts and a clearly disclosed captioned 60-second desktop-screenshot walkthrough.

## Outstanding gates

1. **Physical-device acceptance.** Run and record the checklist in `TESTING.md`. Do not represent IWER footage as real Quest testing. Assess hand tracking, occlusion, comfort, legibility, tracking recovery, actual passthrough and sustained frame rate.
2. **Stack/submission eligibility.** This implementation uses custom Three.js and native WebXR. It does **not** use IWSDK. The overview explicitly describes hosted URLs for “Built with IWSDK (WebXR)” entries and a Meta release-channel/APK route for native/custom-engine entries. Obtain organizer confirmation for this custom WebXR stack or make an authorized, properly tested stack adaptation. Merely using IWER for tests does not make the runtime an IWSDK application.
3. **Entrant eligibility.** Confirm the full rules, division, build/conception dates, account eligibility, representative requirements and Meta Start/developer membership. No account or eligibility verification has been performed here.
4. **Permanent accessible hosting.** Deploy the frontend and API together behind HTTPS with a persistent database. A static-only GitHub Pages upload will not run this backend. A temporary workspace preview is not durable judging access. Use fictional public-demo data; add actual authentication/authorization before any private workplace deployment.
5. **Competition demo video.** The delivered 60-second website walkthrough uses desktop stills and an illustrative opening; it is not a recorded physical-device or simulator acceptance journey. The overview asks for a publicly accessible YouTube/Vimeo video under three minutes, showing device/XR Simulator or equivalent footage. Record the final approved build, identify emulator footage honestly and keep the actual operational interaction visible.
6. **Entry materials and consent.** Confirm team/IP/asset permissions; prepare the title, short tagline, track/division, description, new-feature summary if relevant, launch information and working access instructions.
7. **Final verification and freeze.** Test the hosted URL from a clean headset browser, confirm no controller dependency, back up the judging database and retain the submitted version. Recheck the event's accessibility and no-post-deadline-change requirements.

**No competition submission, paid deployment, account change, SDK migration or native packaging has been authorized or performed.**

## Suggested under-three-minute demo outline

This is a plan for a separate competition recording, not a claim that the delivered website walkthrough meets the event's footage requirements.

| Time      | Show                                                                                    | Message                                                                   |
| --------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 0:00–0:15 | Product name, learner and compact stockroom                                             | Learn a real receiving procedure, not just answer a quiz.                 |
| 0:15–0:35 | Hands select role, briefing and invoice                                                 | Start immediately; know the task, target and handling rules.              |
| 0:35–1:15 | Inspect a good carton, rotate it, drag to storage; inspect damage/expiry and quarantine | Check labels and dates; accept sound stock and isolate real exceptions.   |
| 1:15–1:35 | Deliberate incorrect placement, explanation and correction                              | Mistakes teach the operational reason and do not advance progress.        |
| 1:35–2:00 | Sorted delivery, received 22 / shortage 2, review and final confirmation                | Accept 22 sound units, record shortage 2 and explicitly confirm.          |
| 2:00–2:25 | Saved scorecard, exceptions, recommendation, retry and harder delivery                  | See what improved and what to practise next.                              |
| 2:25–2:50 | Named team, focused assignment, pause/resume                                            | Managers see real attempts and assign targeted practice.                  |
| 2:50–2:59 | Final product card and tested-platform disclosure                                       | Hands-only operational practice, with honest hardware/emulator labelling. |

If cutting or accelerating a longer run, label it clearly. Do not imply that edits prove an uninterrupted hardware session. Keep a separate uncut acceptance recording for validation.
