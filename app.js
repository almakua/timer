import { createSession, updateSession, subscribeToSession } from "./sync.js";
import { t, getLang, setLang } from "./i18n.js";
import { formatSecondsToMMSS, parseAndSanitizeTimeToSeconds } from "./time-utils.js";
import { parseWodText } from "./wod-parser.js";
import { qrcode } from "./qrcode-lib.js";

let currentMode = "hiit";
let roundTimes = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20];
let originalBaseTimes = [];
const DEFAULTS = { prepare: 10, work: 20, warning: 5, rest: 10, extraRest: 40, extraRestFreq: 5 };

const modeCacheValues = {
    hiit: { work: 20 },
    tabata: { work: 20 },
    emom: { work: 60 },
    amrap: { work: 1200 },
    fortime: { work: 600 },
};

const MODE_LABELS = { hiit: "HIIT", tabata: "TABATA", emom: "EMOM", amrap: "AMRAP", fortime: "FOR TIME" };
const HISTORY_KEY = "hiit-history-v1";
const HISTORY_LIMIT = 50;

// ── Stato di condivisione / visualizzazione remota ──
let shareSession = null; // { code, controllerToken } quando QUESTO dispositivo comanda e condivide
let viewerSession = null; // { code, unsubscribe } quando QUESTO dispositivo segue un codice altrui
let repCounter = 0;

// ── Volume beep (per dispositivo, mai sincronizzato) ──
const VOLUME_KEY = "hiit-timer-volume";
const VOLUME_LAST_NONZERO_KEY = "hiit-timer-volume-last-nonzero";
const LEGACY_SOUND_KEY = "hiit-timer-sound-enabled";

// Migra la vecchia impostazione on/off verso il nuovo volume in percentuale
if (localStorage.getItem(VOLUME_KEY) === null) {
    const legacy = localStorage.getItem(LEGACY_SOUND_KEY);
    if (legacy !== null) {
        localStorage.setItem(VOLUME_KEY, legacy === "off" ? "0" : "100");
        localStorage.removeItem(LEGACY_SOUND_KEY);
    }
}

let volumeLevel = parseInt(localStorage.getItem(VOLUME_KEY), 10);
if (isNaN(volumeLevel)) volumeLevel = 100;
let lastNonZeroVolume = parseInt(localStorage.getItem(VOLUME_LAST_NONZERO_KEY), 10);
if (isNaN(lastNonZeroVolume) || lastNonZeroVolume <= 0) lastNonZeroVolume = 100;

