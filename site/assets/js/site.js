// Shared site behaviour: mobile navigation, current year, clipboard helper.

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
