"""Promote real, labelled browser captures and create optimised website WebPs.
Run only after the eight-carton loop and capture-labelled tests have passed.
This step is deliberately separate from browser testing: tests never mutate
public assets or trigger hot reloads while another test is scanning a page.
"""
from pathlib import Path
from shutil import copyfile
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'artifacts' / 'brightmart'
DESTINATION = ROOT / 'public' / 'images'
NAMES = ['stockroom', 'inspect', 'record', 'sort', 'review', 'scorecard']
for name in NAMES:
    path = SOURCE / f'product-{name}.png'
    if not path.is_file():
        raise SystemExit(f'Missing real product capture: {path}. Run the labelled browser tests first.')
DESTINATION.mkdir(parents=True, exist_ok=True)
for name in NAMES:
    source = SOURCE / f'product-{name}.png'
    copyfile(source, DESTINATION / source.name)
    Image.open(source).convert('RGB').save(DESTINATION / f'product-{name}.webp', 'WEBP', quality=84, method=6)
print('Promoted six actual product captures and generated six WebPs; no values or UI labels repainted.')
