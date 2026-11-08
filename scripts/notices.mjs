// Regenerate after npm ci / dependency updates. This inventories the installed
// production dependency tree; it is not a legal-compliance certification.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('.');
const paths = [
  ...new Set(
    execFileSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], { encoding: 'utf8' })
      .trim()
      .split('\n'),
  ),
].filter((p) => p !== root);
const packages = paths
  .map((path) => ({ path, pkg: JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8')) }))
  .sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));
let text =
  'OpsSim Africa — third-party runtime notices\n\nGenerated from the installed production dependency tree. Dependencies retain their own licenses. This inventory does not assign an application license or certify legal compliance. Font OFL notices are separately included in public/fonts/. Development/test tools are not bundled into the application runtime.\n';
for (const { path, pkg } of packages) {
  text += `\n${'='.repeat(72)}\n${pkg.name}@${pkg.version}\nDeclared license: ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license || pkg.licenses || 'See upstream package')}\n`;
  if (pkg.homepage) text += `Homepage: ${pkg.homepage}\n`;
  const files = readdirSync(path, { withFileTypes: true }).filter(
    (e) => e.isFile() && /^(license|licence|copying|notice)([-.].*)?$/i.test(e.name),
  );
  for (const file of files)
    text += `\n--- ${file.name} ---\n${readFileSync(resolve(path, file.name), 'utf8')}\n`;
  if (!files.length)
    text +=
      '\nNo root notice file was found in this installed package. Consult its declared license and upstream distribution for applicable terms.\n';
}
writeFileSync('THIRD_PARTY_NOTICES.txt', text);
writeFileSync('public/third-party-notices.txt', text);
console.log(
  `Wrote notices for ${packages.length} runtime packages to THIRD_PARTY_NOTICES.txt and public/third-party-notices.txt.`,
);
