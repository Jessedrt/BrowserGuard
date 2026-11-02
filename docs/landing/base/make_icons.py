"""Builds the BrowserGuard icon-concepts SVG sources and renders PNGs.

Requires: pip install resvg-py
Output: docs/landing/04-*.png and docs/landing/base/icon-*.svg
"""
import os
import resvg_py

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

SHIELD = ("M256 92 C300 116 348 136 400 152 L400 268 C400 340 340 398 256 426 "
          "C172 398 112 340 112 268 L112 152 C164 136 212 116 256 92 Z")
CHECK = "M190 264 L238 312 L330 218"

DEFS = """
<defs>
  <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#3B78FF"/><stop offset="1" stop-color="#1747D6"/>
  </linearGradient>
  <linearGradient id="steel" x1="0.2" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#EAF1FF"/>
    <stop offset="1" stop-color="#C9D9FA"/>
  </linearGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0F2257" flood-opacity="0.28"/>
  </filter>
  <filter id="inner" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="#1747D6" flood-opacity="0.45"/>
  </filter>
</defs>
"""

# A — flat, exact match to the shipped brand mark
A = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect width="512" height="512" rx="112" fill="#2F6BFF"/>
<path d="{SHIELD}" transform="translate(256 258) scale(0.70) translate(-256 -258)"
      fill="none" stroke="#FFFFFF" stroke-width="43" stroke-linejoin="round"/>
<path d="{CHECK}" transform="translate(256 262) scale(0.70) translate(-256 -262)"
      fill="none" stroke="#FFFFFF" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
</svg>"""

# B — soft 3D / dimensional
B = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
{DEFS}
<rect width="512" height="512" rx="118" fill="url(#blue)"/>
<rect width="512" height="512" rx="118" fill="url(#gloss)"/>
<g filter="url(#inner)">
  <path d="{SHIELD}" transform="translate(256 252) scale(0.72) translate(-256 -256)"
        fill="url(#steel)" stroke="#D7E4FF" stroke-width="6" stroke-linejoin="round"/>
</g>
<path d="{SHIELD}" transform="translate(256 248) scale(0.72) translate(-256 -256)"
      fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round" opacity="0.9"/>
<path d="{CHECK}" transform="translate(256 252) scale(0.72) translate(-256 -256)"
      fill="none" stroke="#2258E8" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
</svg>"""

# C — outlined / light background
C = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect width="512" height="512" rx="112" fill="#FFFFFF"/>
<rect x="4" y="4" width="504" height="504" rx="108" fill="none" stroke="#D6E2FA" stroke-width="8"/>
<path d="{SHIELD}" transform="translate(256 258) scale(0.70) translate(-256 -256)"
      fill="none" stroke="#2F6BFF" stroke-width="34" stroke-linejoin="round"/>
<path d="{CHECK}" transform="translate(256 262) scale(0.70) translate(-256 -256)"
      fill="none" stroke="#2F6BFF" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
</svg>"""

# D — dark navy, for dark UI / favicon on light chrome
D = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
{DEFS}
<rect width="512" height="512" rx="118" fill="#0F2257"/>
<rect width="512" height="512" rx="118" fill="url(#gloss)" opacity="0.35"/>
<path d="{SHIELD}" transform="translate(256 258) scale(0.72) translate(-256 -256)"
      fill="#2F6BFF"/>
<path d="{SHIELD}" transform="translate(256 258) scale(0.72) translate(-256 -256)"
      fill="none" stroke="#6C93FF" stroke-width="8" stroke-linejoin="round"/>
<path d="{CHECK}" transform="translate(256 262) scale(0.72) translate(-256 -256)"
      fill="none" stroke="#FFFFFF" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
</svg>"""

VARIANTS = {"A": A, "B": B, "C": C, "D": D}

for key, svg in VARIANTS.items():
    with open(os.path.join(HERE, f"icon-{key}.svg"), "w", encoding="utf-8") as fh:
        fh.write(svg)
    open(os.path.join(OUT, f"04-icon-{key}.png"), "wb").write(
        resvg_py.svg_to_bytes(svg_string=svg, width=1024, height=1024))
    for px in (16, 32, 48, 128):
        open(os.path.join(HERE, f"icon-{key}-{px}.png"), "wb").write(
            resvg_py.svg_to_bytes(svg_string=svg, width=px, height=px))
    print("rendered", key)