// ── Web Worker Inline per Timer Preciso ──
const workerCode = `
    let interval = null;
    self.onmessage = function(e) {
        if (e.data === 'start') {
            if (interval) clearInterval(interval);
            interval = setInterval(() => {
                self.postMessage('tick');
            }, 50);
        } else if (e.data === 'stop') {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        }
    };
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const timerWorker = new Worker(URL.createObjectURL(blob));

timerWorker.onmessage = function(e) {
    if (e.data !== 'tick') return;
    if (viewerSession) {
        viewerTick();
    } else {
        tick();
    }
};

document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        if (currentMode === "hiit" || currentMode === "amrap" || currentMode === "fortime") {
            modeCacheValues[currentMode].work = getRawValue("work");
        }
        document
            .querySelectorAll(".mode-tab")
            .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        currentMode = tab.dataset.mode;
        adaptUIForMode();
    });
});

function adaptUIForMode() {
    const rowRounds = document.getElementById("row-rounds");
    const rowPrepare = document.getElementById("row-prepare");
    const rowWork = document.getElementById("row-standard-work");
    const rowWarning = document.getElementById("row-warning");
    const rowRest = document.getElementById("row-rest");
    const rowToggleExtraRest = document.getElementById("row-toggle-extra-rest");
    const extraRestWrap = document.getElementById("extra-rest-inputs-container-wrap");
    const rowToggle = document.getElementById("row-toggle-advanced");
    const rowSummary = document.getElementById("row-summary");
    const advancedAccordion = document.getElementById("advanced-options-accordion");
    const lblWorkMain = document.getElementById("lbl-work-main");
    const lblWorkSub = document.getElementById("lbl-work-sub");

    // Ripristina la visibilità di default
    rowRounds.classList.remove("hidden");
    rowPrepare.classList.remove("hidden");
    rowWork.classList.remove("hidden");
    rowWarning.classList.remove("hidden");
    rowRest.classList.remove("hidden");
    rowToggleExtraRest.classList.remove("hidden");
    rowToggle.classList.remove("hidden");
    rowSummary.classList.remove("hidden");

    if (currentMode === "hiit") {
        setRawValue("work", modeCacheValues.hiit.work);
        lblWorkMain.textContent = t("workLabelHiit");
        lblWorkSub.textContent = t("workSubHiit");
        rowToggleExtraRest.classList.remove("hidden");
        advancedAccordion.classList.remove("hidden");
        toggleAdvancedMode();
        toggleExtraRestMode();
    } else {
        rowToggleExtraRest.classList.add("hidden");
        extraRestWrap.style.display = "none";
        advancedAccordion.classList.add("hidden");

        if (currentMode === "tabata") {
            rowRounds.classList.add("hidden");
            rowPrepare.classList.add("hidden");
            rowToggle.classList.add("hidden");
            document.getElementById("rounds-inputs-container-wrap").classList.remove("visible");

            setRawValue("work", modeCacheValues.tabata.work);
            lblWorkMain.textContent = t("workLabelTabata");
            lblWorkSub.textContent = t("workSubTabata");
            updateSummary();
        } else if (currentMode === "emom") {
            rowWork.classList.add("hidden");
            rowRest.classList.add("hidden");
            rowToggle.classList.add("hidden");
            document.getElementById("rounds-inputs-container-wrap").classList.remove("visible");

            lblWorkMain.textContent = t("workLabelEmom");
            lblWorkSub.textContent = t("workSubEmom");
            updateSummary();
        } else if (currentMode === "amrap") {
            rowRounds.classList.add("hidden");
            rowWarning.classList.add("hidden");
            rowRest.classList.add("hidden");
            rowToggle.classList.add("hidden");
            rowSummary.classList.add("hidden");
            document.getElementById("rounds-inputs-container-wrap").classList.remove("visible");

            setRawValue("work", modeCacheValues.amrap.work);
            lblWorkMain.textContent = t("workLabelAmrap");
            lblWorkSub.textContent = t("workSubAmrap");
            updateSummary();
        } else if (currentMode === "fortime") {
            rowRounds.classList.add("hidden");
            rowWarning.classList.add("hidden");
            rowRest.classList.add("hidden");
            rowToggle.classList.add("hidden");
            rowSummary.classList.add("hidden");
            document.getElementById("rounds-inputs-container-wrap").classList.remove("visible");

            setRawValue("work", modeCacheValues.fortime.work);
            lblWorkMain.textContent = t("workLabelFortime");
            lblWorkSub.textContent = t("workSubFortime");
            updateSummary();
        }
    }
}

function applyConfigObject(parsed) {
    currentMode = parsed.currentMode || "hiit";
    document.querySelectorAll(".mode-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.mode === currentMode);
    });
    setRawValue("prepare", parsed.prepare ?? DEFAULTS.prepare);
    setRawValue("work", parsed.work ?? DEFAULTS.work);
    setRawValue("warning", parsed.warning ?? DEFAULTS.warning);
    setRawValue("rest", parsed.rest ?? DEFAULTS.rest);
    setRawValue("extraRest", parsed.extraRest ?? DEFAULTS.extraRest);
    document.getElementById("cfg-extraRestFreq").value = parsed.extraRestFreq ?? DEFAULTS.extraRestFreq;
    document.getElementById("cfg-extra-rest-toggle").checked = parsed.extraRestActive ?? true;
    document.getElementById("cfg-rounds").value = parsed.rounds ?? 10;
    document.getElementById("cfg-advanced-toggle").checked = parsed.advancedMode ?? false;
    if (parsed.modeCacheValues) Object.assign(modeCacheValues, parsed.modeCacheValues);
    // adaptUIForMode() ripopola il campo "work" da modeCacheValues[currentMode]: se quella cache
    // è rimasta indietro rispetto al valore appena ripristinato, lo sovrascriverebbe silenziosamente.
    if (modeCacheValues[currentMode]) {
        modeCacheValues[currentMode].work = parsed.work ?? DEFAULTS.work;
    }
    if (Array.isArray(parsed.roundTimes) && parsed.roundTimes.length > 0) {
        roundTimes = parsed.roundTimes;
    }
}

function loadConfig() {
    const saved = localStorage.getItem("hiit-config-v12");
    if (!saved) {
        setRawValue("prepare", DEFAULTS.prepare);
        setRawValue("work", DEFAULTS.work);
        setRawValue("warning", DEFAULTS.warning);
        setRawValue("rest", DEFAULTS.rest);
        setRawValue("extraRest", DEFAULTS.extraRest);
        document.getElementById("cfg-extraRestFreq").value = DEFAULTS.extraRestFreq;
        document.getElementById("cfg-extra-rest-toggle").checked = true;
        document.getElementById("cfg-rounds").value = 10;
        syncRoundsArray(10);
        adaptUIForMode();
        return;
    }
    try {
        applyConfigObject(JSON.parse(saved));
    } catch (e) {
        console.error(e);
    }
    adaptUIForMode();
}

function buildConfigSnapshot() {
    return {
        currentMode: currentMode,
        prepare: getRawValue("prepare"),
        work: getRawValue("work"),
        warning: getRawValue("warning"),
        rest: getRawValue("rest"),
        extraRest: getRawValue("extraRest"),
        extraRestFreq: parseInt(document.getElementById("cfg-extraRestFreq").value) || 0,
        extraRestActive: document.getElementById("cfg-extra-rest-toggle").checked,
        rounds: parseInt(document.getElementById("cfg-rounds").value) || 10,
        advancedMode: document.getElementById("cfg-advanced-toggle").checked,
        roundTimes: roundTimes,
        modeCacheValues: modeCacheValues,
    };
}

function saveConfig() {
    localStorage.setItem("hiit-config-v12", JSON.stringify(buildConfigSnapshot()));
}

function getRawValue(idPart) {
    return parseInt(document.getElementById("cfg-" + idPart).dataset.value) || 0;
}
function setRawValue(idPart, seconds) {
    const input = document.getElementById("cfg-" + idPart);
    input.dataset.value = seconds;
    input.value = formatSecondsToMMSS(seconds);
}

function syncRoundsArray(targetLength) {
    const currentWorkDefault = getRawValue("work") || DEFAULTS.work;
    while (roundTimes.length < targetLength) {
        const lastVal = roundTimes[roundTimes.length - 1] || currentWorkDefault;
        roundTimes.push(lastVal);
    }
    while (roundTimes.length > targetLength) {
        roundTimes.pop();
    }
}

function toggleAdvancedMode() {
    if (currentMode !== "hiit") return;
    const isAdvanced = document.getElementById("cfg-advanced-toggle").checked;
    const rowStandard = document.getElementById("row-standard-work");
    const containerWrap = document.getElementById("rounds-inputs-container-wrap");
    const totalRounds = roundTimes.length;

    if (isAdvanced) {
        rowStandard.classList.add("hidden");
        containerWrap.classList.add("visible");
    } else {
        rowStandard.classList.remove("hidden");
        containerWrap.classList.remove("visible");
        const standardValue = getRawValue("work") || DEFAULTS.work;
        roundTimes = Array(totalRounds).fill(standardValue);
    }
    buildRoundInputs();
}

function toggleExtraRestMode() {
    if (currentMode !== "hiit") return;
    const isExtraRestActive = document.getElementById("cfg-extra-rest-toggle").checked;
    const wrap = document.getElementById("extra-rest-inputs-container-wrap");

    if (isExtraRestActive) {
        wrap.style.display = "grid";
    } else {
        wrap.style.display = "none";
    }
    updateSummary();
}

function buildRoundInputs() {
    document.getElementById("cfg-rounds").value = roundTimes.length;
    const container = document.getElementById("rounds-inputs-container");
    container.innerHTML = "";

    roundTimes.forEach((time, index) => {
        const row = document.createElement("div");
        row.className = "round-item";
        row.innerHTML = `
            <span>${t("setLabel")} ${index + 1}</span>
            <div class="stepper">
                <button type="button" class="btn-time-minus" data-idx="${index}">−</button>
                <input type="text" class="cfg-single-work" data-idx="${index}" value="${formatSecondsToMMSS(time)}" inputmode="numeric" />
                <button type="button" class="btn-time-plus" data-idx="${index}">+</button>
            </div>
        `;
        container.appendChild(row);
    });

    container.querySelectorAll(".btn-time-minus").forEach((b) => {
        b.addEventListener("click", () => modifyRoundTime(parseInt(b.dataset.idx), -5));
    });
    container.querySelectorAll(".btn-time-plus").forEach((b) => {
        b.addEventListener("click", () => modifyRoundTime(parseInt(b.dataset.idx), 5));
    });

    container.querySelectorAll(".cfg-single-work").forEach((input) => {
        const handleSingleBlur = () => {
            const idx = parseInt(input.dataset.idx);
            const sanitizedSec = parseAndSanitizeTimeToSeconds(input.value, DEFAULTS.work, true);
            roundTimes[idx] = sanitizedSec;
            input.value = formatSecondsToMMSS(sanitizedSec);
            sanitizeWarningAgainstRoundTimes();
            updateSummary();
        };
        input.addEventListener("blur", handleSingleBlur);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") input.blur();
        });
    });
    updateSummary();
}

function modifyRoundTime(idx, delta) {
    roundTimes[idx] = Math.max(5, (roundTimes[idx] || 40) + delta);
    sanitizeWarningAgainstRoundTimes();
    buildRoundInputs();
}

["prepare", "work", "rest", "warning", "extraRest"].forEach((field) => {
    const input = document.getElementById("cfg-" + field);
    const handleMainBlur = () => {
        const def = DEFAULTS[field];
        const isWork = field === "work" || field === "warning" || field === "extraRest";
        const sanitizedSec = parseAndSanitizeTimeToSeconds(input.value, def, isWork);
        setRawValue(field, sanitizedSec);

        if (field === "work" || field === "warning") {
            sanitizeWarningAgainstRoundTimes();
        }
        updateSummary();
    };
    input.addEventListener("blur", handleMainBlur);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur();
    });
});

// Input diretto del numero di round totali
const roundsInput = document.getElementById("cfg-rounds");
roundsInput.addEventListener("blur", () => {
    let val = parseInt(roundsInput.value) || 8;
    if (val < 1) val = 1;
    if (val > 30) val = 30;
    roundsInput.value = val;

    syncRoundsArray(val);
    sanitizeWarningAgainstRoundTimes();
    if (document.getElementById("cfg-advanced-toggle").checked) {
        buildRoundInputs();
    }
    updateSummary();
});
roundsInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") roundsInput.blur();
});

document.getElementById("btn-round-plus").addEventListener("click", () => {
    const input = document.getElementById("cfg-rounds");
    let val = parseInt(input.value) || 8;
    if (val < 30) {
        val++;
        input.value = val;
        syncRoundsArray(val);
        sanitizeWarningAgainstRoundTimes();
        if (document.getElementById("cfg-advanced-toggle").checked) {
            buildRoundInputs();
        }
        updateSummary();
    }
});

document.getElementById("btn-round-minus").addEventListener("click", () => {
    const input = document.getElementById("cfg-rounds");
    let val = parseInt(input.value) || 8;
    if (val > 1) {
        val--;
        input.value = val;
        syncRoundsArray(val);
        sanitizeWarningAgainstRoundTimes();
        if (document.getElementById("cfg-advanced-toggle").checked) {
            buildRoundInputs();
        }
        updateSummary();
    }
});

// Incremento / Decremento frequenza Rest Extra
document.getElementById("btn-extra-rest-freq-plus").addEventListener("click", () => {
    const input = document.getElementById("cfg-extraRestFreq");
    let val = parseInt(input.value) || 0;
    if (val < 30) input.value = val + 1;
    updateSummary();
});

document.getElementById("btn-extra-rest-freq-minus").addEventListener("click", () => {
    const input = document.getElementById("cfg-extraRestFreq");
    let val = parseInt(input.value) || 0;
    if (val > 0) input.value = val - 1;
    updateSummary();
});

function sanitizeWarningAgainstRoundTimes() {
    let currentWarning = getRawValue("warning") || 0;

    let maxAllowedWarning = Infinity;
    if (currentMode === "hiit") {
        if (document.getElementById("cfg-advanced-toggle").checked) {
            maxAllowedWarning = Math.min(...roundTimes);
        } else {
            maxAllowedWarning = getRawValue("work") || DEFAULTS.work;
        }
    } else if (currentMode === "tabata") {
        maxAllowedWarning = getRawValue("work") || 20;
    } else if (currentMode === "emom") {
        maxAllowedWarning = 60;
    }

    if (currentWarning > maxAllowedWarning) {
        setRawValue("warning", maxAllowedWarning);
    }
}

document.getElementById("cfg-advanced-toggle").addEventListener("change", () => {
    toggleAdvancedMode();
    sanitizeWarningAgainstRoundTimes();
});

document.getElementById("cfg-extra-rest-toggle").addEventListener("change", () => {
    toggleExtraRestMode();
});

function updateSummary() {
    let prepare = 10;
    let rest = 20;
    let totalRounds = 8;
    let workTotal = 0;
    let restTotal = 0;

    if (currentMode === "hiit") {
        prepare = getRawValue("prepare");
        rest = getRawValue("rest");
        const extraRest = getRawValue("extraRest");
        const extraRestFreq = parseInt(document.getElementById("cfg-extraRestFreq").value) || 0;
        const isExtraRestActive = document.getElementById("cfg-extra-rest-toggle").checked;
        totalRounds = parseInt(document.getElementById("cfg-rounds").value) || 10;

        if (document.getElementById("cfg-advanced-toggle").checked) {
            workTotal = roundTimes.reduce((a, b) => a + b, 0);
        } else {
            const standardValue = getRawValue("work") || DEFAULTS.work;
            workTotal = totalRounds * standardValue;
            roundTimes = Array(totalRounds).fill(standardValue);
        }

        // Calcolo dei tempi di recupero (rest standard e rest extra)
        for (let rNumber = 1; rNumber < totalRounds; rNumber++) {
            const isExtraRestRound = (isExtraRestActive && extraRestFreq > 0 && rNumber % extraRestFreq === 0);
            const activeRestDuration = isExtraRestRound && extraRest > 0 ? extraRest : rest;
            restTotal += activeRestDuration;
        }
    } else if (currentMode === "tabata") {
        prepare = 10;
        rest = getRawValue("rest");
        totalRounds = 8;
        const workTime = getRawValue("work") || 20;
        workTotal = totalRounds * workTime;
        restTotal = totalRounds > 1 ? (totalRounds - 1) * rest : 0;
    } else if (currentMode === "emom") {
        prepare = getRawValue("prepare");
        rest = 0;
        totalRounds = parseInt(document.getElementById("cfg-rounds").value) || 10;
        const workTime = 60;
        workTotal = totalRounds * workTime;
        restTotal = 0;
    } else if (currentMode === "amrap" || currentMode === "fortime") {
        prepare = getRawValue("prepare");
        workTotal = getRawValue("work");
        totalRounds = 1;
        restTotal = 0;
    }

    const totalDuration = prepare + workTotal + restTotal;

    document.getElementById("sum-rounds").textContent = totalRounds;
    document.getElementById("sum-total").textContent = fmtTime(totalDuration);
    saveConfig();
}

function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

document.querySelectorAll("[data-field]").forEach((btn) => {
    btn.addEventListener("click", () => {
        const field = btn.dataset.field;
        const delta = parseInt(btn.dataset.delta);

        let currentSec = getRawValue(field);
        let newSec = currentSec + delta;

        if (field === "work" && newSec < 5) newSec = 5;
        if (field === "warning" && newSec < 0) newSec = 0;
        if (field === "extraRest" && newSec < 0) newSec = 0;
        if (field !== "work" && field !== "warning" && field !== "extraRest" && newSec < 0) newSec = 0;

        setRawValue(field, newSec);
        if (field === "work" || field === "warning") {
            sanitizeWarningAgainstRoundTimes();
        }
        updateSummary();
    });
});

// ── Audio Engine con Onde Triangolari ──
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}
function playBeep(frequency, duration) {
    if (volumeLevel <= 0) return;
    try {
        const ctx = getAudioCtx();
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = frequency;
        const now = ctx.currentTime;
        const peakGain = 0.9 * (volumeLevel / 100);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(peakGain, now + 0.005);
        gainNode.gain.setValueAtTime(peakGain, now + duration - 0.01);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    } catch (e) {
        console.error(e);
    }
}
function playLowBeep() {
    playBeep(880, 0.25);
}
function playWarningBeep() {
    playBeep(1400, 0.25);
}
function playHighBeep() {
    playBeep(2000, 0.85);
}

// ── Wake Lock ──
let wakeLock = null;
async function acquireWakeLock() {
    if ("wakeLock" in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request("screen");
        } catch {}
    }
}
function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
}

// ── Motore Sequenza Timer ──
// Il tempo rimanente/trascorso si calcola sempre da un epoch assoluto
// (Date.now() al momento in cui la fase corrente è iniziata), non per
// accumulo di delta. Questo rende identico il calcolo sia in locale
// (solo/controller) sia su un dispositivo che segue una sessione remota:
// cambia solo la provenienza di `phaseStartedAt` (locale o da Firestore).
let state = null;
let workoutHasStarted = false;

function setupSequenceStage() {
    getAudioCtx();
    const seq = [];
    let prepare = 10;
    let warning = 5;
    let rest = 10;
    let extraRest = 0;
    let extraRestFreq = 0;
    let rounds = 10;

    originalBaseTimes = [];

    if (currentMode === "hiit") {
        prepare = getRawValue("prepare");
        rest = getRawValue("rest");
        extraRest = getRawValue("extraRest");
        extraRestFreq = parseInt(document.getElementById("cfg-extraRestFreq").value) || 0;
        const isExtraRestActive = document.getElementById("cfg-extra-rest-toggle").checked;
        warning = getRawValue("warning");
        rounds = parseInt(document.getElementById("cfg-rounds").value) || 10;

        if (prepare > 0) {
            seq.push({ phase: "prepare", duration: prepare, round: null });
            originalBaseTimes.push(prepare);
        }
        roundTimes.forEach((wTime, index) => {
            const rNumber = index + 1;
            seq.push({ phase: "work", duration: wTime, round: rNumber });
            originalBaseTimes.push(wTime);

            if (rNumber < roundTimes.length) {
                const isExtraRestRound = (isExtraRestActive && extraRestFreq > 0 && rNumber % extraRestFreq === 0);
                const activeRestDuration = isExtraRestRound && extraRest > 0 ? extraRest : rest;

                if (activeRestDuration > 0) {
                    seq.push({
                        phase: isExtraRestRound && extraRest > 0 ? "extraRest" : "rest",
                        duration: activeRestDuration,
                        round: rNumber
                    });
                    originalBaseTimes.push(activeRestDuration);
                }
            }
        });
    } else if (currentMode === "tabata") {
        prepare = 10;
        rest = getRawValue("rest");
        warning = getRawValue("warning");
        rounds = 8;
        const workTime = getRawValue("work") || 20;

        if (prepare > 0) {
            seq.push({ phase: "prepare", duration: prepare, round: null });
            originalBaseTimes.push(prepare);
        }
        for (let i = 0; i < rounds; i++) {
            const rNumber = i + 1;
            seq.push({ phase: "work", duration: workTime, round: rNumber });
            originalBaseTimes.push(workTime);
            if (rNumber < rounds && rest > 0) {
                seq.push({ phase: "rest", duration: rest, round: rNumber });
                originalBaseTimes.push(rest);
            }
        }
    } else if (currentMode === "emom") {
        prepare = getRawValue("prepare");
        warning = getRawValue("warning");
        rounds = parseInt(document.getElementById("cfg-rounds").value) || 10;
        rest = 0;
        const workTime = 60;

        if (prepare > 0) {
            seq.push({ phase: "prepare", duration: prepare, round: null });
            originalBaseTimes.push(prepare);
        }
        for (let i = 0; i < rounds; i++) {
            const rNumber = i + 1;
            seq.push({ phase: "work", duration: workTime, round: rNumber });
            originalBaseTimes.push(workTime);
        }
    } else if (currentMode === "amrap" || currentMode === "fortime") {
        prepare = getRawValue("prepare");
        const workDuration = getRawValue("work");
        rounds = 1;

        if (prepare > 0) {
            seq.push({ phase: "prepare", duration: prepare, round: null });
            originalBaseTimes.push(prepare);
        }
        seq.push({ phase: "work", duration: workDuration, round: null });
        originalBaseTimes.push(workDuration);
    }

    state = {
        mode: currentMode,
        seq,
        idx: 0,
        remaining: seq[0].duration,
        elapsedInPhase: 0,
        phaseStartedAt: null,
        workoutStartedAt: null,
        paused: false,
        pausedElapsedSeconds: 0,
        warning,
        totalRounds: rounds,
        beepsFired: new Set(),
        isViewer: false,
    };

    workoutHasStarted = false;

    // Configurazione Recap in basso
    if (currentMode === "hiit" || currentMode === "tabata" || currentMode === "emom") {
        document.getElementById("rcp-rounds").textContent = state.totalRounds;
        document.getElementById("rcp-warning").textContent = `${warning}s`;
        if (currentMode === "hiit") {
            const isAdvanced = document.getElementById("cfg-advanced-toggle").checked;
            document.getElementById("rcp-work").textContent = isAdvanced ? t("workMixedLabel") : `${getRawValue("work")}s`;

            let restText = `${rest}s`;
            const isExtraRestActive = document.getElementById("cfg-extra-rest-toggle").checked;
            if (isExtraRestActive && extraRestFreq > 0 && extraRest > 0) {
                restText += t("recapRestExtraSuffix", { extraRest, freq: extraRestFreq });
            }
            document.getElementById("rcp-rest").textContent = restText;
        } else if (currentMode === "tabata") {
            document.getElementById("rcp-work").textContent = `${getRawValue("work")}s`;
            document.getElementById("rcp-rest").textContent = `${rest}s`;
        } else if (currentMode === "emom") {
            document.getElementById("rcp-work").textContent = `60s`;
            document.getElementById("rcp-rest").textContent = `0s`;
        }
        document.getElementById("active-hiit-recap").classList.add("visible");
    } else {
        document.getElementById("active-hiit-recap").classList.remove("visible");
    }

    document.getElementById("btn-active-start").style.display = "block";
    document.getElementById("btn-pause").style.display = "none";
    document.getElementById("btn-pause").textContent = t("pauseBtn");
    document.getElementById("btn-stop").textContent = t("stopBtn");
    document.getElementById("btn-share").style.display = "flex";
    document.getElementById("btn-share").textContent = t("shareBtn");
    document.getElementById("share-code-badge").classList.remove("visible");
    document.getElementById("viewer-banner").classList.remove("visible");
    document.getElementById("rep-counter-panel").classList.remove("visible");

    showActive();
    acquireWakeLock();
    renderActive();
}

const EARLY_FINISH_MIN_SECONDS = 30;

function startRunningWorkout() {
    workoutHasStarted = true;
    document.getElementById("btn-active-start").style.display = "none";
    document.getElementById("btn-pause").style.display = "block";
    state.phaseStartedAt = Date.now();
    state.workoutStartedAt = Date.now();
    state.beepsFired = new Set();
    timerWorker.postMessage('start');
    pushSyncUpdate();
}

function onPhaseStart() {
    state.beepsFired = new Set();
    playHighBeep();
}

function evaluateBeeps(seg) {
    const triggerBeepVal = Math.ceil(state.remaining);

    // Chiave condivisa tra tutte le regole: se un secondo è già stato "coperto"
    // da una regola (es. warning basso che si sovrappone al countdown di fine
    // fase), le altre lo trovano già in beepsFired e non raddoppiano il beep.
    const fireBeepOnce = (beepFn) => {
        if (state.beepsFired.has(triggerBeepVal)) return;
        state.beepsFired.add(triggerBeepVal);
        beepFn();
    };

    if ((state.mode === "hiit" || state.mode === "tabata" || state.mode === "emom") && seg.phase === "work") {
        const warningLimit = state.warning || 0;
        // Countdown di 3 beep che anticipano il warning, più il beep del warning stesso
        // (es. warning a 1:30 -> beep a 1:33, 1:32, 1:31, 1:30). Con un warning basso
        // (es. 5s) il countdown finirebbe troppo a ridosso di quello di fine fase,
        // suonando come due gruppi confusi con una pausa in mezzo: sotto questa soglia
        // niente lead-in, resta il singolo beep di sempre. Il lead-in suona come il
        // normale countdown 3-2-1 (stesso tono), ma il beep del warning vero e proprio
        // (l'ultimo del gruppo) ha un tono distinto, per riconoscerlo a orecchio.
        const WARNING_COUNTDOWN_MIN_SECONDS = 15;
        if (warningLimit > 0) {
            const rangeStart = warningLimit >= WARNING_COUNTDOWN_MIN_SECONDS ? warningLimit + 3 : warningLimit;
            if (triggerBeepVal === warningLimit) {
                fireBeepOnce(playWarningBeep);
            } else if (triggerBeepVal > warningLimit && triggerBeepVal <= rangeStart) {
                fireBeepOnce(playLowBeep);
            }
        }
    }

    // Beep 3, 2, 1 secondi prima della fine della fase
    if (!(state.mode === "fortime" && seg.phase === "work")) {
        if (triggerBeepVal <= 3 && triggerBeepVal >= 1) {
            fireBeepOnce(playLowBeep);
        }
    }
}

function tick() {
    if (!workoutHasStarted || (state && state.paused)) return;

    const seg = state.seq[state.idx];
    const now = Date.now();

    if (state.mode === "fortime" && seg.phase === "work") {
        state.elapsedInPhase = (now - state.phaseStartedAt) / 1000;
        state.remaining = seg.duration - state.elapsedInPhase;

        if (state.elapsedInPhase >= seg.duration) {
            finish();
            return;
        }
    } else {
        state.remaining = seg.duration - (now - state.phaseStartedAt) / 1000;
        if (state.remaining <= 0) {
            advancePhase();
            return;
        }
    }

    evaluateBeeps(seg);
    renderActive();
}

function advancePhase() {
    state.idx++;
    if (state.idx >= state.seq.length) {
        finish();
        return;
    }

    state.phaseStartedAt = Date.now();
    state.elapsedInPhase = 0;
    state.pausedElapsedSeconds = 0;
    state.remaining = state.seq[state.idx].duration;
    state.beepsFired = new Set();

    renderActive();
    onPhaseStart();
    pushSyncUpdate();
}

// ── Visualizzazione in sola lettura di una sessione remota ──
function viewerTick() {
    if (!state || !state.isViewer) return;
    const seg = state.seq[state.idx];

    if (state.paused) {
        if (state.mode === "fortime" && seg.phase === "work") {
            state.elapsedInPhase = state.pausedElapsedSeconds || 0;
            state.remaining = seg.duration - state.elapsedInPhase;
        } else {
            state.remaining = seg.duration - (state.pausedElapsedSeconds || 0);
        }
    } else {
        const now = Date.now();
        if (state.mode === "fortime" && seg.phase === "work") {
            state.elapsedInPhase = (now - state.phaseStartedAt) / 1000;
            state.remaining = seg.duration - state.elapsedInPhase;
        } else {
            state.remaining = seg.duration - (now - state.phaseStartedAt) / 1000;
        }
    }

    evaluateBeeps(seg);
    renderActive();
}

function applyRemoteData(data) {
    if (data.status === "ended") {
        alert(t("alertCoachEndedSharing"));
        exitViewerMode();
        return;
    }

    state = {
        mode: data.mode,
        seq: data.seq,
        idx: data.idx,
        totalRounds: data.totalRounds,
        warning: data.warning || 0,
        remaining: 0,
        elapsedInPhase: 0,
        phaseStartedAt: data.phaseStartedAt,
        paused: data.status !== "running",
        pausedElapsedSeconds: data.status === "running" ? 0 : (data.pausedElapsedSeconds || 0),
        beepsFired: new Set(),
        isViewer: true,
    };

    if (data.recap) {
        document.getElementById("rcp-work").textContent = data.recap.work ?? "—";
        document.getElementById("rcp-rest").textContent = data.recap.rest ?? "—";
        document.getElementById("rcp-rounds").textContent = data.recap.rounds ?? "—";
        document.getElementById("rcp-warning").textContent = data.recap.warning ?? "—";
        document.getElementById("active-hiit-recap").classList.toggle(
            "visible",
            data.mode === "hiit" || data.mode === "tabata" || data.mode === "emom",
        );
    }

    document.getElementById("finished-overlay").classList.remove("visible");
    setViewerControlsVisibility();
    showActive();

    if (data.status === "finished") {
        finishViewer(data);
        return;
    }
    viewerTick();
}

// Stessa logica di messaggio usata da finish() lato controller, così chi segue
// vede un'informazione equivalente (round completati / time cap raggiunto),
// non un generico "il coach ha finito" privo di dettagli.
function buildFinishedMessage(mode, totalRounds, timeValueSeconds) {
    if (mode === "hiit" || mode === "tabata" || mode === "emom") {
        return t("finishedHiit", { rounds: totalRounds });
    } else if (mode === "amrap") {
        return t("finishedAmrap");
    } else if (mode === "fortime") {
        return t("finishedFortime", { time: formatSecondsToMMSS(Math.floor(timeValueSeconds)) });
    }
    return "";
}

function finishViewer(data) {
    timerWorker.postMessage('stop');
    playHighBeep();
    setTimeout(playHighBeep, 400);
    const timeValueSeconds = data.mode === "fortime" ? data.seq[data.idx].duration : 0;
    document.getElementById("finished-msg").textContent = buildFinishedMessage(data.mode, data.totalRounds, timeValueSeconds);
    document.getElementById("finished-overlay").classList.add("visible");
}

function setViewerControlsVisibility() {
    document.getElementById("btn-active-start").style.display = "none";
    document.getElementById("btn-pause").style.display = "none";
    document.getElementById("btn-stop").textContent = t("exitBtn");
    document.getElementById("btn-share").style.display = "none";
    document.getElementById("share-code-badge").classList.remove("visible");
    document.getElementById("viewer-banner").classList.add("visible");
    document.getElementById("rep-counter-panel").classList.add("visible");
}

async function joinSession() {
    if (shareSession) {
        alert(t("alertShareTerminateFirst"));
        return;
    }
    const input = document.getElementById("cfg-join-code");
    const code = (input.value || "").trim().toUpperCase();
    if (code.length < 4) return;

    const btn = document.getElementById("btn-join");
    btn.disabled = true;
    btn.textContent = t("joinBtnConnecting");

    try {
        const unsubscribe = await subscribeToSession(
            code,
            (data) => applyRemoteData(data),
            (err) => {
                console.error(err);
                if (viewerSession) {
                    alert(t("alertSessionNotFound"));
                    exitViewerMode();
                } else {
                    alert(t("alertInvalidCode"));
                }
            },
        );
        viewerSession = { code, unsubscribe };
        resetRepCounter();
        getAudioCtx();
        acquireWakeLock();
        timerWorker.postMessage('start');
    } catch (err) {
        console.error(err);
        alert(t("alertConnectFailed", { msg: err.message }));
    } finally {
        btn.disabled = false;
        btn.textContent = t("joinBtn");
    }
}

function exitViewerMode() {
    if (viewerSession) {
        viewerSession.unsubscribe();
        viewerSession = null;
    }
    timerWorker.postMessage('stop');
    releaseWakeLock();
    state = null;
    resetRepCounter();
    showSetup();
}

// ── Condivisione (lato controller) ──
function buildSyncPayload() {
    return {
        mode: state.mode,
        seq: state.seq,
        idx: state.idx,
        totalRounds: state.totalRounds,
        warning: state.warning,
        status: state.paused ? "paused" : (workoutHasStarted ? "running" : "ready"),
        phaseStartedAt: state.phaseStartedAt,
        pausedElapsedSeconds: state.paused ? state.pausedElapsedSeconds : null,
        recap: {
            work: document.getElementById("rcp-work").textContent,
            rest: document.getElementById("rcp-rest").textContent,
            rounds: document.getElementById("rcp-rounds").textContent,
            warning: document.getElementById("rcp-warning").textContent,
        },
    };
}

function pushSyncUpdate(extra = {}) {
    if (!shareSession) return;
    const payload = { ...buildSyncPayload(), ...extra };
    updateSession(shareSession.code, shareSession.controllerToken, payload).catch((err) => {
        console.error("Errore di sincronizzazione:", err);
    });
}

async function startSharing() {
    if (!state || state.isViewer) return;
    if (viewerSession) {
        alert(t("alertExitViewerFirst"));
        return;
    }
    if (shareSession) return;

    const btn = document.getElementById("btn-share");
    btn.disabled = true;
    btn.textContent = t("shareBtnActivating");
    try {
        const { code, controllerToken } = await createSession(buildSyncPayload());
        shareSession = { code, controllerToken };
        showShareBadge(code);
    } catch (err) {
        console.error(err);
        alert(t("alertShareFailed", { msg: err.message }));
    } finally {
        btn.disabled = false;
        btn.textContent = t("shareBtn");
    }
}

function buildJoinUrl(code) {
    return `${location.origin}${location.pathname}?join=${code}`;
}

function renderShareQr(code) {
    const qr = qrcode(0, "M");
    qr.addData(buildJoinUrl(code));
    qr.make();
    document.getElementById("share-code-qr").innerHTML = qr.createSvgTag(4, 0);
}

function showShareBadge(code) {
    document.getElementById("share-code-value").textContent = code;
    renderShareQr(code);
    document.getElementById("share-code-badge").classList.add("visible");
    document.getElementById("btn-share").style.display = "none";
}

function stopSharing() {
    if (!shareSession) return;
    updateSession(shareSession.code, shareSession.controllerToken, { status: "ended" }).catch(() => {});
    shareSession = null;
    document.getElementById("share-code-badge").classList.remove("visible");
}

// ── REGOLATORI EXTRA TIME (+1m / -1m) ──
document.getElementById("btn-add-extratime").addEventListener("click", () => {
    if (!state || state.isViewer) return;
    const seg = state.seq[state.idx];
    if (seg.phase !== "work" || state.mode !== "fortime") return;

    const amount = 60;
    seg.duration += amount;
    state.beepsFired.clear();
    renderActive();
    pushSyncUpdate();
});

document.getElementById("btn-remove-extratime").addEventListener("click", () => {
    if (!state || state.isViewer) return;
    const seg = state.seq[state.idx];
    if (seg.phase !== "work" || state.mode !== "fortime") return;

    const amount = 60;
    const baseTimeInvalicabile = originalBaseTimes[state.idx];

    if (seg.duration - amount >= baseTimeInvalicabile) {
        seg.duration -= amount;
        if (state.remaining < amount) state.remaining = 0;
        state.beepsFired.clear();
        renderActive();
        pushSyncUpdate();
    }
});

function finish() {
    timerWorker.postMessage('stop');
    releaseWakeLock();
    playHighBeep();
    setTimeout(playHighBeep, 400);

    document.getElementById("finished-msg").textContent = buildFinishedMessage(state.mode, state.totalRounds, state.elapsedInPhase);
    document.getElementById("finished-overlay").classList.add("visible");

    pushSyncUpdate({ status: "finished" });
    saveHistoryRecord();
}

function renderActive() {
    const seg = state.seq[state.idx];

    let displaySeconds = Math.max(0, Math.ceil(state.remaining));
    if (state.mode === "fortime" && seg.phase === "work") {
        displaySeconds = Math.floor(state.elapsedInPhase);
    }

    const badge = document.getElementById("phase-badge");
    badge.className = "phase-badge " + seg.phase;

    let phaseText = seg.phase.toUpperCase();
    if (seg.phase === "work") {
        if (state.mode === "amrap") phaseText = "AMRAP";
        else if (state.mode === "fortime") phaseText = "FOR TIME";
        else if (state.mode === "emom") phaseText = "EMOM";
    } else if (seg.phase === "extraRest") {
        phaseText = t("phaseExtraRestBadge");
    }
    badge.textContent = phaseText;

    const roundBox = document.getElementById("active-round-box");
    const dividerBox = document.getElementById("active-divider-box");
    const progressWrap = document.getElementById("active-progress-wrap");
    const modifiersZone = document.getElementById("active-modifiers-zone");
    const timecapSubinfo = document.getElementById("active-timecap-subinfo");

    if (seg.phase === "prepare") {
        roundBox.classList.remove("hidden");
        dividerBox.classList.remove("hidden");
        progressWrap.classList.remove("hidden");
        modifiersZone.classList.remove("visible");
        timecapSubinfo.classList.remove("visible");

        document.getElementById("round-num").textContent = "—";
        document.getElementById("round-label").textContent =
            (state.mode === "hiit" || state.mode === "tabata" || state.mode === "emom") ? t("roundLabelPrepare", { n: state.totalRounds }) : t("readyLabel");
        document.getElementById("time-label").textContent = t("timeLabelPrepare");
    } else {
        if (state.mode === "hiit" || state.mode === "tabata" || state.mode === "emom") {
            roundBox.classList.remove("hidden");
            dividerBox.classList.remove("hidden");
            progressWrap.classList.remove("hidden");
            modifiersZone.classList.remove("visible");
            timecapSubinfo.classList.remove("visible");

            document.getElementById("round-num").textContent = seg.round;
            document.getElementById("round-label").textContent = t("roundLabelActive", { n: state.totalRounds });

            let timeLabelText = t("timeLabelWork");
            if (seg.phase === "rest") timeLabelText = t("timeLabelRestStandard");
            else if (seg.phase === "extraRest") timeLabelText = t("timeLabelRestExtra");
            document.getElementById("time-label").textContent = timeLabelText;
        } else {
            roundBox.classList.add("hidden");
            dividerBox.classList.add("hidden");

            if (state.mode === "amrap") {
                modifiersZone.classList.remove("visible");
                timecapSubinfo.classList.remove("visible");
                progressWrap.classList.remove("hidden");
                document.getElementById("time-label").textContent = t("timeLabelRemaining");
            } else if (state.mode === "fortime") {
                modifiersZone.classList.toggle("visible", !state.isViewer);
                timecapSubinfo.classList.add("visible");
                document.getElementById("timecap-target-val").textContent = formatSecondsToMMSS(seg.duration);
                progressWrap.classList.add("hidden");
                document.getElementById("time-label").textContent = t("timeLabelElapsed");
            }
        }
    }

    const timeVal = document.getElementById("time-val");
    timeVal.textContent = formatSecondsToMMSS(displaySeconds);
    // Pulsa in sincro col beep degli ultimi 3 secondi di fase (stessa esclusione
    // per il lavoro FOR TIME, che conta in su verso un cap e non ha un "fine fase" imminente)
    const isFinalCountdown = displaySeconds >= 1 && displaySeconds <= 3 && !(state.mode === "fortime" && seg.phase === "work");
    timeVal.classList.toggle("pulse", isFinalCountdown);

    let pct = (state.remaining / seg.duration) * 100;
    document.getElementById("progress-bar").style.width = Math.max(0, pct) + "%";

    document.body.classList.remove("phase-prepare", "phase-work", "phase-rest", "phase-extraRest");
    document.body.classList.add("phase-" + seg.phase);
}

function showActive() {
    document.getElementById("setup-screen").style.display = "none";
    document.getElementById("active-screen").classList.add("visible");
}

function showSetup() {
    document.getElementById("setup-screen").style.display = "";
    document.getElementById("active-screen").classList.remove("visible");
    document.getElementById("finished-overlay").classList.remove("visible");
    document.body.classList.remove("phase-prepare", "phase-work", "phase-rest", "phase-extraRest");
    document.getElementById("share-code-badge").classList.remove("visible");
    document.getElementById("viewer-banner").classList.remove("visible");
    document.getElementById("rep-counter-panel").classList.remove("visible");
    document.getElementById("btn-share").style.display = "flex";
    document.getElementById("btn-share").textContent = t("shareBtn");
    document.getElementById("btn-stop").textContent = t("stopBtn");
}

function togglePause() {
    if (!state || state.isViewer) return;
    state.paused = !state.paused;
    if (!state.paused) {
        state.phaseStartedAt = Date.now() - state.pausedElapsedSeconds * 1000;
        timerWorker.postMessage('start');
    } else {
        state.pausedElapsedSeconds = (Date.now() - state.phaseStartedAt) / 1000;
        timerWorker.postMessage('stop');
    }
    document.getElementById("btn-pause").textContent = state.paused ? t("resumeBtn") : t("pauseBtn");
    pushSyncUpdate();
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.error(`Errore attivando lo schermo intero: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

