#!/usr/bin/env python3
"""824824.com static site generator.

    python3 build.py                # build the site into _site/
    python3 build.py --render-png   # also render PNG icons + social image (needs rsvg-convert)

Content lives in src/ (pages, guides, data). Styles and scripts live in assets/.
Site-wide settings: site.json. Runtime settings (ad slots, YouTube, donation links):
assets/js/config.js. The output in _site/ is what GitHub Pages serves (gh-pages branch).
"""
import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

import yaml

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "_site"
CFG = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
SITE_URL = (os.environ.get("SITE_URL") or CFG["site_url"]).rstrip("/")
CUSTOM_DOMAIN = os.environ.get("CUSTOM_DOMAIN", CFG.get("custom_domain", "")).strip()
BASE_PATH = (urlparse(SITE_URL).path.rstrip("/") or "") + "/"
ADS_CLIENT = CFG["adsense_client"]
YEAR = dt.date.today().year

esc = html.escape

# ---------------------------------------------------------------- data

CATS = {
    "pay": {"name": "Pay and overtime", "code": "eve"},
    "time": {"name": "Time math", "code": "day"},
    "schedule": {"name": "Schedules and staffing", "code": "night"},
    "health": {"name": "Sleep and health", "code": "rest"},
}

TOOLS = [
    ("time-card-calculator", "Time card calculator", "pay", "card",
     "Weekly or bi-weekly time cards with breaks, overnight shifts, rounding, overtime and pay."),
    ("overtime-calculator", "Overtime calculator", "pay", "overtime",
     "Overtime pay with the correct regular rate when differentials or bonuses apply."),
    ("shift-differential-calculator", "Shift differential calculator", "pay", "moonpay",
     "Evening, night and weekend premiums, flat or percentage, per shift and per year."),
    ("hourly-salary-converter", "Hourly and salary converter", "pay", "convert",
     "Hourly, weekly, bi-weekly, monthly and annual pay, including 12-hour rotations."),
    ("hours-calculator", "Hours calculator", "time", "hourglass",
     "Hours between two times or dates, add or subtract time, and add up a list of shifts."),
    ("decimal-hours-converter", "Decimal hours converter", "time", "decimal",
     "Hours and minutes to decimal hours for payroll, and back again."),
    ("military-time-converter", "Military time converter", "time", "clock24",
     "24-hour and 12-hour time, how to say it out loud, and a full chart."),
    ("printable-timesheet", "Printable timesheet", "time", "print",
     "A clean weekly or bi-weekly timesheet to fill in by hand and print."),
    ("shift-pattern-generator", "Shift pattern generator", "schedule", "rotate",
     "Turn 2-2-3, DuPont, Panama, 4-on-4-off, 24/48 and more into a calendar you can export."),
    ("staffing-calculator", "24/7 staffing calculator", "schedule", "people",
     "How many people it takes to cover every hour, with absences and overtime built in."),
    ("night-shift-sleep-planner", "Night shift sleep planner", "health", "moon",
     "A sleep, nap, light and caffeine plan built around your exact shift."),
]
TOOL_BY_SLUG = {t[0]: t for t in TOOLS}

GUIDE_CATS = {
    "Pay & Law": "eve",
    "Schedules": "night",
    "Health & Sleep": "rest",
    "Time Math": "day",
    "History": "hist",
}

MORE_LINKS = [
    ("about.html", "About 824824"),
    ("what-does-824-mean.html", "What 824 means"),
    ("support.html", "Support us"),
    ("advertise.html", "Advertise and sponsor"),
    ("careers.html", "Careers and contributors"),
    ("contact.html", "Contact"),
]

INVOLVED_LINKS = [
    ("get-matched.html", "Get matched with software"),
    ("job-alerts.html", "Shift job alerts"),
    ("contests.html", "Monthly contest"),
    ("support.html", "Support us"),
    ("advertise.html", "Advertise and sponsor"),
    ("careers.html", "Careers and contributors"),
]

COMPANY_LINKS = [
    ("about.html", "About"),
    ("what-does-824-mean.html", "What 824 means"),
    ("contact.html", "Contact"),
    ("privacy.html", "Privacy policy"),
    ("terms.html", "Terms of use"),
    ("disclaimer.html", "Disclaimer and trademarks"),
]

# ---------------------------------------------------------------- icons

ICON_PATHS = {
    "card": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/><circle cx="16.5" cy="16.5" r="1.2"/>',
    "overtime": '<circle cx="11" cy="13" r="7.5"/><path d="M11 9v4l2.5 1.6M19 2.5v5M16.5 5h5"/>',
    "moonpay": '<path d="M14.5 3.5a8 8 0 1 0 6 11.3A7 7 0 0 1 14.5 3.5z"/><path d="M8.5 10.5v6M6.8 12.2h3.4M6.8 14.8h3.4"/>',
    "convert": '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
    "hourglass": '<path d="M6 3h12M6 21h12M7.5 3v2.8a4.5 4.5 0 0 0 9 0V3M7.5 21v-2.8a4.5 4.5 0 0 1 9 0V21"/>',
    "decimal": '<path d="M5 6.5 7 5v14M11 19h.01M14.5 5h4.5M14.5 5l-.5 5.5c1-.9 2-1.2 3-1.2a3.4 3.4 0 0 1 0 6.9c-1.3 0-2.4-.6-3-1.7"/>',
    "clock24": '<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l3.5 2"/><path d="M12 3v1.5M21 12h-1.5M12 21v-1.5M3 12h1.5"/>',
    "print": '<path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
    "rotate": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17.5h2"/>',
    "people": '<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 14.4A4.6 4.6 0 0 1 21 19"/>',
    "moon": '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    "search": '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    "theme": '<path d="M12 3a9 9 0 1 0 0 18z" fill="currentColor"/><circle cx="12" cy="12" r="9"/>',
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "close": '<path d="M6 6l12 12M18 6 6 18"/>',
    "chev": '<path d="m7 10 5 5 5-5"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    "out": '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    "check": '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    "play": '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    "link": '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
}


