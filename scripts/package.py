"""Package a verified Git checkout plus production output and selected release evidence.
Run after npm run build and a clean commit: python scripts/package.py
Never includes live data, backups, credentials, dependencies, traces or scratch files.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT.parent / 'OpsSim-Africa.zip')
args = parser.parse_args()
output = args.output.resolve()
status = subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True)
if status.strip():
    raise SystemExit('Commit the reviewed source before packaging; the working tree must be clean.')
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
verification = json.loads((ROOT / 'docs/VERIFICATION.json').read_text())
if not verification.get('verifiedForDemoRelease'):
    raise SystemExit('Final demo-release verification must pass before packaging.')
if not (ROOT / 'dist/index.html').is_file():
    raise SystemExit('Missing compiled production build. Run npm run build first.')

blocked = {'.git', '.cache', 'node_modules', 'data', 'backups', 'artifacts', 'test-results', 'playwright-report', '.arena'}
secrets = re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
files = {}
for name in tracked:
    if not name:
        continue
    p = Path(name)
    if any(part in blocked for part in p.parts) or (p.name.startswith('.env') and p.name != '.env.example'):
        raise SystemExit('Refusing a sensitive tracked path: ' + name)
    source = ROOT / p
    if source.is_symlink():
        raise SystemExit('Refusing a symlink in the source package: ' + name)
    if source.is_file():
        content = source.read_bytes()
        if secrets.search(content):
            raise SystemExit('Credential-pattern scan failed for ' + name)
        files['OpsSim-Africa/' + p.as_posix()] = content
for source in sorted((ROOT / 'dist').rglob('*')):
    if source.is_file():
        content = source.read_bytes()
        if secrets.search(content):
            raise SystemExit('Credential-pattern scan failed in compiled output.')
        files['OpsSim-Africa/' + source.relative_to(ROOT).as_posix()] = content

evidence = {
    'unit-tests.tap': 'artifacts/brightmart/unit-tests.tap',
    'browser-results.json': 'artifacts/brightmart/final-browser-results.json',
    'xr-emulation.json': 'artifacts/brightmart/xr-emulation.json',
    'xr-document-emulation.json': 'artifacts/brightmart/xr-document-emulation.json',
    'dependency-audit.json': 'artifacts/brightmart/dependency-audit.json',
    'visual-qa.json': 'artifacts/brightmart/visual-qa.json',
    'production-smoke.json': 'artifacts/production-smoke.json',
    'backup-verification.json': 'artifacts/brightmart/backup-verification.json',
    'production-backup-verification.json': 'artifacts/brightmart/production-backup-verification.json',
    'owner-export-verification.json': 'artifacts/brightmart/owner-export-verification.json',
    'build.log': 'artifacts/brightmart/production-build.log',
    'format-check.log': 'artifacts/brightmart/format-check.log',
    'site-home-desktop.png': 'artifacts/brightmart/site-home-desktop.png',
    'site-home-mobile.png': 'artifacts/brightmart/site-home-mobile.png',
    'site-product-desktop.png': 'artifacts/brightmart/site-product-desktop.png',
    'xr-eight-sorted.png': 'artifacts/brightmart/xr-eight-sorted.png',
    'xr-scorecard.png': 'artifacts/brightmart/xr-scorecard.png',
    'xr-document-held.png': 'artifacts/brightmart/xr-document-held.png',
    'production-scorecard.png': 'artifacts/brightmart/production-scorecard.png',
    'design-kit-desktop.png': 'artifacts/brightmart/design-kit-desktop.png',
    'design-kit-mobile.png': 'artifacts/brightmart/design-kit-mobile.png',
}
for name, relative in evidence.items():
    source = ROOT / relative
    if not source.is_file():
        raise SystemExit('Missing final release evidence: ' + relative)
    files['OpsSim-Africa/release-evidence/' + name] = source.read_bytes()

meta = {
    'version': json.loads((ROOT / 'package.json').read_text())['version'],
    'repository': 'https://github.com/leephil1907-lab/opsimafrica',
    'sourceCommit': commit,
    'packagedAt': datetime.now(timezone.utc).isoformat(),
    'includesCompiledBuild': True,
    'includesLiveDatabaseOrCredentials': False,
    'physicalQuestVerified': False,
}
files['OpsSim-Africa/SOURCE-COMMIT.txt'] = (commit + '\n').encode()
files['OpsSim-Africa/DELIVERY.json'] = (json.dumps(meta, indent=2) + '\n').encode()
manifest = {name: hashlib.sha256(content).hexdigest() for name, content in sorted(files.items())}
files['OpsSim-Africa/FILE-CHECKSUMS.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, content in sorted(files.items()):
        archive.writestr(name, content)
with zipfile.ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Archive integrity check failed.')
    for name, expected in manifest.items():
        if hashlib.sha256(archive.read(name)).hexdigest() != expected:
            raise SystemExit('Archive content verification failed: ' + name)
digest = hashlib.sha256(output.read_bytes()).hexdigest()
checksum = output.with_suffix(output.suffix + '.sha256')
checksum.write_text(digest + '  ' + output.name + '\n')
print(json.dumps({'archive': str(output), 'files': len(files), 'bytes': output.stat().st_size, 'sha256': digest, 'checksum': str(checksum), **meta}, indent=2))