// FOR TIME è l'unica modalità dove interrompere prima del tempo è l'esito
// normale e desiderato (hai finito il lavoro prima del time cap): se sono
// passati almeno EARLY_FINISH_MIN_SECONDS dall'inizio, lo trattiamo come un
// risultato valido e lo salviamo nello storico. Sotto quella soglia si
// presume un avvio accidentale, e non si salva nulla. Per le altre modalità
// (HIIT/TABATA/EMOM/AMRAP) interrompere in anticipo resta un abbandono: non
// viene salvato, come già oggi.
function maybeSaveEarlyFinish() {
    if (!state || state.isViewer || !workoutHasStarted) return;
    if (state.mode !== "fortime") return;
    if (!state.workoutStartedAt) return;

    const seg = state.seq[state.idx];
    if (seg.phase !== "work") return;

    const elapsedSinceStart = (Date.now() - state.workoutStartedAt) / 1000;
    if (elapsedSinceStart < EARLY_FINISH_MIN_SECONDS) return;

    state.elapsedInPhase = state.paused
        ? (state.pausedElapsedSeconds || 0)
        : (Date.now() - state.phaseStartedAt) / 1000;
    saveHistoryRecord();
}

function handleBackToSetup() {
    if (viewerSession) {
        exitViewerMode();
        return;
    }
    const alreadyFinished = document.getElementById("finished-overlay").classList.contains("visible");
    if (!alreadyFinished) {
        maybeSaveEarlyFinish();
    }
    if (shareSession) {
        stopSharing();
    }
    timerWorker.postMessage('stop');
    releaseWakeLock();
    state = null;
    showSetup();
}

