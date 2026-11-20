import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'export', '--platform', 'web', '--output-dir', 'dist'], { cwd: root, stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
const hash = createHash('sha256');
function sources(directory) {
  for (const file of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, file.name);
    if (file.isDirectory()) sources(full);
    else if (/\.(tsx?|css|mjs|json)$/.test(file.name)) hash.update(path.relative(root, full)).update(readFileSync(full));
  }
}
sources(path.join(root, 'src'));
for (const file of ['App.tsx', 'App.web.tsx', 'app.config.ts', 'package.json', 'package-lock.json']) hash.update(file).update(readFileSync(path.join(root, file)));
writeFileSync(path.join(root, 'dist/release.json'), JSON.stringify({ app: 'Freight Partners', platform: 'web', source_sha256: hash.digest('hex') }, null, 2) + '\n');

const args = process.argv.slice(2);
if (args.length) {
  if (args.length !== 2 || args[0] !== '--backend') throw new Error('Usage: node scripts/build-web.mjs [--backend <backend-checkout>]');
  const backend = realpathSync(path.resolve(args[1]));
  const parent = realpathSync(path.join(backend, 'partner_network'));
  const destination = path.join(parent, 'web-build');
  if (!existsSync(path.join(parent, 'Dockerfile')) || parent !== path.join(backend, 'partner_network') || lstatSync(destination, { throwIfNoEntry: false })?.isSymbolicLink())
    throw new Error('Refusing to replace a directory outside the selected backend partner service.');
  // Only replace the explicitly validated, generated website output.
  if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  cpSync(path.join(root, 'dist'), destination, { recursive: true });
  console.log(`Partner website build copied to ${destination}`);
}
