// Password and passphrase generator. All randomness comes from the browser's
// cryptographic source; nothing is transmitted or persisted.
import {generatePassword, generatePassphrase, analyzePassword} from '../lib/password.js?v=2';
import {copyText} from '../site.js?v=2';

const $ = id => document.getElementById(id);
const COLORS = ['var(--red)', 'var(--red)', 'var(--amber)', 'var(--blue)', 'var(--green)'];
let kind = 'random';

const options = () => ({
  length: Number($('length').value),
  upper: $('opt-upper').checked,
  digits: $('opt-digits').checked,
  symbols: $('opt-symbols').checked,
  excludeAmbiguous: $('opt-ambiguous').checked,
  requireAll: $('opt-require').checked
});

function updateStrength(value, overrideBits) {
  if (overrideBits) {
    const bits = overrideBits;
    const score = bits >= 76 ? 4 : bits >= 60 ? 3 : bits >= 45 ? 2 : bits >= 30 ? 1 : 0;
    $('meter').style.width = `${(score + 1) * 20}%`;
    $('meter').style.backgroundColor = COLORS[score];
    $('strength-label').textContent = ['Weak', 'Weak', 'Fair', 'Strong', 'Very strong'][score];
    $('strength-label').style.color = COLORS[score];
    $('strength-bits').textContent = `${bits} bits of entropy`;
    return;
  }
  const analysis = analyzePassword(value);
  $('meter').style.width = `${(analysis.score + 1) * 20}%`;
  $('meter').style.backgroundColor = COLORS[analysis.score];
  $('strength-label').textContent = analysis.label;
  $('strength-label').style.color = COLORS[analysis.score];
  $('strength-bits').textContent = `about ${Math.round(analysis.bits)} bits of entropy`;
}

function generate() {
  if (kind === 'random') {
    const value = generatePassword(options());
    $('output').textContent = value;
    updateStrength(value);
  } else {
    const words = Number($('words').value);
    const separator = '-';
    const {value, bits} = generatePassphrase({
      words,
      separator,
      capitalize: $('opt-capitalise').checked
    });
    const extra = $('opt-number').checked ? Math.floor(Math.random() * 9000 + 1000) : '';
    const final = extra ? `${value}${separator}${extra}` : value;
    $('output').textContent = final;
    // The appended number is not cryptographic randomness, so it is not counted
    // as entropy in the figure shown.
    updateStrength(final, bits);
  }
  $('copy-error').textContent = '';
}

function setKind(next) {
  kind = next;
  for (const tab of document.querySelectorAll('[data-kind]')) {
    const selected = tab.dataset.kind === next;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  $('random-options').hidden = next !== 'random';
  $('words-options').hidden = next !== 'words';
  generate();
}

for (const tab of document.querySelectorAll('[data-kind]')) {
  tab.addEventListener('click', () => setKind(tab.dataset.kind));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    setKind(kind === 'random' ? 'words' : 'random');
    document.querySelector(`[data-kind="${kind}"]`).focus();
  });
}

$('length').addEventListener('input', () => {
  $('length-value').textContent = $('length').value;
  generate();
});
$('words').addEventListener('input', () => {
  $('words-value').textContent = $('words').value;
  generate();
});
for (const id of ['opt-upper', 'opt-digits', 'opt-symbols', 'opt-ambiguous', 'opt-require', 'opt-capitalise', 'opt-number']) {
  $(id).addEventListener('change', generate);
}

$('again').addEventListener('click', generate);
$('copy').addEventListener('click', async () => {
  const ok = await copyText($('output').textContent, $('copy'));
  $('copy-error').textContent = ok ? '' : 'Your browser blocked clipboard access. Select the value and copy it manually.';
});

$('length-value').textContent = $('length').value;
$('words-value').textContent = $('words').value;
generate();
