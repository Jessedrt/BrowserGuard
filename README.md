# BrowserGuard

**Development of a Chrome Extension for Ad, Tracker, Phishing and Malicious Website Protection**

BrowserGuard is a working Manifest V3 cybersecurity training project. It blocks common ad and tracking network requests, analyzes website URLs for phishing indicators, checks domains against a locally stored malware-domain feed, and interrupts risky top-level navigation with a warning. It stores controls, statistics, and a short security-event history on the user's device.

**BrowserGuard is a browser-level security tool. It is not a replacement for antivirus or endpoint security software.** It does not scan the computer or claim to find Trojans installed on it. Its malware protection is limited to malicious websites and download sources visible to the browser.

## The problem

Advertising and tracking requests expose browsing activity and can lead to unwanted content. Phishing URLs may imitate trusted brands, while malware distribution sites can host dangerous downloads. BrowserGuard demonstrates several complementary browser defenses while keeping the distinction between *suspicious* URL patterns and *threat-intelligence* matches clear.

## Features

- Independent ad and tracker blocking through two packaged `declarativeNetRequest` rulesets. Domain and endpoint rules are maintained in `rules/`.
- URL analysis for IP hosts, long domains, many subdomains, punycode, user-info tricks, encoding, complex paths, URL shorteners, unencrypted sensitive paths, and selected brand lookalikes.
- Risk labels: **SAFE**, **LOW RISK**, **SUSPICIOUS**, **HIGH RISK**, and **KNOWN MALICIOUS**. A heuristic result never claims confirmed phishing.
- A dated snapshot of the public [URLhaus hosts file](https://urlhaus.abuse.ch/downloads/hostfile/) is bundled for offline first-run protection. Daily downloads and manual refresh replace it with newer domains. The extension keeps working with the snapshot, heuristics, and custom blocklist when updates fail.
- Warning interstitial with reasons, a back button, advanced explanation, and an explicit second confirmation for high-risk and feed-matched sites.
- Popup, dashboard, protection toggles, local event history, allowlist, custom blocklist, and settings.
- No telemetry, analytics, remote JavaScript, client-side API secrets, or browsing-URL reputation queries.

## Architecture

```text
manifest.json                     MV3 permissions, worker, popup, rulesets
assets/                           generated PNG extension icons
rules/ads.json                    ad domains and endpoints
rules/trackers.json               tracker domains and pixels
src/security/domains.js           URL parsing and domain validation
src/security/analyzer.js          explainable heuristic risk scoring
src/security/reputation.js        URLhaus feed parser
src/security/seed.js              dated URLhaus offline snapshot
src/background/service-worker.js  navigation monitoring, DNR state, statistics, messages
src/storage/state.js              local settings and data defaults
src/popup/                       compact current-site controls
src/dashboard/                   full dashboard and list management
src/warning/                     navigation interstitial
src/ui/common.css                shared visual design
tests/                           safe logic fixtures and local rule demo
scripts/check.mjs                manifest and rule audit
```

The worker observes top-level HTTP(S) navigation with `webNavigation.onBeforeNavigate`, analyzes the URL, and uses `tabs.update` to show the extension warning page. It stores the pending original URL only in worker memory for that tab. Clicking **Continue anyway** grants one navigation attempt for that exact URL, expiring after two minutes. No persistent exception is added.

Ads and trackers use separate static rulesets. Switching either off disables only that ruleset. Allowlist domains receive higher-priority DNR allow rules; custom and URLhaus domains receive dynamic DNR rules that block subresource requests. The allowlist also bypasses URL analysis. DNR does not inspect page content or downloaded files.

## Threat intelligence and privacy

The extension fetches **the feed file**, not the current browsing URL. The bundled snapshot was taken from the URLhaus hosts file dated 2026-10-02 05:17:27 UTC. The only outbound request initiated by BrowserGuard is to `https://urlhaus.abuse.ch/downloads/hostfile/` for enabled automatic updates or a manual refresh. No API key is needed. If a future reputation API requires a key, use a server-side proxy that stores the key and disclose the URL data sent to it; never place that key in extension code. Such an API is **not** part of this version.

History records only warning events: timestamp, domain, origin (scheme and host, without path or query), threat type, risk, reasons, and action. It is capped at 200 entries. Blocked ad/tracker URLs are not stored. All settings, counters, feed domains, and history use `chrome.storage.local`; nothing is synced to an account. Users can clear history and reset counters. Feed updates can be disabled.

## Permissions

| Permission | Why it is needed |
|---|---|
| `declarativeNetRequest` | Apply packaged and dynamic browser network rules. |
| `declarativeNetRequestFeedback` | Count actual ad/tracker rule matches in the unpacked academic demo. |
| `webNavigation` | Analyze top-level navigation before commitment. |
| `tabs` | Read the active tab URL and open the warning page. |
| `storage` | Save settings, counters, lists, feed, and threat events locally. |
| `alarms` | Schedule daily feed updates. |
| `https://urlhaus.abuse.ch/*` host access | Download the public URLhaus host file. |

There is no `<all_urls>` host permission, `webRequest`, cookies permission, content script, or remote executable code. The extension-page CSP allows scripts from the extension itself only. User-controlled text is displayed with `textContent`.

## Install in Chrome

Download the extension ZIP from the [latest GitHub release](https://github.com/Jessedrt/BrowserGuard/releases/latest), then extract it. The extracted folder must contain `manifest.json` at its top level. GitHub Packages is not used because BrowserGuard is an unpacked Chrome extension, not an npm package.

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository's root folder, the one containing `manifest.json`.
5. Pin BrowserGuard using Chrome's Extensions menu. Open its popup and dashboard.
6. Wait for the first URLhaus update or click **Update now** in Dashboard → Settings. If the network is unavailable, the dashboard continues to use the bundled snapshot and labels it as such.

Chrome 120 or newer is required. The project has no package dependencies or build step.

## Testing and live demonstration

Run `npm test` for URL parsing, domain normalization, IP/punycode, subdomain and lookalike scoring, allowlist/blocklist precedence, and feed parsing. Run `npm run check` for the MV3 manifest, rule IDs, and unsafe-code patterns.

For a safe live demonstration:

1. Open the popup on a normal HTTPS site and use **Scan current site**. A `SAFE` result means no configured signal was found, not that the site is guaranteed safe.
2. Add `test-blocked.example` to the custom blocklist. Navigate to `https://test-blocked.example/`. The reserved `.example` domain is a safe test fixture; the interstitial should show a **custom blocklist** match. Use **Go back to safety**.
3. Open `http://paypa1.example/verify` to demonstrate a heuristic **HIGH RISK** warning without contacting a live phishing site. The domain is a reserved test fixture; the warning says **Suspected phishing**.
4. Add `test-blocked.example` to the allowlist, then repeat the visit. It should bypass BrowserGuard's warning. Remove it afterward.
5. To test DNR blocking, start a local server in the repository root, for example `python -m http.server 8000`, and visit `http://localhost:8000/tests/demo.html`. Its ad and tracker image requests should show as blocked by the extension in DevTools Network. Popup counters should increment in an unpacked install. Turn each protection off and reload to compare.
6. Toggle protection, close and reopen the popup, and confirm the settings persist. Inspect the dashboard's real history, then clear it.

The demo file issues requests to ordinary ad/tracker endpoints. It contains no malware and does not need those requests to succeed.

## How counts are obtained

Ad and tracker counters increase only from Chrome's `onRuleMatchedDebug` event for the corresponding blocking rulesets. This [feedback event is only available to unpacked extensions](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest). **Packed/Store installs still block requests, but cannot provide these lifetime counters through this API.** This version is intended for an unpacked academic demonstration. Suspected-phishing and known-malicious counts increase after BrowserGuard opens a warning page and decrease if the user continues. User-added blocklist domains have their own category because they are not independently verified threats. History records whether the user continued.

## Limitations

- URL heuristics can miss phishing and can flag innocent sites. BrowserGuard does not claim to prove phishing or certify a site as safe.
- Chrome's `webNavigation` event is a notification, not a synchronous cancellation API. The interstitial is shown promptly, but a network connection may start before the worker switches tabs. DNR blocks known malicious subresources, while top-level warning navigation has this timing limit.
- The URLhaus hosts file covers malware distribution domains, not every malicious or phishing site. Feed entries may change or include compromised legitimate hosts. The dashboard shows the last update and count.
- URLhaus and custom DNR rules block matching subresources. The top-level interstitial is driven by navigation analysis; download contents are not scanned.
- The bundled ad/tracker rules intentionally cover a maintainable set of common services rather than a complete commercial filter list. First-party trackers and script-created popups may escape them.
- Chrome feedback counters are unavailable for packed installs. This is a platform restriction, not an estimated statistic.

## Future improvements

Import a regularly maintained filter list after evaluating its license and false-positive rate; add optional user-approved server-side reputation checks; authenticate future bundled feed snapshots; and migrate to a Chrome-supported pre-navigation blocking design if the platform offers one without excessive permissions.

## Sources

- [Chrome declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [Chrome webNavigation API](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)
- [URLhaus public downloads](https://urlhaus.abuse.ch/downloads/hostfile/)
