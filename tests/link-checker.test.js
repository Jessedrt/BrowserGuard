import test from 'node:test';
import assert from 'node:assert/strict';
import {extractWebLinks} from '../src/security/link-extractor.js';
import {analyzeUrl} from '../src/security/analyzer.js';

test('pasted email text extracts distinct web links without opening them', () => {
  const text = 'Open https://example.com/start, then visit http://paypa1.example/verify. Ignore javascript:alert(1) and duplicate https://example.com/start.';
  assert.deepEqual(extractWebLinks(text), ['https://example.com/start', 'http://paypa1.example/verify']);
  assert.equal(analyzeUrl(extractWebLinks(text)[1]).risk, 'HIGH RISK');
});

test('link extraction is bounded and rejects unsupported or oversized text', () => {
  assert.deepEqual(extractWebLinks('ftp://example.com and example.com'), []);
  assert.deepEqual(extractWebLinks('x'.repeat(20001)), []);
  assert.equal(extractWebLinks('https://one.example https://two.example', 1).length, 1);
});
