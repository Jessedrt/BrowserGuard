import {readFile, readdir} from 'node:fs/promises';
import {join, extname} from 'node:path';
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
if (manifest.manifest_version !== 3 || manifest.background?.type !== 'module') throw new Error('Invalid MV3 foundation');
if (manifest.permissions.includes('webRequest') || manifest.host_permissions.includes('<all_urls>')) throw new Error('Excessive permission');
for (const path of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon), ...(manifest.content_scripts || []).flatMap(script => [...(script.js || []), ...(script.css || [])])]) {
  await readFile(new URL(`../${path}`, import.meta.url));
}
const ids = new Set();
for (const entry of manifest.declarative_net_request.rule_resources) {
  const rules = JSON.parse(await readFile(new URL(`../${entry.path}`, import.meta.url), 'utf8'));
  for (const rule of rules) {
    if (ids.has(rule.id)) throw new Error(`Duplicate rule ID ${rule.id}`);
    ids.add(rule.id);
    if (rule.action.type !== 'block') throw new Error('Unexpected static rule action');
  }
}
async function walk(path) {
  for (const entry of await readdir(path, {withFileTypes:true})) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (extname(target) === '.js') {
      const source = await readFile(target, 'utf8');
      if (/\beval\s*\(|new\s+Function\s*\(/.test(source)) throw new Error(`Unsafe JS in ${target}`);
    }
  }
}
await walk(new URL('../src/', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
console.log(`MV3 manifest, ${ids.size} static rules, and unsafe-code patterns checked.`);
