const $ = id => document.getElementById(id);
const request = async message => {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
  return response;
};
let state;
function say(text) { $('message').textContent = text; $('message').classList.add('visible'); setTimeout(() => $('message').classList.remove('visible'), 5000); }
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
  $('history-list').replaceChildren();
  if (!data.history.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'No security warnings recorded.'; $('history-list').append(p); }
  for (const event of data.history) {
    const row = document.createElement('div'); row.className = 'history-item';
    const title = document.createElement('strong'); title.textContent = `${event.domain} · ${event.threatType}`;
    const time = document.createElement('small'); time.textContent = new Date(event.timestamp).toLocaleString();
    const details = document.createElement('p'); details.textContent = `${event.risk} · ${event.action} · ${(event.reasons || []).join('; ')}`;
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
function activeNav() { for (const a of document.querySelectorAll('nav a')) a.classList.toggle('active', a.hash === (location.hash || '#overview')); }
window.addEventListener('hashchange', activeNav); activeNav();
