// Extract only explicit web links from pasted text. Never fetch or open them.
export function extractWebLinks(text, limit = 10) {
  if (typeof text !== 'string' || text.length > 20000) return [];
  const found = [];
  const seen = new Set();
  const pattern = /https?:\/\/[^\s<>"'`]+/gi;
  for (const match of text.matchAll(pattern)) {
    const value = match[0].replace(/[.,!?;:]+$/, '').replace(/\)+$/, '');
    if (!value || seen.has(value)) continue;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) continue;
      found.push(value);
      seen.add(value);
      if (found.length >= limit) break;
    } catch { /* Ignore incomplete links in pasted text. */ }
  }
  return found;
}