def icon(name, cls="icon"):
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" '
            f'focusable="false">{ICON_PATHS[name]}</svg>')


# The 824824 mark: a 24-hour ring with the 8-hour arc lit (one third of the day).
LOGO = ('<svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">'
        '<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="4.5"/>'
        '<path d="M16 5a11 11 0 0 1 9.53 16.5" fill="none" stroke="var(--amber)" stroke-width="4.5" stroke-linecap="round"/>'
        '<circle cx="16" cy="16" r="2.2" fill="currentColor"/></svg>')

# ---------------------------------------------------------------- source parsing

FM_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.S)


def read_source(path):
    text = path.read_text(encoding="utf-8")
    m = FM_RE.match(text)
    if not m:
        raise SystemExit(f"{path}: missing front matter")
    meta = yaml.safe_load(m.group(1)) or {}
    meta.setdefault("slug", path.stem)
    meta["_path"] = path
    return meta, text[m.end():]


def fmt_date(value):
    if isinstance(value, str):
        value = dt.date.fromisoformat(value)
    return f"{value:%B} {value.day}, {value.year}"


def iso_date(value):
    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat()[:10]
    return str(value)[:10]


def abs_url(slug):
    return f"{SITE_URL}/" if slug == "index" else f"{SITE_URL}/{slug}.html"


def page_href(slug):
    return "index.html" if slug == "index" else f"{slug}.html"


# ---------------------------------------------------------------- includes (shortcodes)

def inc_ad(p, ctx):
    if not ctx.get("ads", True):
        return ""
    slot = p.get("slot", "in-article")
    return f'<aside class="ad-slot ad-{esc(slot)}" data-ad="{esc(slot)}" aria-label="Advertisement"></aside>'


CTA_COPY = {
    "business": (
        "Scheduling people around the clock?",
        "Answer five quick questions and get a free shortlist of scheduling, time-clock and payroll software "
        "that fits your team size and budget. No obligation, and you decide who contacts you.",
        "get-matched.html", "Get my free shortlist"),
    "worker": (
        "Want shifts that fit your life?",
        "Get free alerts for jobs that match your role, preferred shifts and pay. No account needed, and you can "
        "unsubscribe any time.",
        "job-alerts.html", "Set up job alerts"),
}


def inc_cta(p, ctx):
    kind = p.get("kind", "business")
    title, text, href, label = CTA_COPY[kind]
    return (f'<div class="cta-inline cta-{kind}"><div><p class="cta-title">{title}</p><p>{text}</p></div>'
            f'<a class="btn btn-primary" href="{href}">{label}</a></div>')


INDUSTRIES = [
    ("healthcare", "Healthcare and long-term care"),
    ("restaurants", "Restaurants and food service"),
    ("retail", "Retail"),
    ("hospitality", "Hotels and hospitality"),
    ("manufacturing", "Manufacturing"),
    ("warehouse", "Warehouse and logistics"),
    ("security", "Security"),
    ("other", "Something else"),
]


def inc_lead_band(p, ctx):
    heading = p.get("heading", "Running a team that never clocks out?")
    buttons = "\n".join(
        f'<li><a class="pick" href="get-matched.html?industry={k}">{v}</a></li>' for k, v in INDUSTRIES)
    return f'''<section class="lead-band" aria-labelledby="lead-band-title">
<div class="wrap lead-band-inner">
<div class="lead-band-copy">
<h2 id="lead-band-title">{esc(heading)}</h2>
<p>Get a free, side-by-side shortlist of scheduling, time-clock and payroll software matched to your industry, team size and budget, plus a buyer's checklist built from your answers.</p>
<ul class="ticks">
<li>{icon("check")}Five questions, about a minute</li>
<li>{icon("check")}Free, with no obligation to buy</li>
<li>{icon("check")}You choose who contacts you</li>
</ul>
</div>
<div class="lead-band-start">
<p class="lead-band-step">Start here: which industry are you in?</p>
<ul class="pick-list">{buttons}</ul>
</div>
</div>
</section>'''


