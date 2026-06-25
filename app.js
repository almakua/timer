let currentMode = "hiit";
let roundTimes = [40, 40, 40, 40, 40, 40, 40, 40];
let originalBaseTimes = [];
const DEFAULTS = { prepare: 10, work: 40, warning: 5, rest: 20 };

const modeCacheValues = {
    hiit: { work: 40 },
    tabata: { work: 20 },
    emom: { work: 60 },
    amrap: { work: 1200 },
    fortime: { work: 600 },
};

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
    if (e.data === 'tick') {
        tick();
    }
};

function formatSecondsToMMSS(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseAndSanitizeTimeToSeconds(
    inputStr,
    fallbackValue = 10,
    isWorkField = false,
) {
    let clean = inputStr.replace(/[^0-9:]/g, "").trim();
    if (!clean) return fallbackValue;

    let seconds = 0;
    if (clean.includes(":")) {
        const parts = clean.split(":");
        const mins = parseInt(parts[0]) || 0;
        const secs = parseInt(parts[1]) || 0;
        seconds = mins * 60 + secs;
    } else {
        seconds = parseInt(clean) || fallbackValue;
    }

    const minAllowed = isWorkField ? 5 : 0;
    if (seconds < minAllowed) seconds = minAllowed;
    if (seconds > 7200) seconds = 7200;

    return seconds;
}

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
    const rowToggle = document.getElementById("row-toggle-advanced");
    const rowSummary = document.getElementById("row-summary");
    const lblWorkMain = document.getElementById("lbl-work-main");
    const lblWorkSub = document.getElementById("lbl-work-sub");

    // Ripristina la visibilità di default
    rowRounds.classList.remove("hidden");
    rowPrepare.classList.remove("hidden");
    rowWork.classList.remove("hidden");
    rowWarning.classList.remove("hidden");
    rowRest.classList.remove("hidden");
    rowToggle.classList.remove("hidden");
    rowSummary.classList.remove("hidden");

    if (currentMode === "hiit") {
        setRawValue("work", modeCacheValues.hiit.work);
        lblWorkMain.textContent = "Durata round";
        lblWorkSub.textContent = "Tempo di lavoro (uguale per tutti i round)";
        toggleAdvancedMode();
    } else if (currentMode === "tabata") {
        // Tabata: 8 round, prepare 10s. Espone solo: durata round, warning e rest
        rowRounds.classList.add("hidden");
        rowPrepare.classList.add("hidden");
        rowToggle.classList.add("hidden");
        document.getElementById("rounds-inputs-container-wrap").classList.remove("visible");
        
        setRawValue("work", modeCacheValues.tabata.work);
        lblWorkMain.textContent = "Durata Round (Lavoro)";
        lblWorkSub.textContent = "Tempo di attività per ciascun set (Tabata)";
        updateSummary();
    } else if (currentMode === "emom") {
        // EMOM: rest=0s, work=60s. Espone solo: round totali, prepare e warning
        rowWork.classList.add("hidden");
        rowRest.classList.add("hidden");
        rowToggle.classList.add("hidden");
        document.getElementById("rounds-inputs-container-wrap").classList.remove("visible");
        
        lblWorkMain.textContent = "Tempo di Lavoro";
        lblWorkSub.textContent = "Preimpostato a 1:00 per ciascun minuto";
        updateSummary();
    } else if (currentMode === "amrap") {
        rowRounds.classList.add("hidden");
        rowWarning.classList.add("hidden");
        rowRest.classList.add("hidden");
        rowToggle.classList.add("hidden");
        rowSummary.classList.add("hidden");
        document.getElementById("rounds-inputs-container-wrap").classList.remove("visible");
        
        setRawValue("work", modeCacheValues.amrap.work);
        lblWorkMain.textContent = "Durata totale AMRAP";
        lblWorkSub.textContent = "Tempo totale limite dell'allenamento";
        updateSummary();
    } else if (currentMode === "fortime") {
        rowRounds.classList.add("hidden");
        rowWarning.classList.add("hidden");
        rowRest.classList.add("hidden");
        rowToggle.classList.add("hidden");
        rowSummary.classList.add("hidden");
        document.getElementById("rounds-inputs-container-wrap").classList.remove("visible");
        
        setRawValue("work", modeCacheValues.fortime.work);
        lblWorkMain.textContent = "Time Cap (Massimo)";
        lblWorkSub.textContent = "Interruzione forzata dopo questo tempo";
        updateSummary();
    }
}

