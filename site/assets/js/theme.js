// Theme: light or dark, remembered per browser, defaulting to the OS setting.
// Loaded from <head> (not deferred) so the first paint is already the right
// palette — a deferred script would flash the other theme first. The site CSP
// only allows 'self' scripts, so this has to live in a file like this one.
(function () {
  var KEY = 'bg-theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function stored() {
    try {
      var value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (error) {
      return null; // storage can be blocked; the OS preference is enough
    }
  }

  function systemTheme() { return media && media.matches ? 'dark' : 'light'; }
  function apply(theme) { root.setAttribute('data-theme', theme); }

  window.bgTheme = {
    current: function () { return root.getAttribute('data-theme') || systemTheme(); },
    set: function (theme) {
      apply(theme);
      try { localStorage.setItem(KEY, theme); } catch (error) { /* private mode */ }
    }
  };

  apply(stored() || systemTheme());

  // Until the visitor picks a theme, follow the OS when it changes mid-session.
  if (media && media.addEventListener) {
    media.addEventListener('change', function (event) {
      if (!stored()) apply(event.matches ? 'dark' : 'light');
    });
  }
})();
