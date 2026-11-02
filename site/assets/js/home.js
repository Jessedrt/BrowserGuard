// Homepage quick-check: hands the pasted value to the link checker page, which
// performs the analysis. Nothing is sent to a server.
import './site.js';

const form = document.getElementById('quick-check');
if (form) {
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = document.getElementById('quick-url').value.trim();
    if (!value) return;
    location.href = `tools/link-checker?url=${encodeURIComponent(value)}`;
  });
}