document.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === "INPUT") return;

    const key = e.key.toLowerCase();
    const activeVisible = document.getElementById("active-screen").classList.contains("visible");
    const overlayVisible = document.getElementById("finished-overlay").classList.contains("visible");

    if (e.code === "Space" || key === " ") {
        e.preventDefault();
        if (viewerSession) return;
        if (activeVisible) {
            if (!workoutHasStarted) {
                startRunningWorkout();
            } else {
                togglePause();
            }
        } else if (!overlayVisible) {
            setupSequenceStage();
        }
    } else if (key === "escape" || key === "r") {
        e.preventDefault();
        if (activeVisible || overlayVisible) {
            handleBackToSetup();
        }
    } else if (key === "f") {
        e.preventDefault();
        toggleFullScreen();
    }
});

// Event Listeners UI
document.getElementById("btn-apply").addEventListener("click", setupSequenceStage);
document.getElementById("btn-active-start").addEventListener("click", startRunningWorkout);
document.getElementById("btn-pause").addEventListener("click", togglePause);
document.getElementById("btn-stop").addEventListener("click", handleBackToSetup);
document.getElementById("btn-done").addEventListener("click", handleBackToSetup);

document.getElementById("btn-fullscreen").addEventListener("click", toggleFullScreen);

document.getElementById("btn-share").addEventListener("click", startSharing);

