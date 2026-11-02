# BrowserGuard site

Static security-tools site. No build step, no dependencies, no server: every check
runs in the visitor's browser.

```text
site/
  index.html                     tools hub and quick link check
  extension.html                 the Chromium extension as one offering
  about.html                     method, privacy statement and limits (#limits)
  tools/
    link-checker.html            URL and email-link phishing analysis
    password-strength.html       guess-count and pattern analysis
    password-generator.html      random passwords and passphrases
    privacy-check.html           what this browser exposes to any site
  robots.txt
  _headers                       security headers for static hosts (Netlify et al.)
  assets/
    css/site.css                 one design system, light and dark
    img/                         logo, favicon, hero, Open Graph image
    js/site.js                   navigation, year, clipboard helper
    js/lib/password.js           scoring, generation, 256-word list
    js/tools/*.js                one module per tool page
    js/engine/                   GENERATED from src/security — do not edit
```

## Run it locally

```bash
npm run site:serve     # http://localhost:8099
npm run site:check     # links, accessibility basics, CSP safety, engine drift
npm run site:sync      # refresh assets/js/engine from src/security
npm run site:zip       # build deploy/browserguard-site.zip for drag-and-drop hosts
npm run site:url -- <url>   # set absolute social tags, sitemap and robots
```

The site must be served over HTTP rather than opened from the file system, because
the tools are ES modules and browsers block module loading on `file://`.

## Shared analysis engine

`assets/js/engine/{domains,analyzer,link-extractor}.js` are copies of
`src/security/` with a generated-file banner. The site is deployed as a folder of
static files, so it cannot import from `src/`, and duplicating the logic by hand
would let the site and the extension disagree.

`npm run site:check` fails if a copy drifts, so change the engine in `src/security`
and run `npm run site:sync`.

## Deploying

The folder can be published as-is (Netlify, Cloudflare Pages, GitHub Pages, an S3
bucket, or any static host). There is no build command and no output directory
other than `site/` itself. No CI workflow is included; Netlify builds nothing, so
deployment is just "publish this folder".

### Netlify

Step-by-step instructions live in [`docs/DEPLOY-NETLIFY.md`](../docs/DEPLOY-NETLIFY.md).
Two routes, both free:

**Drag and drop (fastest, no repository connection).** Build the upload archive and
drop it on <https://app.netlify.com/drop>:

```bash
npm run site:zip     # writes deploy/browserguard-site.zip (~218 KB, 26 files)
```

Netlify extracts it, serves `index.html`, and gives you a `*.netlify.app` URL. The
`_headers` file inside the archive is read automatically, so the security headers
and CSP apply on a drag-and-drop deploy too.

**Repository import (recommended for updates).** Connect the GitHub repo, then:

| Setting | Value |
| --- | --- |
| Build command | *(leave empty)* |
| Publish directory | `site` |
| Node version | any — nothing is compiled |

`netlify.toml` at the repository root supplies those values, so the defaults are
already correct. Every push to the production branch redeploys automatically.

### Headers and CSP

Both `netlify.toml` and `site/_headers` send:

- a Content-Security-Policy with no `unsafe-inline` for scripts *or* styles — the
  site has no inline scripts and no `style=` attributes, and `npm run site:check`
  fails if one is ever reintroduced
- `connect-src` limited to `'self'` plus `https://api.pwnedpasswords.com` for the
  optional breach check
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `Permissions-Policy` denying device APIs

### Before going live

1. Run `npm run site:url -- https://your-site.example` — it sets absolute
   `og:url`, `og:image` and `canonical` tags on every page, writes `sitemap.xml`
   and references it from `robots.txt`. Social previews do not resolve relative
   paths, so this step is required before sharing the link.
2. Rebuild the upload archive with `npm run site:zip` and redeploy.
3. Check the site on a phone; every link is relative, so a sub-path deployment
   works unchanged.

## Network use

The site makes **one** optional outbound request: the breach check on
`tools/password-strength.html` calls `https://api.pwnedpasswords.com/range/<5-char SHA-1 prefix>`
after an explicit button press, using k-anonymity so the password itself is never
sent. Nothing else leaves the page, and `scripts/check-site.mjs` fails the build if
another external host is added without being listed there.

## Design tokens

The palette is the extension's palette, so the two read as one product:

| Token | Value | Use |
| --- | --- | --- |
| `--blue` | `#2f6bff` | primary actions, links, protection |
| `--blue-d` | `#1747d6` | gradient end, emphasis |
| `--pale` | `#e8f0ff` | tinted surfaces |
| `--ink` | `#0f2257` | headings and body |
| `--muted` | `#55689a` | secondary text |
| `--green` / `--amber` / `--red` | status only | no indicators / suspicion / high risk |

Colour is semantic: green means "no known indicators", never "safe".
