import {analyzeUrl} from '../security/analyzer.js';
import {normalizeDomain, parseWebUrl} from '../security/domains.js';
import {parseUrlhausHostfile, URLHAUS_FEED} from '../security/reputation.js';
import {getState, updateState} from '../storage/state.js';

const RULE_ALLOW_START = 100000;
const RULE_CUSTOM_START = 200000;
const RULE_FEED_START = 300000;
const MAX_FEED = 15000;
let mutation = Promise.resolve();
let rulesSync = Promise.resolve();

async function showSiteBadge(tabId, analysis, settings) {
  if (!chrome.action?.setBadgeText) return;
  let text = '', color = '#6b7b90', title = 'BrowserGuard';
  if (analysis.allowlisted) {
    text = 'AL'; title = 'BrowserGuard: site is allowlisted; URL checks were skipped';
  } else if (!settings.phishing && !settings.malicious) {
    text = 'OFF'; title = 'BrowserGuard: phishing and malicious-site protection are off';
  } else if (analysis.knownMatch || analysis.customMatch) {
    text = '!'; color = '#bd2d40'; title = `BrowserGuard: ${analysis.risk.toLowerCase()} — review the warning`;
  } else if (['HIGH RISK', 'SUSPICIOUS'].includes(analysis.risk) && !settings.phishing) {
    text = 'OFF'; title = 'BrowserGuard: phishing protection is off';
  } else if (analysis.risk === 'HIGH RISK') {
    text = '!'; color = '#bd2d40'; title = 'BrowserGuard: high-risk URL — review the warning';
  } else if (analysis.risk === 'SUSPICIOUS' || analysis.risk === 'LOW RISK') {
    text = '?'; color = '#a86b00'; title = 'BrowserGuard: URL warning signs found — open the popup for details';
  } else if (analysis.risk === 'SAFE') {
    text = '✓'; color = '#087b59'; title = 'BrowserGuard: no known URL risk indicators; this is not a safety guarantee';
  }
  try {
    await chrome.action.setBadgeText({tabId, text});
    if (text) await chrome.action.setBadgeBackgroundColor({tabId, color});
    await chrome.action.setTitle({tabId, title});
  } catch (error) { console.warn('BrowserGuard badge could not be updated:', error); }
}

async function clearSiteBadge(tabId) {
  if (!chrome.action?.setBadgeText) return;
  try {
    await chrome.action.setBadgeText({tabId, text: ''});
    await chrome.action.setTitle({tabId, title: 'BrowserGuard'});
  } catch (error) { console.warn('BrowserGuard badge could not be cleared:', error); }
}

const sessionKey = (kind, tabId) => `${kind}:${tabId}`;
async function getSession(kind, tabId) {
  const key = sessionKey(kind, tabId);
  return (await chrome.storage.session.get(key))[key] || null;
}
async function setSession(kind, tabId, value) {
  await chrome.storage.session.set({[sessionKey(kind, tabId)]: value});
}
async function clearSession(kind, tabId) {
  await chrome.storage.session.remove(sessionKey(kind, tabId));
}

function locked(work) {
  const next = mutation.then(work, work);
  mutation = next.catch(() => {});
  return next;
}

function eventFor(id, analysis, action, originalUrl) {
  return {
    id, timestamp: new Date().toISOString(), domain: analysis.domain,
    url: new URL(originalUrl).origin,
    threatType: analysis.threatType || 'Suspicious website', risk: analysis.risk,
    reasons: analysis.reasons, action
  };
}

async function recordThreat(id, analysis, originalUrl, action = 'Blocked with warning') {
  await locked(async () => {
    const state = await getState();
    const key = analysis.customMatch ? 'custom' : analysis.knownMatch ? 'malicious' : 'phishing';
    state.stats[key]++;
    state.history.unshift(eventFor(id, analysis, action, originalUrl));
    await updateState({stats: state.stats, history: state.history.slice(0, 200)});
  });
}

function domainRule(id, domain, type) {
  return {
    id, priority: type === 'allow' ? 100 : 10,
    action: {type: type === 'allow' ? 'allowAllRequests' : 'block'},
    condition: type === 'allow'
      ? {requestDomains: [domain], resourceTypes: ['main_frame', 'sub_frame']}
      : {requestDomains: [domain], resourceTypes: ['sub_frame', 'script', 'image', 'xmlhttprequest', 'media', 'object', 'other']}
  };
}

