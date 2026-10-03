import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/youtube/early-filter.js', import.meta.url), 'utf8');
function setup() {
  const listeners = new Map();
  const window = {addEventListener: (type, callback) => listeners.set(type, callback)};
  class Response {
    constructor(url, data) { this.url = url; this.data = data; }
    async json() { return this.data; }
  }
  const context = vm.createContext({window, JSON: {parse: JSON.parse}, Response, URL, Object, Reflect,
    location: {origin: 'https://www.youtube.com'}});
  vm.runInContext(source, context);
  return {context, window, Response, message: enabled => listeners.get('message')({
    source: window, origin: 'https://www.youtube.com',
    data: {source: 'BrowserGuard', type: 'YOUTUBE_AD_FILTER', enabled}
  })};
}
const player = () => ({videoDetails: {videoId: 'real-video'}, streamingData: {formats: [1]},
  playabilityStatus: {status: 'OK'}, adPlacements: [{id: 1}], adSlots: [1], playerAds: [1]});

test('initial player assignment strips ad metadata and preserves playable video data', () => {
  const {window} = setup();
  window.ytInitialPlayerResponse = player();
  assert.equal(window.ytInitialPlayerResponse.adPlacements, undefined);
  assert.equal(window.ytInitialPlayerResponse.adSlots, undefined);
  assert.equal(window.ytInitialPlayerResponse.playerAds, undefined);
  assert.equal(window.ytInitialPlayerResponse.videoDetails.videoId, 'real-video');
  assert.deepEqual(window.ytInitialPlayerResponse.streamingData.formats, [1]);
});

test('parsed player data on later navigation is filtered, unrelated JSON is untouched', () => {
  const {context} = setup();
  const result = context.JSON.parse(JSON.stringify({playerResponse: player()}));
  assert.equal(result.playerResponse.adPlacements, undefined);
  assert.equal(result.playerResponse.videoDetails.videoId, 'real-video');
  const unrelated = context.JSON.parse('{"adPlacements":[1],"videoDetails":{"videoId":7}}');
  assert.deepEqual(unrelated.adPlacements, [1]);
});

test('Response.json filters only YouTube player endpoints', async () => {
  const {Response} = setup();
  const filtered = await new Response('https://www.youtube.com/youtubei/v1/player', player()).json();
  assert.equal(filtered.adPlacements, undefined);
  const unrelated = await new Response('https://www.youtube.com/youtubei/v1/browse', player()).json();
  assert.deepEqual(unrelated.adPlacements, [{id: 1}]);
});

test('turning off ad blocking stops filtering on an existing tab', () => {
  const {window, message} = setup();
  message(false);
  window.ytInitialPlayerResponse = player();
  assert.deepEqual(window.ytInitialPlayerResponse.adPlacements, [{id: 1}]);
  message(true);
  window.ytInitialPlayerResponse = player();
  assert.equal(window.ytInitialPlayerResponse.adPlacements, undefined);
});