function loadConfig() {
    const saved = localStorage.getItem("hiit-config-v11");
    if (!saved) {
        setRawValue("prepare", DEFAULTS.prepare);
        setRawValue("work", DEFAULTS.work);
        setRawValue("warning", DEFAULTS.warning);
        setRawValue("rest", DEFAULTS.rest);
        syncRoundsArray(parseInt(document.getElementById("cfg-rounds").value));
        adaptUIForMode();
        return;
    }
    try {
        const parsed = JSON.parse(saved);
        currentMode = parsed.currentMode || "hiit";
        document.querySelectorAll(".mode-tab").forEach((t) => {
            t.classList.toggle("active", t.dataset.mode === currentMode);
        });
        setRawValue("prepare", parsed.prepare ?? DEFAULTS.prepare);
        setRawValue("work", parsed.work ?? DEFAULTS.work);
        setRawValue("warning", parsed.warning ?? DEFAULTS.warning);
        setRawValue("rest", parsed.rest ?? DEFAULTS.rest);
        document.getElementById("cfg-advanced-toggle").checked = parsed.advancedMode ?? false;
        if (parsed.modeCacheValues) Object.assign(modeCacheValues, parsed.modeCacheValues);
        if (Array.isArray(parsed.roundTimes) && parsed.roundTimes.length > 0) {
            roundTimes = parsed.roundTimes;
        }
    } catch (e) {
        console.error(e);
    }
    adaptUIForMode();
}

