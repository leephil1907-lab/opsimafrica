# OpsSim Africa — 60-second product walkthrough

**Delivered asset:** `public/images/product-demo.mp4` (60 seconds, 1280 × 720, 24 fps), with `product-demo.vtt` English captions. No narration or music. A small crossfade connects each ten-second chapter.

**Truthful visual disclosure:** opening promotional image is AI-generated and illustrative; all other chapters use screenshots captured from the actual desktop app. This is **not** physical Quest, hand-tracking or passthrough footage, and is not proof of physical comfort or device performance.

| Time    | Visual                                                          | Message / caption direction                                                               |
| ------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 00–10 s | Grounded, fictional African trainee / stockroom illustration    | Give staff a safe place to practise before the costly mistake.                            |
| 10–20 s | Actual eight-carton BrightMart stockroom and delivery task      | Know the task. Check the delivery note before handling stock.                             |
| 20–30 s | Actual carton inspector, packaging, SKU, batch and expiry       | Inspect before accepting. Isolate damaged, expired or mismatched physical stock.          |
| 30–40 s | Actual receiving tablet: expected 24, received 22, shortage 2   | Accept the 22 sound units. Record a shortage of 2. Missing stock is not quarantine stock. |
| 40–50 s | Actual item-level report, totals and confirmation action        | Review every line. Keep shortages and overages separate. Then explicitly confirm.         |
| 50–60 s | Actual saved 88/100 scorecard, four dimensions, improvement cue | Know the next step. Review two coaching priorities; repeat or try the harder delivery.    |

## Player behaviour

Home → **Watch the 60-second Demo** opens a native modal player with captions, controls and Escape-to-close. Focus returns to the opening button. Product also links to the walkthrough. Demo request and practice CTAs remain below the player.

## Recreate

1. `npx playwright test tests/e2e/brightmart.spec.ts -g 'eight-carton loop|capture labelled'` captures real product evidence into `artifacts/brightmart/` using the isolated test database. It does not mutate public assets during tests.
2. Run `python scripts/product-assets.py` to promote the passing captures to `public/images` and produce WebPs with Pillow, preserving the values and labels.
3. With optional Python tools `Pillow` and `imageio-ffmpeg` installed, run `python scripts/product-demo.py`.
4. Run `node scripts/concepts.mjs`, then `python scripts/design-kit.py` to refresh the offline design handoff.

Future hardware footage should replace screenshot chapters only after physical headset validation and with the recording source labelled correctly. Do not relabel this video as Meta/Quest-verified footage.
