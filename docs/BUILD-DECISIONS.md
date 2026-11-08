# BrightMart v2 implementation decisions

Confirmed by the owner on 8 November 2026:

- Standard: eight physical cartons: four correct, one damaged, one expired, one quantity discrepancy, one mismatch.
- Accept the 22 sound units in a 24-unit delivery-note line; record a two-unit shortage. Never quarantine nonexistent missing units.
- Use an explicit 35/25/25/15 rubric with a maximum of 100 points, not normalized raw marks.
- Public website: six pages. Demo-request form works; do not invent email, WhatsApp, social accounts, founders, endorsements or testimonials.
- Navy/green/grey visual direction, Manrope type, progressive hands-only interaction, two accepted-stock shelves.
- Preserve the previously verified v1 receiving engine/history for compatibility. BrightMart is the new primary experience.
- Repository: https://github.com/leephil1907-lab/opsimafrica . No credential may be committed. Authentication is temporary and in memory, not a persistent secret vault.
- First remote checkpoint: verified v1.1 baseline, commit 9365ee9 on main. Current implementation branch: feat/brightmart-business-site.

## Delivery goals

1. Working six-page business website, real request persistence, honest demo/roadmap labels.
2. Eight-carton BrightMart lesson, per-item unit counts/condition/action, shortage reconciliation, review/confirm.
3. Fixed task HUD + portable tablet, stationary one-hand controls, accessible +/- counters.
4. Four-dimension scoring, top-two coaching, stage feedback, harder replay.
5. Brand/wireframe/component assets and 60-second demo storyboard.
6. API/browser/XR/production checks, documentation, pushed reviewed source.

Physical Quest validation and competition-stack eligibility remain separate gates. Do not claim a Meta SDK migration, real headset footage, guaranteed business outcomes or secure multi-tenant roles.

## Verified implementation details

- Draft identity guards prevent both transient and settled writes from crossing a run / carton boundary. Server-saved lines remain authoritative.
- Programmatic navigation uses history state without scheduling a later hash event that can overwrite a role / learner launch. Manual hash and browser history navigation reset the URL launch intent, including clearing absent run IDs and handling invite queries. Root historical hash links can switch from the public site without a full reload.
- Browser product captures are written to ignored artifacts; promotion to public assets is a separate explicit step. Documentation, helpers, tests, private data and artifacts do not trigger development hot reload.
- A separate compiled-production smoke covers six public pages and both receiving engines, including scorecard reload and a same-document cross-engine route transition.
- Source publication uses the existing public repository and a temporary path-scoped Git credential cache; no credential is part of the source, archive or persistent secret-vault promise.
