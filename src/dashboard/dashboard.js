import {riskTone} from '../ui/risk-tone.js';
import {extractWebLinks} from '../security/link-extractor.js';

const $ = id => document.getElementById(id);
const request = async message => {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
  return response;
};
let state;
let checkMode = 'url';
function say(text) { $('message').textContent = text; $('message').classList.add('visible'); setTimeout(() => $('message').classList.remove('visible'), 5000); }
function checkResult(analysis) {
  const row = document.createElement('article'); row.className = 'check-result'; row.dataset.tone = analysis.allowlisted ? 'neutral' : riskTone(analysis.risk);
  const head = document.createElement('div'); head.className = 'check-result-head';
  const domain = document.createElement('strong'); domain.textContent = analysis.domain;
  const badge = document.createElement('span'); badge.className = `pill ${analysis.allowlisted ? '' : riskTone(analysis.risk)}`;
  badge.textContent = analysis.allowlisted ? 'ALLOWLISTED' : analysis.risk === 'SAFE' ? 'NO INDICATORS' : analysis.risk;
  head.append(domain, badge);
  const basis = document.createElement('p'); basis.className = 'check-basis';
  basis.textContent = analysis.allowlisted ? 'Checks skipped for your allowlisted domain.'
    : analysis.customMatch ? 'Matched your custom blocklist.'
    : analysis.knownMatch ? 'Matched the local URLhaus malware-domain feed.'
    : `Local URL patterns · signal score ${analysis.score}/99 (not a probability).`;
  row.append(head, basis);
  if (analysis.reasons.length && !analysis.allowlisted) {
    const list = document.createElement('ul');
    for (const reason of analysis.reasons) { const item = document.createElement('li'); item.textContent = reason; list.append(item); }
    row.append(list);
  }
  return row;
}
function setCheckMode(mode) {
  checkMode = mode;
  for (const button of document.querySelectorAll('[data-check-mode]')) {
    const selected = button.dataset.checkMode === mode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  $('check-input').hidden = mode !== 'url';
  $('check-input').required = mode === 'url';
  $('email-input').hidden = mode !== 'email';
  $('email-input').required = mode === 'email';
  $('check-label').textContent = mode === 'url' ? 'Website URL' : 'Email text with links';
  $('check-label').htmlFor = mode === 'url' ? 'check-input' : 'email-input';
  $('check-help').textContent = mode === 'url' ? 'The link is analyzed locally and never opened.' : 'Email text stays on your device and is not saved.';
  $('check-form').querySelector('button[type="submit"]').textContent = mode === 'url' ? 'Check link' : 'Check email links';
  $('check-error').hidden = true;
  $('check-results').replaceChildren();
}
function item(text, onRemove) {
  const row = document.createElement('div'); row.className = 'domain-item';
  const label = document.createElement('span'); label.textContent = text;
  const button = document.createElement('button'); button.textContent = 'Remove'; button.type = 'button'; button.addEventListener('click', onRemove);
  row.append(label, button); return row;
}
function render(data) {
  state = data;
  for (const key of ['ads','trackers','phishing','malicious','custom']) {
    $(`${key}-count`).textContent = data.stats[key];
    if ($(`${key}-label`)) $(`${key}-label`).textContent = data.stats[key];
  }
  const max = Math.max(1, ...Object.values(data.stats));
  for (const key of ['ads','trackers','phishing','malicious','custom']) $(`${key}-bar`).style.width = `${data.stats[key] / max * 100}%`;
  $('total-count').textContent = data.stats.phishing + data.stats.malicious;
  for (const input of document.querySelectorAll('[data-setting]')) input.checked = data.settings[input.dataset.setting];
  const on = ['ads','trackers','phishing','malicious'].filter(x => data.settings[x]).length;
  $('overall').textContent = data.ruleError ? 'Rules need attention' : on === 4 ? 'Protection active' : on ? 'Partial protection' : 'Protection off';
  $('overall').className = `pill ${data.ruleError ? 'danger' : on === 4 ? 'good' : on ? 'warn' : 'danger'}`;
  if (data.ruleError) say(data.ruleError);
  $('feed-status').textContent = `${data.feed.length.toLocaleString()} domains · ${data.feedSource === 'downloaded' ? 'downloaded' : 'bundled snapshot'} ${new Date(data.feedUpdatedAt).toLocaleString()}`;
  const applied = Number.isFinite(data.feedRulesApplied) ? data.feedRulesApplied : 0;
  const capped = data.settings.malicious && applied < data.feed.length;
  $('rules-status').textContent = data.settings.malicious
    ? `${applied.toLocaleString()} of ${data.feed.length.toLocaleString()} feed domains are enforced as browser rules · ${Number(data.dynamicRuleCount || 0).toLocaleString()} dynamic rules active${capped ? ' · the browser rule quota limits how much of the feed can be applied' : ''}`
    : 'Malicious-site protection is off, so no custom or feed rules are applied.';
  $('history-list').replaceChildren();
  if (!data.history.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'No security warnings recorded.'; $('history-list').append(p); }
  for (const event of data.history) {
    const row = document.createElement('div'); row.className = 'history-item';
    const title = document.createElement('strong'); title.textContent = `${event.domain} · ${event.threatType}`;
    const time = document.createElement('small'); time.textContent = new Date(event.timestamp).toLocaleString();
    const details = document.createElement('p'); details.textContent = `${event.risk} · ${event.action} · ${(event.reasons || []).join('; ')}`;
    details.className = `risk-${riskTone(event.risk)}`;
    row.append(title,time,details); $('history-list').append(row);
  }
  for (const list of ['allowlist','blocklist']) {
    $(`${list}-items`).replaceChildren();
    for (const domain of data[list]) $(`${list}-items`).append(item(domain, async () => {
      try { render(await request({type:'REMOVE_DOMAIN', list, domain})); say(`${domain} removed.`); }
      catch (error) { say(error.message); }
    }));
  }
}
try { render(await request({type:'STATE'})); } catch(error) { say(error.message); }
for (const button of document.querySelectorAll('[data-check-mode]')) button.addEventListener('click', () => setCheckMode(button.dataset.checkMode));
$('check-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = checkMode === 'url' ? $('check-input').value.trim() : $('email-input').value;
  const links = checkMode === 'url' ? [input] : extractWebLinks(input);
  const error = $('check-error'); error.hidden = true;
  const results = $('check-results'); results.replaceChildren();
  if (checkMode === 'url' && (!/^https?:\/\//i.test(input) || input.length > 2048)) {
    error.textContent = 'Enter a complete HTTP or HTTPS URL of up to 2,048 characters.'; error.hidden = false; return;
  }
  if (checkMode === 'email' && !links.length) {
    error.textContent = 'No complete HTTP or HTTPS links found in this text.'; error.hidden = false; return;
  }
  const submit = $('check-form').querySelector('button[type="submit"]'); submit.disabled = true;
  try {
    for (const url of links) {
      const analysis = await request({type:'ANALYZE', url});
      if (analysis.risk === 'UNSUPPORTED') {
        error.textContent = 'One link could not be analyzed. Check its format.'; error.hidden = false; continue;
      }
      results.append(checkResult(analysis));
    }
  } catch (failure) { error.textContent = failure.message; error.hidden = false; }
  finally { submit.disabled = false; }
});
for (const input of document.querySelectorAll('[data-setting]')) input.addEventListener('change', async () => {
  input.disabled = true;
  try { render(await request({type:'SET_SETTING', key:input.dataset.setting, value:input.checked})); say('Setting saved.'); }
  catch(error) { render(await request({type:'STATE'})); say(error.message); }
  finally { input.disabled = false; }
});
for (const form of document.querySelectorAll('form[data-list]')) form.addEventListener('submit', async event => {
  event.preventDefault();
  const input = form.elements.domain;
  try { render(await request({type:'ADD_DOMAIN', list:form.dataset.list, domain:input.value})); input.value = ''; say('Domain added.'); }
  catch(error) { say(error.message); }
});
$('clear-history').addEventListener('click', async () => {
  if (!confirm('Clear locally stored threat history?')) return;
  try { render(await request({type:'CLEAR_HISTORY'})); say('History cleared.'); } catch(error) { say(error.message); }
});
$('reset-stats').addEventListener('click', async () => {
  if (!confirm('Reset locally stored statistics?')) return;
  try { render(await request({type:'RESET_STATS'})); say('Statistics reset.'); } catch(error) { say(error.message); }
});
$('refresh-feed').addEventListener('click', async event => {
  event.target.disabled = true;
  try { const result = await request({type:'REFRESH_FEED'}); render(await request({type:'STATE'})); say(result.updated ? `Threat feed updated: ${result.count} domains.` : 'Automatic feed updates are disabled.'); }
  catch(error) { say(`Feed update failed: ${error.message}`); }
  finally { event.target.disabled = false; }
});
const navLinks = [...document.querySelectorAll('nav a')];
const sections = [...document.querySelectorAll('main section[id]')];
function highlight(id) { for (const a of navLinks) a.classList.toggle('active', a.hash === `#${id}`); }
function activeNav() { highlight((location.hash || '#overview').slice(1)); }
function spy() {
  const offset = window.scrollY + 160;
  let current = sections[0]?.id;
  for (const section of sections) if (section.offsetTop <= offset) current = section.id;
  highlight(current);
}
let scrolling = false;
window.addEventListener('scroll', () => {
  if (scrolling) return;
  scrolling = true;
  requestAnimationFrame(() => { spy(); scrolling = false; });
}, {passive: true});
window.addEventListener('hashchange', activeNav);
activeNav();
try { const version = chrome.runtime.getManifest().version; $('footer-version').textContent = `BrowserGuard v${version}`; } catch { /* Static preview without extension APIs. */ }

$('copy-summary').addEventListener('click', async () => {
  if (!state) return;
  const active = ['ads','trackers','phishing','malicious'].filter(key => state.settings[key]).map(key => key === 'malicious' ? 'malicious sites' : key).join(', ');
  const report = [
    `BrowserGuard v${chrome.runtime.getManifest().version} — protection summary`,
    `Generated: ${new Date().toLocaleString()}`,
    `Ad requests blocked: ${state.stats.ads}`,
    `Tracker requests blocked: ${state.stats.trackers}`,
    `Suspected phishing warnings: ${state.stats.phishing}`,
    `Known malicious-site warnings: ${state.stats.malicious}`,
    `User-blocked site warnings: ${state.stats.custom}`,
    `Protection enabled for: ${active || 'nothing'}`,
    `Threat feed: ${state.feed.length} domains (${state.feedSource === 'downloaded' ? 'downloaded' : 'bundled snapshot'}), ${state.feedRulesApplied || 0} enforced as browser rules`,
    `Trusted domains: ${state.allowlist.length} · Custom blocked domains: ${state.blocklist.length}`,
    'Counts come from real rule-match feedback and actual warning interstitials; they are not estimates.'
  ].join('\n');
  try {
    await navigator.clipboard.writeText(report);
    say('Summary copied to clipboard.');
  } catch (error) {
    say(`Could not copy the summary: ${error.message}`);
  }
});
