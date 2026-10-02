import {SEED_DOMAINS, SEED_UPDATED_AT} from '../security/seed.js';

export const DEFAULTS = {
  settings: {ads: true, trackers: true, phishing: true, malicious: true, feedUpdates: true},
  allowlist: [], blocklist: [], feed: SEED_DOMAINS, feedUpdatedAt: SEED_UPDATED_AT, feedSource: 'bundled',
  stats: {ads: 0, trackers: 0, phishing: 0, malicious: 0, custom: 0},
  history: [], ruleError: null
};

export async function getState() {
  const data = await chrome.storage.local.get(DEFAULTS);
  return {...DEFAULTS, ...data, settings: {...DEFAULTS.settings, ...data.settings}, stats: {...DEFAULTS.stats, ...data.stats}};
}

export async function updateState(patch) {
  await chrome.storage.local.set(patch);
}