document.getElementById("btn-join").addEventListener("click", joinSession);
const joinCodeInput = document.getElementById("cfg-join-code");
joinCodeInput.addEventListener("input", () => {
    joinCodeInput.value = joinCodeInput.value.toUpperCase();
});
joinCodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinSession();
});

// ── Contatore Rep/Giri (solo locale, mai sincronizzato) ──
function resetRepCounter() {
    repCounter = 0;
    updateRepCounterDisplay();
}
function updateRepCounterDisplay() {
    const el = document.getElementById("rep-counter-value");
    if (el) el.textContent = repCounter;
}
document.getElementById("btn-rep-plus").addEventListener("click", () => {
    repCounter++;
    updateRepCounterDisplay();
});
document.getElementById("btn-rep-minus").addEventListener("click", () => {
    repCounter = Math.max(0, repCounter - 1);
    updateRepCounterDisplay();
});

// ── Storico allenamenti (solo locale) ──
function saveHistoryRecord() {
    if (state.isViewer) return;

    let durationLabel;
    if (state.mode === "fortime") {
        durationLabel = formatSecondsToMMSS(Math.floor(state.elapsedInPhase));
    } else {
        const totalSeconds = state.seq.reduce((acc, s) => acc + s.duration, 0);
        durationLabel = formatSecondsToMMSS(totalSeconds);
    }

    const record = {
        date: new Date().toISOString(),
        mode: state.mode,
        totalRounds: state.totalRounds,
        duration: durationLabel,
        config: buildConfigSnapshot(),
    };

    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        history = [];
    }
    history.unshift(record);
    if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function renderHistoryList() {
    const container = document.getElementById("history-list");
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        history = [];
    }
    if (history.length === 0) {
        container.innerHTML = `<p class="history-empty">${t("historyEmptyMsg")}</p>`;
        return;
    }
    const dateLocale = getLang() === "en" ? "en-GB" : "it-IT";
    container.innerHTML = history
        .map((r, idx) => {
            const d = new Date(r.date);
            const dateLabel = d.toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
            const timeLabel = d.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });
            const roundsPart = (r.mode === "hiit" || r.mode === "tabata" || r.mode === "emom")
                ? t("historyRoundsPart", { n: r.totalRounds })
                : "";
            const reuseBtn = r.config
                ? `<button type="button" class="history-reuse-btn" data-reuse-idx="${idx}">${t("historyReuseBtn")}</button>`
                : "";
            return `<div class="history-item">
                <div class="history-item-info">
                    <div class="history-item-mode">${MODE_LABELS[r.mode] || r.mode}</div>
                    <div class="history-item-meta">${dateLabel} ${timeLabel} · ${roundsPart}${r.duration}</div>
                </div>
                ${reuseBtn}
            </div>`;
        })
        .join("");
}

