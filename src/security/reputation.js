import { normalizeDomain } from './domains.js';

export const URLHAUS_FEED = 'https://urlhaus.abuse.ch/downloads/hostfile/';
export function parseUrlhausHostfile(text, max = 15000) {
  const domains = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.trim().split(/\s+/);
    if (!['0.0.0.0', '127.0.0.1'].includes(parts[0]) || parts.length !== 2) continue;
    const host = normalizeDomain(parts[1]);
    if (host) domains.add(host);
    if (domains.size >= max) break;
  }
  return [...domains];
}
