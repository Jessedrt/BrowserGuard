// Cache-busting for the static site.
//
// The site has no build step and its filenames never change, so a browser that
// cached /assets/css/site.css can keep serving the old stylesheet after a
// deploy. This stamps a version query onto every local asset reference, which
// gives the browser a URL it has never seen and therefore must fetch.
//
//   npm run site:v            bump by one
//   npm run site:v -- 7       set an explicit version
//
// It rewrites, in site/**/*.html:
//   <link href="assets/css/site.css?v=N">, <script src="...?v=N">, <img src>
// and, in site/assets/js/**.js, the relative import specifiers so the whole
// module graph moves together. Only files under assets/ are touched.
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const VERSION = (process.argv[2] || '').trim();

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

// ?v=3 -> 3, ?v= -> 1, no query -> 1 (first stamping)
const versionOf = url => Number((url.match(/[?&]v=(\d+)/) || [, '1'])[1]);
const strip = url => url.replace(/([?&])v=\d+&?/, '$1').replace(/[?&]$/, '');

const files = await walk(SITE);
const htmlFiles = files.filter(file => file.endsWith('.html'));
const jsFiles = files.filter(file => file.endsWith('.js')
  && file.includes(join('assets', 'js'))
  && !file.includes(join('assets', 'js', 'engine'))); // generated copy: must stay byte-identical

let current = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]*assets\/[^"]*?(\?v=\d+)?)"/g)) current = Math.max(current, versionOf(match[1]));
}
const next = VERSION || String(current + 1);

// An asset reference is local, has no scheme, and points into assets/.
const isAsset = url => !/^(?:[a-z]+:|\/\/|#)/i.test(url) && /(^|\/)assets\//.test(url);

function stamp(url) {
  if (!isAsset(url)) return url;
  return `${strip(url)}?v=${next}`;
}

let touched = 0;

for (const file of htmlFiles) {
  const before = await readFile(file, 'utf8');
  const after = before.replace(/(href|src)="([^"]+)"/g, (whole, attr, url) => `${attr}="${stamp(url)}"`);
  if (after !== before) { await writeFile(file, after); touched++; }
}

// Module specifiers are relative ('./site.js', '../engine/analyzer.js'), so they
// do not match isAsset; every relative .js specifier gets the version instead,
// which moves the whole graph to URLs the browser has not cached.
const stampModule = spec => (/\.js$/.test(strip(spec)) ? `${strip(spec)}?v=${next}` : spec);

for (const file of jsFiles) {
  const before = await readFile(file, 'utf8');
  const after = before.replace(/from\s+'(\.[^']+)'/g, (whole, spec) => `from '${stampModule(spec)}'`)
    .replace(/import\s+'(\.[^']+)'/g, (whole, spec) => `import '${stampModule(spec)}'`);
  if (after !== before) { await writeFile(file, after); touched++; }
}

console.log(`Asset version set to ?v=${next}`);
console.log(`  ${touched} file(s) rewritten across ${htmlFiles.length} page(s) and ${jsFiles.length} module(s)`);
console.log(`  pages: ${htmlFiles.map(file => relative(SITE, file)).join(', ')}`);
