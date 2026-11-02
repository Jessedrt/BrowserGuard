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
npm run site:check     # links, accessibility basics, engine drift, external hosts
npm run site:sync      # refresh assets/js/engine from src/security
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

The folder can be published as-is (GitHub Pages, Netlify, Cloudflare Pages, an
S3 bucket, or any static host). Before going live:

1. Set the absolute URLs for `og:image` and add `og:url` per page — they are
   currently relative, which works for browsing but not for social previews.
2. Add the production domain to `robots.txt` and `sitemap.xml` if you want search
   engines to index the tools.
3. If the site is served under a sub-path, every link is relative, so it will work
   unchanged, but check `tools/*.html` links from the hub once after deploying.

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
