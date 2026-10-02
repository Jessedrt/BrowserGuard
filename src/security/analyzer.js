import { isIpHost, parseWebUrl, hostMatches } from './domains.js';

const BRANDS = [
  {name: 'Google', domain: 'google.com'},
  {name: 'Microsoft', domain: 'microsoft.com'},
  {name: 'PayPal', domain: 'paypal.com'},
  {name: 'Amazon', domain: 'amazon.com'},
  {name: 'Apple', domain: 'apple.com'},
  {name: 'Facebook', domain: 'facebook.com'}
];
const SENSITIVE = /(?:login|signin|verify|secure|account|password|update|billing)/i;
const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly']);

function distanceAtMostOne(a, b) {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (a.length <= b.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function analyzeUrl(input, {allowlist = [], blocklist = [], intelligence = []} = {}) {
  const url = parseWebUrl(input);
  if (!url) return {risk: 'UNSUPPORTED', score: 0, reasons: [], threatType: null, domain: null};
  const domain = url.hostname.toLowerCase();
  if (allowlist.some(x => hostMatches(domain, x))) return {risk: 'SAFE', score: 0, reasons: ['User allowlist'], threatType: null, domain, allowlisted: true};
  const custom = blocklist.some(x => hostMatches(domain, x));
  const feed = intelligence.some(x => hostMatches(domain, x));
  if (custom) return {risk: 'USER BLOCKED', score: 100, domain, customMatch: true, knownMatch: false, threatType: 'User-blocked site', reasons: ['Domain is on your custom blocklist']};
  if (feed) return {risk: 'KNOWN MALICIOUS', score: 100, domain, customMatch: false, knownMatch: true, threatType: 'Malicious site', reasons: ['Domain matches the URLhaus malware distribution feed']};
  let score = 0;
  const reasons = [];
  const add = (points, reason) => { score += points; reasons.push(reason); };
  if (isIpHost(domain)) add(35, 'Website uses an IP address instead of a domain');
  if (domain.length > 45) add(20, 'Unusually long domain');
  if (domain.split('.').length > 4) add(30, 'Many subdomains');
  if (domain.includes('xn--')) add(30, 'Punycode domain: verify its spelling');
  if (url.username || url.password || /@/.test(input.split(/[?#]/)[0])) add(45, 'URL contains a misleading user-info section');
  if (/%(?:2f|5c|40|00|25)/i.test(input) || (input.match(/%[0-9a-f]{2}/gi) || []).length >= 5) add(20, 'Unusual URL encoding');
  if (url.pathname.length > 120 || url.pathname.split('/').length > 9) add(10, 'Unusually complex URL path');
  if (url.protocol === 'http:' && SENSITIVE.test(url.pathname + url.search)) add(20, 'Sensitive page uses unencrypted HTTP');
  if (SHORTENERS.has(domain)) add(15, 'Shortened link hides the destination');
  for (const brand of BRANDS) {
    if (hostMatches(domain, brand.domain)) continue;
    const labels = domain.split('.');
    const candidate = labels.length >= 2 ? labels.at(-2) : domain;
    const base = brand.domain.split('.')[0];
    if (distanceAtMostOne(candidate, base) || (domain.includes(base) && SENSITIVE.test(domain))) {
      add(45, `Domain may imitate ${brand.name}`);
      break;
    }
  }
  const capped = Math.min(score, 99);
  const risk = capped >= 60 ? 'HIGH RISK' : capped >= 30 ? 'SUSPICIOUS' : capped > 0 ? 'LOW RISK' : 'SAFE';
  return {risk, score: capped, reasons, threatType: capped >= 30 ? 'Suspected phishing' : null, domain, knownMatch: false};
}