def inc_alerts_band(p, ctx):
    return f'''<section class="alerts-band" aria-labelledby="alerts-title">
<div class="wrap alerts-inner">
<div>
<h2 id="alerts-title">{esc(p.get("heading", "Shift job alerts, free"))}</h2>
<p>Nurses, care aides, cooks, warehouse crews, security officers and more: tell us the role and shifts you want, and we'll send matching openings. No account, no spam.</p>
</div>
<form class="form form-inline" data-form="job-alert-quick" data-subject="New job alert signup (quick) — 824824" data-success="You're on the list. Watch your inbox for matching shifts." novalidate>
<div class="hp" aria-hidden="true"><label>Leave this empty <input type="text" name="_honey" tabindex="-1" autocomplete="off"></label></div>
<label class="field"><span>Role</span><input name="role" type="text" list="role-list" placeholder="e.g. Registered nurse" required autocomplete="organization-title"></label>
<label class="field"><span>City or postal code</span><input name="location" type="text" required autocomplete="postal-code"></label>
<label class="field"><span>Email</span><input name="email" type="email" required autocomplete="email"></label>
<label class="check"><input type="checkbox" name="consent_alerts" value="yes" required data-consent> <span>Email me matching job alerts. I can unsubscribe at any time.</span></label>
<button class="btn btn-primary" type="submit">Create my alert</button>
<p class="form-status" role="status" aria-live="polite"></p>
</form>
</div>
</section>'''


def tool_item(slug):
    s, name, cat, ic, desc = TOOL_BY_SLUG[slug]
    return (f'<li class="roster-item code-{CATS[cat]["code"]}"><a href="{s}.html">'
            f'<span class="roster-icon">{icon(ic)}</span>'
            f'<span class="roster-text"><strong>{esc(name)}</strong><span>{esc(desc)}</span></span></a></li>')


def inc_tool_list(p, ctx):
    if p.get("group") == "yes":
        out = []
        for key, cat in CATS.items():
            items = "\n".join(tool_item(t[0]) for t in TOOLS if t[2] == key)
            out.append(f'<section class="roster-group" aria-labelledby="grp-{key}">'
                       f'<h3 id="grp-{key}" class="roster-head code-{cat["code"]}">{cat["name"]}</h3>'
                       f'<ul class="roster">{items}</ul></section>')
        return '<div class="roster-groups">' + "\n".join(out) + "</div>"
    only = p.get("only")
    slugs = only.split(",") if only else [t[0] for t in TOOLS]
    return '<ul class="roster">' + "\n".join(tool_item(s.strip()) for s in slugs) + "</ul>"


def guide_item(g):
    code = GUIDE_CATS.get(g["category"], "hist")
    return (f'<li class="guide-item code-{code}"><a href="{g["slug"]}.html">'
            f'<span class="guide-cat">{esc(g["category"])}</span>'
            f'<strong>{esc(g["h1"])}</strong>'
            f'<span class="guide-desc">{esc(g["description"])}</span>'
            f'<span class="guide-time">{g["read_min"]} min read</span></a></li>')


def inc_guide_list(p, ctx):
    guides = ctx["guides"]
    if p.get("category"):
        guides = [g for g in guides if g["category"] == p["category"]]
    limit = int(p.get("limit", 0) or 0)
    if limit:
        guides = guides[:limit]
    return '<ul class="guide-list">' + "\n".join(guide_item(g) for g in guides) + "</ul>"


def video_figure(v):
    vid = esc(v["id"])
    return (f'<figure class="video"><button class="yt" type="button" data-yt="{vid}" '
            f'aria-label="Play video: {esc(v["title"])}">'
            f'<img src="https://i.ytimg.com/vi/{vid}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360">'
            f'<span class="yt-play">{icon("play")}</span></button>'
            f'<figcaption><strong>{esc(v["title"])}</strong><span>{esc(v["channel"])}</span></figcaption></figure>')


def inc_video_grid(p, ctx):
    videos = ctx["videos"]
    if p.get("topic"):
        videos = [v for v in videos if v["topic"] == p["topic"]]
    if p.get("ids"):
        wanted = [i.strip() for i in p["ids"].split(",")]
        videos = [v for i in wanted for v in ctx["videos"] if v["id"] == i]
    limit = int(p.get("limit", 0) or 0)
    if limit:
        videos = videos[:limit]
    return '<div class="video-grid">' + "\n".join(video_figure(v) for v in videos) + "</div>"


def inc_newsletter(p, ctx):
    return f'''<form class="form form-newsletter" data-form="newsletter" data-subject="New newsletter signup — 824824" data-success="You're subscribed. The next issue lands in your inbox." novalidate>
<div class="hp" aria-hidden="true"><label>Leave this empty <input type="text" name="_honey" tabindex="-1" autocomplete="off"></label></div>
<label class="field"><span>Email</span><input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label>
<label class="field"><span>I mostly</span><select name="audience"><option>Work shifts</option><option>Schedule or manage shift workers</option><option>Both</option></select></label>
<label class="check"><input type="checkbox" name="consent_newsletter" value="yes" required data-consent> <span>Send me {esc(p.get("name", "The 8/24 Brief"))}, about two emails a month. Unsubscribe any time.</span></label>
<button class="btn btn-primary" type="submit">Subscribe</button>
<p class="form-status" role="status" aria-live="polite"></p>
</form>'''


def inc_share(p, ctx):
    return f'''<div class="share" data-share>
<span class="share-label">Share</span>
<button type="button" class="chip" data-share-native>{icon("out")}Share</button>
<button type="button" class="chip" data-share-copy>{icon("link")}Copy link</button>
<a class="chip" data-share-to="whatsapp" href="#" target="_blank" rel="noopener">WhatsApp</a>
<a class="chip" data-share-to="facebook" href="#" target="_blank" rel="noopener">Facebook</a>
<a class="chip" data-share-to="linkedin" href="#" target="_blank" rel="noopener">LinkedIn</a>
<a class="chip" data-share-to="x" href="#" target="_blank" rel="noopener">X</a>
</div>'''


