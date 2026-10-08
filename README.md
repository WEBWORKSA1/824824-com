# 824824.com: Eight of Twenty-Four

Free time card, overtime, shift pattern, staffing and night-shift sleep tools, plus sourced guides, for shift workers and the managers who schedule them. Monetized with Google AdSense, YouTube embeds, a B2B software-shortlist lead funnel, worker job alerts, sponsorships, contests and reader support.

**Live:** https://webworksa1.github.io/824824-com/ (GitHub Pages, free plan, served from the `gh-pages` branch)

## What's inside

| Area | Pages |
|---|---|
| 11 tools | time card, overtime (US regular-rate method), shift differential, hourly and salary, hours, decimal hours, military time, printable timesheet, shift pattern generator (calendar + .ics export + coverage + overtime by payroll week), 24/7 staffing, night-shift sleep planner |
| 8 guides | overtime laws (US, Canada, UK, India, Australia), rotating patterns, night-shift survival, decimal hours, shift differentials, fair scheduling, 24-hour clock, history of the 8-hour day |
| Lead generation | `get-matched.html` (5-step funnel with buyer's checklist and opt-in consents), `job-alerts.html`, lead band on tool and guide pages, exit-intent Shift Survival Kit, newsletter |
| Revenue and community | `support.html` (one-time and monthly, allocation), `advertise.html` (6 packages + rate-card form), `contests.html` + `contest-rules.html`, `careers.html`, `videos.html` |
| Trust | `about.html`, `what-does-824-mean.html`, `privacy.html`, `terms.html`, `disclaimer.html` (trademark and copyright disclosure) |

Every page carries the partner bar linking to https://web.works/contact. All forms post through FormSubmit to the site inbox, which is never shown on the site: it's assembled at submit time from an obfuscated array in `assets/js/config.js`.

## Project layout

```
build.py              static site generator (python3 build.py -> _site/)
site.json             site URL, custom domain, AdSense publisher id, partner link
src/pages/            pages: front matter + HTML (tool pages: tool UI, then <!--article-->)
src/guides/           long-form guides
src/data/videos.json  embedded YouTube videos
assets/css/style.css  design system (light and dark)
assets/js/config.js   the only script to edit: ad slots, GA4, YouTube channel, donation links, form alias
assets/js/app.js      navigation, search, forms, funnel, ads, video, share, donations, consent
assets/js/dial.js     home page 24-hour dial
assets/js/tools/      one script per calculator + core.js (shared math)
static/               files copied to the site root (service worker)
tests/                tools.test.js (node), qa.py (links, anchors, ids, inbox exposure)
docs/                 RESEARCH.md, PROMPTS.md (phase-wise build prompts), deploy-workflow.yml
```

## Build and check

```bash
pip install pyyaml
python3 build.py          # writes _site/
node tests/tools.test.js  # calculator math (39 tests)
python3 tests/qa.py       # links, anchors, duplicate ids, JSON-LD, partner bar, inbox exposure
```

Publish by pushing the contents of `_site/` to the `gh-pages` branch. To automate it, enable `docs/deploy-workflow.yml` (instructions inside the file).

## Go-live checklist

1. **Forms (2 minutes):** submit any form on the live site once. FormSubmit emails the site inbox an activation link; click **Activate**. Optional: paste the random-string alias FormSubmit provides into `formAlias` in `assets/js/config.js` so even the obfuscated address leaves the site.
2. **Images:** upload `og-image.png`, `apple-touch-icon.png`, `icon-192.png` and `icon-512.png` into `assets/img/` on the `gh-pages` branch (and on `main` so future builds keep them): GitHub > Add file > Upload files.
3. **AdSense:** add the site in AdSense, enable Auto ads, and turn on Google's consent message for the EEA, UK and Switzerland (Privacy & messaging). `ads.txt` is generated with `pub-6620975821265271`; it's read from the domain root, so it takes effect on the custom domain. For fixed units, paste slot ids into `SITE.adsense.slots` in `config.js`; until then those spots show house promos.
4. **Custom domain 824824.com:** DNS A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (and AAAA `2606:50c0:8000::153`, `...8001::153`, `...8002::153`, `...8003::153`), `www` CNAME to `webworksa1.github.io`. Then set `"custom_domain": "824824.com"` and `"site_url": "https://824824.com"` in `site.json`, rebuild and publish (a `CNAME` file is written automatically), and tick **Enforce HTTPS** in Settings > Pages.
5. **Search Console:** verify the domain and submit `sitemap.xml`.
6. **YouTube, donations, analytics:** fill `youtube.channel`, `donate.*` and `ga4` in `config.js`. With no donation links, the support page uses a pledge form.
7. **Contest:** Contest 1 promises $175 in prizes (closes November 30, 2026). Change the amounts and dates in `src/pages/contests.html` and `src/pages/contest-rules.html` before promoting it if needed.

## Legal

"824824" is used as a descriptive numeric domain name (8 of 24 hours). No trademark is claimed in the number, and the site isn't affiliated with any person, company, team or organization that uses 8, 24 or 824. See `disclaimer.html`. Inquiries about this website, the domain, sponsorship, advertising or partnership: https://web.works/contact
