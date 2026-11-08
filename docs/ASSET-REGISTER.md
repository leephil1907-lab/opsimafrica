# Design and media asset register

**OpsSim Africa v2.0 · 8 November 2026**

This register distinguishes authored diagrams, real product captures and promotional illustration. None of these assets is customer, pilot, physical-Quest or business-outcome evidence.

## Brand / typography

| Files                                                              | Source / intended use                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `public/brand/opssim-mark.svg`                                     | Authored operational box / check brand symbol, scalable SVG                          |
| `public/brand/opssim-wordmark.svg` and `opssim-wordmark-light.svg` | Dark / light wordmarks; not a partner or certification mark                          |
| `public/favicon.svg`                                               | Authored browser mark                                                                |
| `public/fonts/manrope.woff2`, `manrope-variable.ttf`               | Manrope font, obtained from Google Fonts; SIL Open Font License in `manrope-OFL.txt` |
| `public/fonts/dm-sans.woff2`                                       | Retained legacy font; SIL Open Font License in `dmsans-OFL.txt`                      |

Palette: navy `#0F1B2A`, off-white `#F6F7F9`, grey `#DDE3E8`, green `#00A86B`, amber `#F2A93B`, coral `#E2574C`, blue `#2F6FED`. XR surfaces use `#1B2027` / `#2A323C` with `#E8EDF2` / `#A9B4BF` text. Exact measured pairings and normal-text / UI thresholds are in `CONTRAST-CHECKS.json`.

## Handoff and editable concepts

| Files                            | Disclosure                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OpsSim-Design-Kit.html`         | Self-contained offline handoff. Embedded fonts, images, wireframes, video and captions; reference form / buttons are not an operational booking system |
| `wireframes/home-desktop.svg`    | Desktop homepage information wireframe, not a screenshot                                                                                               |
| `wireframes/home-mobile.svg`     | Mobile homepage information wireframe, not a screenshot                                                                                                |
| `wireframes/product.svg`         | Desktop product information wireframe, not a screenshot                                                                                                |
| `wireframes/product-mobile.svg`  | Mobile product information wireframe with stacked screenshots / controls, not a screenshot                                                             |
| `concepts/stockroom.svg`         | Authored stockroom diagram exported from the actual website component; shelf / table / quarantine layout, not a rendered headset view                  |
| `concepts/task-panel.svg`        | Authored illustrative eye-level task-panel concept                                                                                                     |
| `concepts/receiving-tablet.svg`  | Authored illustrative item-recording concept, correctly accepting 22 sound units with shortage 2                                                       |
| `concepts/manager-dashboard.svg` | Authored illustrative manager concept. Learners and figures are fictional; not customer results                                                        |

The four standalone concept SVGs embed Manrope for offline display. The handoff uses actual desktop captures alongside clearly labelled concepts; it does not pass a mockup off as implemented UI.

## Promotional illustration

`public/images/retail-practice-hero.png` / `.webp` is **AI-generated**. It depicts a fictional African trainee in a grounded receiving environment. It is labelled an illustrative training scene on the public site. The depicted person is not a team member, customer, testimonial or recorded Quest tester. The depicted UI is illustrative, not a product screenshot.

No external customer / partner logos or real staff photographs are used.

## Actual application captures

`public/images/product-{stockroom,inspect,record,sort,review,scorecard}.{png,webp}` are captured from the **running BrightMart desktop application**, using fictional data and an isolated browser-test database.

- Stockroom: real rendered table, shelves, tablet and lesson state.
- Inspector: real carton packaging / quantity / SKU / batch / expiry evidence.
- Record: real expected 24 / received 22 / shortage 2 interaction.
- Sort: real accepted-stock placement choices.
- Review: real per-item receiving report and explicit confirmation.
- Scorecard: real saved **88/100** after three deliberately corrected mistakes, not an invented success metric.

Crops and resizing improve legibility; values and interface labels are not repainted. The optimized WebP files are derived from the PNG captures. These are **desktop screenshots**, not real headset footage.

## Sixty-second walkthrough

- `public/images/product-demo.mp4`: **60 seconds**, 1280 × 720, 24 fps, H.264, no audio.
- `public/images/product-demo.vtt`: English captions, six ten-second chapters.
- `60-SECOND-STORYBOARD.md`: chapter-by-chapter plan and honest source disclosures.
- `PRODUCT-DEMO.json`: machine-readable timing / asset metadata.

The video is a still-image product walkthrough: illustrative opening, followed by actual desktop app captures. It is not proof of physical hands, stereo comfort, passthrough, hardware performance or competition readiness. It is not the separately required final competition recording or an automatically published external video.

## Recreate without disrupting verification

Requires the normal Node development dependencies. Optional media-build tools used here: **Pillow 13.0.0** and **imageio-ffmpeg 0.8.1**; these are not application runtime requirements. A compatible installed FFmpeg can be used instead of imageio-ffmpeg.

```sh
# Serial capture tests. Do not run another Playwright suite on port 3100.
npx playwright test tests/e2e/brightmart.spec.ts -g 'eight-carton loop|capture labelled'

# Only after both captures pass: promote, optimize and assemble the walkthrough.
python -m pip install Pillow==13.0.0 imageio-ffmpeg==0.8.1
python scripts/product-assets.py
python scripts/product-demo.py

# Recreate concepts and the embedded offline handoff.
node scripts/concepts.mjs
python scripts/design-kit.py

# The live app must already be running for the website captures.
BASE_URL=http://127.0.0.1:3000 node scripts/visual-qa.mjs
```

Browser tests write to `artifacts/brightmart/`, never directly to `public/`. Media promotion is deliberately separate, avoiding hot reload during another test. Do not regenerate public assets or edit application source during a browser regression run. Generated docs / scripts / tests / artifacts are excluded from the development watcher.

The visual-QA script verifies offline image loading, video metadata, 320 / 390 / 1440 layouts and axe checks, and produces rendered website / handoff evidence. Human inspection is still needed for the images and final video; automatic layout checks do not prove physical-headset legibility.

## Licensing and evidence limits

Font licenses and `THIRD_PARTY_NOTICES.txt` remain part of the project. No application license, customer endorsement, accessibility certification or measured operational improvement is implied. Review distribution rights and select the application license before wider release. Physical headset footage should replace screenshot chapters only after real-device validation and with a truthful recording-source label.
