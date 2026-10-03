// Runs at document_start in YouTube's MAIN world. Keep this narrowly scoped:
// remove only player ad metadata, never streaming data or video playback state.
(() => {
  const AD_KEYS = ['playerAds', 'adPlacements', 'adSlots'];
  let enabled = true;

  function isPlayer(value) {
    return value && typeof value === 'object' && !Array.isArray(value) &&
      (typeof value.videoDetails?.videoId === 'string' ||
       (value.streamingData && value.playabilityStatus));
  }

  function stripPlayerAds(value) {
    if (!value || typeof value !== 'object') return value;
    if (isPlayer(value)) {
      for (const key of AD_KEYS) {
        if (Object.hasOwn(value, key)) Reflect.deleteProperty(value, key);
      }
    }
    if (value.playerResponse && value.playerResponse !== value) stripPlayerAds(value.playerResponse);
    if (value.response?.playerResponse) stripPlayerAds(value.response.playerResponse);
    return value;
  }

  // Initial watch-page data is assigned by YouTube's own bootstrap scripts.
  function watchGlobal(name) {
    const descriptor = Object.getOwnPropertyDescriptor(window, name);
    if (descriptor && !descriptor.configurable) {
      if (enabled) stripPlayerAds(window[name]);
      return;
    }
    if (descriptor?.get || descriptor?.set) return;
    let value = descriptor?.value;
    if (enabled) stripPlayerAds(value);
    Object.defineProperty(window, name, {
      configurable: true, enumerable: descriptor?.enumerable ?? true,
      get() { return value; },
      set(next) { value = enabled ? stripPlayerAds(next) : next; }
    });
  }

  watchGlobal('ytInitialPlayerResponse');

  // YouTube may parse a subsequent player response during in-page navigation.
  const nativeParse = JSON.parse;
  JSON.parse = function(...args) {
    const parsed = Reflect.apply(nativeParse, this, args);
    const source = args[0];
    if (enabled && typeof source === 'string' &&
        AD_KEYS.some(key => source.includes(`"${key}"`))) stripPlayerAds(parsed);
    return parsed;
  };

  // Response.json() uses the browser's parser and bypasses the JS JSON.parse hook.
  if (typeof Response !== 'undefined' && typeof Response.prototype.json === 'function') {
    const nativeResponseJson = Response.prototype.json;
    Response.prototype.json = function(...args) {
      const result = Reflect.apply(nativeResponseJson, this, args);
      let path;
      try {
        const url = new URL(this.url);
        if (url.protocol === 'https:' &&
            (url.hostname === 'www.youtube.com' || url.hostname === 'm.youtube.com') &&
            /^\/youtubei\/v1\/(?:player|get_watch)$/.test(url.pathname)) path = true;
      } catch { /* A non-URL response is not a YouTube player response. */ }
      return path ? result.then(data => enabled ? stripPlayerAds(data) : data) : result;
    };
  }

  // The isolated content script forwards local settings. No browsing data leaves
  // the page, and changing settings takes effect on an already-open tab.
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.source === 'BrowserGuard' && event.data?.type === 'YOUTUBE_AD_FILTER' &&
        typeof event.data.enabled === 'boolean') enabled = event.data.enabled;
  });
})();
