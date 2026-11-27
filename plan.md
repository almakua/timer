# Plan: bypass HTTP cache on service worker install

In `sw.js`, `install` handler: replace `return cache.addAll(ASSETS);` with
`return cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })));`
and add a 1 line lowercase comment above it: `// bypass the http cache so a new version never stores stale files`

Don't bump `CACHE_NAME` (already v12 and not yet deployed). Run `npm test`
