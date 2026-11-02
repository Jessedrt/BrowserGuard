// Password scoring, generation and formatting. Everything runs in the page;
// no password or passphrase is ever sent anywhere by this module.

// Short list of the most frequently seen passwords. Order matters: an earlier
// entry means a smaller guess count, which is exactly how attackers rank them.
export const COMMON_PASSWORDS = [
  'password','123456','123456789','qwerty','12345678','111111','1234567890','1234567','password1','12345',
  'qwerty123','1q2w3e','123123','abc123','1234','password123','iloveyou','1q2w3e4r','000000','qwertyuiop',
  'admin','letmein','welcome','monkey','dragon','football','baseball','sunshine','princess','superman',
  'qazwsx','trustno1','hello123','master','shadow','michael','jennifer','jordan','harley','ranger',
  'buster','thomas','tigger','robert','soccer','batman','test123','passw0rd','p@ssw0rd','p@ssword',
  'welcome1','welcome123','admin123','root','toor','changeme','secret','letmein123','football1','monkey123',
  'charlie','donald','freedom','whatever','qwerty1','starwars','computer','internet','samsung','google',
  'loveyou','nicole','daniel','jessica','ashley','amanda','andrew','joshua','matthew','hunter',
  'summer','winter','spring','autumn','january','february','march','april','may','june','july','august',
  'september','october','november','december','monday','friday','sunday','birthday','chocolate','cookie',
  'maggie','pepper','ginger','banana','orange','purple','silver','golden','diamond','flower',
  'school','student','teacher','nigeria','lagos','abuja','africa','michael1','lovely','sweet',
  'angel','babygirl','hottie','mustang','ferrari','cheese','ninja','pokemon','minecraft','fortnite',
  'linkedin','facebook','youtube','instagram','twitter','whatsapp','telegram','snapchat','tiktok','netflix',
  'access','login','user','guest','default','temp123','letmein1','pass1234','passpass','qwerty12',
  'zaq12wsx','asdfghjkl','zxcvbnm','1qaz2wsx','1q2w3e4r5t','qwe123','asd123','789456123','321654987','159753',
  'password12','password!','password12!','passw0rd1','adminadmin','administrator','server','database','mysql','oracle'
];

// Three-letter-per-word list for passphrases. 256 entries = 8 bits of entropy per
// word, so the maths stays simple and honest.
export const PASSPHRASE_WORDS = [
  'acorn','amber','anchor','apple','arrow','atlas','autumn','badge','baker','balloon','bamboo','banjo',
  'basil','beacon','beetle','bishop','blanket','blossom','border','bottle','bramble','breeze','bridge','bronze',
  'bubble','bucket','buffalo','bunker','burrow','butter','cabin','cactus','camera','candle','canoe','canvas',
  'canyon','carbon','cargo','castle','cattle','cedar','cello','census','chalk','cherry','chisel','cinder',
  'circle','citrus','clover','coast','cobalt','coffee','comet','compass','copper','coral','cosmos','cotton',
  'cougar','crater','crayon','cricket','crystal','cymbal','dahlia','daisy','damson','dapple','dawn','decoy',
  'delta','denim','desert','diesel','dinner','dolphin','domino','donkey','dragon','drift','drizzle','dune',
  'eagle','earth','ember','emerald','engine','ermine','falcon','fathom','feather','fennel','fern','ferry',
  'fiddle','fiesta','fig','filter','finch','fjord','flame','flint','florist','flute','fog','forest',
  'fossil','fountain','fox','freckle','frost','galaxy','garden','garlic','gecko','geyser','ginger','glacier',
  'glider','globe','gloss','goose','granite','grape','gravity','grove','gull','gusto','hammock','harbor',
  'harvest','hazel','heather','helmet','heron','hickory','hollow','honey','horizon','hunter','hurdle','iceberg',
  'igloo','indigo','island','ivory','jacket','jaguar','jasmine','jelly','jersey','jewel','jigsaw','jolly',
  'jungle','juniper','kayak','kettle','kernel','keystone','kitten','koala','ladder','lagoon','lantern','latch',
  'lattice','lava','leaf','ledger','lemon','lentil','leopard','lever','lichen','lilac','linen','lobster',
  'locust','lodge','lotus','lumber','lunar','lynx','magnet','mahogany','mallet','mango','maple','marble',
  'marina','marrow','meadow','medal','melon','mentor','mercury','mermaid','meteor','midnight','mint','mirror',
  'mist','mitten','monsoon','moose','mosaic','moss','motto','mountain','muffin','mural','mushroom','mustard',
  'nectar','needle','nickel','noodle','north','nova','nugget','nutmeg','oasis','oat','obsidian','ocelot',
  'octave','olive','onyx','opal','orbit','orchid','osprey','otter','outpost','oyster','paddle','palace',
  'palm','panda','panic','papaya','parcel','parrot','pastel','path','peach','pearl','pebble','pelican',
  'penguin','peony','pepper','perch','petal','pewter','pigeon','pillar','pilot','pine','pixel','planet',
  'plum','pocket','polar','pollen','pomelo','poncho','poppy','portal','potato','prairie','prism','puddle'
];
// Keep the list at exactly 256 entries so each word contributes 8 bits.
PASSPHRASE_WORDS.length = Math.min(PASSPHRASE_WORDS.length, 256);

