# AGENTS.md

Guide for coding agents. For features and architecture see [README.md](README.md)

## Project

Vanilla JS PWA workout timer (HIIT, TABATA, EMOM, AMRAP, FOR TIME) with CrossFit Buriacus branding. No build step, served as static files via GitHub Pages (`CNAME`)

## Files

- `index.html`: page structure, modals, Service Worker registration
- `app.js`: timing engine, sounds, UI binding, themes, sync and history glue (browser only)
- `style.css`: layout, CSS tokens and the three themes
- `i18n.js`: IT/EN dictionary and helpers
- `sync.js`: lazy-loaded Firebase Firestore wrapper
- `firebase-config.js`: Firebase project config
- `time-utils.js`: pure time helpers, tested in `time-utils.test.js`
- `wod-parser.js`: local WOD text parser, tested in `wod-parser.test.js`
- `sw.js`: Service Worker (cache, update flow)
- `qrcode-lib.js`: vendored QR code encoder
- `manifest.json`, `icon.svg`, `logo-buriacus*.png`, `end-image.webp`: PWA metadata and images

## Commands

- `npm test` runs the suite (`node --test`)
- run locally with `python3 -m http.server 8931` from the repo root, then open http://localhost:8931

## Conventions

- themes use `html[data-theme="neon|stealth|brutalist"]` and CSS tokens in `style.css`; new UI must use tokens and look right in all three themes
- i18n: `data-i18n`, `data-i18n-placeholder` and `data-i18n-title` are applied in `app.js`; strings live in `i18n.js` (it/en)
- any change to a cached asset, or a new asset: update `ASSETS` and bump `CACHE_NAME` in `sw.js`
- code comments in English, lowercase, 1 line; existing Italian comments in `app.js` can stay
- workflow: plan in `plan.md`, execution by a subagent, then review

## Assets

`end-image.webp` is derived from `end_image.jpeg` (white background turned black, speed lines and edges faded, 800px, `cwebp -q 82`). The processing script isn't in the repo, so changing the image means redoing that processing from the source