def inc_mail(p, ctx):
    label = esc(p.get("label", "Email us"))
    subject = esc(p.get("subject", "Hello from 824824.com"))
    cls = esc(p.get("class", "mail-link"))
    return f'<a class="{cls}" href="contact.html" data-mail data-subject="{subject}">{icon("mail")}{label}</a>'


def inc_icon(p, ctx):
    return icon(p.get("name", "check"))


INCLUDES = {
    "ad.html": inc_ad,
    "cta-inline.html": inc_cta,
    "lead-band.html": inc_lead_band,
    "alerts-band.html": inc_alerts_band,
    "tool-list.html": inc_tool_list,
    "guide-list.html": inc_guide_list,
    "video-grid.html": inc_video_grid,
    "newsletter.html": inc_newsletter,
    "share.html": inc_share,
    "mail.html": inc_mail,
    "icon.html": inc_icon,
}
INC_RE = re.compile(r"\{%\s*include\s+([\w\-.]+)\s*(.*?)\s*%\}")
ATTR_RE = re.compile(r'(\w+)="([^"]*)"')


def render_includes(body, ctx):
    def repl(m):
        fn = INCLUDES.get(m.group(1))
        if not fn:
            raise SystemExit(f"{ctx['slug']}: unknown include {m.group(1)}")
        return fn(dict(ATTR_RE.findall(m.group(2))), ctx)
    return INC_RE.sub(repl, body)


# ---------------------------------------------------------------- chrome

def head(meta, ctx):
    slug = meta["slug"]
    canonical = abs_url(slug)
    title = esc(meta["title"])
    desc = esc(meta["description"])
    robots = '<meta name="robots" content="noindex, follow">' if meta.get("noindex") else \
        '<meta name="robots" content="index, follow, max-image-preview:large">'
    base = f'<base href="{BASE_PATH}">\n' if slug == "404" else ""
    adsense = ""
    if ctx["ads"]:
        adsense = (f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADS_CLIENT}" '
                   f'crossorigin="anonymous"></script>\n')
    og_type = "article" if meta.get("layout") == "guide" else "website"
    jsonld = "".join(f'<script type="application/ld+json">{ld_dumps(obj)}</script>\n' for obj in ctx["jsonld"])
    v = ctx["ver"]
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{base}<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
{robots}
<meta name="google-adsense-account" content="{ADS_CLIENT}">
<meta name="theme-color" content="#f2f4f8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0c1229" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="824824">
<meta property="og:title" content="{esc(meta.get("og_title", meta["title"]))}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE_URL}/assets/img/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="824824 — Eight of Twenty-Four: free tools for shift workers">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;1,400&amp;family=Big+Shoulders:opsz,wght@10..72,700..900&amp;display=swap">
<link rel="stylesheet" href="assets/css/style.css?v={v}">
<script>try{{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}}catch(e){{}}</script>
{adsense}{jsonld}</head>'''


def ld_dumps(obj):
    """Compact JSON-LD with a line break between list items, so no line grows huge."""
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return text.replace('},{"@type"', '},\n{"@type"')


def partner_bar():
    return (f'<a class="partner-bar" href="{esc(CFG["partner_url"])}" target="_blank" rel="noopener">'
            f'<span>{esc(CFG["partner_text"])}</span></a>')


def header(meta):
    active = meta.get("nav", "")

    def cur(key):
        return ' aria-current="page"' if key == active else ""

    groups = []
    for key, cat in CATS.items():
        links = "\n".join(f'<li><a href="{t[0]}.html">{esc(t[1])}</a></li>' for t in TOOLS if t[2] == key)
        groups.append(f'<div class="menu-group code-{cat["code"]}"><p class="menu-head">{cat["name"]}</p><ul>{links}</ul></div>')
    tools_menu = "\n".join(groups) + '<p class="menu-foot"><a href="tools.html">All tools</a></p>'
    more = "\n".join(f'<li><a href="{h}">{esc(n)}</a></li>' for h, n in MORE_LINKS)
    return f'''<header class="site-header">
