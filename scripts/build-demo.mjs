// Build the isolated, browser-only demo alongside the authenticated application.
import { cpSync, existsSync, lstatSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demo = join(root, 'demo-sites', 'freight-session');
const vite = join(demo, 'node_modules', 'vite', 'bin', 'vite.js');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (!existsSync(vite)) {
  const npm = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  run(process.execPath, [npm, 'ci', '--prefix', demo, '--no-audit', '--no-fund']);
}
run(process.execPath, [vite, 'build'], {
  cwd: demo,
  env: { ...process.env, VITE_BASE_PATH: '/demo/', FREIGHT_DEMO_OUT_DIR: 'dist-web' },
});
const destination = resolve(root, 'public', 'demo');
if (dirname(destination) !== resolve(root, 'public') || lstatSync(destination, { throwIfNoEntry: false })?.isSymbolicLink()) {
  throw new Error('Refusing to replace an unexpected demo output directory.');
}
rmSync(destination, { recursive: true, force: true });
mkdirSync(dirname(destination), { recursive: true });
cpSync(join(demo, 'dist-web'), destination, { recursive: true });
console.log('Meridian demo built at /demo/index.html; production API credentials are not included.');
