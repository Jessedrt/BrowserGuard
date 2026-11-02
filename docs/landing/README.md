# BrowserGuard — landing page & presentation imagery

Design assets for the **BrowserGuard** SIWES mini project landing page and defence
slides. Everything is built from the project's own palette so the images match the
extension UI in `src/ui/common.css`.

| Token | Value | Use |
| --- | --- | --- |
| Primary blue | `#2F6BFF` | accents, links, icon tile |
| Deep blue | `#1747D6` | gradients, emphasis |
| Pale blue | `#E8F0FF` / `#F2F7FF` | surfaces, placeholder blocks |
| Navy text | `#0F2257` | headings |
| Slate text | `#55689A` | body copy |
| White | `#FFFFFF` | cards, shield glyph |

Typography in the composited images: **Inter** (800 for titles, 600 for subheads,
400 for body). It is bundled with the site in most cases; the extension itself uses
Segoe UI / Inter, so the two read as one family.

---

## 1. `01-hero-banner.png` — 1600 × 900 (16:9)

Landing page hero. Soft blue technical gradient with faint grid lines and
concentric arcs on the left, a floating white browser window and a large blue
shield-with-checkmark on the right. The left 45 % is deliberately empty and now
carries the real lock-up:

- eyebrow: `SIWES MINI PROJECT · 2026` (letterspaced, deep blue)
- title: `BrowserGuard` (Inter 800, navy)
- subtitle: `Privacy-first browser security` (blue)
- two-line description in slate

*Variants:* `01-hero-banner-blank.png` — identical art with **no text**, for a live
`<h1>` overlay; `01-hero-banner-1200.jpg` and `.webp` — web-weight versions
(67 KB / 36 KB).

## 2. `02-project-overview.png` — 1024 × 1024 (1:1)

Presentation card art. Pale blue field inside a thin rounded frame, one centred
white browser window, a blue shield with a white tick in front of it, and a navy
padlock on a soft circular badge connected to the shield by a dotted arc — the
three ideas of the project (browse, protect, keep private) in one quiet
composition. No text, so it works as a slide image or a card header.

## 3. `03-og-image-1200x630.png` — exactly 1200 × 630

Open Graph / Twitter card. Blue wash fading to a browser mockup at the right,
with the shield anchored to the window's lower-left corner. Left side carries:

- eyebrow `CHROMIUM EXTENSION · UNIVERSITY SIWES PROJECT`
- wordmark `BrowserGuard` (Inter 800)
- subtitle `Privacy-First Browser Security Extension | SIWES 2026`
- rule + feature line `Ad and tracker blocking · Phishing URL analysis · Malware feed checks`
- credit `Ayomide Jesse · Department project, 2026`

Drop-in markup:

```html
<meta property="og:title" content="BrowserGuard">
<meta property="og:description" content="Privacy-First Browser Security Extension | SIWES 2026">
<meta property="og:image" content="/assets/03-og-image-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```

`03-og-image-blank.png` is the same art without type, if you'd rather compose it in
Figma/PowerPoint.

## 4. Extension icon concepts — `04-icon-concepts.png` (1900 × 1450)

One contact sheet: four directions, each shown large and then at true 16/32/48/128 px
so you can judge legibility. Individual 1024 px renders: `04-icon-A.png` …
`04-icon-D.png`.

| | Style | Where it wins |
| --- | --- | --- |
| **A** | Flat — blue rounded square, white outlined shield + tick | Matches the shipped `assets/icon*.png`; the safest toolbar icon |
| **B** | Soft dimensional — gradient tile, raised frosted shield, blue tick | Store listing, dashboard header, slide title |
| **C** | Outlined, light — white tile, blue line shield | Print, white slides, light UI |
| **D** | Dark navy — navy tile, solid blue shield | Dark mode, dark screenshots |

Sources are `base/icon-{A,B,C,D}.svg` on a 512 px grid with a 112 px corner radius,
plus ready-made PNGs at 16/32/48/128 px in `base/`. Regenerate with
`python3 base/make_icons.py` (needs `pip install resvg-py`).

## 5. `05-feature-section.png` — 1640 × 700

The **What it checks** band: heading, one-line context statement, and four cards on
a 350 × 360 grid (16 px gutters, 24 px radius, 1 px `#DEE9FC` border).

| Card | Icon idea | Copy |
| --- | --- | --- |
| URL analysis | address bar under a magnifier | Reads the address for phishing patterns before the page opens. |
| Malware feed | shield holding a bulleted threat list | Matches domains against a locally stored URLhaus threat feed. |
| Ad blocking | content panel with a prohibition badge | Stops ad and tracker requests with packaged, reviewable rules. |
| Warning page | browser window with an amber alert triangle | Interrupts risky navigation with a clear, colour-coded warning. |

The four icons also exist as standalone transparent-ready tiles at 640 px:
`base/feature-url-analysis.png`, `feature-malware-feed.png`,
`feature-ad-blocking.png`, `feature-warning-page.png` (SVG sources alongside).
Regenerate with `python3 base/make_features.py`.

---

## Using them

- All images are RGB PNG (some 16-bit) — convert to 8-bit/JPG for production, or use
  the `.jpg` / `.webp` derivatives supplied here.
- Card and section art is intentionally text-light so it survives being scaled down
  in a projector slide or a phone browser.
- `base/` holds the text-free generated art plus SVG sources; `docs/landing` holds the
  finished, labelled deliverables.

## Production notes

- The hero and OG images follow the project's honest framing: they promise local
  checking and blocking, not a guaranteed "safe" verdict. Keep the wording if you
  edit the copy.
- Colour is used semantically: blue = protection, green = protected, amber =
  suspicious, red = high risk. Do not recolour the warning card's triangle to blue.
