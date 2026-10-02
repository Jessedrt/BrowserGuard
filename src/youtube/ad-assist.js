// YouTube can deliver video ads through the same media infrastructure as normal videos.
// Press only visible ad controls that YouTube exposes; never change video playback.
(() => {
  const SKIP_SELECTOR = [
    'button.ytp-ad-skip-button',
    'button.ytp-ad-skip-button-modern',
    'button.ytp-skip-ad-button',
    '.ytp-ad-skip-button-container button',
    '.ytp-ad-skip-button-slot button',
    '.ytp-ad-skip-button button',
    '.ytp-ad-skip-button-modern button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-container [role="button"]',
    '.ytp-ad-skip-button-slot [role="button"]'
  ].join(', ');
  const CLOSE_SELECTOR = 'button.ytp-ad-overlay-close-button';
  const lastClick = new WeakMap();
  let settings = {ads: true};
  let allowlist = [];
  let queued = false;

  const allowed = () => allowlist.some(domain =>
    location.hostname === domain || location.hostname.endsWith(`.${domain}`));

  function clickIfAvailable(button) {
    if (!button || button.disabled || !button.isConnected || !button.getClientRects().length) return;
    if (button.getAttribute?.('aria-disabled') === 'true' || button.getAttribute?.('aria-hidden') === 'true') return;
    if (getComputedStyle(button).visibility === 'hidden') return;
    if (Date.now() - (lastClick.get(button) || 0) < 1000) return;
    lastClick.set(button, Date.now());
    button.click();
  }

  function scan() {
    queued = false;
    if (!settings.ads || allowed()) return;
    const player = document.querySelector('.html5-video-player');
    if (!player) return;
    // A visible Skip control is a stronger signal than YouTube's changing ad classes.
    clickIfAvailable(player.querySelector(SKIP_SELECTOR));
    clickIfAvailable(player.querySelector(CLOSE_SELECTOR));
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(scan);
  }

  chrome.storage.local.get({settings: {ads: true}, allowlist: []}).then(state => {
    settings = state.settings || settings;
    allowlist = Array.isArray(state.allowlist) ? state.allowlist : [];
    schedule();
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) settings = changes.settings.newValue || {ads: true};
    if (changes.allowlist) allowlist = Array.isArray(changes.allowlist.newValue) ? changes.allowlist.newValue : [];
    schedule();
  });
  new MutationObserver(schedule).observe(document, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled', 'aria-hidden']
  });
  // Some controls become clickable after a countdown without a DOM mutation.
  setInterval(schedule, 500);
})();