<div class="wrap header-inner">
<a class="brand" href="index.html" aria-label="824824 home">{LOGO}<span class="brand-word">824824</span><span class="brand-sub">Eight of Twenty-Four</span></a>
<nav class="main-nav" id="main-nav" aria-label="Main">
<ul class="nav-list">
<li class="has-menu"><button type="button" class="nav-btn" aria-expanded="false" aria-controls="menu-tools"{cur("tools")}>Tools{icon("chev", "icon chev")}</button>
<div class="menu menu-wide" id="menu-tools">{tools_menu}</div></li>
<li><a class="nav-link" href="guides.html"{cur("guides")}>Guides</a></li>
<li><a class="nav-link" href="videos.html"{cur("videos")}>Videos</a></li>
<li><a class="nav-link" href="contests.html"{cur("contests")}>Contests</a></li>
<li><a class="nav-link" href="job-alerts.html"{cur("alerts")}>Job alerts</a></li>
<li class="has-menu"><button type="button" class="nav-btn" aria-expanded="false" aria-controls="menu-more"{cur("more")}>More{icon("chev", "icon chev")}</button>
<div class="menu" id="menu-more"><ul>{more}</ul></div></li>
</ul>
<a class="btn btn-primary nav-cta-mobile" href="get-matched.html">Get matched</a>
</nav>
<div class="header-actions">
<button type="button" class="icon-btn" data-search-open aria-label="Search tools and guides">{icon("search")}</button>
<button type="button" class="icon-btn" data-theme-toggle aria-label="Switch between light and dark theme">{icon("theme")}</button>
<a class="btn btn-primary btn-sm header-cta" href="get-matched.html"{cur("match")}>Get matched</a>
<button type="button" class="icon-btn menu-toggle" aria-expanded="false" aria-controls="main-nav" aria-label="Open menu">{icon("menu")}</button>
</div>
</div>
</header>'''


def footer(ctx):
    tool_links = "\n".join(f'<li><a href="{t[0]}.html">{esc(t[1])}</a></li>' for t in TOOLS)
    guide_links = "\n".join(f'<li><a href="{g["slug"]}.html">{esc(g["short"])}</a></li>' for g in ctx["guides"])
    involved = "\n".join(f'<li><a href="{h}">{esc(n)}</a></li>' for h, n in INVOLVED_LINKS)
    company = "\n".join(f'<li><a href="{h}">{esc(n)}</a></li>' for h, n in COMPANY_LINKS)
    return f'''<footer class="site-footer">
<div class="wrap footer-top">
<div class="footer-brand">
<a class="brand brand-footer" href="index.html">{LOGO}<span class="brand-word">824824</span><span class="brand-sub">Eight of Twenty-Four</span></a>
<p>Free, accurate tools and plain-language guides for the people who work while others sleep, and for the managers who build their schedules.</p>
<p class="footer-mail">{inc_mail({"label": "Email us", "subject": "Hello from 824824.com"}, ctx)}</p>
</div>
<div class="footer-news">
<h2 class="footer-head">The 8/24 Brief</h2>
<p>New tools, pay and scheduling rule changes, and night-shift tips. About two emails a month.</p>
{inc_newsletter({}, ctx)}
</div>
</div>
<div class="wrap footer-cols">
<div><h2 class="footer-head">Tools</h2><ul>{tool_links}</ul></div>
<div><h2 class="footer-head">Guides</h2><ul>{guide_links}</ul></div>
<div><h2 class="footer-head">Get involved</h2><ul>{involved}</ul></div>
<div><h2 class="footer-head">Company</h2><ul>{company}</ul></div>
</div>
<div class="wrap footer-legal">
<p>&copy; {YEAR} 824824.com. Tools and guides are general information, not legal, tax, financial or medical advice. Calculator results are estimates; check them against your employment contract, collective agreement and local law.</p>
<p><strong>Trademark and copyright notice:</strong> &ldquo;824824&rdquo; is used here as a descriptive numeric domain name (8 hours of the 24-hour day). No trademark rights are claimed in the number, and 824824.com is not affiliated with, sponsored or endorsed by any company, person, team or organization that uses the numbers 8, 24, 824 or similar marks. Other product names and trademarks belong to their owners. Original text, tools and code &copy; 824824.com; embedded videos remain the property of their creators. <a href="disclaimer.html#trademark">Read the full disclosure</a>.</p>
</div>
</footer>
<dialog class="search-dialog" id="search-dialog" aria-label="Search tools and guides">
<div class="search-box">{icon("search")}<input type="search" id="search-input" placeholder="Search tools and guides" autocomplete="off" aria-controls="search-results" aria-label="Search tools and guides"><button type="button" class="icon-btn" data-search-close aria-label="Close search">{icon("close")}</button></div>
<ul class="search-results" id="search-results" role="listbox" aria-label="Results"></ul>
<p class="search-hint">Try &ldquo;overtime&rdquo;, &ldquo;DuPont&rdquo; or &ldquo;night shift&rdquo;.</p>
</dialog>
{ROLE_LIST if ctx.get("roles") else ""}'''


ROLE_LIST = '''<datalist id="role-list"><option value="Registered nurse"><option value="Licensed practical nurse"><option value="Personal support worker"><option value="Certified nursing assistant"><option value="Care aide"><option value="Paramedic"><option value="Cook"><option value="Server"><option value="Hotel front desk agent"><option value="Housekeeper"><option value="Security officer"><option value="Warehouse associate"><option value="Forklift operator"><option value="Production operator"><option value="Machine operator"><option value="Truck driver"><option value="Call center agent"><option value="Retail associate"><option value="Cleaner"><option value="Firefighter"></datalist>'''


def scripts(meta, ctx):
    v = ctx["ver"]
    tags = [f'<script src="assets/js/config.js?v={v}"></script>',
            f'<script src="assets/js/app.js?v={v}" defer></script>']
    for s in meta.get("scripts", []) or []:
        tags.append(f'<script src="assets/js/{s}.js?v={v}" defer></script>')
    return "\n".join(tags)


def breadcrumbs(trail):
    items = ['<li><a href="index.html">Home</a></li>']
    for name, href in trail[:-1]:
        items.append(f'<li><a href="{href}">{esc(name)}</a></li>')
    items.append(f'<li aria-current="page">{esc(trail[-1][0])}</li>')
    return f'<nav class="crumbs" aria-label="Breadcrumb"><ol>{"\n".join(items)}</ol></nav>'


def breadcrumb_ld(trail, slug):
    elems = [{"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE_URL}/"}]
    for i, (name, href) in enumerate(trail, start=2):
        url = abs_url(slug) if i == len(trail) + 1 else f"{SITE_URL}/{href}"
        elems.append({"@type": "ListItem", "position": i, "name": name, "item": url})
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": elems}


def faq_section(faq):
    if not faq:
        return ""
    items = "\n".join(f'<details class="faq-item"><summary>{esc(f["q"])}</summary><div class="faq-a"><p>{esc(f["a"])}</p></div></details>'
                    for f in faq)
    return f'<section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">Questions people ask</h2>{items}</section>'


def faq_ld(faq):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}} for f in faq]}


def sources_section(sources):
    if not sources:
        return ""
    items = "\n".join(f'<li><a href="{esc(s["url"])}" target="_blank" rel="noopener">{esc(s["title"])}</a></li>' for s in sources)
    return (f'<section class="sources" aria-labelledby="src-title"><h2 id="src-title">Sources</h2>'
            f'<p class="muted">We link to official and primary sources so you can check our work. Rules change; confirm anything important with the source.</p>'
            f'<ol>{items}</ol></section>')


def related_section(meta, ctx):
    tools = meta.get("related_tools") or []
    guides = meta.get("related_guides") or []
    if not tools and not guides:
        return ""
    parts = ['<section class="related" aria-labelledby="rel-title"><h2 id="rel-title">Keep going</h2><div class="related-grid">']
    if tools:
        parts.append('<div><h3 class="related-head">Tools</h3><ul class="roster roster-compact">'
                     + "\n".join(tool_item(s) for s in tools if s in TOOL_BY_SLUG) + "</ul></div>")
    if guides:
        gmap = {g["slug"]: g for g in ctx["guides"]}
        parts.append('<div><h3 class="related-head">Guides</h3><ul class="guide-list guide-list-compact">'
                     + "\n".join(guide_item(gmap[s]) for s in guides if s in gmap) + "</ul></div>")
    parts.append("</div></section>")
    return "\n".join(parts)


def org_ld():
    return {"@context": "https://schema.org", "@type": "Organization", "name": "824824",
            "alternateName": "Eight of Twenty-Four", "url": f"{SITE_URL}/",
            "logo": f"{SITE_URL}/assets/img/icon.svg"}


# ---------------------------------------------------------------- layouts

def wrap_page(meta, ctx, main_html):
    ctx["roles"] = 'list="role-list"' in main_html
    body_class = meta.get("body_class", meta.get("layout", "page"))
    no_exit = " data-no-exit" if meta.get("no_exit") else ""
    return f'''{head(meta, ctx)}
