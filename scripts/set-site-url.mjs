// Points the site at its public URL: absolute social-preview tags on every page,
// a sitemap, and a robots.txt that references it.
//
//   npm run site:url -- https://browserguard-tools.netlify.app
//
// Run it once you know the domain. Safe to re-run: every rewrite is idempotent.
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');

const raw = process.argv[2];
if (!raw) {
  console.error('Usage: npm run site:url -- https://your-site.example');
  process.exit(1);
}
let base;
try {
  const parsed = new URL(raw);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('must be http or https');
  if (!parsed.hostname.includes('.')) throw new Error('that does not look like a domain');
  base = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
} catch (error) {
  console.error(`Not a usable site URL: ${raw} (${error.message})`);
  process.exit(1);
}

const decode = value => value
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
const esc = value => decode(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// Netlify serves these pages without the .html suffix (and redirects it away),
// so the canonical form is the clean URL — not a URL that bounces.
const pageUrl = path => (path === 'index.html'
  ? `${base}/`
  : `${base}/${path.replace(/\.html$/, '').split('\\').join('/')}`);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.name.endsWith('.html')) files.push(target);
  }
  return files;
}

const files = (await walk(SITE)).sort((a, b) => a.localeCompare(b));
const pages = [];

for (const file of files) {
  const path = relative(SITE, file).split('\\').join('/');
  const url = pageUrl(path);
  let html = await readFile(file, 'utf8');
  const image = `${base}/assets/img/og.jpg`;
  const title = (html.match(/<title>([^<]+)<\/title>/) || [, 'BrowserGuard'])[1];
  const description = (html.match(/<meta name="description" content="([^"]*)"/) || [, '']) [1];

  // Replace an existing image tag (absolute or relative) with the absolute URL.
  if (/<meta property="og:image"/.test(html)) {
    html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${image}">`);
  }
  if (/<meta property="og:url"/.test(html)) {
    html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  }

  // Add whichever preview tags the page is missing, right after its description.
  const additions = [];
  if (!/<meta property="og:type"/.test(html)) additions.push('<meta property="og:type" content="website">');
  if (!/<meta property="og:title"/.test(html)) additions.push(`<meta property="og:title" content="${esc(title)}">`);
  if (!/<meta property="og:description"/.test(html)) additions.push(`<meta property="og:description" content="${esc(description)}">`);
  if (!/<meta property="og:url"/.test(html)) additions.push(`<meta property="og:url" content="${url}">`);
  if (!/<meta property="og:image"/.test(html)) additions.push(`<meta property="og:image" content="${image}">`);
  if (!/<meta name="twitter:card"/.test(html)) additions.push('<meta name="twitter:card" content="summary_large_image">');
  if (!/<meta name="twitter:image"/.test(html)) additions.push(`<meta name="twitter:image" content="${image}">`);

  if (additions.length) {
    const anchor = /<meta name="description" content="[^"]*">\n?/;
    if (anchor.test(html)) html = html.replace(anchor, match => `${match}${additions.join('\n')}\n`);
    else html = html.replace('</head>', `${additions.join('\n')}\n</head>`);
  }

  // Canonical URL, so duplicate paths do not compete in search results.
  const canonical = `<link rel="canonical" href="${url}">`;
  if (/<link rel="canonical"/.test(html)) html = html.replace(/<link rel="canonical" href="[^"]*">/, canonical);
  else html = html.replace('</head>', `${canonical}\n</head>`);

  await writeFile(file, html);
  pages.push({path, url, title, description});
}

const priority = path => (path === 'index.html' ? '1.0' : path.startsWith('tools/') ? '0.8' : '0.6');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${page.url}</loc>
    <changefreq>monthly</changefreq>
    <priority>${priority(page.path)}</priority>
  </url>`).join('\n')}
</urlset>
`;
await writeFile(join(SITE, 'sitemap.xml'), sitemap);

const robotsPath = join(SITE, 'robots.txt');
let robots = await readFile(robotsPath, 'utf8').catch(() => 'User-agent: *\nAllow: /\n');
robots = robots.replace(/\nSitemap: .*$/gm, '').trimEnd();
robots += `\n\nSitemap: ${base}/sitemap.xml\n`;
await writeFile(robotsPath, robots);

console.log(`Site URL set to ${base}`);
console.log(`  ${pages.length} pages given absolute og:url, og:image and canonical tags`);
console.log(`  sitemap.xml written with ${pages.length} entries`);
console.log(`  robots.txt now points at ${base}/sitemap.xml`);