function reuseHistoryRecord(idx) {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        history = [];
    }
    const record = history[idx];
    if (!record || !record.config) return;

    applyConfigObject(record.config);
    adaptUIForMode();
    document.getElementById("history-overlay").classList.remove("visible");
    setupSequenceStage();
}

document.getElementById("history-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-reuse-idx]");
    if (!btn) return;
    reuseHistoryRecord(parseInt(btn.dataset.reuseIdx));
});

document.getElementById("btn-history").addEventListener("click", () => {
    renderHistoryList();
    document.getElementById("history-overlay").classList.add("visible");
});
document.getElementById("btn-history-close").addEventListener("click", () => {
    document.getElementById("history-overlay").classList.remove("visible");
});
document.getElementById("btn-history-clear").addEventListener("click", () => {
    if (confirm(t("historyClearConfirm"))) {
        localStorage.removeItem(HISTORY_KEY);
        renderHistoryList();
    }
});

// Applica al setup screen il risultato di parseWodText() (vedi wod-parser.js)
function applyParsedWod(parsed) {
    if (!parsed || !parsed.mode) return false;

    currentMode = parsed.mode;
    document.querySelectorAll(".mode-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.mode === currentMode);
    });

    if (parsed.mode === "hiit") {
        if (parsed.work) modeCacheValues.hiit.work = parsed.work;
        if (parsed.rest) setRawValue("rest", parsed.rest);
        if (parsed.rounds) {
            const val = Math.max(1, Math.min(30, parsed.rounds));
            document.getElementById("cfg-rounds").value = val;
            syncRoundsArray(val);
        }
        document.getElementById("cfg-advanced-toggle").checked = false;
    } else if (parsed.mode === "emom") {
        if (parsed.rounds) {
            document.getElementById("cfg-rounds").value = Math.max(1, Math.min(30, parsed.rounds));
        }
    } else if (parsed.mode === "amrap" || parsed.mode === "fortime") {
        if (parsed.cap) {
            modeCacheValues[parsed.mode].work = parsed.cap;
        }
    }
    // tabata: nessun altro campo da impostare, work/rest sono fissi

    adaptUIForMode();
    sanitizeWarningAgainstRoundTimes();
    updateSummary();
    return true;
}