<body class="layout-{esc(body_class)}"{no_exit}>
<a class="skip" href="#main">Skip to content</a>
{partner_bar()}
{header(meta)}
<main id="main">
{main_html}
</main>
{footer(ctx)}
{scripts(meta, ctx)}
</body>
</html>
'''


def page_head_block(meta, trail=None):
    crumbs = breadcrumbs(trail) if trail else ""
    lede = f'<p class="lede">{meta["lede"]}</p>' if meta.get("lede") else ""
    return f'<div class="wrap page-head">{crumbs}\n<h1>{esc(meta.get("h1", meta["title"]))}</h1>\n{lede}</div>\n'


def layout_home(meta, body, ctx):
    return render_includes(body, ctx)


def layout_page(meta, body, ctx):
    trail = meta.get("trail") or [(meta.get("crumb", meta.get("h1", meta["title"])), page_href(meta["slug"]))]
    if meta["slug"] != "404":
        ctx["jsonld"].append(breadcrumb_ld(trail, meta["slug"]))
    content = render_includes(body, ctx)
    width = "prose-page" if meta.get("prose") else "page-body"
    inner = f'<div class="wrap {width}">{content}</div>'
    if meta.get("prose"):
        inner = f'<div class="wrap prose-wrap"><article class="prose">{content}</article></div>'
    extra = faq_section(meta.get("faq")) + sources_section(meta.get("sources"))
    if meta.get("faq"):
        ctx["jsonld"].append(faq_ld(meta["faq"]))
    extra_html = f'<div class="wrap after-article">{extra}</div>' if extra else ""
    return page_head_block(meta, trail) + inner + extra_html


def layout_hub(meta, body, ctx):
    trail = [(meta.get("crumb", meta.get("h1")), page_href(meta["slug"]))]
    ctx["jsonld"].append(breadcrumb_ld(trail, meta["slug"]))
    return page_head_block(meta, trail) + f'<div class="wrap page-body">{render_includes(body, ctx)}</div>'


def layout_tool(meta, body, ctx):
    slug = meta["slug"]
    _, name, cat, ic, desc = TOOL_BY_SLUG[slug]
    trail = [("Tools", "tools.html"), (name, page_href(slug))]
    ctx["jsonld"].append({"@context": "https://schema.org", "@type": "WebApplication", "name": meta.get("h1", name),
                          "url": abs_url(slug), "description": meta["description"],
                          "applicationCategory": "BusinessApplication", "operatingSystem": "Any",
                          "isAccessibleForFree": True,
                          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
                          "publisher": {"@type": "Organization", "name": "824824", "url": f"{SITE_URL}/"}})
    ctx["jsonld"].append(breadcrumb_ld(trail, slug))
    if meta.get("faq"):
        ctx["jsonld"].append(faq_ld(meta["faq"]))
    tool_html, _, article = body.partition("<!--article-->")
    tool_html = render_includes(tool_html, ctx)
    article = render_includes(article, ctx)
    aside_ad = inc_ad({"slot": "sidebar"}, ctx)
    kind = meta.get("cta", "business")
    title, text, href, label = CTA_COPY[kind]
    aside = f'''<aside class="tool-aside">
