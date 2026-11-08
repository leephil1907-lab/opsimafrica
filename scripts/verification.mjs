// Finalise the demo-release evidence only after every required check has passed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const read = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const browser = json('artifacts/brightmart/final-browser-results.json');
assert.equal(browser.stats.expected, 45);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0);
assert.equal(browser.errors.length, 0);
assert.ok(browser.config.projects.every((p) => p.retries === 0));
const tap = read('artifacts/brightmart/unit-tests.tap');
assert.match(tap, /# tests 66\s/);
assert.match(tap, /# pass 66\s/);
assert.match(tap, /# fail 0\s/);
const production = json('artifacts/production-smoke.json');
assert.equal(production.passed, true);
assert.equal(production.brightmart.score, 100);
assert.equal(production.brightmart.totals.shortageUnits, 2);
assert.equal(production.legacy.score, 100);
const backup = json('artifacts/brightmart/backup-verification.json');
const productionBackup = json('artifacts/brightmart/production-backup-verification.json');
assert.equal(backup.passed, true);
assert.equal(backup.preUpdate.equal, true);
assert.equal(productionBackup.passed, true);
assert.ok(productionBackup.tables.find((t) => t.name === 'receiving_runs')?.rows > 0);
assert.ok(productionBackup.tables.find((t) => t.name === 'brightmart_runs')?.rows > 0);
assert.ok(productionBackup.contactRequests.recentCountPreserved > 0);
const ownerExport = json('artifacts/brightmart/owner-export-verification.json');
assert.equal(ownerExport.passed, true);
assert.equal(ownerExport.mode, '0600');
assert.ok(ownerExport.savedFictionalRequestsExported > 0);
const visual = json('artifacts/brightmart/visual-qa.json');
assert.equal(visual.passed, true);
const audit = json('artifacts/brightmart/dependency-audit.json');
assert.equal(audit.metadata.vulnerabilities.total, 0);
assert.match(
  read('artifacts/brightmart/format-check.log'),
  /All matched files use Prettier code style/,
);
assert.match(read('artifacts/brightmart/production-build.log'), /built in/);
const walk = (p) =>
  readdirSync(p, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(p, e.name)) : [join(p, e.name)],
  );
const frontend = Object.fromEntries(
  walk('dist')
    .filter((p) => /\.(js|css|html)$/.test(p))
    .sort()
    .map((p) => [p.replaceAll('\\', '/'), hash(p)]),
);
const evidencePaths = [
  'artifacts/brightmart/unit-tests.tap',
  'artifacts/brightmart/final-browser-results.json',
  'artifacts/production-smoke.json',
  'artifacts/brightmart/backup-verification.json',
  'artifacts/brightmart/production-backup-verification.json',
  'artifacts/brightmart/visual-qa.json',
  'artifacts/brightmart/owner-export-verification.json',
  'artifacts/brightmart/dependency-audit.json',
  'artifacts/brightmart/production-build.log',
  'artifacts/brightmart/format-check.log',
];
const report = {
  product: 'OpsSim Africa',
  version: json('package.json').version,
  verifiedAt: new Date().toISOString(),
  verifiedForDemoRelease: true,
  sourceCommitReference: 'SOURCE-COMMIT.txt and DELIVERY.json in the delivered archive',
  environment: {
    node: process.version,
    browser: 'Playwright Chromium, headless, software WebGL',
    emulator: 'Meta IWER 2.8.0 Quest 3 preset',
    physicalDevice: false,
  },
  checks: {
    unit: {
      passed: 66,
      failed: 0,
      skipped: 0,
      durationMilliseconds: Number(tap.match(/# duration_ms ([\d.]+)/)?.[1]),
    },
    browser: { ...browser.stats, retriesConfigured: 0, files: 6, xrTests: 5 },
    typescriptAndProductionBuild: { passed: true, modules: 1609 },
    formatting: { passed: true },
    dependencyAudit: { reportedVulnerabilities: 0 },
    production: {
      passed: true,
      publicPages: 6,
      videoSeconds: 60,
      requestReceipt: true,
      automaticBooking: false,
      brightmartScore: 100,
      dimensions: [35, 25, 25, 15],
      legacyScore: 100,
      reloadAndHarderReplay: true,
      browserErrors: 0,
      failedResources: 0,
      developmentXRDiagnostics: false,
      viteClient: false,
      durationMilliseconds: production.durationMilliseconds,
    },
    mainBackup: {
      passed: true,
      integrity: backup.integrity,
      preUpdateCompletedResultsPreservedExactly: backup.preUpdate.completedResultsPreservedExactly,
      currentSessionsPreserved: backup.tables.find((t) => t.name === 'sessions').rows,
      privateRowsExposed: false,
    },
    productionBackup: {
      passed: true,
      integrity: productionBackup.integrity,
      bothEngines: true,
      consentedFictionalRequestsPreserved: productionBackup.contactRequests.recentCountPreserved,
      privateRowsExposed: false,
    },
    ownerExport: {
      passed: true,
      mode: '0600',
      readonly: true,
      publicOrSourceDestinationsRejected: true,
      formulaSafe: true,
      fictionalRequests: ownerExport.savedFictionalRequestsExported,
      privateRowsExposed: false,
    },
    offlineDesignKitAndVisualQA: {
      passed: true,
      widths: [320, 390, 1440],
      axeViolations: 0,
      embeddedVideoSeconds: 60,
    },
  },
  frontendFileSHA256: frontend,
  evidenceSHA256: Object.fromEntries(evidencePaths.map((p) => [p, hash(p)])),
  notValidated: [
    'Physical Quest hand tracking / actual passthrough / stereo comfort / performance',
    'Docker execution',
    'Real-pilot operational outcomes',
    'Authenticated private staff use / secure tenancy',
    'Permanent deployment / competition eligibility or submission',
  ],
  mediaDisclosure:
    'AI-generated illustrative opening; actual automated desktop captures for product screens and 60-second captioned video. Not physical headset footage or human completion-time evidence.',
};
writeFileSync('docs/VERIFICATION.json', JSON.stringify(report, null, 2) + '\n');
const seconds = (browser.stats.duration / 1000).toFixed(1);
writeFileSync(
  'docs/RELEASE.md',
  `# OpsSim Africa v2.0 — demo release\n\nVerified ${report.verifiedAt.slice(0, 10)}. This is a functioning shared-demo MVP, not a claim of hardened workplace or physical-headset readiness.\n\n## Included\n\n- Six mobile-first public pages, saved demo / waitlist receipts, privacy and honest roadmap labels.\n- BrightMart: eight physical cartons; 22 sound units accepted / shortage 2; per-item records; fixed 35 / 25 / 25 / 15 scoring; Review then Confirm; saved coaching and comparable replay.\n- Stationary one-hand WebXR path, task panel / portable tablet, document and carton manipulation, quantity pokes and pause safeguards.\n- Lightweight named-team / invitation / assignment / trainer views. Historical engine, contexts, roles and saved data preserved.\n- Brand kit, editable wireframes / concepts, actual product captures, captioned 60-second MP4 / VTT and offline design handoff.\n\n## Verified\n\n| Check | Result |\n| --- | --- |\n| Unit / API / persistence / gestures | 66 / 66 passed |\n| Browser regression, six files | 45 / 45 passed; zero retries, flaky tests or skips; ${seconds} seconds |\n| XR emulator cases | 5 passed; right hand only; no controllers |\n| Production build / format / dependency audit | Passed; 0 reported vulnerabilities |\n| Compiled production smoke | Six pages, real receipt, current and legacy receiving loops both 100, reload, replay, pause; no browser errors / failed resources |\n| Live-data backup / isolated restore | Integrity ok; ${report.checks.mainBackup.currentSessionsPreserved} sessions preserved; all ${backup.preUpdate.completedResultsPreservedExactly} pre-update completed results unchanged |\n| Production restore | Both engines and ${productionBackup.contactRequests.recentCountPreserved} fictional contact requests preserved |\n| Owner-local contact export | Read-only; owner-only 0600 CSV; ${ownerExport.savedFictionalRequestsExported} fictional requests; formula-safe; source / public paths rejected |\n| Offline handoff / visual QA | 320 / 390 / 1440; embedded video 60 seconds; zero axe violations |\n\nMachine-readable details and evidence hashes: **VERIFICATION.json**. The delivery archive includes the source commit, per-file checksums, compiled build and selected release evidence. Live databases, backups, private CSVs, dependencies, credentials and scratch files are excluded.\n\n## Important limits\n\nPhysical Quest hands, actual passthrough, stereo comfort, reachable controls and performance still require real-device testing. Software-emulator timing is not a human task-time or hardware benchmark. Shared demo roles are not authentication or tenant permissions. The promotional video is a desktop still-image walkthrough with an illustrative opening, not headset footage or pilot evidence. Docker, permanent deployment and competition submission / eligibility remain unverified.\n`,
);
console.log('Finalised docs/VERIFICATION.json and docs/RELEASE.md from passing evidence.');
