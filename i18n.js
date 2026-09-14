// ── Traduzioni (IT / EN) ──
// Dizionario piatto: ogni chiave ha una stringa per lingua, con {placeholder}
// sostituibili via t(key, { placeholder: valore }).

const STORAGE_KEY = "hiit-timer-lang";

const dict = {
    it: {
        historyBtn: "Storico",
        shortcutsHelpBtn: "Scorciatoie da tastiera",
        shortcutsModalTitle: "⌨️ Scorciatoie da tastiera",
        shortcutSpaceKey: "Spazio",
        shortcutSpace: "Avvia / Metti in pausa / Riprendi",
        shortcutEsc: "Indietro / Esci dall'allenamento",
        shortcutF: "Schermo intero",
        shortcutHelp: "Mostra/nascondi questo aiuto",
        roundsLabel: "Round totali",
        roundsSub: "Numero di round totali (scrivibile da tastiera)",
        prepareLabel: "Prepare",
        prepareSub: "Conto alla rovescia iniziale",
        workLabelHiit: "Durata round",
        workSubHiit: "Tempo di lavoro (uguale per tutti i round)",
        warningLabel: "Warning pre-fine",
        warningSub: "Allarme prima della fine del blocco (mm:ss)",
        restLabel: "Rest standard",
        restSub: "Recupero tra i round standard",
        advancedToggleLabel: "Imposta tempi diversi per ogni set",
        advancedTitle: "Personalizza durata singoli Set (mm:ss)",
        setLabel: "Set",
        extraRestToggleLabel: "Inserisci recuperi extra programmati",
        extraRestLabel: "Rest Extra",
        extraRestSub: "Durata del recupero lungo speciale (mm:ss)",
        extraRestFreqLabel: "Frequenza Rest Extra",
        extraRestFreqSub: "Inserisci un Rest Extra ogni X round di lavoro",
        summaryRoundsLabel: "Round",
        summaryTotalLabel: "Durata totale",
        applyBtn: "✓ Applica",
        joinLabel: "🔗 Segui un allenamento condiviso",
        advancedOptionsSummary: "⚙️ Opzioni avanzate",
        joinPlaceholder: "CODICE",
        joinBtn: "Segui",
        joinBtnConnecting: "Connessione...",

        workLabelTabata: "Durata Round (Lavoro)",
        workSubTabata: "Tempo di attività per ciascun set (Tabata)",
        workLabelEmom: "Tempo di Lavoro",
        workSubEmom: "Preimpostato a 1:00 per ciascun minuto",
        workLabelAmrap: "Durata totale AMRAP",
        workSubAmrap: "Tempo totale limite dell'allenamento",
        workLabelFortime: "Time Cap (Massimo)",
        workSubFortime: "Interruzione forzata dopo questo tempo",

        fullscreenTitle: "Schermo Intero",
        shareBtn: "📡 Condividi",
        shareBtnActivating: "Attivazione...",
        viewerBanner: "👀 In diretta",
        readyLabel: "Pronto",
        extratimeMinus: "- 1 Min",
        extratimePlus: "+ 1 Min",
        recapWorkLabel: "Lavoro:",
        recapRestLabel: "Rest:",
        recapRoundsLabel: "Round Totali:",
        recapWarningLabel: "Warning:",
        recapRestExtraSuffix: " (+{extraRest}s ogni {freq})",
        workMixedLabel: "Misto",
        repCounterLabel: "I tuoi giri / rep",
        muteBtnMute: "Disattiva audio",
        muteBtnUnmute: "Attiva audio",
        startBtn: "▶ Inizia Allenamento",
        pauseBtn: "⏸ Pausa",
        resumeBtn: "▶ Riprendi",
        stopBtn: "■ Indietro / Reset",
        exitBtn: "■ Esci",

        timeLabelPrepare: "prepare",
        timeLabelWork: "lavoro",
        timeLabelRestStandard: "rest standard",
        timeLabelRestExtra: "rest extra",
        timeLabelRemaining: "tempo rimanente",
        timeLabelElapsed: "tempo trascorso",
        roundLabelPrepare: "{n} round",
        roundLabelActive: "/ {n} round",
        phaseExtraRestBadge: "REST EXTRA",

        finishedTitle: "💪 Fatto!",
        finishedHiit: "{rounds} round completati!",
        finishedAmrap: "Tempo scaduto! Allenamento completato.",
        finishedFortime: "Time cap raggiunto a {time}!",
        restartBtn: "Ricomincia",

        codeLabel: "Codice",
        shareQrHint: "📷 Inquadra per seguire",
        updateAvailableMsg: "🔄 Nuova versione disponibile",
        updateReloadBtn: "Aggiorna",

        historyModalTitle: "📜 Storico allenamenti",
        historyClearBtn: "Cancella storico",
        historyCloseBtn: "Chiudi",
        historyEmptyMsg: "Nessun allenamento ancora registrato.",
        historyReuseBtn: "▶ Riusa",
        historyRoundsPart: "{n} round · ",
        historyClearConfirm: "Cancellare tutto lo storico allenamenti?",

        wodImportBtn: "Incolla WOD",
        wodModalTitle: "📋 Incolla il WOD",
        wodHint: "Riconosce formati comuni: EMOM 12, AMRAP 20, Tabata, 21-15-9 for time, 5 rounds 40s/20s...",
        wodTextareaPlaceholder: "Incolla qui il testo del WOD",
        wodParseBtn: "Analizza",
        wodApplyBtn: "Applica al timer",
        wodCloseBtn: "Chiudi",
        wodNotRecognized: "Non ho riconosciuto una struttura valida. Prova a riformularlo o imposta i campi a mano.",

        alertShareTerminateFirst: "Termina prima la condivisione in corso per poter seguire un altro allenamento.",
        alertSessionNotFound: "Sessione non trovata o terminata.",
        alertInvalidCode: "Codice non valido o sessione inesistente.",
        alertConnectFailed: "Impossibile connettersi: {msg}",
        alertExitViewerFirst: "Esci dalla visualizzazione remota prima di condividere un tuo allenamento.",
        alertShareFailed: "Impossibile attivare la condivisione: {msg}",
        alertCoachEndedSharing: "Il coach ha terminato la condivisione.",
    },
    en: {
        historyBtn: "History",
        shortcutsHelpBtn: "Keyboard shortcuts",
        shortcutsModalTitle: "⌨️ Keyboard shortcuts",
        shortcutSpaceKey: "Space",
        shortcutSpace: "Start / Pause / Resume",
        shortcutEsc: "Back / Exit workout",
        shortcutF: "Fullscreen",
        shortcutHelp: "Show/hide this help",
        roundsLabel: "Total rounds",
        roundsSub: "Total number of rounds (typeable from keyboard)",
        prepareLabel: "Prepare",
        prepareSub: "Initial countdown",
        workLabelHiit: "Round duration",
        workSubHiit: "Work time (same for every round)",
        warningLabel: "Pre-end warning",
        warningSub: "Alert before the block ends (mm:ss)",
        restLabel: "Standard rest",
        restSub: "Recovery between standard rounds",
        advancedToggleLabel: "Set different times per set",
        advancedTitle: "Customize each Set's duration (mm:ss)",
        setLabel: "Set",
        extraRestToggleLabel: "Add scheduled extra rest",
        extraRestLabel: "Extra Rest",
        extraRestSub: "Duration of the special long recovery (mm:ss)",
        extraRestFreqLabel: "Extra Rest Frequency",
        extraRestFreqSub: "Insert an Extra Rest every X work rounds",
        summaryRoundsLabel: "Rounds",
        summaryTotalLabel: "Total duration",
        applyBtn: "✓ Apply",
        joinLabel: "🔗 Follow a shared workout",
        advancedOptionsSummary: "⚙️ Advanced options",
        joinPlaceholder: "CODE",
        joinBtn: "Follow",
        joinBtnConnecting: "Connecting...",

        workLabelTabata: "Round Duration (Work)",
        workSubTabata: "Activity time per set (Tabata)",
        workLabelEmom: "Work Time",
        workSubEmom: "Preset to 1:00 per minute",
        workLabelAmrap: "Total AMRAP duration",
        workSubAmrap: "Total time limit for the workout",
        workLabelFortime: "Time Cap (Maximum)",
        workSubFortime: "Forced stop after this time",

        fullscreenTitle: "Fullscreen",
        shareBtn: "📡 Share",
        shareBtnActivating: "Activating...",
        viewerBanner: "👀 Live",
        readyLabel: "Ready",
        extratimeMinus: "- 1 Min",
        extratimePlus: "+ 1 Min",
        recapWorkLabel: "Work:",
        recapRestLabel: "Rest:",
        recapRoundsLabel: "Total Rounds:",
        recapWarningLabel: "Warning:",
        recapRestExtraSuffix: " (+{extraRest}s every {freq})",
        workMixedLabel: "Mixed",
        repCounterLabel: "Your rounds / reps",
        muteBtnMute: "Mute",
        muteBtnUnmute: "Unmute",
        startBtn: "▶ Start Workout",
        pauseBtn: "⏸ Pause",
        resumeBtn: "▶ Resume",
        stopBtn: "■ Back / Reset",
        exitBtn: "■ Exit",

        timeLabelPrepare: "prepare",
        timeLabelWork: "work",
        timeLabelRestStandard: "standard rest",
        timeLabelRestExtra: "extra rest",
        timeLabelRemaining: "time remaining",
        timeLabelElapsed: "time elapsed",
        roundLabelPrepare: "{n} rounds",
        roundLabelActive: "/ {n} rounds",
        phaseExtraRestBadge: "EXTRA REST",

        finishedTitle: "💪 Done!",
        finishedHiit: "{rounds} rounds completed!",
        finishedAmrap: "Time's up! Workout completed.",
        finishedFortime: "Time cap reached at {time}!",
        restartBtn: "Restart",

        codeLabel: "Code",
        shareQrHint: "📷 Scan to follow",
        updateAvailableMsg: "🔄 New version available",
        updateReloadBtn: "Update",

        historyModalTitle: "📜 Workout history",
        historyClearBtn: "Clear history",
        historyCloseBtn: "Close",
        historyEmptyMsg: "No workouts recorded yet.",
        historyReuseBtn: "▶ Reuse",
        historyRoundsPart: "{n} rounds · ",
        historyClearConfirm: "Clear all workout history?",

        wodImportBtn: "Paste WOD",
        wodModalTitle: "📋 Paste the WOD",
        wodHint: "Recognizes common formats: EMOM 12, AMRAP 20, Tabata, 21-15-9 for time, 5 rounds 40s/20s...",
        wodTextareaPlaceholder: "Paste the WOD text here",
        wodParseBtn: "Analyze",
        wodApplyBtn: "Apply to timer",
        wodCloseBtn: "Close",
        wodNotRecognized: "I couldn't recognize a valid structure. Try rephrasing it or set the fields manually.",

        alertShareTerminateFirst: "End the current sharing session first to follow another workout.",
        alertSessionNotFound: "Session not found or ended.",
        alertInvalidCode: "Invalid code or the session doesn't exist.",
        alertConnectFailed: "Unable to connect: {msg}",
        alertExitViewerFirst: "Exit remote viewing before sharing your own workout.",
        alertShareFailed: "Unable to start sharing: {msg}",
        alertCoachEndedSharing: "The coach has ended the sharing session.",
    },
};

function detectDefaultLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && dict[saved]) return saved;
    const browserLang = (navigator.language || "it").slice(0, 2);
    return dict[browserLang] ? browserLang : "it";
}

let currentLang = detectDefaultLang();

export function getLang() {
    return currentLang;
}

export function setLang(lang) {
    if (!dict[lang] || lang === currentLang) return false;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    return true;
}

export function t(key, vars) {
    let str = dict[currentLang][key] ?? dict.it[key] ?? key;
    if (vars) {
        Object.keys(vars).forEach((k) => {
            str = str.replaceAll(`{${k}}`, vars[k]);
        });
    }
    return str;
}