function saveConfig() {
    const cfg = {
        currentMode: currentMode,
        prepare: getRawValue("prepare"),
        work: getRawValue("work"),
        warning: getRawValue("warning"),
        rest: getRawValue("rest"),
        advancedMode: document.getElementById("cfg-advanced-toggle").checked,
        roundTimes: roundTimes,
        modeCacheValues: modeCacheValues,
    };
    localStorage.setItem("hiit-config-v11", JSON.stringify(cfg));
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

function buildRoundInputs() {
    document.getElementById("cfg-rounds").value = roundTimes.length;
    const container = document.getElementById("rounds-inputs-container");
    container.innerHTML = "";

    roundTimes.forEach((time, index) => {
        const row = document.createElement("div");
        row.className = "round-item";
        row.innerHTML = `
            <span>Set ${index + 1}</span>
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

["prepare", "work", "rest", "warning"].forEach((field) => {
    const input = document.getElementById("cfg-" + field);
    const handleMainBlur = () => {
        const def = DEFAULTS[field];
        const isWork = field === "work" || field === "warning";
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

document.getElementById("btn-round-plus").addEventListener("click", () => {
    let currentRounds = roundTimes.length;
    if (currentRounds >= 30) return;
    syncRoundsArray(currentRounds + 1);
    if (!document.getElementById("cfg-advanced-toggle").checked) {
        const standardValue = getRawValue("work") || DEFAULTS.work;
        roundTimes[roundTimes.length - 1] = standardValue;
    }
    sanitizeWarningAgainstRoundTimes();
    buildRoundInputs();
});

document.getElementById("btn-round-minus").addEventListener("click", () => {
    let currentRounds = roundTimes.length;
    if (currentRounds <= 1) return;
    syncRoundsArray(currentRounds - 1);
    sanitizeWarningAgainstRoundTimes();
    buildRoundInputs();
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

function updateSummary() {
    let prepare = 10;
    let rest = 20;
    let totalRounds = 8;
    let workTotal = 0;

    if (currentMode === "hiit") {
        prepare = getRawValue("prepare");
        rest = getRawValue("rest");
        totalRounds = roundTimes.length;

        if (document.getElementById("cfg-advanced-toggle").checked) {
            workTotal = roundTimes.reduce((a, b) => a + b, 0);
        } else {
            const standardValue = getRawValue("work") || DEFAULTS.work;
            workTotal = totalRounds * standardValue;
            roundTimes = Array(totalRounds).fill(standardValue);
        }
    } else if (currentMode === "tabata") {
        prepare = 10;
        rest = getRawValue("rest");
        totalRounds = 8;
        const workTime = getRawValue("work") || 20;
        workTotal = totalRounds * workTime;
    } else if (currentMode === "emom") {
        prepare = getRawValue("prepare");
        rest = 0;
        totalRounds = parseInt(document.getElementById("cfg-rounds").value) || 10;
        const workTime = 60;
        workTotal = totalRounds * workTime;
    } else if (currentMode === "amrap" || currentMode === "fortime") {
        prepare = getRawValue("prepare");
        workTotal = getRawValue("work");
        totalRounds = 1;
        rest = 0;
    }

    const restTotal = (currentMode === "hiit" || currentMode === "tabata") && totalRounds > 1 ? (totalRounds - 1) * rest : 0;
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
        if (field !== "work" && field !== "warning" && newSec < 0) newSec = 0;

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
    try {
        const ctx = getAudioCtx();
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = frequency;
        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.9, now + 0.005);
        gainNode.gain.setValueAtTime(0.9, now + duration - 0.01);
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
let state = null;
let workoutHasStarted = false;

function setupSequenceStage() {
    getAudioCtx();
    const seq = [];
    let prepare = 10;
    let warning = 5;
    let rest = 20;
    let rounds = 8;

    originalBaseTimes = [];

    if (currentMode === "hiit") {
        prepare = getRawValue("prepare");
        rest = getRawValue("rest");
        warning = getRawValue("warning");
        rounds = roundTimes.length;
        
        if (prepare > 0) {
            seq.push({ phase: "prepare", duration: prepare, round: null });
            originalBaseTimes.push(prepare);
        }
        roundTimes.forEach((wTime, index) => {
            const rNumber = index + 1;
            seq.push({ phase: "work", duration: wTime, round: rNumber });
            originalBaseTimes.push(wTime);
            if (rNumber < roundTimes.length && rest > 0) {
                seq.push({ phase: "rest", duration: rest, round: rNumber });
                originalBaseTimes.push(rest);
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
        beepsFired: new Set(),
        lastTick: performance.now(),
        totalRounds: rounds,
    };

    workoutHasStarted = false;

    // Configurazione Recap in basso
    if (currentMode === "hiit" || currentMode === "tabata" || currentMode === "emom") {
        document.getElementById("rcp-rounds").textContent = state.totalRounds;
        document.getElementById("rcp-warning").textContent = `${warning}s`;
        if (currentMode === "hiit") {
            const isAdvanced = document.getElementById("cfg-advanced-toggle").checked;
            document.getElementById("rcp-work").textContent = isAdvanced ? "Misto" : `${getRawValue("work")}s`;
            document.getElementById("rcp-rest").textContent = `${rest}s`;
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
    document.getElementById("btn-pause").textContent = "⏸ Pausa";

    showActive();
    acquireWakeLock();
    renderActive();
}

function startRunningWorkout() {
    workoutHasStarted = true;
    document.getElementById("btn-active-start").style.display = "none";
    document.getElementById("btn-pause").style.display = "block";
    state.lastTick = performance.now();
    state.beepsFired = new Set();
    timerWorker.postMessage('start');
}

function onPhaseStart() {
    state.beepsFired = new Set();
    playHighBeep();
}

function tick() {
    if (!workoutHasStarted || (state && state.paused)) return;

    const now = performance.now();
    const delta = (now - state.lastTick) / 1000;
    state.lastTick = now;

    const seg = state.seq[state.idx];

    if (state.mode === "fortime" && seg.phase === "work") {
        state.elapsedInPhase += delta;
        state.remaining = seg.duration - state.elapsedInPhase;

        if (state.elapsedInPhase >= seg.duration) {
            finish();
            return;
        }
    } else {
        state.remaining -= delta;
        if (state.remaining <= 0) {
            advancePhase();
            return;
        }
    }

    // Beeps acustici
    const triggerBeepVal = Math.ceil(state.remaining);
    
    if ((state.mode === "hiit" || state.mode === "tabata" || state.mode === "emom") && seg.phase === "work") {
        const warningLimit = getRawValue("warning") || 0;
        if (warningLimit > 0 && triggerBeepVal === warningLimit) {
            if (!state.beepsFired.has("warning-pre")) {
                state.beepsFired.add("warning-pre");
                playLowBeep();
            }
        }
    }

    // Beep 3, 2, 1 secondi prima della fine della fase
    if (!(state.mode === "fortime" && seg.phase === "work")) {
        if (triggerBeepVal <= 3 && triggerBeepVal >= 1) {
            if (!state.beepsFired.has(triggerBeepVal)) {
                state.beepsFired.add(triggerBeepVal);
                playLowBeep();
            }
        }
    }

    renderActive();
}

function advancePhase() {
    state.idx++;
    if (state.idx >= state.seq.length) {
        finish();
        return;
    }

    const next = state.seq[state.idx];
    state.remaining = next.duration;
    state.elapsedInPhase = 0;
    state.beepsFired = new Set();
    state.lastTick = performance.now();

    renderActive();
    onPhaseStart();
}

// ── REGOLATORI EXTRA TIME (+1m / -1m) ──
document.getElementById("btn-add-extratime").addEventListener("click", () => {
    if (!state) return;
    const seg = state.seq[state.idx];
    if (seg.phase !== "work" || state.mode !== "fortime") return;

    const amount = 60;
    seg.duration += amount;
    state.beepsFired.clear();
    renderActive();
});

document.getElementById("btn-remove-extratime").addEventListener("click", () => {
    if (!state) return;
    const seg = state.seq[state.idx];
    if (seg.phase !== "work" || state.mode !== "fortime") return;

    const amount = 60;
    const baseTimeInvalicabile = originalBaseTimes[state.idx];

    if (seg.duration - amount >= baseTimeInvalicabile) {
        seg.duration -= amount;
        if (state.remaining < amount) state.remaining = 0;
        state.beepsFired.clear();
        renderActive();
    }
});

function finish() {
    timerWorker.postMessage('stop');
    releaseWakeLock();
    playHighBeep();
    setTimeout(playHighBeep, 400);

    if (state.mode === "hiit" || state.mode === "tabata" || state.mode === "emom") {
        document.getElementById("finished-msg").textContent = `${state.totalRounds} round completati!`;
    } else if (state.mode === "amrap") {
        document.getElementById("finished-msg").textContent = `Tempo scaduto! Allenamento completato.`;
    } else if (state.mode === "fortime") {
        document.getElementById("finished-msg").textContent = `Time cap raggiunto a ${formatSecondsToMMSS(Math.floor(state.elapsedInPhase))}!`;
    }
    document.getElementById("finished-overlay").classList.add("visible");
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
            (state.mode === "hiit" || state.mode === "tabata" || state.mode === "emom") ? `${state.totalRounds} round` : "Pronto";
        document.getElementById("time-label").textContent = "prepare";
    } else {
        if (state.mode === "hiit" || state.mode === "tabata" || state.mode === "emom") {
            roundBox.classList.remove("hidden");
            dividerBox.classList.remove("hidden");
            progressWrap.classList.remove("hidden");
            modifiersZone.classList.remove("visible");
            timecapSubinfo.classList.remove("visible");

            document.getElementById("round-num").textContent = seg.round;
            document.getElementById("round-label").textContent = `/ ${state.totalRounds} round`;
            document.getElementById("time-label").textContent = seg.phase === "rest" ? "rest" : "lavoro";
        } else {
            roundBox.classList.add("hidden");
            dividerBox.classList.add("hidden");

            if (state.mode === "amrap") {
                modifiersZone.classList.remove("visible");
                timecapSubinfo.classList.remove("visible");
                progressWrap.classList.remove("hidden");
                document.getElementById("time-label").textContent = "tempo rimanente";
            } else if (state.mode === "fortime") {
                modifiersZone.classList.add("visible");
                timecapSubinfo.classList.add("visible");
                document.getElementById("timecap-target-val").textContent = formatSecondsToMMSS(seg.duration);
                progressWrap.classList.add("hidden");
                document.getElementById("time-label").textContent = "tempo trascorso";
            }
        }
    }

    document.getElementById("time-val").textContent = formatSecondsToMMSS(displaySeconds);

    let pct = (state.remaining / seg.duration) * 100;
    document.getElementById("progress-bar").style.width = Math.max(0, pct) + "%";

    document.body.classList.remove("phase-prepare", "phase-work", "phase-rest");
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
    document.body.classList.remove("phase-prepare", "phase-work", "phase-rest");
}

function togglePause() {
    if (!state) return;
    state.paused = !state.paused;
    if (!state.paused) {
        state.lastTick = performance.now();
        timerWorker.postMessage('start');
    } else {
        timerWorker.postMessage('stop');
    }
    document.getElementById("btn-pause").textContent = state.paused ? "▶ Riprendi" : "⏸ Pausa";
}

// ── Gestione Schermo Intero (Fullscreen) ──
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.error(`Errore attivando lo schermo intero: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

// ── Scorciatoie da Tastiera / Telecomando clicker ──
document.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === "INPUT") return;

    const key = e.key.toLowerCase();
    const activeVisible = document.getElementById("active-screen").classList.contains("visible");
    const overlayVisible = document.getElementById("finished-overlay").classList.contains("visible");

    if (e.code === "Space" || key === " ") {
        e.preventDefault();
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
            timerWorker.postMessage('stop');
            releaseWakeLock();
            state = null;
            showSetup();
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
document.getElementById("btn-stop").addEventListener("click", () => {
    timerWorker.postMessage('stop');
    releaseWakeLock();
    state = null;
    showSetup();
});
document.getElementById("btn-done").addEventListener("click", () => {
    timerWorker.postMessage('stop');
    releaseWakeLock();
    state = null;
    showSetup();
});

// Bottone fullscreen in active screen
document.getElementById("btn-fullscreen").addEventListener("click", toggleFullScreen);

loadConfig();
