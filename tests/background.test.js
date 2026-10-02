import test from 'node:test';
import assert from 'node:assert/strict';

const events = {};
const data = {};
const rules = new Map();
const enabled = new Set(['ads','trackers']);
const tabUpdates = [];
const event = key => ({addListener: listener => { events[key] = listener; }});
globalThis.chrome = {
  storage: {local: {
    get: async defaults => structuredClone({...defaults, ...data}),
    set: async patch => Object.assign(data, structuredClone(patch))
  }},
  declarativeNetRequest: {
    updateEnabledRulesets: async ({enableRulesetIds,disableRulesetIds}) => { enableRulesetIds.forEach(x => enabled.add(x)); disableRulesetIds.forEach(x => enabled.delete(x)); },
    getDynamicRules: async () => [...rules.values()],
    updateDynamicRules: async ({removeRuleIds,addRules}) => { removeRuleIds.forEach(x => rules.delete(x)); addRules.forEach(x => rules.set(x.id,x)); },
    onRuleMatchedDebug: event('ruleMatch')
  },
  webNavigation: {onBeforeNavigate: event('navigate')},
  runtime: {onInstalled: event('installed'), onStartup: event('startup'), onMessage: event('message'), getURL: path => `chrome-extension://test/${path}`},
  alarms: {onAlarm: event('alarm'), create: () => {}},
  tabs: {onRemoved: event('removed'), update: async (id, options) => {tabUpdates.push({id,...options}); return {id};}, get: async id => ({id}), goBack: async () => {}}
};
await import('../src/background/service-worker.js');
function message(input, sender = {}) {
  return new Promise(resolve => events.message(input, sender, resolve));
}
const tick = () => new Promise(resolve => setTimeout(resolve, 25));

test('settings persist and turn off only the selected DNR ruleset', async () => {
  const state = await message({type:'SET_SETTING',key:'ads',value:false});
  assert.equal(state.settings.ads, false);
  assert.equal(enabled.has('ads'), false);
  assert.equal(enabled.has('trackers'), true);
  assert.equal((await message({type:'STATE'})).settings.ads, false);
});
test('allowlist and blocklist produce validated dynamic rules', async () => {
  assert.match((await message({type:'ADD_DOMAIN',list:'blocklist',domain:'bad/path'})).error, /valid domain/);
  await message({type:'ADD_DOMAIN',list:'blocklist',domain:'test-blocked.example'});
  assert.ok([...rules.values()].some(rule => rule.condition.requestDomains?.includes('test-blocked.example') && rule.action.type === 'block'));
  await message({type:'ADD_DOMAIN',list:'allowlist',domain:'test-blocked.example'});
  assert.ok([...rules.values()].some(rule => rule.condition.requestDomains?.includes('test-blocked.example') && rule.action.type === 'allowAllRequests'));
  assert.equal((await message({type:'ANALYZE',url:'https://test-blocked.example/'})).risk, 'SAFE');
  await message({type:'REMOVE_DOMAIN',list:'allowlist',domain:'test-blocked.example'});
});
test('warning navigation records a genuine event and one-time continue', async () => {
  events.navigate({frameId:0,tabId:7,url:'https://test-blocked.example/'});
  await tick();
  assert.ok(tabUpdates.some(x => x.id === 7 && x.url.endsWith('/warning.html')));
  const warning = await message({type:'WARNING',tabId:7});
  assert.equal(warning.analysis.risk, 'USER BLOCKED');
  assert.equal((await message({type:'STATE'})).stats.custom, 1);
  await message({type:'CONTINUE',tabId:7});
  assert.ok(tabUpdates.some(x => x.id === 7 && x.url === 'https://test-blocked.example/'));
  assert.equal((await message({type:'STATE'})).stats.custom, 0);
  assert.equal((await message({type:'STATE'})).history[0].action, 'User continued after warning');
  events.navigate({frameId:0,tabId:7,url:'https://test-blocked.example/'});
  await tick();
  assert.equal((await message({type:'STATE'})).stats.custom, 0);
});
test('ad/tracker statistics count actual rule-match callbacks only', async () => {
  events.ruleMatch({rule:{rulesetId:'ads'}});
  events.ruleMatch({rule:{rulesetId:'trackers'}});
  events.ruleMatch({rule:{rulesetId:'_dynamic'}});
  await tick();
  const state = await message({type:'STATE'});
  assert.equal(state.stats.ads, 1);
  assert.equal(state.stats.trackers, 1);
});