<div class="aside-card"><p class="cta-title">{title}</p><p>{text}</p><a class="btn btn-primary btn-block" href="{href}">{label}</a></div>
{aside_ad}
</aside>'''
    lede = f'<p class="lede">{meta["lede"]}</p>' if meta.get("lede") else ""
    return f'''<div class="wrap page-head tool-head code-{CATS[cat]["code"]}">{breadcrumbs(trail)}
<h1>{esc(meta.get("h1", name))}</h1>{lede}</div>
<div class="wrap tool-layout">
<section class="tool-main" aria-label="{esc(name)}">{tool_html}</section>
{aside}
</div>
<div class="wrap">{inc_ad({"slot": "after-tool"}, ctx)}</div>
<div class="wrap article-wrap"><article class="prose">{article}{inc_share({}, ctx)}</article></div>
<div class="wrap after-article">{faq_section(meta.get("faq"))}{sources_section(meta.get("sources"))}{related_section(meta, ctx)}</div>
{inc_lead_band({}, ctx) if kind == "business" else inc_alerts_band({}, ctx)}'''


H2_RE = re.compile(r'<h2 id="([^"]+)">(.*?)</h2>', re.S)


def layout_guide(meta, body, ctx):
    slug = meta["slug"]
    trail = [("Guides", "guides.html"), (meta["h1"], page_href(slug))]
    updated = meta.get("updated", CFG["launched"])
    ctx["jsonld"].append({"@context": "https://schema.org", "@type": "Article", "headline": meta["h1"],
                          "description": meta["description"], "datePublished": iso_date(CFG["launched"]),
                          "dateModified": iso_date(updated), "mainEntityOfPage": abs_url(slug),
                          "image": f"{SITE_URL}/assets/img/og-image.png",
                          "author": {"@type": "Organization", "name": "824824 editorial team", "url": f"{SITE_URL}/about.html"},
                          "publisher": {"@type": "Organization", "name": "824824", "url": f"{SITE_URL}/",
                                        "logo": {"@type": "ImageObject", "url": f"{SITE_URL}/assets/img/icon.svg"}}})
    ctx["jsonld"].append(breadcrumb_ld(trail, slug))
    if meta.get("faq"):
        ctx["jsonld"].append(faq_ld(meta["faq"]))
    content = render_includes(body, ctx)
    toc = "\n".join(f'<li><a href="#{hid}">{re.sub("<[^>]+>", "", text)}</a></li>' for hid, text in H2_RE.findall(content))
    code = GUIDE_CATS.get(meta["category"], "hist")
    return f'''<div class="wrap page-head guide-head code-{code}">{breadcrumbs(trail)}
