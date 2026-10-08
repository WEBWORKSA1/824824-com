#!/usr/bin/env python3
"""Static QA for the built site: links, anchors, assets, ids, inbox exposure, front matter. Run after build.py."""
import re, sys, json
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "_site"
problems = []
# Binary images are uploaded separately (see README); they may be absent from a fresh build.
PENDING_UPLOADS = {"assets/img/apple-touch-icon.png", "assets/img/og-image.png", "assets/img/icon-192.png", "assets/img/icon-512.png"}

class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []; self.ids = []; self.srcs = []; self.h1 = 0; self.title = ""; self._t = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"): self.ids.append(a["id"])
        if tag == "a" and a.get("href"): self.links.append(a["href"])
        if tag in ("script", "img", "iframe") and a.get("src"): self.srcs.append(a["src"])
        if tag == "link" and a.get("href"): self.srcs.append(a["href"])
        if tag == "h1": self.h1 += 1
        if tag == "title": self._t = True
    def handle_endtag(self, tag):
        if tag == "title": self._t = False
    def handle_data(self, d):
        if self._t: self.title += d

pages = {}
for f in sorted(SITE.glob("*.html")):
    p = P(); p.feed(f.read_text(encoding="utf-8")); pages[f.name] = p

for name, p in pages.items():
    if p.h1 != 1: problems.append(f"{name}: {p.h1} h1 elements")
    dup = {i for i in p.ids if p.ids.count(i) > 1}
    if dup: problems.append(f"{name}: duplicate ids {sorted(dup)}")
    if len(p.title) > 75: problems.append(f"{name}: long title ({len(p.title)})")
    for href in p.links:
        if href.startswith(("http://", "https://", "mailto:", "tel:")) or href in ("#",): continue
        path, _, frag = href.partition("#")
        path = path.split("?")[0]
        target = name if not path else path
        if not (SITE / target).exists():
            problems.append(f"{name}: broken link {href}"); continue
        if frag and target.endswith(".html"):
            tp = pages.get(target)
            if tp and frag not in tp.ids: problems.append(f"{name}: missing anchor #{frag} in {target}")
    for src in p.srcs:
        if src.startswith(("http", "data:")) or src.split("?")[0] in PENDING_UPLOADS: continue
        if not (SITE / src.split("?")[0]).exists(): problems.append(f"{name}: missing asset {src}")

# inbox must never appear in plain text anywhere in source or output
needles = [chr(103)+"mail", "@"+"g"+"mail", "webworksa1"+chr(64)]
for base in (ROOT,):
    for f in base.rglob("*"):
        if not f.is_file() or ".git" in f.parts or f.suffix in (".png", ".woff2"): continue
        try: t = f.read_text(encoding="utf-8")
        except Exception: continue
        for n in needles:
            if n.lower() in t.lower(): problems.append(f"inbox exposure: {f.relative_to(ROOT)} contains '{n}'")

# required on every page
for name in pages:
    t = (SITE / name).read_text(encoding="utf-8")
    if "web.works/contact" not in t: problems.append(f"{name}: missing partner bar")
    if name != "404.html" and 'rel="canonical"' not in t: problems.append(f"{name}: no canonical")
    if "{%" in t or "{{" in t: problems.append(f"{name}: unrendered template tag")
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
        try: json.loads(m.group(1))
        except Exception as e: problems.append(f"{name}: bad JSON-LD {e}")

print(f"Checked {len(pages)} pages.")
if problems:
    print("\n".join(problems)); sys.exit(1)
print("No problems found.")
