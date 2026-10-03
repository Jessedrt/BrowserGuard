# Design references for BrowserGuard v1.3

BrowserGuard uses its own implementation. No uBlock Origin or PhishScan source code, filter files, threat results, branding, or API responses are bundled.

## uBlock Origin and uBO Lite

The [uBO Lite project](https://github.com/uBlockOrigin/uBOL-home) packages declarative network rules and uses cosmetic content filtering. Its [FAQ](https://github.com/uBlockOrigin/uBOL-home/wiki/Frequently-asked-questions-(FAQ)) explains why a Manifest V3 blocker has different capabilities from the original uBlock Origin. BrowserGuard applies the same broad design ideas on a much smaller scale: packaged ad/tracker rules, local allowlist exceptions, and YouTube-scoped cosmetic filtering. It does not claim uBO's filter coverage or copy its GPL-licensed code.

BrowserGuard's ad list remains curated in `rules/ads.json`; new domains must be reviewed for false positives. The YouTube helper cannot reliably remove ads that share normal video delivery. It attempts Skip first and only tries to seek when YouTube marks an ad and the visible countdown matches the video timeline. The user can disable this experimental advance without disabling network blocking.

## PhishScan

[PhishScan](https://phishscan.io/) presents an explainable verdict with individual threat indicators and offers server-side checks such as DNS, WHOIS, redirects, and external reputation sources. BrowserGuard adopts the useful presentation principle: the popup and warning page show the actual detection basis and reasons. BrowserGuard does **not** call PhishScan, perform those server-side checks, send browsing URLs to it, or display a fabricated AI verdict. Its local URL heuristics and local URLhaus feed are described separately in the interface.

PhishScan's UI and product text were not copied. A future optional reputation integration would need a documented API, an explicit privacy disclosure, and a backend proxy for any secret key.