async function syncRules() {
  const state = await getState();
  const enabled = [];
  if (state.settings.ads) enabled.push('ads');
  if (state.settings.trackers) enabled.push('trackers');
  await chrome.declarativeNetRequest.updateEnabledRulesets({enableRulesetIds: enabled, disableRulesetIds: ['ads','trackers'].filter(x => !enabled.includes(x))});
  const current = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = [];
  state.allowlist.forEach((domain, index) => {
    addRules.push(domainRule(RULE_ALLOW_START + index, domain, 'allow'));
    addRules.push({id: RULE_ALLOW_START + 30000 + index, priority: 100, action: {type: 'allow'}, condition: {initiatorDomains: [domain], resourceTypes: ['script','image','xmlhttprequest','sub_frame','media','font','ping','other']}});
  });
  if (state.settings.malicious) {
    state.blocklist.forEach((domain, index) => addRules.push(domainRule(RULE_CUSTOM_START + index, domain, 'block')));
    state.feed.slice(0, MAX_FEED).forEach((domain, index) => addRules.push(domainRule(RULE_FEED_START + index, domain, 'block')));
  }
  await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds: current.map(x => x.id), addRules});
  await updateState({ruleError: null});
}

function scheduleSync() {
  const next = rulesSync.then(syncRules, syncRules);
  rulesSync = next.catch(async error => {
    await updateState({ruleError: `Network rules could not be applied: ${error.message}`});
    console.error('BrowserGuard rule sync failed:', error);
  });
  return next;
}

async function refreshFeed(force = false) {
  const state = await getState();
  if (!force && !state.settings.feedUpdates) return {updated: false, count: state.feed.length};
  const response = await fetch(URLHAUS_FEED, {cache: 'no-store', credentials: 'omit'});
  if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
  const text = await response.text();
  const feed = parseUrlhausHostfile(text, MAX_FEED);
  if (feed.length < 10) throw new Error('Feed was empty or invalid');
  await updateState({feed, feedUpdatedAt: new Date().toISOString(), feedSource: 'downloaded'});
  await scheduleSync();
  return {updated: true, count: feed.length};
}

