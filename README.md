# BrowserGuard

**Development of a Chromium Extension for Ad, Tracker, Phishing and Malicious Website Protection**

BrowserGuard is a working Manifest V3 cybersecurity training project. It blocks common ad and tracking network requests, analyzes website URLs for phishing indicators, checks domains against a locally stored malware-domain feed, and interrupts risky top-level navigation with a warning. It stores controls, statistics, and a short security-event history on the user's device.

The current package targets **compatible Chromium-based browsers**, rather than every browser that supports extensions. Chrome is the demonstrated environment. Microsoft Edge and Brave use Chromium extension technology and can load unpacked extensions, but this release has not been fully tested feature by feature in those browsers. Other Chromium browsers require API-specific testing. The current ZIP is not a supported Firefox or Safari build; Firefox does not support the `background.service_worker` entry used here. See the [Edge extension overview](https://learn.microsoft.com/en-us/microsoft-edge/extensions/), [Brave extension support](https://support.brave.com/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave), and [Mozilla background compatibility notes](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background).

**BrowserGuard is a browser-level security tool. It is not a replacement for antivirus or endpoint security software.** It does not scan the computer or claim to find Trojans installed on it. Its malware protection is limited to malicious websites and download sources visible to the browser.

## The problem

Advertising and tracking requests expose browsing activity and can lead to unwanted content. Phishing URLs may imitate trusted brands, while malware distribution sites can host dangerous downloads. BrowserGuard demonstrates several complementary browser defenses while keeping the distinction between *suspicious* URL patterns and *threat-intelligence* matches clear.

## Features

### v1.6.2 dashboard layout

- The dashboard uses the supplied larger typography, five-card overview, wider checker, and responsive navigation. Existing statistics, controls, history, and lists continue to use the same real data and actions.

### v1.6.1 compact popup

- The popup now uses the supplied compact blue header, status icon, combined counters, two-column protection controls, and grouped actions. Detection and blocking behavior are unchanged.

### v1.6 interface redesign

- The popup, dashboard, and security warning now share the supplied blue theme, rounded cards and controls, responsive layout, and light/dark color support.
- Safe, suspicious, and high-risk states retain distinct green, amber, and red treatments. The new presentation does not change threat detection or inflate protection counts.

### v1.5 early YouTube player filtering

- A small YouTube-only script now runs at document start in the page's JavaScript world. It removes recognized ad metadata from initial and later player responses before YouTube uses those responses, while preserving video details, streaming data, and playback state. The existing network rules, page ad-slot hiding, and Skip helper remain as fallbacks.
- BrowserGuard registers this script only when ad blocking is enabled for that YouTube host. Allowlisting `youtube.com` or the specific `www`/`m` host unregisters it. Changes also reach an already-open tab; reload open YouTube tabs after installing an update or enabling ad blocking so the document-start filter can run before playback.
- This is best effort. If YouTube changes its response format or serves an ad outside the recognized data paths, a video ad can still play. BrowserGuard does not count filtered player fields as blocked network requests or claim a verified zero-ad rate.

### v1.4 local link checker

- The dashboard can inspect a pasted HTTP(S) URL or extract up to ten explicit links from pasted email text. It shows the domain, risk label, detection basis, and individual reasons using BrowserGuard's existing local analysis and blocklists.
- Pasted email text is not uploaded, opened, or saved. The checker does not analyze sender headers, attachments, DNS, redirects, or email content for phishing language. A low-risk result is not a safety guarantee.
- The public project site offers a URL-structure-only version of the link checker. It does not access the extension's live feed or local lists.

### v1.3 aggressive filtering and clearer verdicts

- Expanded packaged DNR rules for known ad-serving domains. These are static, reviewable rules and require no new permissions.
- YouTube-only cosmetic filtering hides known page ad slots while ad blocking is on and YouTube is not allowlisted. The helper still presses visible Skip controls. An optional **Advance detected YouTube ads** switch makes a guarded seek attempt only when YouTube's ad state and visible countdown agree with the video timeline. It leaves ordinary video playback alone. You can turn off the seek attempt while keeping network rules and Skip assist.
- The popup distinguishes blocked **ad requests** from video ads and shows the actual basis and reasons for a URL verdict. The warning page likewise identifies a local heuristic, custom blocklist, or URLhaus feed match.
- These techniques are best effort. YouTube can change its player, reject seeks, or serve ads through the same path as normal video. BrowserGuard cannot promise an ad-free YouTube session.

### v1.2.1 YouTube improvement

- The YouTube assist starts at document start, looks for YouTube's visible Skip control without requiring an `ad-showing` CSS class, and rechecks when a countdown makes the control available. It still respects the ad toggle and allowlist.
- Popup ad and tracker counts are labeled as totals across all sites. A YouTube note explains that clicking Skip does not increment the blocked-request counter.
- YouTube can serve video ads through normal media delivery. BrowserGuard cannot reliably block every in-video ad without risking normal playback; unskippable ads can still play.

### v1.2 improvements

- Warning colors now follow risk severity: amber for suspicious URL signals and red for high-risk, known-malicious, or user-blocked sites. The popup and threat history use the same distinction.
- A per-tab badge on the extension icon shows green for no known URL risk indicators, amber for URL warning signs, red for dangerous results, and neutral for allowlisted or disabled URL protection. Green is not a guarantee that a site is safe.
- The badge uses the existing extension action and navigation access. BrowserGuard does not inject a status banner into every website or request broad host access for this feature.

### Earlier UI improvements

- Refined popup, dashboard, and warning page with responsive layouts, clearer status, keyboard focus, and dark-mode styling.
- Warning state and one-time continue choices survive a Manifest V3 service-worker restart within the same browser session.
- Threat history identifies each warning event separately, so continuing one warning updates its own event.

- Independent ad and tracker blocking through two packaged `declarativeNetRequest` rulesets. Domain and endpoint rules are maintained in `rules/`.
- YouTube ad assist blocks `/pagead/` network endpoints and presses an available Skip button or closes an ad overlay. It cannot guarantee removal of unskippable video ads. Assist actions are not added to network-block counters.
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
src/security/link-extractor.js    bounded link extraction from pasted text
src/security/reputation.js        URLhaus feed parser
src/security/seed.js              dated URLhaus offline snapshot
src/youtube/ad-assist.js           YouTube-only ad controls and guarded ad advance
src/youtube/early-filter.js        document-start player ad-metadata filter
src/youtube/ad-assist.css          YouTube-only page ad-slot hiding
src/background/service-worker.js  navigation monitoring, DNR state, statistics, messages
src/storage/state.js              local settings and data defaults
src/popup/                       compact current-site controls
src/dashboard/                   full dashboard and list management
src/warning/                     navigation interstitial
src/ui/common.css                shared visual design
tests/                           safe logic fixtures and local rule demo
scripts/check.mjs                manifest and rule audit
```

The worker observes top-level HTTP(S) navigation with `webNavigation.onBeforeNavigate`, analyzes the URL, and uses `tabs.update` to show the extension warning page. It stores the pending original URL in Chrome's temporary `storage.session` for that tab, so the warning and one-time bypass survive a service-worker restart. Clicking **Continue anyway** grants one navigation attempt for that exact URL, expiring after two minutes. No persistent exception is added; session data is discarded when the browser session ends.

Ads and trackers use separate static rulesets. Switching either off disables only that ruleset. Allowlist domains receive higher-priority DNR allow rules; custom and URLhaus domains receive dynamic DNR rules that block subresource requests. The allowlist also bypasses URL analysis. DNR does not inspect page content or downloaded files.

The YouTube helper runs only on `www.youtube.com` and `m.youtube.com`. The worker uses `chrome.scripting` to register a document-start script in the page's MAIN world only when ad blocking is enabled and the host is not allowlisted. This script strips three recognized ad fields from player response objects in the initial page data and JSON responses. It does not touch the video stream, playback clock, or other response fields. The separate content script observes player controls, presses an available Skip button, closes ad overlays, and forwards local setting changes to the early filter. CSS hides known page ad slots. The optional ad-advance control makes a guarded seek attempt only on a confirmed ad timeline. No browsing data is sent by these scripts. YouTube can change its responses or reject the fallback, so this remains best effort.

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
| `scripting` | Register or unregister the early YouTube filter at document start according to the ad setting and allowlist. |
| `https://urlhaus.abuse.ch/*` host access | Download the public URLhaus host file. |
| `www.youtube.com` and `m.youtube.com` host access | Run the early player filter and the existing YouTube ad helper on those two sites. |

There is no `<all_urls>` host permission, `webRequest`, cookies permission, or remote executable code. YouTube scripts are limited to the two listed hosts. The extension-page CSP allows scripts from the extension itself only. User-controlled text is displayed with `textContent`.

## Install in a compatible Chromium browser

The [latest GitHub release](https://github.com/Jessedrt/BrowserGuard/releases/latest) contains both a signed `.crx` Chrome extension package and a ZIP. On Windows and macOS, Chrome does not allow ordinary installation of a locally downloaded CRX outside the Chrome Web Store; use the ZIP for this academic demonstration. Extract it so that `manifest.json` is at the top level of the selected folder. GitHub Packages is not used because BrowserGuard is not an npm package.

1. Open the extension page for your browser: `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the extracted folder containing `manifest.json` (or the repository root when working from source).
5. Pin BrowserGuard using the browser's Extensions menu. Open its popup and dashboard.
6. Wait for the first URLhaus update or click **Update now** in Dashboard → Settings. If the network is unavailable, the dashboard continues to use the bundled snapshot and labels it as such.

Chrome 120 or newer is required for the demonstrated Chrome setup. Browser versions and API support vary elsewhere. The project has no package dependencies or build step.

## Testing and live demonstration

Run `npm test` for URL parsing, domain normalization, IP/punycode, subdomain and lookalike scoring, allowlist/blocklist precedence, and feed parsing. Run `npm run check` for the MV3 manifest, rule IDs, and unsafe-code patterns.

For a safe live demonstration:

1. Open `https://example.com/`, then look for the green extension-icon badge and use **Scan current site** in the popup. A `SAFE` result means no configured URL signal was found, not that the site is guaranteed safe.
2. Add `test-blocked.example` to the custom blocklist. Navigate to `https://test-blocked.example/`. The reserved `.example` domain is a safe test fixture; the interstitial should show a **custom blocklist** match. Use **Go back to safety**.
3. Open `http://192.0.2.4/login` to demonstrate an amber **SUSPICIOUS** warning. Then open `http://paypa1.example/verify` to demonstrate a red heuristic **HIGH RISK** warning without contacting a live phishing site. Both use reserved test addresses; the warning says **Suspected phishing**, not confirmed phishing.
4. Add `test-blocked.example` to the allowlist, then repeat the visit. It should bypass BrowserGuard's warning. Remove it afterward.
5. To test DNR blocking, start a local server in the repository root, for example `python -m http.server 8000`, and visit `http://localhost:8000/tests/demo.html`. Its ad and tracker image requests should show as blocked by the extension in DevTools Network. Popup counters should increment in an unpacked install. Turn each protection off and reload to compare.
6. Toggle protection, close and reopen the popup, and confirm the settings persist. Inspect the dashboard's real history, then clear it.

The demo file issues requests to ordinary ad/tracker endpoints. It contains no malware and does not need those requests to succeed.

## How counts are obtained

Ad and tracker counters increase only from Chrome's `onRuleMatchedDebug` event for the corresponding blocking rulesets. This [feedback event is only available to unpacked extensions](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest). **Packed/Store installs still block requests, but cannot provide these lifetime counters through this API.** This version is intended for an unpacked academic demonstration. Suspected-phishing and known-malicious counts increase after BrowserGuard opens a warning page and decrease if the user continues. User-added blocklist domains have their own category because they are not independently verified threats. History records whether the user continued.

## Limitations

- URL heuristics can miss phishing and can flag innocent sites. BrowserGuard does not claim to prove phishing or certify a site as safe.
- YouTube may change its player data, serve ads outside the fields filtered here, or deliver video ads through the same media endpoints as ordinary playback. Blocking those endpoints would risk breaking videos. YouTube may also reject the guarded ad-advance attempt, so ads can still play. Reload open YouTube tabs after an extension update.
- Chrome's `webNavigation` event is a notification, not a synchronous cancellation API. The interstitial is shown promptly, but a network connection may start before the worker switches tabs. DNR blocks known malicious subresources, while top-level warning navigation has this timing limit.
- The URLhaus hosts file covers malware distribution domains, not every malicious or phishing site. Feed entries may change or include compromised legitimate hosts. The dashboard shows the last update and count.
- URLhaus and custom DNR rules block matching subresources. The top-level interstitial is driven by navigation analysis; download contents are not scanned.
- The bundled ad/tracker rules intentionally cover a maintainable set of common services rather than a complete commercial filter list. First-party trackers and script-created popups may escape them.
- Chrome feedback counters are unavailable for packed installs. This is a platform restriction, not an estimated statistic.

## Future improvements

Import a regularly maintained filter list after evaluating its license and false-positive rate; add optional user-approved server-side reputation checks; authenticate future bundled feed snapshots; and migrate to a Chrome-supported pre-navigation blocking design if the platform offers one without excessive permissions.

## Sources

- [Chrome declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Chrome webNavigation API](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)
- [uBlock Origin's maintained YouTube filters](https://github.com/uBlockOrigin/uAssets/blob/master/filters/filters.txt) (design reference; BrowserGuard uses its own small implementation)
- [URLhaus public downloads](https://urlhaus.abuse.ch/downloads/hostfile/)
