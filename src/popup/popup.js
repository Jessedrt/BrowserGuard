import {riskTone} from '../ui/risk-tone.js';
import {hostMatches} from '../security/domains.js';

const $ = id => document.getElementById(id);
const request = async message => {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
  return response;
};
let currentUrl = null;
let currentHost = null;
let lastState = null;

function trustedEntry(state) {
  if (!currentHost) return null;
  return state.allowlist.find(domain => hostMatches(currentHost, domain)) || null;
}

function renderTrust(state) {
  const entry = trustedEntry(state);
  const button = $('trust');
  button.hidden = !currentHost;
  button.setAttribute('aria-pressed', String(Boolean(entry)));
  button.textContent = entry
    ? `Trusted${entry === currentHost ? '' : ` via ${entry}`} — stop trusting`
    : 'Trust this site';
}

function render(state) {
  lastState = state;
  $('ads-count').textContent = state.stats.ads.toLocaleString();
  $('trackers-count').textContent = state.stats.trackers.toLocaleString();
  $('threats-count').textContent = (state.stats.phishing + state.stats.malicious).toLocaleString();
  for (const input of document.querySelectorAll('[data-setting]')) input.checked = state.settings[input.dataset.setting];
  const on = ['ads','trackers','phishing','malicious'].filter(key => state.settings[key]).length;
  $('status').textContent = state.ruleError ? 'Rules need attention' : on === 4 ? 'Protection active' : on ? 'Partial protection' : 'Protection off';
  $('status').className = `pill ${state.ruleError ? 'danger' : on === 4 ? 'good' : on ? 'warn' : 'danger'}`;
  if (state.ruleError) $('message').textContent = state.ruleError;
  renderTrust(state);
}

async function scan() {
  if (!currentUrl) { $('message').textContent = 'Open a website to scan its URL.'; return; }
  const result = await request({type: 'ANALYZE', url: currentUrl});
  const tone = result.allowlisted ? 'neutral' : riskTone(result.risk);
  $('risk').textContent = result.allowlisted ? 'ALLOWLISTED' : result.risk === 'SAFE' ? 'NO KNOWN URL INDICATORS' : result.risk;
  $('risk').className = tone === 'neutral' ? 'muted' : `${tone}-text`;
  $('risk-basis').textContent = result.allowlisted ? 'URL checks skipped for this site'
    : result.customMatch ? 'Matched your custom blocklist'
    : result.knownMatch ? 'Matched the local URLhaus malware-domain feed'
    : `Local URL heuristic · signal score ${result.score}/99${result.risk === 'SAFE' ? ' · not a safety guarantee' : ''}`;
  $('risk-basis').hidden = false;
  const list = $('risk-reasons');
  list.replaceChildren();
  for (const reason of result.allowlisted ? [] : result.reasons) {
    const item = document.createElement('li');
    item.textContent = reason;
    list.append(item);
  }
  list.hidden = !list.childElementCount;
  document.querySelector('.site').dataset.tone = tone;
}

try {
  render(await request({type: 'STATE'}));
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  currentUrl = tab?.url && /^https?:/i.test(tab.url) ? tab.url : null;
  currentHost = currentUrl ? new URL(currentUrl).hostname : null;
  $('domain').textContent = currentHost || 'No web page selected';
  if (currentHost === 'www.youtube.com' || currentHost === 'm.youtube.com') {
    $('youtube-note').hidden = false;
  }
  if (lastState) renderTrust(lastState);
  if (currentUrl) await scan();
} catch (error) { $('message').textContent = error.message; }

for (const input of document.querySelectorAll('[data-setting]')) input.addEventListener('change', async () => {
  input.disabled = true;
  try { render(await request({type: 'SET_SETTING', key: input.dataset.setting, value: input.checked})); $('message').textContent = 'Setting saved.'; }
  catch (error) { render(await request({type: 'STATE'})); $('message').textContent = error.message; }
  finally { input.disabled = false; }
});

$('trust').addEventListener('click', async () => {
  if (!currentHost || !lastState) return;
  const button = $('trust');
  button.disabled = true;
  try {
    const entry = trustedEntry(lastState);
    render(await request({type: entry ? 'REMOVE_DOMAIN' : 'ADD_DOMAIN', list: 'allowlist', domain: entry || currentHost}));
    $('message').textContent = entry ? `${entry} is no longer trusted.` : `${currentHost} is now trusted; URL checks and blocking are skipped for it.`;
    if (currentUrl) await scan();
  } catch (error) {
    $('message').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('scan').addEventListener('click', () => scan().catch(error => $('message').textContent = error.message));
$('check-link').addEventListener('click', () => chrome.tabs.create({url: chrome.runtime.getURL('src/dashboard/dashboard.html#check')}));
$('details').addEventListener('click', () => chrome.tabs.create({url: chrome.runtime.getURL('src/dashboard/dashboard.html#history')}));
$('dashboard').addEventListener('click', () => chrome.runtime.openOptionsPage());
