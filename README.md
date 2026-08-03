# HIIT Timer Pro

A professional CrossFit and gym timer optimized for large monitors and TV screens, readable from 10-15 meters away. Built with a lightweight, offline-first vanilla web stack (Zero-Compile).

Live deployment: **[timer.mbianchi.me](https://timer.mbianchi.me)** (GitHub Pages)

---

## 🚀 Key Features

- **Zero-Compile Vanilla Stack:** Pure HTML5, CSS3, and ES6 JavaScript. No framework overhead, no build steps, instant startup.
- **Offline-First (PWA):** Fully-compliant Progressive Web App utilizing a Service Worker cache to run completely offline. Once loaded, the timer functions in gym environments without any internet connectivity.
- **Precision Timing (Web Worker Threading):** Bypasses browser background tab throttling using an inline Web Worker thread for high-precision time ticks (50ms intervals).
- **Dynamic Audio Synthesis:** Sound alerts are synthesized on-the-fly using the Web Audio API (triangle wave oscillators) to eliminate latency and asset loading issues.
- **Wakelock Integration:** Keeps the screen active and prevents sleep mode during workouts using the Screen Wake Lock API.
- **Multi-Screen Sync (optional):** Share a running workout with a 6-character code — any other device can follow it read-only in real time, no account required. See "Sincronizzazione Multi-Schermo" below.
- **Local Workout History:** Every completed session is logged on-device (date, mode, rounds, duration) — no account, no server, just `localStorage`.
- **Physical Controller Friendly:** Keyboard hotkeys mapped for wireless clickers and remotes:
  * `Space` -> Play / Pause (or Apply configuration).
  * `Esc` / `R` -> Reset / Back to configuration screen.
  * `F` -> Toggle Fullscreen.

---

## ⏱ Workout Modes

### 1. HIIT (High Intensity Interval Training)
A highly configurable interval timer supporting:
- Total Rounds (directly editable via keyboard or stepper buttons).
- Preparation time.
- Standard work round duration.
- End-of-round warning sound (mm:ss format).
- Standard rest between rounds.
- **⚙️ Advanced Set Timing (Teal style):** Customize the duration of each individual work set.
- **⚙️ Scheduled Extra Rest (Purple style):** Automatically inject a longer recovery rest phase (e.g., 40s) after every X work rounds (e.g., every 5 rounds).

### 2. TABATA
Standard 20s work / 10s rest protocol. Rounds (8) and preparation (10s) are locked. Configurable work, warning, and rest times.

### 3. EMOM (Every Minute On the Minute)
Work duration is locked at 60s, rest is locked at 0s. Configurable total rounds, preparation, and warning buzzer.

### 4. AMRAP (As Many Rounds As Possible)
A count-down workout duration timer.

### 5. FOR TIME
A count-up stopwatch. Includes target time cap and on-screen modifying buttons to add/remove 1 minute to the cap during the workout.

---

## 🔗 Sincronizzazione Multi-Schermo (opzionale)

Il timer può essere seguito in tempo reale da altri dispositivi tramite un codice a 6 caratteri, senza account e senza login. Finché non si usa questa funzione, il timer resta interamente locale e offline come prima.

- **Condividi**: durante un allenamento, il pulsante **📡 Condividi** (in alto a sinistra) genera un codice mostrato in basso a destra. Chi ha comandato il timer (premuto "Applica"/"Inizia") resta il "controller".
- **Segui**: dalla schermata iniziale, inserendo il codice nel box "Segui un allenamento condiviso" un altro dispositivo (telefono in un'altra stanza, TV di un'altra sala, telefono di un atleta) visualizza il timer **in sola lettura**, con audio e beep identici a quelli del controller.
- **Contatore rep/giri**: chi segue con un codice vede anche un contatore personale di giri/rep, incrementabile a mano. È **solo locale a quel dispositivo**, non viene mai salvato né condiviso con nessuno: serve solo come promemoria personale durante il WOD.
- **Storico**: il pulsante **📜 Storico** in alto a destra mostra gli ultimi allenamenti completati su quel dispositivo (data, modalità, round, durata). Anche questo è salvato solo in locale (`localStorage`), non richiede account.

### Setup richiesto (una tantum)

La sincronizzazione si appoggia a **Firebase Firestore** (piano gratuito). GitHub Pages resta l'hosting di tutto il resto: non serve un server.

1. Crea un progetto su [console.firebase.google.com](https://console.firebase.google.com) (gratuito).
2. Abilita **Firestore Database** (modalità produzione).
3. In *Impostazioni progetto → Le tue app*, crea una "app web" e copia la configurazione in [`firebase-config.js`](firebase-config.js), sostituendo i valori placeholder.
4. Incolla queste **Security Rules** in Firestore → Regole:

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

5. In Firestore → *Database → TTL* attiva una policy TTL sulla collezione `sessions`, campo `expireAt`, così le sessioni vengono cancellate automaticamente circa 6 ore dopo l'ultimo aggiornamento (nessuna manutenzione manuale necessaria).

**Nota sulla sicurezza**: senza account, chi comanda una sessione è distinto da chi la segue tramite un `controllerToken` segreto generato al momento della condivisione e mai esposto a chi si unisce con il codice — solo chi possiede il token può modificare la sessione. Il codice stesso è pensato per essere condiviso a voce/schermo con persone fidate nello stesso box: chiunque lo conosca può seguire in sola lettura la sessione.

---

## 🛠 Technical Architecture

### 1. Web Worker Timing
Most modern browsers throttle JavaScript `setInterval` and `setTimeout` functions to 1s intervals when the tab is in the background or the screen dimming policy kicks in. To bypass this, the timer offloads the tick loop to a background thread using an inline Web Worker created dynamically from a `Blob`:

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
This ensures tick execution every 50ms, maintaining visual fluidness and timing accuracy even when the browser window is inactive.

### 2. Web Audio API Synthesis
To prevent lag or loading failures associated with static `.mp3` or `.wav` sound files in low-connectivity areas, all sound alerts are synthesized in real-time. 

Using the Web Audio API, we create a `OscillatorNode` with a triangle waveform (`triangle`) for a clean, non-distorted sound and control the amplitude envelope with a `GainNode` using linear ramps:

```javascript
const osc = ctx.createOscillator();
const gainNode = ctx.createGain();
osc.type = "triangle";
osc.frequency.value = frequency;

gainNode.gain.setValueAtTime(0, now);
gainNode.gain.linearRampToValueAtTime(0.9, now + 0.005);
gainNode.gain.setValueAtTime(0.9, now + duration - 0.01);
gainNode.gain.linearRampToValueAtTime(0, now + duration);
```

### 3. Progressive Web App (PWA) Caching
Offline capabilities are managed via `sw.js` implementing a **Stale-While-Revalidate** strategy. Crucial assets (`index.html`, `style.css`, `app.js`, `icon.svg`, and `manifest.json`) are cached locally. When the app is accessed:
1. It instantly serves the cached version.
2. It fetches the network version in the background to update the cache for the next reload.

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
This lock is released automatically when navigating away or stopping the timer, and re-acquired when starting a workout.

---

## 📂 Project Directory Structure

- `index.html` - Core layout structure and Service Worker registration.
- `style.css` - Responsive grid/flex design utilizing viewport-relative typography (`clamp()`, `vw`) for television layouts, plus color-coded option blocks.
- `app.js` - Sequence builder, sound engine, UI binding, keyboard event router, Web Worker wrapper, and multi-screen sync/history/rep-counter logic (ES module).
- `sync.js` - Firebase Firestore wrapper (lazy-loaded), used only when sharing or following a session.
- `firebase-config.js` - Firebase project configuration (placeholder — see "Sincronizzazione Multi-Schermo" above).
- `sw.js` - Service Worker cache script.
- `manifest.json` - PWA app installation metadata.
- `icon.svg` - App launcher icon.
- `CNAME` - Custom domain DNS configuration for GitHub Pages (`timer.mbianchi.me`).
