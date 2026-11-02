import test from 'node:test';
import assert from 'node:assert/strict';

const events = {};
const data = {};
const session = {};
const rules = new Map();
const writes = [];
const event = key => ({addListener: listener => { events[key] = listener; }});
const dynamicLimit = {value: 5000};
const rejectAbove = {value: Infinity};
const FEED_SIZE = 8000;

globalThis.chrome = {
  storage: {
    local: {
      get: async defaults => structuredClone({...defaults, ...data}),
      set: async patch => { writes.push(structuredClone(patch)); Object.assign(data, structuredClone(patch)); }
    },
    session: {
      get: async key => ({[key]: structuredClone(session[key])}),
      set: async patch => Object.assign(session, structuredClone(patch)),
      remove: async key => { delete session[key]; }
    }
  },
  declarativeNetRequest: {
    get MAX_NUMBER_OF_DYNAMIC_RULES() { return dynamicLimit.value; },
    updateEnabledRulesets: async () => {},
    getDynamicRules: async () => [...rules.values()],
    updateDynamicRules: async ({removeRuleIds, addRules}) => {
      if (addRules.length > rejectAbove.value) throw new Error('The number of dynamic rules exceeds the maximum');
      removeRuleIds.forEach(id => rules.delete(id));
      addRules.forEach(rule => rules.set(rule.id, rule));
    },
    onRuleMatchedDebug: event('ruleMatch')
  },
  scripting: {
    getRegisteredContentScripts: async () => [],
    registerContentScripts: async () => {},
    unregisterContentScripts: async () => {}
  },
  webNavigation: {onBeforeNavigate: event('navigate'), onCommitted: event('committed')},
  action: {setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {}},
  runtime: {onInstalled: event('installed'), onStartup: event('startup'), onMessage: event('message'), getURL: path => `chrome-extension://test/${path}`},
  alarms: {onAlarm: event('alarm'), create: () => {}},
  tabs: {onRemoved: event('removed'), update: async (id, options) => ({id, ...options}), get: async id => ({id}), goBack: async () => {}}
};

await import('../src/background/service-worker.js');
const message = input => new Promise(resolve => events.message(input, {}, resolve));
const tick = () => new Promise(resolve => setTimeout(resolve, 30));

data.feed = Array.from({length: FEED_SIZE}, (_, index) => `feed-${index}.example`);
data.settings = {ads: true, trackers: true, phishing: true, malicious: true, feedUpdates: false, youtubeAdvance: true};
data.allowlist = ['trusted.example'];
data.blocklist = ['blocked.example'];

test('feed rules are trimmed to the browser dynamic-rule quota', async () => {
  rejectAbove.value = Infinity;
  const state = await message({type: 'SET_SETTING', key: 'ads', value: true});
  assert.equal(state.ruleError, null);
  const ids = [...rules.keys()];
  assert.ok(ids.length <= dynamicLimit.value, `expected at most ${dynamicLimit.value} rules, saw ${ids.length}`);
  assert.equal(state.dynamicRuleCount, ids.length);
  // 5000 quota minus 500 headroom, minus the two allowlist rules and one blocklist rule.
  assert.equal(state.feedRulesApplied, 4500 - 2 - 1);
  assert.ok(state.feedRulesApplied < state.feed.length, 'state must not claim the whole feed is enforced');
});

test('a rejected rule set falls back to lists only and reports the problem', async () => {
  rejectAbove.value = 50;
  const state = await message({type: 'SET_SETTING', key: 'trackers', value: true});
  assert.match(state.ruleError, /rejected the full rule set/i);
  assert.equal(state.feedRulesApplied, 0);
  const kinds = [...rules.values()].map(rule => rule.action.type);
  assert.ok(kinds.includes('allow'), 'allowlist rules must survive a reduced rule set');
  assert.ok(kinds.includes('block'), 'blocklist rules must survive a reduced rule set');
});

test('ad and tracker match bursts are batched into one storage write', async () => {
  rejectAbove.value = Infinity;
  writes.length = 0;
  for (let index = 0; index < 6; index++) events.ruleMatch({rule: {rulesetId: 'ads'}});
  for (let index = 0; index < 4; index++) events.ruleMatch({rule: {rulesetId: 'trackers'}});
  await tick();
  const state = await message({type: 'STATE'});
  assert.equal(state.stats.ads, 6);
  assert.equal(state.stats.trackers, 4);
  const statWrites = writes.filter(patch => 'stats' in patch);
  assert.equal(statWrites.length, 1, `expected a single stats write, saw ${statWrites.length}`);
  assert.equal((await message({type: 'STATE'})).stats.ads, 6);
});