let lastParsedWod = null;

document.getElementById("btn-wod-import").addEventListener("click", () => {
    document.getElementById("wod-textarea").value = "";
    const preview = document.getElementById("wod-preview");
    preview.textContent = "";
    preview.classList.remove("wod-preview-error");
    document.getElementById("btn-wod-apply").disabled = true;
    lastParsedWod = null;
    document.getElementById("wod-overlay").classList.add("visible");
});
document.getElementById("btn-wod-close").addEventListener("click", () => {
    document.getElementById("wod-overlay").classList.remove("visible");
});
document.getElementById("btn-wod-parse").addEventListener("click", () => {
    lastParsedWod = parseWodText(document.getElementById("wod-textarea").value);
    const preview = document.getElementById("wod-preview");
    const applyBtn = document.getElementById("btn-wod-apply");
    if (lastParsedWod) {
        preview.textContent = "✓ " + lastParsedWod.detectedLabel.join(" · ");
        preview.classList.remove("wod-preview-error");
        applyBtn.disabled = false;
    } else {
        preview.textContent = t("wodNotRecognized");
        preview.classList.add("wod-preview-error");
        applyBtn.disabled = true;
    }
});
document.getElementById("btn-wod-apply").addEventListener("click", () => {
    if (applyParsedWod(lastParsedWod)) {
        document.getElementById("wod-overlay").classList.remove("visible");
    }
});

