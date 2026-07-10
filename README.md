# HIIT Timer Pro

Un timer professionale per palestra e box CrossFit, ottimizzato per schermi di grandi dimensioni e leggibile a distanza (10-15 metri). Costruito interamente in tecnologia vanilla offline-first (Zero-Compile).

Sito web ospitato su: **[timer.mbianchi.me](https://timer.mbianchi.me)** (GitHub Pages)

---

## ✨ Caratteristiche Principali

- **Stack Tecnologico Leggero (Zero-Compile):** Sviluppato esclusivamente in HTML5, CSS3 vanilla e JavaScript ES6. Nessun framework pesante, nessun tempo di compilazione, avvio istantaneo.
- **Funzionamento Offline Completo (PWA):** L'applicazione è una Progressive Web App configurata tramite `manifest.json` e Service Worker (`sw.js`). Una volta caricata la pagina, l'applicazione funziona al 100% offline in palestra anche in assenza di connessione internet.
- **Precisione Millimetrica (Web Worker):** Il motore del tempo gira all'interno di un **Web Worker inline** in background. Questo previene il rallentamento o il blocco dei secondi quando il browser disattiva la scheda o spegne lo schermo (background throttling).
- **Sintetizzatore Audio Integrato:** I segnali acustici (beep di countdown e allarmi) sono generati al volo tramite le API Web Audio del browser con oscillatori ad onda triangolare. Nessuna dipendenza da file audio esterni o caricamenti lenti.
- **Supporto Telecomando / Clicker (Keyboard Shortcuts):**
  * `Spazio` -> Avvia / Mette in pausa l'allenamento (o applica le impostazioni nella schermata iniziale).
  * `Esc` o `R` -> Torna alla schermata di configurazione / Resetta il timer.
  * `F` -> Attiva o disattiva la modalità Schermo Intero (Fullscreen).

---

## ⏱ Modalità di Allenamento

### 1. HIIT (High Intensity Interval Training)
La modalità più personalizzabile. Permette di configurare:
- Numero di round totali (inseribili da tastiera o tramite stepper).
- Tempo di preparazione iniziale.
- Durata round standard.
- Warning acustico pre-fine (mm:ss).
- Recupero standard tra i round.
- **⚙️ Opzione Avanzata - Tempi Diversi per ogni Set (Stile Teal):** Permette di impostare una durata specifica per ogni singolo set.
- **⚙️ Opzione Avanzata - Recuperi Extra Programmati (Stile Viola):** Permette di programmare un recupero speciale più lungo (es. 40s) ad intervalli regolari (es. ogni 5 round di lavoro), utile per circuiti e divisioni in blocchi.

### 2. TABATA
Configurazione preimpostata sul protocollo classico: 8 round e 10s di prepare bloccati. È possibile regolare solo la durata del lavoro, del warning e del rest.

### 3. EMOM (Every Minute On the Minute)
Configurazione incentrata sui minuti di lavoro: durata round bloccata a 60 secondi e rest bloccato a 0. È possibile regolare solo il numero di round totali, la preparazione iniziale e il warning pre-fine.

### 4. AMRAP (As Many Rounds As Possible)
Un timer alla rovescia impostato sulla durata totale selezionata (es. 20 minuti).

### 5. FOR TIME
Un cronometro incrementale che conta a partire da zero fino al raggiungimento di un **Time Cap** stabilito. Nella schermata attiva sono presenti due pulsanti rapidi per aggiungere o rimuovere 1 minuto al Time Cap corrente (`+ 1 Min` / `- 1 Min`).

---

## 🛠 Sviluppo e Test Locale

Puoi avviare un server locale per testare e modificare il timer in pochi secondi.

1. Clona il repository ed entra nella cartella:
   ```bash
   git clone https://github.com/almakua/timer.git
   cd timer
   ```

2. Avvia un server web locale (ad esempio con Python):
   ```bash
   python3 -m http.server 8000
   ```

3. Apri il browser all'indirizzo:
   **[http://localhost:8000](http://localhost:8000)**

---

## 📂 Struttura del Progetto

- `index.html` - Struttura semantica del layout e registrazione del Service Worker.
- `style.css` - Design responsivo, animazioni e stili color-coded per i diversi componenti.
- `app.js` - Logica del timer, audio engine, gestione scorciatoie e Web Worker.
- `sw.js` - Logica di cache ed esecuzione offline (Strategia *Stale-While-Revalidate*).
- `manifest.json` - Configurazione PWA per l'installazione su Desktop e Dispositivi Mobili.
- `icon.svg` - Icona vettoriale dell'applicazione.
- `CNAME` - Dominio personalizzato per GitHub Pages (`timer.mbianchi.me`).
