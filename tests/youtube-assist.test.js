import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../src/youtube/ad-assist.js', import.meta.url), 'utf8');

function setup({ads = true, youtubeAdvance = true, allowlist = [], skipAvailable = true, visible = true, overlay = false, adShowing = false, adMarker = false} = {}) {
  const frames = [];
  let onChanged;
  let onMutation;
  let onInterval;
  let clicks = 0;
  let cosmeticEnabled = false;
  const video = {duration: 30, currentTime: 0};
  const skipButton = {
    disabled: false, isConnected: true,
    getClientRects: () => visible ? [1] : [],
    click: () => { clicks++; }
  };
  const overlayButton = {
    disabled: false, isConnected: true,
    getClientRects: () => [1],
    click: () => { clicks++; }
  };
  const player = {
    classList: {contains: name => name === 'ad-showing' && adShowing},
    querySelector: selector => selector === 'button.ytp-ad-overlay-close-button'
      ? overlay && overlayButton
      : selector === 'video.html5-main-video' ? video
      : selector === '.ytp-ad-duration-remaining' ? adMarker ? {getClientRects: () => [1], textContent: '0:30'} : null
      : skipAvailable && skipButton
  };
  const document = {
    documentElement: {classList: {toggle: (_name, value) => { cosmeticEnabled = value; }}},
    querySelector: selector => selector === '.html5-video-player' ? player : null
  };
  const chrome = {storage: {
    local: {get: async () => ({settings: {ads, youtubeAdvance}, allowlist})},
    onChanged: {addListener: listener => { onChanged = listener; }}
  }};
  const messages = [];
  const window = {postMessage: message => messages.push(message)};
  class MutationObserver { constructor(callback) { onMutation = callback; } observe() {} }
  runInNewContext(source, {
    chrome, document, window, location: {hostname: 'www.youtube.com', origin: 'https://www.youtube.com'}, MutationObserver,
    requestAnimationFrame: callback => frames.push(callback),
    getComputedStyle: () => ({visibility: 'visible'}),
    setInterval: callback => { onInterval = callback; }, Date
  });
  return {
    get clicks() { return clicks; },
    get cosmeticEnabled() { return cosmeticEnabled; },
    video,
    flush: () => { while (frames.length) frames.shift()(); },
    change: changes => onChanged(changes, 'local'),
    mutate: () => onMutation(),
    tick: () => onInterval(),
    skipButton, messages
  };
}

test('YouTube assist clicks only a visible YouTube Skip control', async () => {
  const assist = setup();
  await Promise.resolve();
  assist.flush();
  assert.equal(assist.clicks, 1);
  assist.mutate();
  assist.flush();
  assert.equal(assist.clicks, 1, 'rapid mutations do not spam clicks');
  const noSkip = setup({skipAvailable: false});
  await Promise.resolve(); noSkip.flush();
  assert.equal(noSkip.clicks, 0);
  const hidden = setup({visible: false});
  await Promise.resolve(); hidden.flush();
  assert.equal(hidden.clicks, 0);
  const overlayOnly = setup({skipAvailable: false, overlay: true});
  await Promise.resolve(); overlayOnly.flush();
  assert.equal(overlayOnly.clicks, 1);
});

test('YouTube assist rechecks when a Skip control appears without a mutation', async () => {
  const assist = setup({visible: false});
  await Promise.resolve(); assist.flush();
  assert.equal(assist.clicks, 0);
  assist.skipButton.getClientRects = () => [1];
  assist.tick(); assist.flush();
  assert.equal(assist.clicks, 1);
});

test('aggressive assist advances only a confirmed ad, never an ordinary video', async () => {
  const confirmed = setup({skipAvailable: false, adShowing: true, adMarker: true});
  await Promise.resolve(); confirmed.flush();
  assert.ok(confirmed.video.currentTime >= 29.7);
  const noMarker = setup({skipAvailable: false, adShowing: true});
  await Promise.resolve(); noMarker.flush();
  assert.equal(noMarker.video.currentTime, 0);
  const normal = setup({skipAvailable: false, adMarker: true});
  await Promise.resolve(); normal.flush();
  assert.equal(normal.video.currentTime, 0);
  const wrongTimeline = setup({skipAvailable: false, adShowing: true, adMarker: true});
  wrongTimeline.video.duration = 90;
  await Promise.resolve(); wrongTimeline.flush();
  assert.equal(wrongTimeline.video.currentTime, 0);
  const disabled = setup({skipAvailable: false, adShowing: true, adMarker: true, youtubeAdvance: false});
  await Promise.resolve(); disabled.flush();
  assert.equal(disabled.video.currentTime, 0);
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
  assert.equal(allowlisted.cosmeticEnabled, false);
  allowlisted.change({allowlist: {newValue: []}}); allowlisted.flush();
  assert.equal(allowlisted.clicks, 1);
  assert.equal(allowlisted.cosmeticEnabled, true);
});

test('YouTube rule targets ad endpoints, not ordinary video playback', () => {
  const rules = JSON.parse(readFileSync(new URL('../rules/ads.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const youtube = rules.find(rule => rule.id === 5);
  assert.deepEqual(youtube.condition.requestDomains, ['youtube.com']);
  assert.equal(youtube.condition.urlFilter, '/pagead/');
  assert.ok(!youtube.condition.resourceTypes.includes('media'));
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.youtube.com/*', 'https://m.youtube.com/*']);
  assert.equal(manifest.content_scripts[0].run_at, 'document_start');
  assert.deepEqual(manifest.content_scripts[0].css, ['src/youtube/ad-assist.css']);
  const css = readFileSync(new URL('../src/youtube/ad-assist.css', import.meta.url), 'utf8');
  assert.match(css, /browserguard-ads-on #player-ads/);
  assert.doesNotMatch(css, /html5-main-video/);
});
