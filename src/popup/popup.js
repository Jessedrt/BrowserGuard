const $ = id => document.getElementById(id);
const request = async message => {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
  return response;
};
let currentUrl = null;

function render(state) {
  $('ads-count').textContent = state.stats.ads;
  $('trackers-count').textContent = state.stats.trackers;
  $('threats-count').textContent = state.stats.phishing + state.stats.malicious;
  for (const input of document.querySelectorAll('[data-setting]')) input.checked = state.settings[input.dataset.setting];
  const on = Object.values(state.settings).slice(0,4).filter(Boolean).length;
  $('status').textContent = state.ruleError ? 'Rules need attention' : on === 4 ? 'Protection active' : on ? 'Partial protection' : 'Protection off';
  $('status').className = `pill ${state.ruleError ? 'danger' : on === 4 ? 'good' : on ? 'warn' : 'danger'}`;
  if (state.ruleError) $('message').textContent = state.ruleError;
}

async function scan() {
  if (!currentUrl) { $('message').textContent = 'Open a website to scan its URL.'; return; }
  const result = await request({type: 'ANALYZE', url: currentUrl});
  $('risk').textContent = `${result.risk}${result.reasons.length ? ' · ' + result.reasons.join('; ') : ' · No suspicious URL signals found'}`;
  $('risk').className = result.risk === 'SAFE' ? 'good-text' : result.risk === 'LOW RISK' ? 'muted' : 'error';
}

try {
  render(await request({type: 'STATE'}));
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  currentUrl = tab?.url && /^https?:/i.test(tab.url) ? tab.url : null;
  const host = currentUrl ? new URL(currentUrl).hostname : null;
  $('domain').textContent = host || 'No web page selected';
  if (host === 'www.youtube.com' || host === 'm.youtube.com') {
    $('counter-note').textContent = 'YouTube assist skips ads only when a Skip button is available. Skips are not counted as blocked requests.';
  }
  if (currentUrl) await scan();
} catch (error) { $('message').textContent = error.message; }

for (const input of document.querySelectorAll('[data-setting]')) input.addEventListener('change', async () => {
  input.disabled = true;
  try { render(await request({type: 'SET_SETTING', key: input.dataset.setting, value: input.checked})); $('message').textContent = 'Setting saved.'; }
  catch (error) { render(await request({type: 'STATE'})); $('message').textContent = error.message; }
  finally { input.disabled = false; }
});
$('scan').addEventListener('click', () => scan().catch(error => $('message').textContent = error.message));
$('details').addEventListener('click', () => chrome.tabs.create({url: chrome.runtime.getURL('src/dashboard/dashboard.html#history')}));
$('dashboard').addEventListener('click', () => chrome.runtime.openOptionsPage());