async function navigate(details) {
  if (details.frameId !== 0 || details.tabId < 0) return;
  const url = parseWebUrl(details.url);
  if (!url) return;
  const state = await getState();
  const analysis = analyzeUrl(details.url, {
    allowlist: state.allowlist,
    blocklist: state.settings.malicious ? state.blocklist : [],
    intelligence: state.settings.malicious ? state.feed : []
  });
  const shouldWarn = (analysis.knownMatch || analysis.customMatch) && state.settings.malicious ||
    !analysis.knownMatch && !analysis.customMatch && state.settings.phishing && ['SUSPICIOUS','HIGH RISK'].includes(analysis.risk);
  await showSiteBadge(details.tabId, analysis, state.settings);
  if (!shouldWarn) { await clearSession('warning', details.tabId); return; }
  const permit = await getSession('bypass', details.tabId);
  if (permit && permit.url === details.url && permit.expires > Date.now()) {
    await clearSession('bypass', details.tabId);
    return;
  }
  const previous = await getSession('warning', details.tabId);
  if (previous?.url === details.url && Date.now() - previous.time < 3000) return;
  const id = crypto.randomUUID();
  await setSession('warning', details.tabId, {id, url: details.url, analysis, time: Date.now()});
  try {
    await chrome.tabs.update(details.tabId, {url: chrome.runtime.getURL('src/warning/warning.html')});
    await recordThreat(id, analysis, details.url);
  } catch (error) {
    await clearSession('warning', details.tabId);
    console.error('BrowserGuard warning navigation failed:', error);
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(details => { navigate(details).catch(console.error); }, {url: [{schemes: ['http','https']}]});
chrome.webNavigation.onCommitted.addListener(details => {
  if (details.frameId !== 0 || details.tabId < 0) return;
  if (!parseWebUrl(details.url) && details.url !== chrome.runtime.getURL('src/warning/warning.html')) clearSiteBadge(details.tabId);
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(info => {
    const key = info.rule.rulesetId === 'ads' ? 'ads' : info.rule.rulesetId === 'trackers' ? 'trackers' : null;
    if (!key) return;
    locked(async () => {
      const state = await getState();
      state.stats[key]++;
      await updateState({stats: state.stats});
    }).catch(console.error);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleSync().catch(console.error);
  chrome.alarms.create('feed', {periodInMinutes: 1440});
  refreshFeed().catch(error => console.warn('BrowserGuard feed unavailable; local protection remains active:', error));
});
chrome.runtime.onStartup.addListener(() => {
  scheduleSync().catch(console.error);
  chrome.alarms.create('feed', {periodInMinutes: 1440});
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'feed') refreshFeed().catch(console.warn); });
chrome.tabs.onRemoved.addListener(tabId => {
  Promise.all([clearSession('bypass', tabId), clearSession('warning', tabId)]).catch(console.error);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse, error => sendResponse({error: error.message}));
  return true;
});

async function handleMessage(message, sender) {
  if (!message || typeof message.type !== 'string') throw new Error('Invalid request');
  if (message.type === 'STATE') return getState();
  if (message.type === 'ANALYZE') {
    const state = await getState();
    return analyzeUrl(message.url, {allowlist: state.allowlist, blocklist: state.settings.malicious ? state.blocklist : [], intelligence: state.settings.malicious ? state.feed : []});
  }
  if (message.type === 'SET_SETTING') {
    if (!['ads','trackers','phishing','malicious','feedUpdates','youtubeAdvance'].includes(message.key) || typeof message.value !== 'boolean') throw new Error('Invalid setting');
    const state = await getState();
    state.settings[message.key] = message.value;
    await updateState({settings: state.settings});
    if (['ads','trackers','malicious'].includes(message.key)) await scheduleSync();
    if (message.key === 'feedUpdates' && message.value) refreshFeed().catch(console.warn);
    return getState();
  }
  if (message.type === 'ADD_DOMAIN' || message.type === 'REMOVE_DOMAIN') {
    if (!['allowlist','blocklist'].includes(message.list)) throw new Error('Invalid list');
    const domain = normalizeDomain(message.domain);
    if (!domain) throw new Error('Enter a valid domain, such as example.com');
    const state = await getState();
    if (message.type === 'ADD_DOMAIN') state[message.list] = [...new Set([...state[message.list], domain])].sort();
    else state[message.list] = state[message.list].filter(x => x !== domain);
    await updateState({[message.list]: state[message.list]});
    await scheduleSync();
    return getState();
  }
  if (message.type === 'CLEAR_HISTORY') { await updateState({history: []}); return getState(); }
  if (message.type === 'RESET_STATS') { await updateState({stats: {ads: 0, trackers: 0, phishing: 0, malicious: 0, custom: 0}}); return getState(); }
  if (message.type === 'REFRESH_FEED') return refreshFeed(true);
  if (message.type === 'WARNING') {
    const tab = sender.tab || await chrome.tabs.get(message.tabId);
    return getSession('warning', tab.id);
  }
  if (message.type === 'CONTINUE') {
    const tab = sender.tab || await chrome.tabs.get(message.tabId);
    const warning = await getSession('warning', tab.id);
    if (!warning) throw new Error('Warning expired');
    await setSession('bypass', tab.id, {url: warning.url, expires: Date.now() + 120000});
    await clearSession('warning', tab.id);
    await locked(async () => {
      const state = await getState();
      const key = warning.analysis.customMatch ? 'custom' : warning.analysis.knownMatch ? 'malicious' : 'phishing';
      state.stats[key] = Math.max(0, state.stats[key] - 1);
      const event = state.history.find(item => item.id === warning.id);
      if (event) event.action = 'User continued after warning';
      await updateState({stats: state.stats, history: state.history});
    });
    await chrome.tabs.update(tab.id, {url: warning.url});
    return {ok: true};
  }
  if (message.type === 'GO_BACK') {
    const tab = sender.tab || await chrome.tabs.get(message.tabId);
    await clearSession('warning', tab.id);
    try { await chrome.tabs.goBack(tab.id); }
    catch { await chrome.tabs.update(tab.id, {url: 'chrome://newtab/'}); }
    return {ok: true};
  }
  throw new Error('Unknown request');
}
