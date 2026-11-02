// Keeps the public site's URL-analysis engine identical to the extension's.
//
// The site is deployed as a folder of static files, so it cannot import from
// src/. This script copies the shared security modules into site/assets/js/engine
// with a generated-file banner. `npm run site:check` fails if a copy drifts.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ENGINE_FILES = ['domains.js', 'analyzer.js', 'link-extractor.js'];
const TARGET = join(ROOT, 'site', 'assets', 'js', 'engine');

export async function buildEngineCopy(source) {
  const original = await readFile(join(ROOT, 'src', 'security', source), 'utf8');
  return `// GENERATED FILE — do not edit.\n// Copied from src/security/${source} by scripts/sync-site-engine.mjs.\n// Run \`npm run site:sync\` after changing the extension's analysis code.\n${original}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(TARGET, {recursive: true});
  for (const source of ENGINE_FILES) {
    await writeFile(join(TARGET, source), await buildEngineCopy(source));
    console.log('synced', source);
  }
}
