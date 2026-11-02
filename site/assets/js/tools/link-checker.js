// Link & phishing checker. Uses the same analyzer as the BrowserGuard extension
// (assets/js/engine is generated from src/security).
import {analyzeUrl} from '../engine/analyzer.js';
import {extractWebLinks} from '../engine/link-extractor.js';

const $ = id => document.getElementById(id);
const form = $('check-form');
const result = $('result');
const error = $('error');
let mode = 'url';

const TONE = {SAFE: 'good', 'LOW RISK': 'warn', SUSPICIOUS: 'warn', 'HIGH RISK': 'danger', 'USER BLOCKED': 'danger', 'KNOWN MALICIOUS': 'danger'};

const ICONS = {
  good: '<path d="M20 6 9 17l-5-5"/>',
  warn: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  danger: '<path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  neutral: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>'
};

function icon(tone) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[tone] || ICONS.neutral}</svg>`;
}

function setMode(next) {
  mode = next;
  for (const tab of document.querySelectorAll('[data-mode]')) {
    const selected = tab.dataset.mode === next;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  $('panel-url').hidden = next !== 'url';
  $('panel-email').hidden = next !== 'email';
  error.textContent = '';
  if (next === 'url') $('url-input').focus(); else $('email-input').focus();
}

for (const tab of document.querySelectorAll('[data-mode]')) {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    setMode(mode === 'url' ? 'email' : 'url');
    document.querySelector(`[data-mode="${mode}"]`).focus();
  });
}

function verdictFor(analysis) {
  if (analysis.allowlisted) return {tone: 'neutral', title: 'Allowlisted', meta: 'URL checks are skipped for this domain in the extension.'};
  if (analysis.customMatch) return {tone: 'danger', title: 'On your custom blocklist', meta: 'You marked this domain as blocked.'};
  if (analysis.knownMatch) return {tone: 'danger', title: 'Known malicious domain', meta: 'Matches the local malware-domain feed.'};
  if (analysis.risk === 'HIGH RISK') return {tone: 'danger', title: 'High risk — likely phishing', meta: `Signal score ${analysis.score}/99 · several strong indicators.`};
  if (analysis.risk === 'SUSPICIOUS') return {tone: 'warn', title: 'Suspicious — verify before continuing', meta: `Signal score ${analysis.score}/99 · some indicators found.`};
  if (analysis.risk === 'LOW RISK') return {tone: 'warn', title: 'Low risk — minor oddity', meta: `Signal score ${analysis.score}/99 · nothing decisive.`};
  if (analysis.risk === 'SAFE') return {tone: 'good', title: 'No known phishing indicators', meta: 'Nothing in the address matched a known pattern. This is not a guarantee.'};
  return {tone: 'neutral', title: 'Could not analyse this address', meta: analysis.reasons[0] || 'Check that it is a complete http or https URL.'};
}

function renderCard(analysis, input) {
  const verdict = verdictFor(analysis);
  const card = document.createElement('article');
  card.className = 'panel';
  card.style.padding = '20px';
  card.style.marginTop = '14px';

  const head = document.createElement('div');
  head.className = 'verdict';
  head.dataset.tone = verdict.tone;
  head.innerHTML = `<span class="v-icon">${icon(verdict.tone)}</span><div class="v-body"><strong></strong><div class="v-meta"></div></div>`;
  head.querySelector('strong').textContent = verdict.title;
  head.querySelector('.v-meta').textContent = verdict.meta;
  card.append(head);

  if (analysis.risk !== 'UNSUPPORTED') {
    const facts = document.createElement('div');
    facts.className = 'facts';
    const protocol = input.startsWith('https:') ? 'HTTPS' : 'HTTP (not encrypted)';
    const rows = [
      ['Domain', analysis.domain || '—'],
      ['Connection', protocol],
      ['Risk band', analysis.risk],
      ['Signals found', String((analysis.reasons || []).length)]
    ];
    for (const [label, value] of rows) {
      const fact = document.createElement('div');
      fact.className = 'fact';
      const span = document.createElement('span');
      span.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      fact.append(span, strong);
      facts.append(fact);
    }
    card.append(facts);

    const list = document.createElement('ul');
    list.className = 'reasons';
    const reasons = (analysis.reasons || []).filter(reason => reason !== 'User allowlist');
    list.dataset.clean = String(reasons.length === 0);
    if (!reasons.length) {
      const item = document.createElement('li');
      item.textContent = 'No structural warning signs were detected in this address.';
      list.append(item);
    } else {
      for (const reason of reasons) {
        const item = document.createElement('li');
        item.textContent = reason;
        list.append(item);
      }
    }
    card.append(list);
  }
  return card;
}

function run(inputs) {
  result.replaceChildren();
  let shown = 0;
  for (const input of inputs) {
    const analysis = analyzeUrl(input);
    if (analysis.risk === 'UNSUPPORTED') continue;
    result.append(renderCard(analysis, input));
    shown++;
  }
  if (!shown) {
    error.textContent = 'Nothing could be analysed. Enter a complete URL starting with http:// or https://.';
  }
  result.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  if (mode === 'url') {
    const value = $('url-input').value.trim();
    if (!/^https?:\/\//i.test(value)) { error.textContent = 'Include the full address, starting with http:// or https://.'; return; }
    if (value.length > 2048) { error.textContent = 'That address is longer than 2,048 characters.'; return; }
    run([value]);
    return;
  }
  const links = extractWebLinks($('email-input').value);
  if (!links.length) { error.textContent = 'No complete http or https links were found in that text.'; return; }
  run(links);
});

for (const sample of document.querySelectorAll('[data-sample]')) {
  sample.addEventListener('click', event => {
    event.preventDefault();
    setMode('url');
    $('url-input').value = sample.dataset.sample;
    run([sample.dataset.sample]);
  });
}

// Deep link from the homepage: /tools/link-checker?url=https%3A%2F%2F...
const preset = new URLSearchParams(location.search).get('url');
if (preset) {
  $('url-input').value = preset;
  if (/^https?:\/\//i.test(preset)) run([preset]);
}
