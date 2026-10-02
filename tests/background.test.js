import test from 'node:test';
import assert from 'node:assert/strict';

const events = {};
const data = {};
const session = {};
const rules = new Map();
const enabled = new Set(['ads','trackers']);
const tabUpdates = [];
const event = key => ({addListener: listener => { events[key] = listener; }});
globalThis.chrome = {
  storage: {local: {
    get: async defaults => structuredClone({...defaults, ...data}),
    set: async patch => Object.assign(data, structuredClone(patch))
  }, session: {
    get: async key => ({[key]: structuredClone(session[key])}),
    set: async patch => Object.assign(session, structuredClone(patch)),
    remove: async key => { delete session[key]; }
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
test('warning and one-time bypass survive a service-worker restart', async () => {
  events.navigate({frameId:0,tabId:8,url:'https://test-blocked.example/'});
  await tick();
  assert.equal((await message({type:'WARNING',tabId:8})).analysis.risk, 'USER BLOCKED');
  await import('../src/background/service-worker.js?restart=1');
  assert.equal((await message({type:'WARNING',tabId:8})).url, 'https://test-blocked.example/');
  await message({type:'CONTINUE',tabId:8});
  await import('../src/background/service-worker.js?restart=2');
  const before = (await message({type:'STATE'})).stats.custom;
  events.navigate({frameId:0,tabId:8,url:'https://test-blocked.example/'});
  await tick();
  assert.equal((await message({type:'STATE'})).stats.custom, before);
  assert.equal(await message({type:'WARNING',tabId:8}), null);
});
test('continuing one warning updates only its matching history event', async () => {
  events.navigate({frameId:0,tabId:9,url:'https://test-blocked.example/'});
  events.navigate({frameId:0,tabId:10,url:'https://test-blocked.example/'});
  await tick();
  const older = await message({type:'WARNING',tabId:9});
  const newer = await message({type:'WARNING',tabId:10});
  assert.notEqual(older.id, newer.id);
  await message({type:'CONTINUE',tabId:9});
  const history = (await message({type:'STATE'})).history;
  assert.equal(history.find(item => item.id === older.id).action, 'User continued after warning');
  assert.equal(history.find(item => item.id === newer.id).action, 'Blocked with warning');
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
