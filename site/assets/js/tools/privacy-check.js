// Reads the signals a website can obtain without asking permission, and explains
// which ones are identifying. Nothing is transmitted: there is no network call here.

const $ = id => document.getElementById(id);

function webglInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR);
    const renderer = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    return {vendor: String(vendor), renderer: String(renderer)};
  } catch { return null; }
}

async function canvasSignature() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 40;
    const context = canvas.getContext('2d');
    context.textBaseline = 'top';
    context.font = '16px "Segoe UI", Arial, sans-serif';
    context.fillStyle = '#2f6bff';
    context.fillRect(0, 0, 220, 40);
    context.fillStyle = '#ffffff';
    context.fillText('BrowserGuard fingerprint', 6, 10);
    context.fillStyle = 'rgba(255,255,255,.45)';
    context.beginPath();
    context.arc(190, 20, 14, 0, Math.PI * 2);
    context.fill();
    const data = canvas.toDataURL();
    if (!crypto?.subtle) return null;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return [...new Uint8Array(digest)].slice(0, 8).map(byte => byte.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

function fontCount() {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;left:-9999px;font-size:72px;white-space:nowrap';
  probe.textContent = 'mmmmmmmmmmlli';
  document.body.append(probe);
  const baseline = probe.getBoundingClientRect().width;
  const fonts = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Tahoma', 'Trebuchet MS',
    'Comic Sans MS', 'Impact', 'Segoe UI', 'Calibri', 'Cambria', 'Consolas', 'Helvetica Neue', 'Gill Sans',
    'Futura', 'Menlo', 'Monaco', 'Ubuntu', 'Roboto', 'Noto Sans', 'DejaVu Sans'];
  let count = 0;
  for (const font of fonts) {
    probe.style.fontFamily = `"${font}", monospace`;
    if (Math.abs(probe.getBoundingClientRect().width - baseline) > 0.5) count++;
  }
  probe.remove();
  return {count, total: fonts.length};
}

async function collect() {
  const nav = navigator;
  const gl = webglInfo();
  const fonts = fontCount();
  const canvas = await canvasSignature();
  const memory = navigator.deviceMemory;
  const signals = [
    ['Browser & version', nav.userAgent, 'Reveals your browser and operating system. Standard, and needed for compatibility.'],
    ['Operating system', (nav.userAgentData?.platform) || nav.platform || 'not reported', 'Narrows your device to a platform family.'],
    ['Languages', (nav.languages || [nav.language]).join(', '), 'Language list is fairly distinctive when combined with region.'],
    ['Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'not reported', 'Can imply your country or region without asking.'],
    ['Screen', `${screen.width} × ${screen.height} (${screen.colorDepth}-bit)`, 'Window and screen size are surprisingly identifying in combination.'],
    ['Viewport', `${window.innerWidth} × ${window.innerHeight} at ${Math.round(window.devicePixelRatio * 100) / 100}× pixel ratio`, 'Changes as you resize, which makes it a weaker but constant signal.'],
    ['CPU threads', nav.hardwareConcurrency ? String(nav.hardwareConcurrency) : 'not reported', 'A coarse hardware hint.'],
    ['Device memory', memory ? `${memory} GB (approx.)` : 'not reported', 'Only exposed by some browsers.'],
    ['Touch support', String(nav.maxTouchPoints || 0), 'Helps tell a phone or tablet from a desktop.'],
    ['Graphics card', gl ? `${gl.vendor} · ${gl.renderer}` : 'not available', 'One of the most identifying signals when exposed.'],
    ['Installed fonts', `${fonts.count} of ${fonts.total} common fonts detected`, 'The exact font set is a classic fingerprint component.'],
    ['Canvas signature', canvas ? `${canvas}…` : 'not available', 'Rendering differences make a short hash that can survive cookie clearing.'],
    ['Cookies enabled', String(nav.cookieEnabled), 'Whether the browser will accept stored state.'],
    ['Do Not Track', nav.doNotTrack || 'not set', 'Largely ignored, but it is readable and adds to the fingerprint.']
  ];
  return signals.filter(([, value]) => value !== undefined && value !== null);
}

const ICONS = {
  good: '<path d="M20 6 9 17l-5-5"/>',
  warn: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>'
};

async function render() {
  const list = $('signals');
  const summary = $('summary');
  list.replaceChildren();
  let signals;
  try {
    signals = await collect();
  } catch (error) {
    $('summary-title').textContent = 'Could not read your browser signals';
    $('summary-meta').textContent = error.message;
    return;
  }

  for (const [label, value, explanation] of signals) {
    const group = document.createElement('div');
    group.className = 'signal';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    const small = document.createElement('small');
    small.textContent = explanation;
    dd.append(small);
    group.append(dt, dd);
    list.append(group);
  }

  const identifying = ['Graphics card', 'Canvas signature', 'Installed fonts', 'Screen', 'Timezone', 'Languages'];
  const exposed = signals.filter(([label]) => identifying.includes(label) && !/not available/i.test(signals.find(entry => entry[0] === label)?.[1] ?? '')).length;
  summary.dataset.tone = exposed >= 4 ? 'warn' : 'good';
  $('summary-title').textContent = `${signals.length} signals readable · ${exposed} of ${identifying.length} strong identifying signals exposed`;
  $('summary-meta').textContent = exposed >= 4
    ? 'In combination, these are often enough to recognise a returning browser without cookies.'
    : 'This browser exposes fewer identifying values than usual, or some are limited by your settings.';
  summary.querySelector('.v-icon').innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[summary.dataset.tone === 'warn' ? 'warn' : 'good']}</svg>`;
}

$('refresh').addEventListener('click', render);
render();