// ── Selettore Lingua ──
function applyStaticTranslations() {
    document.documentElement.lang = getLang();
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.title = t(el.dataset.i18nTitle);
    });
}

function refreshDynamicTranslations() {
    adaptUIForMode();
    if (document.getElementById("history-overlay").classList.contains("visible")) {
        renderHistoryList();
    }
    updateVolumeControlsUI();
}

const langSwitcher = document.getElementById("lang-switcher");
langSwitcher.value = getLang();
langSwitcher.addEventListener("change", () => {
    if (setLang(langSwitcher.value)) {
        applyStaticTranslations();
        refreshDynamicTranslations();
    }
});

function setVolumeLevel(newLevel) {
    volumeLevel = Math.max(0, Math.min(100, newLevel));
    localStorage.setItem(VOLUME_KEY, String(volumeLevel));
    if (volumeLevel > 0) {
        lastNonZeroVolume = volumeLevel;
        localStorage.setItem(VOLUME_LAST_NONZERO_KEY, String(lastNonZeroVolume));
    }
    updateVolumeControlsUI();
}

function updateVolumeControlsUI() {
    const btn = document.getElementById("btn-mute");
    const slider = document.getElementById("volume-slider");
    btn.textContent = volumeLevel <= 0 ? "🔇" : "🔊";
    btn.title = volumeLevel <= 0 ? t("muteBtnUnmute") : t("muteBtnMute");
    slider.value = volumeLevel;
}

document.getElementById("btn-mute").addEventListener("click", () => {
    setVolumeLevel(volumeLevel > 0 ? 0 : lastNonZeroVolume);
});

document.getElementById("volume-slider").addEventListener("input", (e) => {
    setVolumeLevel(parseInt(e.target.value, 10) || 0);
});

applyStaticTranslations();
updateVolumeControlsUI();
loadConfig();

// ── Join automatico da QR code (?join=CODICE nell'URL) ──
const joinCodeFromUrl = new URLSearchParams(location.search).get("join");
if (joinCodeFromUrl) {
    history.replaceState(null, "", location.pathname);
    document.getElementById("join-accordion").open = true;
    document.getElementById("cfg-join-code").value = joinCodeFromUrl.trim().toUpperCase();
    joinSession();
}
