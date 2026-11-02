// Shared site behaviour: mobile navigation, theme switch, current year,
// clipboard helper.

const nav = document.querySelector('.nav');
const toggle = document.querySelector('.nav-toggle');
if (nav && toggle) {
  toggle.addEventListener('click', () => {
    const open = nav.dataset.open !== 'true';
    nav.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) { nav.dataset.open = 'false'; toggle.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.dataset.open === 'true') {
      nav.dataset.open = 'false'; toggle.setAttribute('aria-expanded', 'false'); toggle.focus();
    }
  });
}

for (const node of document.querySelectorAll('[data-year]')) node.textContent = String(new Date().getFullYear());

// Theme switch. The palette itself is applied in <head> by theme.js; this only
// flips it and keeps the button's pressed state in step.
const themeButton = document.querySelector('[data-theme-toggle]');
if (themeButton && window.bgTheme) {
  const syncThemeButton = () => {
    const dark = window.bgTheme.current() === 'dark';
    const next = dark ? 'light' : 'dark';
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.setAttribute('title', `Switch to ${next} theme`);
    // aria-label wins over title for screen readers, so both have to move.
    themeButton.setAttribute('aria-label', `Switch to ${next} theme`);
  };
  syncThemeButton();
  themeButton.addEventListener('click', () => {
    window.bgTheme.set(window.bgTheme.current() === 'dark' ? 'light' : 'dark');
    syncThemeButton();
  });
}

export async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      const original = button.dataset.label || button.textContent;
      button.dataset.label = original;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = original; }, 1400);
    }
    return true;
  } catch {
    return false;
  }
}
