// Password strength page. Nothing typed here leaves the browser.
import {analyzePassword, formatDuration} from '../lib/password.js';

const $ = id => document.getElementById(id);
const input = $('password');
const meter = $('meter');
const COLORS = ['var(--red)', 'var(--red)', 'var(--amber)', 'var(--blue)', 'var(--green)'];
const CHARSET_NAMES = size => {
  if (size >= 95) return 'Full printable set';
  if (size >= 69) return 'Letters, digits, symbols';
  if (size >= 62) return 'Upper and lower case + digits';
  if (size >= 52) return 'Letters and symbols';
  if (size >= 36) return 'Letters and digits';
  if (size >= 33) return 'Mixed symbols';
  if (size >= 26) return 'One case only';
  if (size >= 10) return 'Digits only';
  return 'Very limited';
};

function render(analysis) {
  const empty = analysis.length === 0;
  meter.style.width = empty ? '0%' : `${(analysis.score + 1) * 20}%`;
  meter.style.backgroundColor = empty ? 'var(--line)' : COLORS[analysis.score];
  $('meter-label').textContent = empty ? 'Waiting for input' : analysis.label;
  $('meter-label').style.color = empty ? '' : COLORS[analysis.score];
  $('meter-bits').textContent = empty ? '—' : `about ${Math.round(analysis.bits)} bits of entropy`;
  $('offline').textContent = empty ? '—' : formatDuration(analysis.offline);
  $('online').textContent = empty ? '—' : formatDuration(analysis.online);
  $('guesses').textContent = empty ? '—' : analysis.guesses.toLocaleString(undefined, {maximumSignificantDigits: 3});
  $('charset').textContent = empty ? '—' : `${CHARSET_NAMES(analysis.charsetSize)} (${analysis.charsetSize})`;

  const items = $('checks').children;
  for (let index = 0; index < items.length; index++) {
    const check = analysis.checks[index];
    if (!check) continue;
    items[index].textContent = check.label;
    items[index].dataset.ok = String(check.ok);
  }

  const box = $('warnings');
  box.replaceChildren();
  if (analysis.warnings.length) {
    const list = document.createElement('ul');
    list.className = 'reasons';
    for (const warning of analysis.warnings) {
      const item = document.createElement('li');
      item.textContent = warning;
      list.append(item);
    }
    box.append(list);
  }

  // Announce only meaningful changes so screen readers are not flooded per keystroke.
  if (!empty && analysis.label !== render.lastLabel) {
    $('announce').textContent = `Strength: ${analysis.label}`;
    render.lastLabel = analysis.label;
  }
  $('breach-check').disabled = empty || analysis.length < 4;
  $('breach-pill').hidden = true;
  $('breach-error').textContent = '';
}

input.addEventListener('input', () => render(analyzePassword(input.value)));

$('reveal').addEventListener('click', () => {
  const shown = input.type === 'text';
  input.type = shown ? 'password' : 'text';
  $('reveal').textContent = shown ? 'Show' : 'Hide';
  $('reveal').setAttribute('aria-pressed', String(!shown));
  input.focus();
});

$('breach-check').addEventListener('click', async () => {
  const password = input.value;
  if (!password) return;
  const button = $('breach-check');
  const error = $('breach-error');
  const pill = $('breach-pill');
  button.disabled = true;
  button.textContent = 'Checking…';
  error.textContent = '';
  try {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {headers: {'Add-Padding': 'true'}});
    if (!response.ok) throw new Error(`The breach service answered with HTTP ${response.status}`);
    const body = await response.text();
    const match = body.split('\n').map(line => line.trim().split(':')).find(([candidate]) => candidate === suffix);
    const count = match ? Number(match[1]) : 0;
    pill.hidden = false;
    if (Number.isFinite(count) && count > 0) {
      pill.className = 'pill danger';
      pill.textContent = `Seen ${count.toLocaleString()} times in breaches`;
      error.textContent = 'Change this password anywhere you use it, starting with your email account.';
    } else {
      pill.className = 'pill good';
      pill.textContent = 'Not found in known breaches';
      error.textContent = 'Not being in a public breach does not make a weak password strong.';
    }
  } catch (failure) {
    pill.hidden = true;
    error.textContent = `Could not reach the breach service. Your password was not sent anywhere by this page. (${failure.message})`;
  } finally {
    button.disabled = false;
    button.textContent = 'Check against known breaches';
  }
});

render(analyzePassword(''));