const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz','01234567890','qwertyuiop','asdfghjkl','zxcvbnm','1234567890'];
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i' };

export function normalizeLeet(value) {
  return value.toLowerCase().replace(/[0134578@$!]/g, character => LEET[character] ?? character);
}

const charsetFor = password => {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/[0-9]/.test(password)) size += 10;
  if (/[^A-Za-z0-9]/.test(password)) size += 33;
  return Math.max(size, 1);
};

function hasRun(value, minimum = 3) {
  let run = 1;
  for (let index = 1; index < value.length; index++) {
    run = value[index] === value[index - 1] ? run + 1 : 1;
    if (run >= minimum) return true;
  }
  return false;
}

function hasSequence(value, length = 3) {
  const lower = value.toLowerCase();
  for (const table of SEQUENCES) {
    for (let index = 0; index + length <= table.length; index++) {
      const slice = table.slice(index, index + length);
      if (lower.includes(slice) || lower.includes([...slice].reverse().join(''))) return true;
    }
  }
  return false;
}

function hasKeyboardWalk(value, length = 4) {
  const lower = value.toLowerCase();
  for (const row of KEYBOARD_ROWS) {
    for (let index = 0; index + length <= row.length; index++) {
      const slice = row.slice(index, index + length);
      if (lower.includes(slice) || lower.includes([...slice].reverse().join(''))) return true;
    }
  }
  return false;
}

function looksLikeYear(value) {
  const years = value.match(/(19|20)\d{2}/g);
  return years ? years.length > 0 : false;
}

