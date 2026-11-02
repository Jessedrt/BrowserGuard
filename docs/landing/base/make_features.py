"""Draws the four 'What it checks' feature icons as SVG and renders PNGs.

Requires: pip install resvg-py
Output: docs/landing/base/feature-*.png (640 px) and base/feature-*.svg
"""
import os
import resvg_py

HERE = os.path.dirname(os.path.abspath(__file__))

HEAD = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640">
<defs>
  <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F4F8FF"/><stop offset="1" stop-color="#E7F0FF"/>
  </linearGradient>
  <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#3B78FF"/><stop offset="1" stop-color="#1C4FD8"/>
  </linearGradient>
  <filter id="soft" x="-25%" y="-25%" width="150%" height="150%">
    <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#2F6BFF" flood-opacity="0.16"/>
  </filter>
</defs>
<rect width="640" height="640" rx="40" fill="url(#tile)"/>
<circle cx="320" cy="320" r="196" fill="#FFFFFF" filter="url(#soft)"/>
<circle cx="320" cy="320" r="196" fill="none" stroke="#D9E6FD" stroke-width="3"/>
<circle cx="320" cy="320" r="196" fill="none" stroke="#2F6BFF" stroke-width="3"
        stroke-dasharray="2 26" stroke-linecap="round" opacity="0.45"/>
"""
TAIL = "</svg>"

STROKE = 'fill="none" stroke="#2258E8" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"'

# 1. URL analysis — address bar inspected with a magnifier
url = f"""
<g {STROKE}>
  <rect x="150" y="204" width="340" height="88" rx="26"/>
  <rect x="182" y="234" width="26" height="24" rx="7"/>
  <path d="M187 234 v-7 a8 8 0 0 1 16 0 v7"/>
  <path d="M246 236 h104"/><path d="M246 260 h168"/>
</g>
<circle cx="336" cy="384" r="76" fill="#FFFFFF" stroke="#2258E8" stroke-width="15"/>
<path d="M394 440 L444 490" stroke="#2258E8" stroke-width="21" stroke-linecap="round"/>
<path d="M300 356 a46 46 0 0 1 24 -20" fill="none" stroke="#8FB0FF" stroke-width="10" stroke-linecap="round"/>
<path d="M316 384 h40" stroke="#2258E8" stroke-width="13" stroke-linecap="round"/>
"""

# 2. Malware feed — subscribed threat list held inside a shield
feed = f"""
<path d="M320 158 C368 184 420 202 462 216 L462 320 C462 392 398 444 320 470
         C242 444 178 392 178 320 L178 216 C220 202 272 184 320 158 Z"
      fill="#FFFFFF" stroke="#2258E8" stroke-width="15" stroke-linejoin="round"/>
<g fill="none" stroke="#2258E8" stroke-width="13" stroke-linecap="round">
  <path d="M282 268 h150"/><path d="M282 316 h150"/><path d="M282 364 h104"/>
</g>
<g fill="#8FB0FF">
  <circle cx="252" cy="268" r="11"/><circle cx="252" cy="316" r="11"/><circle cx="252" cy="364" r="11"/>
</g>
"""

# 3. Ad blocking — ad slot with a prohibition badge
adblock = f"""
<g {STROKE}>
  <rect x="150" y="196" width="340" height="196" rx="24"/>
  <path d="M186 240 h268"/>
  <path d="M186 292 h188"/>
  <path d="M186 340 h120"/>
</g>
<circle cx="436" cy="404" r="86" fill="#FFFFFF"/>
<circle cx="436" cy="404" r="70" fill="none" stroke="#2258E8" stroke-width="17"/>
<path d="M386 354 L486 454" stroke="#2258E8" stroke-width="17" stroke-linecap="round"/>
"""

# 4. Warning page — window with an alert triangle
warn = f"""
<g {STROKE}>
  <rect x="150" y="182" width="340" height="270" rx="26"/>
  <path d="M150 240 H490"/>
  <circle cx="192" cy="211" r="1"/>
</g>
<circle cx="192" cy="211" r="9" fill="#2258E8"/>
<circle cx="226" cy="211" r="9" fill="#8FB0FF"/>
<circle cx="260" cy="211" r="9" fill="#8FB0FF"/>
<path d="M320 290 L382 396 H258 Z" fill="#FFF3E0" stroke="#B36A00" stroke-width="13" stroke-linejoin="round"/>
<path d="M320 328 v34" stroke="#B36A00" stroke-width="15" stroke-linecap="round"/>
<circle cx="320" cy="380" r="9" fill="#B36A00"/>
"""

ICONS = {"url-analysis": url, "malware-feed": feed, "ad-blocking": adblock, "warning-page": warn}

for name, body in ICONS.items():
    svg = HEAD + body + TAIL
    open(os.path.join(HERE, f"feature-{name}.svg"), "w", encoding="utf-8").write(svg)
    open(os.path.join(HERE, f"feature-{name}.png"), "wb").write(
        resvg_py.svg_to_bytes(svg_string=svg, width=640, height=640))
    print("rendered", name)
