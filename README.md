# HIIT Timer Pro

A professional CrossFit and gym timer optimized for large monitors and TV screens, readable from 10-15 meters away. Built with a lightweight, offline-first vanilla web stack (zero build step, zero runtime dependencies).

Live deployment: **[timer.mbianchi.me](https://timer.mbianchi.me)** (GitHub Pages)

---

## Key Features

- **Zero-build vanilla stack:** pure HTML5, CSS3, and ES modules. No framework, no bundler, no compile step — open `index.html` and it runs.
- **Offline-first (PWA):** a Service Worker caches every asset so the timer keeps working in gyms with poor or no connectivity, once it has been loaded once.
- **Update notifications:** when a new version is deployed, a banner lets you apply it on your own schedule instead of silently swapping code under an in-progress workout.
- **Precision timing (Web Worker):** the tick loop runs on a dedicated Web Worker thread (50ms interval) so timing stays accurate even when the tab is backgrounded or throttled.
- **Dynamic audio synthesis:** every beep is synthesized on the fly with the Web Audio API — no audio files to load, no latency. Three distinct tones are used (round-end countdown, warning alert, phase transition) so they're easy to tell apart by ear, plus an adjustable volume slider (handy for muting the frequent EMOM beeps without losing all audio feedback).
- **Visual countdown pulse:** the on-screen time pulses during the final 3 seconds of a phase, in sync with the audio countdown.
- **Wake Lock integration:** keeps the screen on during a workout via the Screen Wake Lock API.
- **Multi-screen sync (optional):** share a running workout with a 6-character code (or a scannable QR code) — any other device can follow it read-only in real time, no account required. See [Multi-Screen Sync](#multi-screen-sync-optional) below.
- **Local WOD text parser:** paste a WOD's text (EMOM, AMRAP, Tabata, For Time, interval sets, in English or Italian) and the timer auto-configures itself. Parsing is entirely local — no server or AI call involved.
- **Local workout history:** every completed session is logged on-device (date, mode, rounds, duration) and can be reused to instantly reconfigure the timer. No account, no server — just `localStorage`.
- **IT / EN language switcher.**
- **Keyboard shortcuts**, with an in-app help modal (press `?` or use the ⌨️ button):
  * `Space` — Start / Pause / Resume (or apply the configuration from the setup screen).
  * `Esc` / `R` — Back to setup / exit the current view.
  * `F` — Toggle fullscreen.
  * `?` — Show/hide the shortcuts help.

---

## Workout Modes

### 1. HIIT (High Intensity Interval Training)
A fully configurable interval timer supporting:
- Total rounds (directly editable via keyboard or stepper buttons).
- Preparation time.
- Standard work round duration.
- End-of-round warning sound (mm:ss format), with its own distinct tone and a lead-in countdown.
- Standard rest between rounds.
- **Advanced set timing:** customize the duration of each individual work set.
- **Scheduled extra rest:** automatically insert a longer recovery phase (e.g. 40s) after every X work rounds (e.g. every 5 rounds).

### 2. TABATA
Standard 20s work / 10s rest protocol. Rounds (8) and preparation (10s) are locked. Work, warning, and rest times are configurable.

### 3. EMOM (Every Minute On the Minute)
Work duration is locked at 60s, rest at 0s. Total rounds, preparation, and the warning buzzer are configurable.

### 4. AMRAP (As Many Rounds As Possible)
A countdown workout timer.

### 5. FOR TIME
A count-up stopwatch with a target time cap and on-screen +1/-1 minute buttons to adjust the cap mid-workout.

---

## Multi-Screen Sync (optional)

The timer can be followed live from other devices using a 6-character code or by scanning a QR code — no accounts, no login. Until this feature is used, the timer stays fully local and offline as always.

- **Share**: during a workout, the **📡 Share** button (top left) generates a code and a QR code shown in the bottom-right badge. Whoever started the workout (pressed "Apply"/"Start") is the "controller".
- **Follow**: from the setup screen, entering the code in the "Follow a shared workout" box — or scanning the QR — connects another device (a phone in another room, a TV in another area, an athlete's phone) in **read-only** mode, with the same audio/beeps as the controller.
- **Personal rep counter**: a device following via code also gets a personal rep/round counter, incremented by hand. It is **local to that device only** — never saved or shared with anyone — just a personal reminder during the WOD.
- **History**: the **📜 History** button shows the last completed workouts on that device (date, mode, rounds, duration). Also local-only (`localStorage`), no account required.

### One-time setup

Sync relies on **Firebase Firestore** (free tier). GitHub Pages remains the hosting for everything else — no backend server is needed.

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) (free).
2. Enable **Firestore Database** (production mode).
3. Under *Project settings → Your apps*, create a "Web app" and copy the config into [`firebase-config.js`](firebase-config.js), replacing the placeholder values.
4. Paste these **Security Rules** under Firestore → Rules:

    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /sessions/{code} {
          allow get: if true;
          allow list: if false;
          allow create: if request.resource.data.controllerToken is string
                        && request.resource.data.expireAt is timestamp;
          allow update: if request.resource.data.controllerToken == resource.data.controllerToken;
          allow delete: if false;
        }
      }
    }
    ```

5. Under Firestore → *Database → TTL*, enable a TTL policy on the `sessions` collection, field `expireAt`, so sessions are automatically deleted roughly 6 hours after their last update (no manual cleanup needed).

**On security**: without accounts, the controller of a session is distinguished from followers via a secret `controllerToken` generated at share time and never exposed to anyone joining with the code — only the token holder can update the session. The code itself is meant to be shared by voice/screen with trusted people in the same gym: anyone who has it can follow the session read-only.

---

## Running Locally

This is a static, zero-build app — any static file server works. From the repository root:

```bash
python3 -m http.server 8931
```

Then open [http://localhost:8931](http://localhost:8931). Any other static server (`npx serve`, VS Code's "Live Server", etc.) works just as well.

Notes:
- **Service Worker caching**: the app registers a Service Worker that caches assets. If you don't see your local changes reflected, unregister the Service Worker and clear the Cache Storage from your browser's DevTools (Application tab), then reload.
- **Firebase**: `firebase-config.js` must contain valid Firebase project credentials for the Multi-Screen Sync feature to work (see above). Everything else works without any setup.

---

## Automated Tests

The DOM- and Worker-coupled parts of the app (`app.js`) can't be safely imported in Node — it creates a real `Worker` and binds event listeners at module load time. To keep the codebase testable without introducing a build step, all pure logic (no DOM/browser APIs) lives in standalone ES modules that both the browser app and Node's test runner can import directly:

- **`time-utils.js`** — time formatting and parsing (`formatSecondsToMMSS`, `parseAndSanitizeTimeToSeconds`).
- **`wod-parser.js`** — the local WOD text parser, covering EMOM/AMRAP/Tabata/For Time/interval-sets notation in both English and Italian, including several real-world WOD text samples that previously broke earlier parser versions (kept as regression tests).

Tests use Node's built-in test runner (`node:test` / `node:assert`) — no test framework or extra dependency required. Run the full suite with:

```bash
npm test
```

or directly with:

```bash
node --test
```

---

## Technical Architecture

### 1. Web Worker Timing
Most browsers throttle `setInterval`/`setTimeout` to roughly 1s intervals when a tab is backgrounded or the screen dims. To avoid this, the tick loop runs on a dedicated background thread, created dynamically from a `Blob` so no separate worker file is needed:

```javascript
const workerCode = `
    let interval = null;
    self.onmessage = function(e) {
        if (e.data === 'start') {
            if (interval) clearInterval(interval);
            interval = setInterval(() => { self.postMessage('tick'); }, 50);
        } else if (e.data === 'stop') {
            if (interval) { clearInterval(interval); interval = null; }
        }
    };
`;
```

This keeps ticks firing every 50ms, preserving visual fluidity and timing accuracy even when the browser window is inactive. All remaining/elapsed time is computed from an absolute epoch timestamp (`Date.now()` at the moment the current phase started), not accumulated per-tick — this is what lets a remote viewer render an identical countdown to the controller from the same `phaseStartedAt` value.

### 2. Web Audio API Synthesis
To avoid latency or loading failures tied to static `.mp3`/`.wav` files in low-connectivity gyms, every sound alert is synthesized in real time with an `OscillatorNode` (triangle wave, for a clean, non-harsh tone) and a `GainNode` driving a linear amplitude envelope:

```javascript
const osc = ctx.createOscillator();
const gainNode = ctx.createGain();
osc.type = "triangle";
osc.frequency.value = frequency;

