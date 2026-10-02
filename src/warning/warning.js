import {riskTone} from '../ui/risk-tone.js';

const $ = id => document.getElementById(id);
const tab = await chrome.tabs.getCurrent();
const request = async type => {
  const response = await chrome.runtime.sendMessage({type, tabId: tab.id});
  if (response?.error) throw new Error(response.error);
  return response;
};
let warning;
try {
  warning = await request('WARNING');
  if (!warning) throw new Error('This warning has expired.');
  document.body.dataset.tone = riskTone(warning.analysis.risk);
  $('threat').textContent = warning.analysis.threatType || 'Suspicious website';
  $('risk').textContent = warning.analysis.risk;
  $('domain').textContent = warning.analysis.domain;
  for (const reason of warning.analysis.reasons) {
    const item = document.createElement('li'); item.textContent = reason; $('reasons').append(item);
  }
} catch (error) { $('message').textContent = error.message; }
$('advanced').addEventListener('click', () => { $('advanced-panel').hidden = !$('advanced-panel').hidden; });
$('back').addEventListener('click', () => request('GO_BACK').catch(error => $('message').textContent = error.message));
$('continue').addEventListener('click', async () => {
  if (!warning) return;
  if (['HIGH RISK','KNOWN MALICIOUS'].includes(warning.analysis.risk) && !window.confirm(`Continue to ${warning.analysis.domain}? This site may be dangerous.`)) return;
  try { await request('CONTINUE'); } catch (error) { $('message').textContent = error.message; }
});