function dictionaryHits(value) {
  const normalised = normalizeLeet(value);
  const hits = [];
  for (const candidate of COMMON_PASSWORDS) {
    if (normalised === candidate || normalised.includes(candidate)) hits.push(candidate);
  }
  return hits;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'instantly';
  const units = [
    ['second', 1], ['minute', 60], ['hour', 3600], ['day', 86400], ['month', 2629800],
    ['year', 31557600], ['century', 3155760000]
  ];
  if (seconds > 3155760000 * 1000) return 'many millennia';
  let chosen = units[0];
  for (const unit of units) if (seconds >= unit[1]) chosen = unit;
  const value = seconds / chosen[1];
  if (value > 1000) return `about ${Math.round(value).toLocaleString()} ${chosen[0]}s`;
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString()} ${chosen[0]}${rounded === 1 ? '' : 's'}`;
}

export function analyzePassword(password) {
  const value = typeof password === 'string' ? password : '';
  const length = value.length;
  const checks = [
    { id: 'length', label: 'At least 12 characters', ok: length >= 12 },
    { id: 'length-long', label: '16 characters or more', ok: length >= 16 },
    { id: 'case', label: 'Upper and lower case letters', ok: /[a-z]/.test(value) && /[A-Z]/.test(value) },
    { id: 'digit', label: 'Contains a number', ok: /[0-9]/.test(value) },
    { id: 'symbol', label: 'Contains a symbol', ok: /[^A-Za-z0-9]/.test(value) },
    { id: 'common', label: 'Not a common password', ok: length > 0 && dictionaryHits(value).length === 0 },
    { id: 'sequence', label: 'No keyboard or alphabet runs', ok: length > 0 && !hasSequence(value) && !hasKeyboardWalk(value) },
    { id: 'repeat', label: 'No character repeated 3 times', ok: length > 0 && !hasRun(value, 3) }
  ];
  const warnings = [];
  const hits = dictionaryHits(value);
  if (hits.length) warnings.push(`Contains a well-known password or word ("${hits[0]}"), even after letter substitutions.`);
  if (hasSequence(value)) warnings.push('Contains a run such as "abc", "123" or a reversed sequence.');
  if (hasKeyboardWalk(value)) warnings.push('Contains a keyboard pattern such as "qwer" or "asdf".');
  if (hasRun(value, 3)) warnings.push('Repeats the same character three or more times.');
  if (looksLikeYear(value)) warnings.push('Contains a year, which is one of the easiest things to guess.');
  if (length > 0 && length < 8) warnings.push('Fewer than 8 characters can be cracked almost immediately.');

  let guesses;
  if (!length) guesses = 0;
  else if (hits.length) guesses = COMMON_PASSWORDS.indexOf(hits[0]) + 1;
  else {
    guesses = Math.pow(charsetFor(value), length);
    if (hasSequence(value)) guesses *= 0.05;
    if (hasKeyboardWalk(value)) guesses *= 0.05;
    if (hasRun(value, 3)) guesses *= 0.1;
    if (looksLikeYear(value)) guesses *= 0.2;
    if (length <= 8) guesses *= 0.5;
  }
  const log10 = guesses > 0 ? Math.log10(guesses) : 0;
  const bits = guesses > 0 ? Math.log2(guesses) : 0;
  const scoreBasis = !length ? 0 : log10 < 4 ? 0 : log10 < 6 ? 1 : log10 < 8 ? 2 : log10 < 10 ? 3 : 4;
  // A password that fails the basic checks should never be labelled strong.
  const failed = checks.filter(check => !check.ok).length;
  const score = Math.max(0, Math.min(scoreBasis, failed >= 3 ? 2 : 4));
  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return {
    length, guesses, log10, bits, score, label: labels[score], checks, warnings,
    offline: guesses / 1e10, online: guesses / 1e3,
    charsetSize: charsetFor(value)
  };
}

/* ---------------- generation ---------------- */

function randomInt(max) {
  if (max <= 0) throw new Error('Range must be positive');
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % max;
}

const pick = list => list[randomInt(list.length)];

export function generatePassword({ length = 20, upper = true, digits = true, symbols = true, excludeAmbiguous = true, requireAll = true } = {}) {
  const ambiguous = new Set('Il1O0o|`\'"{}[]()/\\');
  const filter = value => (excludeAmbiguous ? [...value].filter(character => !ambiguous.has(character)).join('') : value);
  const lower = filter('abcdefghijklmnopqrstuvwxyz');
  const upperSet = filter('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const digitSet = filter('0123456789');
  const symbolSet = filter('!@#$%^&*-_=+?.,:;');
  const groups = [lower];
  if (upper) groups.push(upperSet);
  if (digits) groups.push(digitSet);
  if (symbols) groups.push(symbolSet);
  const pool = groups.join('');
  const size = Math.max(4, Math.min(128, Number(length) || 20));
  const characters = [];
  if (requireAll) for (const group of groups) characters.push(pick(group));
  while (characters.length < size) characters.push(pick(pool));
  // Fisher–Yates with cryptographic randomness so required characters are not
  // stuck at the front of the password.
  for (let index = characters.length - 1; index > 0; index--) {
    const target = randomInt(index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }
  return characters.join('');
}

export function generatePassphrase({ words = 4, separator = '-', capitalize = true } = {}) {
  const count = Math.max(3, Math.min(10, Number(words) || 4));
  const picked = Array.from({length: count}, () => pick(PASSPHRASE_WORDS));
  const value = picked
    .map(word => (capitalize ? word[0].toUpperCase() + word.slice(1) : word))
    .join(separator);
  return { value, bits: count * 8 };
}
