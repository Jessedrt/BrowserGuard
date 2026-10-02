import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDomain, parseWebUrl, hostMatches, isIpHost} from '../src/security/domains.js';
import {analyzeUrl} from '../src/security/analyzer.js';
import {parseUrlhausHostfile} from '../src/security/reputation.js';
import {SEED_DOMAINS} from '../src/security/seed.js';

test('normal URL parsing and scheme restriction', () => {
  assert.equal(parseWebUrl('https://example.com/path').hostname, 'example.com');
  assert.equal(parseWebUrl('javascript:alert(1)'), null);
  assert.equal(parseWebUrl('not a url'), null);
});
test('domain normalization rejects URL input and invalid domains', () => {
  assert.equal(normalizeDomain(' Example.COM. '), 'example.com');
  assert.equal(normalizeDomain('bücher.example'), 'xn--bcher-kva.example');
  for (const input of ['https://example.com', 'example.com/path', '-bad.com', 'a..com', '127.0.0.1', 'localhost']) assert.equal(normalizeDomain(input), null);
});
test('domain matching respects label boundaries', () => {
  assert.equal(hostMatches('sub.example.com', 'example.com'), true);
  assert.equal(hostMatches('notexample.com', 'example.com'), false);
});
test('IP and punycode URL signals', () => {
  assert.equal(isIpHost('192.0.2.4'), true);
  assert.equal(analyzeUrl('http://192.0.2.4/login').risk, 'SUSPICIOUS');
  assert.ok(analyzeUrl('https://xn--bcher-kva.example/').reasons.some(x => x.includes('Punycode')));
});
test('excessive subdomains and spoofed brand increase risk', () => {
  assert.equal(analyzeUrl('https://a.b.c.d.example.com/').risk, 'SUSPICIOUS');
  const spoof = analyzeUrl('http://paypa1.example/verify');
  assert.equal(spoof.risk, 'HIGH RISK');
  assert.equal(spoof.knownMatch, false);
});
test('allowlist overrides heuristic and blocklist, but not a sibling domain', () => {
  const options = {allowlist:['example.com'], blocklist:['example.com']};
  assert.equal(analyzeUrl('https://sub.example.com/', options).risk, 'SAFE');
  assert.equal(analyzeUrl('https://notexample.com/', options).risk, 'SAFE');
});
test('custom blocklist and feed produce known-match status', () => {
  assert.equal(analyzeUrl('https://test-blocked.example/', {blocklist:['test-blocked.example']}).risk, 'USER BLOCKED');
  const feed = analyzeUrl('https://feed-test.example/', {intelligence:['feed-test.example']});
  assert.equal(feed.risk, 'KNOWN MALICIOUS');
  assert.equal(feed.threatType, 'Malicious site');
  assert.ok(SEED_DOMAINS.length > 300);
  assert.equal(analyzeUrl(`https://${SEED_DOMAINS[0]}/`, {intelligence:SEED_DOMAINS}).risk, 'KNOWN MALICIOUS');
});
test('URLhaus hostfile parser accepts real format and rejects comments/invalid rows', () => {
  const domains = parseUrlhausHostfile('# comment\n127.0.0.1\tbad-test.example\n0.0.0.0 another.example\n127.0.0.1 localhost\n127.0.0.1 bad-test.example');
  assert.deepEqual(domains, ['bad-test.example', 'another.example']);
});
