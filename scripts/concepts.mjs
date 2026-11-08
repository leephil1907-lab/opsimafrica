// Recreate standalone, offline SVG design concepts. These are not headset footage.
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = resolve(root, 'docs/concepts');
await mkdir(directory, { recursive: true });
await mkdir(resolve(root, '.cache'), { recursive: true });
const font = (await readFile(resolve(root, 'public/fonts/manrope.woff2'))).toString('base64');
const css = `@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400 800}text{font-family:Manrope,Arial,sans-serif}`;
const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const rect = (x, y, w, h, fill, radius = 14, stroke = 'none') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const text = (x, y, value, size = 22, fill = '#E8EDF2', weight = 500) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}">${esc(value)}</text>`;
const svg = (name, width, height, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(name)}</title><desc id="desc">Illustrative OpsSim Africa design concept, not a headset capture or customer result.</desc><defs><style>${css}</style></defs>${body}</svg>`;

const b = await build({
  stdin: {
    contents:
      "import {StockroomConcept} from './src/site/Site';import {renderToStaticMarkup} from 'react-dom/server';import {createElement} from 'react';export default renderToStaticMarkup(createElement(StockroomConcept));",
    loader: 'tsx',
    resolveDir: root,
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  loader: { '.css': 'empty' },
  absWorkingDir: root,
});
const modulePath = resolve(root, '.cache/stockroom-export.mjs');
await writeFile(modulePath, b.outputFiles[0].text);
const scene = (await import(pathToFileURL(modulePath))).default
  .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
  .replace('<defs>', `<defs><style>${css}</style>`);
await writeFile(resolve(directory, 'stockroom.svg'), scene);

let task = rect(0, 0, 1000, 370, '#1B2027', 24);
task += text(40, 48, 'CURRENT OBJECTIVE · TASK PANEL CONCEPT', 18, '#A9B4BF', 700);
task += text(40, 106, 'Verify the received quantity.', 40, '#E8EDF2', 800);
task += text(40, 151, '3 of 8 inspected · 2 of 8 placed', 22, '#A9B4BF');
task += text(734, 151, '4:12 remaining', 22, '#E8EDF2', 700);
task +=
  rect(40, 185, 656, 72, '#00A86B') + text(66, 232, 'Save item record  →', 26, '#0F1B2A', 800);
task += rect(718, 185, 240, 72, '#2A323C', 14, '#7A8D9E') + text(748, 232, 'Hint', 26);
task += text(40, 304, 'Accept sound units. Record missing units as a shortage.', 22, '#E8EDF2');
task += text(
  40,
  344,
  'Illustrative concept · one primary action · no walking required',
  18,
  '#A9B4BF',
);
await writeFile(
  resolve(directory, 'task-panel.svg'),
  svg('BrightMart eye-level task panel concept', 1000, 370, task),
);

let tablet = rect(0, 0, 680, 980, '#1B2027', 26);
tablet +=
  rect(20, 18, 640, 46, '#2A323C', 10, '#7A8D9E') +
  text(146, 48, 'GRAB TO MOVE THE TABLET', 18, '#A9B4BF', 700);
tablet += text(40, 108, 'RECEIVING TABLET · C07 · CONCEPT', 18, '#A9B4BF', 700);
tablet += text(40, 165, 'Disposable gloves', 36, '#E8EDF2', 800);
tablet += text(40, 208, 'Expected 24 · observed 22 sound units', 22, '#A9B4BF');
tablet += text(40, 263, 'RECEIVED UNITS', 18, '#A9B4BF', 700);
tablet += rect(40, 286, 122, 94, '#2A323C', 14, '#7A8D9E') + text(86, 346, '−', 40);
tablet += text(298, 350, '22', 56, '#E8EDF2', 800);
tablet += rect(518, 286, 122, 94, '#2A323C', 14, '#7A8D9E') + text(561, 346, '+', 40);
tablet +=
  rect(40, 405, 600, 62, '#F2A93B') +
  text(62, 445, 'Shortage of 2 · do not quarantine missing stock', 20, '#0F1B2A', 700);
tablet += text(40, 511, 'CONDITION', 18, '#A9B4BF', 700);
tablet += rect(40, 532, 284, 66, '#00A86B') + text(65, 575, '✓ Good', 24, '#0F1B2A', 800);
tablet += rect(344, 532, 296, 66, '#2A323C', 14, '#7A8D9E') + text(366, 575, 'Damaged / other', 22);
tablet += text(40, 646, 'DISPOSITION', 18, '#A9B4BF', 700);
tablet +=
  rect(40, 667, 600, 66, '#00A86B') +
  text(64, 710, '✓ Accept the 22 sound units', 24, '#0F1B2A', 800);
tablet += text(40, 782, 'Short note: Counted twice', 22, '#A9B4BF');
tablet +=
  rect(40, 817, 600, 72, '#00A86B') + text(64, 864, 'Save item record  →', 26, '#0F1B2A', 800);
tablet += text(40, 936, 'All cartons complete? Review → Confirm.', 22, '#E8EDF2');
await writeFile(
  resolve(directory, 'receiving-tablet.svg'),
  svg('BrightMart portable receiving tablet concept', 680, 980, tablet),
);

let manager = rect(0, 0, 1100, 680, '#F6F7F9', 22);
manager += text(
  44,
  48,
  'MANAGER CONCEPT · ILLUSTRATIVE DATA · NOT PILOT RESULTS',
  18,
  '#536174',
  700,
);
manager += text(44, 108, 'BrightMart practice team', 40, '#0F1B2A', 800);
for (const [i, label, value] of [
  [0, 'Rubric maximum', '100 pts'],
  [1, 'Standard delivery', '8 cartons'],
  [2, 'Scoring areas', '4'],
  [3, 'Next priorities', '2'],
]) {
  manager += rect(44 + i * 256, 147, 242, 116, '#FFFFFF', 14, '#DDE3E8');
  manager += text(64 + i * 256, 184, label, 18, '#536174');
  manager += text(64 + i * 256, 232, value, 32, '#0F1B2A', 800);
}
manager += rect(44, 292, 1012, 178, '#FFFFFF', 14, '#DDE3E8');
for (const [x, label] of [
  [64, 'Fictional learner'],
  [388, 'Score'],
  [634, 'Active time'],
  [840, 'Exceptions'],
])
  manager += text(x, 332, label, 18, '#536174', 700);
for (const [y, name, score, time] of [
  [385, 'Amaka (example)', '88 / 100 · Good', '4:12'],
  [437, 'Ada (example)', '100 / 100 · Excellent', '5:31'],
]) {
  manager +=
    text(64, y, name, 21, '#0F1B2A', 700) +
    text(388, y, score, 20, '#0F1B2A') +
    text(634, y, time, 21, '#0F1B2A') +
    text(840, y, '4 / 4 caught', 20, '#007E53', 700);
}
manager += text(
  44,
  517,
  'Coaching example: count actual units; check shelf labels before placing.',
  21,
  '#0F1B2A',
);
manager += text(
  44,
  558,
  'Assign the same variant / target / focus to compare practice attempts fairly.',
  20,
  '#536174',
);
manager += text(
  44,
  609,
  'Shared-demo roles are not authentication or secure staff permissions.',
  19,
  '#536174',
);
manager += text(
  44,
  649,
  'No real customer, employee, medical or supplier information belongs in the demo.',
  18,
  '#536174',
);
await writeFile(
  resolve(directory, 'manager-dashboard.svg'),
  svg('OpsSim Africa manager dashboard concept', 1100, 680, manager),
);
console.log('Created four standalone, font-embedded SVG concepts in docs/concepts.');
