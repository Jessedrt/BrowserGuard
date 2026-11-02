// Static-site audit: internal links resolve, the shared engine has not drifted
// from src/security, every tool page loads its own script, and no page reaches a
// third-party host without being listed here.
import {readFile, readdir, stat} from 'node:fs/promises';
import {dirname, join, resolve, posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ENGINE_FILES, buildEngineCopy} from './sync-site-engine.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const problems = [];

// The breach check is the single permitted outbound request: HIBP's k-anonymity
// range endpoint. Referenced links to GitHub are navigational, not fetched.
const ALLOWED_EXTERNAL = ['https://api.pwnedpasswords.com/', 'https://github.com/Jessedrt/BrowserGuard'];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

const files = await walk(SITE);
const htmlFiles = files.filter(file => file.endsWith('.html'));
const skips = ['http://', 'https://', 'mailto:', '#', 'data:'];

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const page = file.slice(SITE.length + 1);

  // 1. local links and asset references
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (skips.some(prefix => target.startsWith(prefix))) continue;
    const clean = target.split('#')[0].split('?')[0];
    if (!clean) continue;
    const resolved = resolve(dirname(file), clean);
    try { await stat(resolved); }
    catch { problems.push(`${page}: broken reference "${target}"`); }
  }

  // 2. external hosts that the page can actually navigate to or fetch.
  // Placeholder text and data-* sample links are inert and are not scanned.
  for (const match of html.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)) {
    const url = match[1];
    if (ALLOWED_EXTERNAL.some(prefix => url.startsWith(prefix))) continue;
    problems.push(`${page}: unexpected external link ${url}`);
  }

  // 3. accessibility basics
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="[^"]*"/.test(match[0])) problems.push(`${page}: <img> without alt — ${match[0].slice(0, 70)}`);
  }
  const labels = [...html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map(match => match[1]);
  for (const id of labels) if (!html.includes(`id="${id}"`)) problems.push(`${page}: <label for="${id}"> has no matching input`);
  if (!/<title>[^<]{10,}<\/title>/.test(html)) problems.push(`${page}: missing or too-short <title>`);
  if (!/<meta name="description" content="[^"]{40,}"/.test(html)) problems.push(`${page}: missing meta description`);
  if (!/<html lang="/.test(html)) problems.push(`${page}: missing lang attribute`);
}

// 4. generated engine copies must match the extension source
for (const source of ENGINE_FILES) {
  const generated = join(SITE, 'assets', 'js', 'engine', source);
  const expected = await buildEngineCopy(source);
  const actual = await readFile(generated, 'utf8').catch(() => null);
  if (actual !== expected) problems.push(`engine drift: site/assets/js/engine/${source} differs from src/security/${source} — run npm run site:sync`);
}

// 5. every tool page must load a module, and every module it imports must exist
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const page = file.slice(SITE.length + 1);
  const scripts = [...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map(match => match[1]);
  if (page !== 'index.html' && !scripts.length) problems.push(`${page}: no module script`);
  for (const script of scripts) {
    const modulePath = resolve(dirname(file), script);
    const module = await readFile(modulePath, 'utf8').catch(() => null);
    if (!module) { problems.push(`${page}: script not found ${script}`); continue; }
    for (const imported of module.matchAll(/from\s+'([^']+)'/g)) {
      if (!imported[1].startsWith('.')) continue;
      const target = resolve(dirname(modulePath), imported[1]);
      if (!await stat(target).then(() => true, () => false)) problems.push(`${page}: import not found ${imported[1]} in ${script}`);
    }
  }
}

const size = (await Promise.all(files.map(async file => (await stat(file)).size))).reduce((total, value) => total + value, 0);
if (problems.length) {
  console.error(`Site audit failed with ${problems.length} problem(s):`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}
console.log(`Site audit passed: ${htmlFiles.length} pages, ${files.length} files, ${(size / 1024).toFixed(0)} KB total, engine in sync.`);
