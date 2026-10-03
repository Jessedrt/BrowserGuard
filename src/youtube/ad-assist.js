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
  const AD_TIMER_SELECTOR = '.ytp-ad-duration-remaining';
  const COSMETIC_CLASS = 'browserguard-ads-on';
  const lastClick = new WeakMap();
  const lastSeek = new WeakMap();
  let settings = {ads: true};
  let allowlist = [];
  let queued = false;

  const allowed = () => allowlist.some(domain =>
    location.hostname === domain || location.hostname.endsWith(`.${domain}`));

  function notifyEarlyFilter() {
    window.postMessage({source: 'BrowserGuard', type: 'YOUTUBE_AD_FILTER',
      enabled: settings.ads && !allowed()}, location.origin);
  }

  function clickIfAvailable(button) {
    if (!button || button.disabled || !button.isConnected || !button.getClientRects().length) return false;
    if (button.getAttribute?.('aria-disabled') === 'true' || button.getAttribute?.('aria-hidden') === 'true') return false;
    if (getComputedStyle(button).visibility === 'hidden') return false;
    if (Date.now() - (lastClick.get(button) || 0) < 1000) return false;
    lastClick.set(button, Date.now());
    button.click();
    return true;
  }

  function advanceAdIfCertain(player) {
    // Never seek an ordinary video: require YouTube's ad state and a matching ad countdown.
    if (!player.classList.contains('ad-showing')) return;
    const timer = player.querySelector(AD_TIMER_SELECTOR);
    if (!timer?.getClientRects().length) return;
    const clock = timer.textContent?.match(/(\d{1,2}):(\d{2})/);
    if (!clock) return;
    const secondsLeft = Number(clock[1]) * 60 + Number(clock[2]);
    const video = player.querySelector('video.html5-main-video');
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 120) return;
    if (Math.abs(video.duration - video.currentTime - secondsLeft) > 3) return;
    if (video.currentTime >= video.duration - 0.5) return;
    const last = lastSeek.get(video);
    if (last && last.duration === video.duration && Date.now() - last.time < 3000) return;
    lastSeek.set(video, {duration: video.duration, time: Date.now()});
    try { video.currentTime = Math.max(video.currentTime, video.duration - 0.2); }
    catch { /* Some ad streams do not allow seeking. */ }
  }

  function scan() {
    queued = false;
    const enabled = settings.ads && !allowed();
    document.documentElement?.classList?.toggle(COSMETIC_CLASS, enabled);
    if (!enabled) return;
    const player = document.querySelector('.html5-video-player');
    if (!player) return;
    // A visible Skip control is a stronger signal than YouTube's changing ad classes.
    if (!clickIfAvailable(player.querySelector(SKIP_SELECTOR)) && settings.youtubeAdvance !== false) advanceAdIfCertain(player);
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
    notifyEarlyFilter();
    schedule();
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) settings = changes.settings.newValue || {ads: true};
    if (changes.allowlist) allowlist = Array.isArray(changes.allowlist.newValue) ? changes.allowlist.newValue : [];
    notifyEarlyFilter();
    schedule();
  });
  new MutationObserver(schedule).observe(document, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled', 'aria-hidden']
  });
  // Some controls become clickable after a countdown without a DOM mutation.
  setInterval(schedule, 500);
})();