gainNode.gain.setValueAtTime(0, now);
gainNode.gain.linearRampToValueAtTime(peakGain, now + 0.005);
gainNode.gain.setValueAtTime(peakGain, now + duration - 0.01);
gainNode.gain.linearRampToValueAtTime(0, now + duration);
```

Three distinct frequencies are used so the different alerts are easy to tell apart by ear: a low tone for the final 3-2-1 countdown of any phase, a perfect fifth above it for the warning alert, and a higher tone for phase transitions (played twice when the whole workout finishes).

### 3. Progressive Web App (PWA) Caching
Offline support is handled by `sw.js` with a **stale-while-revalidate** strategy: every core asset is cached on install, then served instantly from cache while a background fetch refreshes the cache for next time.

New deployments don't take over silently: a new Service Worker installs and waits, and the page shows an update banner. Only once the user confirms does the new worker call `skipWaiting()` and the page reload to the new version — so a coach mid-workout is never yanked onto different code without warning.

### 4. Screen Wake Lock
To keep the display active during long workouts without requiring user interaction:
```javascript
let wakeLock = null;
async function acquireWakeLock() {
    if ("wakeLock" in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request("screen");
        } catch (err) { ... }
    }
}
```
The lock is released automatically when leaving or stopping the timer, and re-acquired when starting a workout.

### 5. QR Code Pairing
Joining a shared session by typing a 6-character code works, but scanning is faster. The share badge also renders a QR code (generated fully client-side, no external service) encoding a URL with the session code as a query parameter. Opening that URL — e.g. by scanning it — auto-fills and submits the "follow" flow on load, connecting as a viewer with no typing required.

---

## Project Directory Structure

- `index.html` — page structure, modals, and Service Worker registration/update-banner wiring.
- `style.css` — responsive grid/flex layout using viewport-relative typography (`clamp()`, `vw`) for TV-sized screens, plus color-coded option blocks.
- `app.js` — sequence builder, timing engine, sound engine, UI binding, keyboard shortcut router, Web Worker wrapper, and the multi-screen sync/history/rep-counter/WOD-import glue code (ES module; not designed to be imported outside a browser).
- `sync.js` — Firebase Firestore wrapper (lazy-loaded), only touched when sharing or following a session.
- `firebase-config.js` — Firebase project configuration (placeholder — see [Multi-Screen Sync](#multi-screen-sync-optional) above).
- `i18n.js` — the IT/EN translation dictionary and helpers (`t`, `getLang`, `setLang`).
- `time-utils.js` — pure time formatting/parsing helpers, covered by `time-utils.test.js`.
- `wod-parser.js` — the local WOD text parser, covered by `wod-parser.test.js`.
- `qrcode-lib.js` — a vendored, MIT-licensed QR code encoder ([kazuhikoarase/qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)), used for the share QR code.
- `sw.js` — Service Worker cache script.
- `manifest.json` — PWA install metadata.
- `icon.svg` — app launcher icon.
- `package.json` — declares this as an ES module project and defines the `npm test` script; no runtime dependencies.
- `CNAME` — custom domain configuration for GitHub Pages (`timer.mbianchi.me`).