<p class="guide-cat">{esc(meta["category"])}</p>
<h1>{esc(meta["h1"])}</h1>
<p class="guide-meta"><span>Updated <time datetime="{iso_date(updated)}">{fmt_date(updated)}</time></span><span>{meta.get("read_min", 6)} min read</span><span>By the 824824 editorial team</span></p>
</div>
<div class="wrap guide-layout">
<aside class="guide-aside">
<nav class="toc" aria-labelledby="toc-title"><p class="toc-title" id="toc-title">On this page</p><ol>{toc}</ol></nav>
{inc_ad({"slot": "sidebar"}, ctx)}
</aside>
<article class="prose">{content}{inc_share({}, ctx)}</article>
</div>
<div class="wrap after-article">{faq_section(meta.get("faq"))}{sources_section(meta.get("sources"))}{related_section(meta, ctx)}</div>
{inc_lead_band({}, ctx) if 'kind="business"' in body else inc_alerts_band({}, ctx)}'''


LAYOUTS = {"home": layout_home, "page": layout_page, "hub": layout_hub, "tool": layout_tool, "guide": layout_guide}

# ---------------------------------------------------------------- build


def asset_version():
    h = hashlib.sha1()
    for p in sorted((ROOT / "assets").rglob("*")):
        if p.is_file():
            h.update(p.read_bytes())
    return h.hexdigest()[:10]


def load_guides():
    guides = []
    for path in sorted((SRC / "guides").glob("*.html")):
        meta, body = read_source(path)
        meta.setdefault("short", meta["h1"])
        guides.append((meta, body))
    order = ["overtime-laws-explained", "rotating-shift-patterns", "night-shift-survival-guide",
             "decimal-hours-time-card-math", "shift-differential-pay", "fair-shift-scheduling-guide",
             "24-hour-clock-guide", "history-of-the-8-hour-day"]
    guides.sort(key=lambda g: order.index(g[0]["slug"]) if g[0]["slug"] in order else 99)
    return guides


SHORT_GUIDE_NAMES = {
    "overtime-laws-explained": "Overtime laws explained",
    "rotating-shift-patterns": "Rotating shift patterns",
    "night-shift-survival-guide": "Night shift survival",
    "decimal-hours-time-card-math": "Decimal hours and time cards",
    "shift-differential-pay": "Shift differential pay",
    "fair-shift-scheduling-guide": "Fair shift scheduling",
    "24-hour-clock-guide": "The 24-hour clock",
    "history-of-the-8-hour-day": "History of the 8-hour day",
}


def build(render_png=False):
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    ver = asset_version()
    videos = json.loads((SRC / "data" / "videos.json").read_text(encoding="utf-8"))
    guide_pairs = load_guides()
    guides = []
    for meta, _ in guide_pairs:
        meta["short"] = SHORT_GUIDE_NAMES.get(meta["slug"], meta["h1"])
        guides.append(meta)

    pages = [read_source(p) for p in sorted((SRC / "pages").glob("*.html"))] + guide_pairs
    sitemap, search = [], []
    for meta, body in pages:
        slug = meta["slug"]
        layout = meta.get("layout", "page")
        ads = meta.get("ads", True) and slug != "404"
        ctx = {"slug": slug, "ver": ver, "guides": guides, "videos": videos, "ads": ads, "jsonld": []}
        if slug == "index":
            ctx["jsonld"].append(org_ld())
            ctx["jsonld"].append({"@context": "https://schema.org", "@type": "WebSite", "name": "824824",
                                  "alternateName": "Eight of Twenty-Four", "url": f"{SITE_URL}/"})
        if layout == "tool":
            meta.setdefault("scripts", [])
            meta["scripts"] = ["tools/core"] + [s for s in meta["scripts"]]
            meta.setdefault("nav", "tools")
        if layout == "guide":
            meta.setdefault("nav", "guides")
        main_html = LAYOUTS[layout](meta, body, ctx)
        page = wrap_page(meta, ctx, main_html)
        out_name = "index.html" if slug == "index" else f"{slug}.html"
        (OUT / out_name).write_text(page, encoding="utf-8")
        if not meta.get("noindex"):
            lastmod = iso_date(meta.get("updated", CFG["launched"]))
            sitemap.append((abs_url(slug), lastmod, meta.get("priority", 0.6)))
            kind = {"tool": "Tool", "guide": "Guide"}.get(layout, "Page")
            search.append({"t": meta.get("h1", meta["title"]), "u": out_name, "d": meta["description"], "k": kind,
                           "x": " ".join(meta.get("keywords", []) or [])})

    # assets and static files
    shutil.copytree(ROOT / "assets", OUT / "assets")
    for p in (ROOT / "static").iterdir():
        if p.is_file():
            shutil.copy2(p, OUT / p.name)
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    if CUSTOM_DOMAIN:
        (OUT / "CNAME").write_text(CUSTOM_DOMAIN + "\n", encoding="utf-8")

    search.sort(key=lambda r: {"Tool": 0, "Guide": 1, "Page": 2}[r["k"]])
    (OUT / "assets" / "js" / "search-index.js").write_text(
        "window.SEARCH_INDEX=[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in search) + "\n];\n",
        encoding="utf-8")

    urls = "\n".join(f"  <url><loc>{u}</loc><lastmod>{d}</lastmod><priority>{p}</priority></url>" for u, d, p in sitemap)
    (OUT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n',
        encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")
    (OUT / "ads.txt").write_text(f"google.com, {ADS_CLIENT.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")
    manifest = {
        "name": "824824 — Eight of Twenty-Four", "short_name": "824824",
        "description": "Free time card, overtime, shift pattern and sleep tools for shift workers.",
        "start_url": "./?source=pwa", "scope": "./", "display": "standalone",
        "background_color": "#0c1229", "theme_color": "#0c1229",
        "icons": [
            {"src": "assets/img/icon.svg", "sizes": "any", "type": "image/svg+xml"},
            {"src": "assets/img/icon-maskable.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable"},
            {"src": "assets/img/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "assets/img/icon-512.png", "sizes": "512x512", "type": "image/png"},
        ],
    }
    (OUT / "site.webmanifest").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    sw = (ROOT / "static" / "sw.js")
    if sw.exists():
        (OUT / "sw.js").write_text(sw.read_text(encoding="utf-8").replace("__VERSION__", ver), encoding="utf-8")

    if render_png:
        render_pngs()
    print(f"Built {len(pages)} pages into {OUT.relative_to(ROOT)}/ (assets v{ver}, site {SITE_URL})")


def render_pngs():
    img = ROOT / "assets" / "img"
    dest = OUT / "assets" / "img"
    jobs = [("og-image.svg", "og-image.png", 1200, 630), ("icon.svg", "icon-192.png", 192, 192),
            ("icon.svg", "icon-512.png", 512, 512), ("icon.svg", "apple-touch-icon.png", 180, 180)]
    for src, out, w, h in jobs:
        if not (img / src).exists():
            print(f"Skipping {out}: {src} not found")
            continue
        subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), str(img / src), "-o", str(dest / out)], check=True)
    print("Rendered PNG images.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--render-png", action="store_true", help="render PNG icons and social image (needs rsvg-convert)")
    args = ap.parse_args()
    build(render_png=args.render_png)
