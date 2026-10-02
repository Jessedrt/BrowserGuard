import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../src/youtube/ad-assist.js', import.meta.url), 'utf8');

function setup({ads = true, allowlist = [], adShowing = true, visible = true, overlay = false} = {}) {
  const frames = [];
  let onChanged;
  let onMutation;
  let clicks = 0;
  const skipButton = {
    disabled: false, isConnected: true,
    getClientRects: () => visible ? [1] : [],
    click: () => { clicks++; }
  };
  const player = {querySelector: () => skipButton};
  const overlayButton = {
    disabled: false, isConnected: true,
    getClientRects: () => [1],
    click: () => { clicks++; }
  };
  const document = {
    documentElement: {},
    querySelector: selector => selector === '.html5-video-player.ad-showing' && adShowing ? player
      : selector === 'button.ytp-ad-overlay-close-button' && overlay ? overlayButton : null
  };
  const chrome = {storage: {
    local: {get: async () => ({settings: {ads}, allowlist})},
    onChanged: {addListener: listener => { onChanged = listener; }}
  }};
  class MutationObserver { constructor(callback) { onMutation = callback; } observe() {} }
  runInNewContext(source, {
    chrome, document, location: {hostname: 'www.youtube.com'}, MutationObserver,
    requestAnimationFrame: callback => frames.push(callback),
    getComputedStyle: () => ({visibility: 'visible'}), Date
  });
  return {
    get clicks() { return clicks; },
    flush: () => { while (frames.length) frames.shift()(); },
    change: changes => onChanged(changes, 'local'),
    mutate: () => onMutation(),
    skipButton
  };
}

test('YouTube assist clicks only an available skip control during an ad', async () => {
  const assist = setup();
  await Promise.resolve();
  assist.flush();
  assert.equal(assist.clicks, 1);
  assist.mutate();
  assist.flush();
  assert.equal(assist.clicks, 1, 'rapid mutations do not spam clicks');
  const noAd = setup({adShowing: false});
  await Promise.resolve(); noAd.flush();
  assert.equal(noAd.clicks, 0);
  const hidden = setup({visible: false});
  await Promise.resolve(); hidden.flush();
  assert.equal(hidden.clicks, 0);
  const overlayOnly = setup({adShowing: false, overlay: true});
  await Promise.resolve(); overlayOnly.flush();
  assert.equal(overlayOnly.clicks, 1);
});

test('YouTube assist respects the ad toggle and allowlist immediately', async () => {
  const assist = setup({ads: false});
  await Promise.resolve(); assist.flush();
  assert.equal(assist.clicks, 0);
  assist.change({settings: {newValue: {ads: true}}}); assist.flush();
  assert.equal(assist.clicks, 1);
  const allowlisted = setup({allowlist: ['youtube.com']});
  await Promise.resolve(); allowlisted.flush();
  assert.equal(allowlisted.clicks, 0);
  allowlisted.change({allowlist: {newValue: []}}); allowlisted.flush();
  assert.equal(allowlisted.clicks, 1);
});

test('YouTube rule targets ad endpoints, not ordinary video playback', () => {
  const rules = JSON.parse(readFileSync(new URL('../rules/ads.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const youtube = rules.find(rule => rule.id === 5);
  assert.deepEqual(youtube.condition.requestDomains, ['youtube.com']);
  assert.equal(youtube.condition.urlFilter, '/pagead/');
  assert.ok(!youtube.condition.resourceTypes.includes('media'));
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.youtube.com/*', 'https://m.youtube.com/*']);
});
