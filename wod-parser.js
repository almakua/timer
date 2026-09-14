// ── Incolla WOD: riconoscimento locale di formati testuali comuni ──
// Nessun server/AI coinvolto: solo pattern-matching su notazioni standard
// (EMOM/AMRAP/Tabata/For Time/round a intervalli). Non capisce testo libero
// o formati non elencati nel suggerimento del modale.
// Modulo separato dal DOM apposta: testabile da solo con `node --test`.

import { formatSecondsToMMSS } from "./time-utils.js";

// Frammento condiviso per un'unità "minuti" (EN + IT + apostrofo tipo "20'")
export const WOD_MIN_UNIT = "(?:min(?:ute)?s?|minuti?|')";

// Pattern a intervalli ripetuti tipo "6x 2:00 amrap ... rest 2' tra i set"
// o "4 sets (new set every 7 minutes)": qui "amrap"/"sets" descrivono la
// struttura del round (quanto dura ogni blocco), non un singolo countdown -
// va riconosciuto PRIMA dei controlli EMOM/AMRAP semplici, altrimenti "6x
// 2:00 amrap" verrebbe letto (male) come un unico AMRAP da 2 minuti.
export function detectWodIntervalSets(text) {
    let rounds = null;
    let work = null;

    // "6x 2:00" - richiede i minuti:secondi, per non confondersi con "3x3 back squat"
    let m = text.match(/(\d+)\s*x\s*(\d+):(\d{2})\b/);
    if (m) {
        rounds = parseInt(m[1], 10);
        work = parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    } else {
        // "4x4:00" già coperto sopra, "6x 20 min" con unità esplicita invece qui
        m = text.match(new RegExp("(\\d+)\\s*x\\s*(\\d+)\\s*" + WOD_MIN_UNIT));
        if (m) {
            rounds = parseInt(m[1], 10);
            work = parseInt(m[2], 10) * 60;
        }
    }

    // "4 sets (new set every 7 minutes)"
    if (rounds === null) {
        m = text.match(new RegExp("(\\d+)\\s*sets?\\b[\\s\\S]{0,30}?every\\s*(\\d+)\\s*" + WOD_MIN_UNIT + "?"));
        if (m) {
            rounds = parseInt(m[1], 10);
            work = parseInt(m[2], 10) * 60;
        }
    }

    if (rounds === null || work === null) return null;

    // Rest tra i round/set, in entrambi gli ordini possibili e IT/EN
    // ("rest 2 minutes between sets" oppure "2:00 rest tra i sets")
    let rest = 0;
    m = text.match(new RegExp("rest\\s*(\\d+)(?::(\\d{2}))?\\s*" + WOD_MIN_UNIT + "?[\\s\\S]{0,20}?(?:between|tra)"))
        || text.match(new RegExp("(\\d+)(?::(\\d{2}))?\\s*" + WOD_MIN_UNIT + "?\\s*rest[\\s\\S]{0,20}?(?:between|tra)"));
    if (m) {
        rest = parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    }

    return { rounds, work, rest };
}

export function parseWodText(rawText) {
    const text = (rawText || "").toLowerCase();
    if (!text.trim()) return null;

    const result = { mode: null, rounds: null, work: null, rest: null, cap: null, detectedLabel: [] };

    const intervalSets = detectWodIntervalSets(text);
    if (intervalSets) {
        result.mode = "hiit";
        result.rounds = intervalSets.rounds;
        result.work = intervalSets.work;
        result.rest = intervalSets.rest;
        result.detectedLabel.push(`HIIT ${result.rounds}x (${result.work}s/${result.rest}s)`);
    }

    // EMOM N (numero prima o dopo la parola chiave, es. "EMOM 12" o "10 min emom")
    if (!result.mode) {
        let m = text.match(/emom[^\d\n]{0,15}?(\d+)/)
            || text.match(/every\s+minute[^\d\n]{0,25}?(\d+)/)
            || text.match(new RegExp("(\\d+)\\s*" + WOD_MIN_UNIT + "?[^\\d\\n]{0,10}?emom"));
        if (m) {
            result.mode = "emom";
            result.rounds = parseInt(m[1], 10);
            result.detectedLabel.push(`EMOM ${result.rounds}'`);
        }
    }

    // TABATA
    if (!result.mode && /tabata/.test(text)) {
        result.mode = "tabata";
        result.detectedLabel.push("Tabata");
    }

    // AMRAP N (minuti o mm:ss, numero prima o dopo la parola chiave)
    if (!result.mode) {
        let m = text.match(/amrap[^\d\n]{0,10}?(\d+)(?::(\d{2}))?/)
            || text.match(new RegExp("(\\d+)(?::(\\d{2}))?\\s*" + WOD_MIN_UNIT + "?[^\\d\\n]{0,10}?amrap"));
        if (m) {
            result.mode = "amrap";
            result.cap = parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
            result.detectedLabel.push(`AMRAP ${formatSecondsToMMSS(result.cap)}`);
        }
    }

    // FOR TIME: schema classico di rep (21-15-9), "for time" o "rft"
    if (!result.mode) {
        const repScheme = text.match(/\b(\d{1,3}-){1,5}\d{1,3}\b/);
        const hasForTime = /for\s*time|\brft\b/.test(text);
        if (repScheme || hasForTime) {
            result.mode = "fortime";
            result.detectedLabel.push(repScheme ? `For Time (${repScheme[0]})` : "For Time");
        }
    }

    // Time cap, rilevante per AMRAP/FOR TIME (numero prima o dopo "cap", mm:ss incluso)
    let capMatch = text.match(/(?:time\s*)?cap[^\d\n]{0,5}?(\d+)(?::(\d{2}))?/)
        || text.match(new RegExp("(\\d+)(?::(\\d{2}))?\\s*" + WOD_MIN_UNIT + "?\\s*(?:time\\s*)?cap"));
    if (capMatch) {
        result.cap = parseInt(capMatch[1], 10) * 60 + (capMatch[2] ? parseInt(capMatch[2], 10) : 0);
    }

    // Round a intervalli espliciti, es. "5 rounds: 40s work / 20s rest", "8x 30/15",
    // "5 rounds of 40 on 20 off" (con o senza slash, con o senza etichette)
    if (!result.mode) {
        let m = text.match(/(\d+)\s*(?:rounds?|x)[^\d\n]{0,20}?(\d+)\s*(?:s|sec|seconds)?(?:\s*(?:work|on))?\s*[\/\-]\s*(\d+)\s*(?:s|sec|seconds)?(?:\s*(?:rest|off))?/)
            || text.match(/(\d+)\s*(?:rounds?|x)[^\d\n]{0,20}?(\d+)\s*(?:s|sec|seconds)?\s*(?:on|work)[^\d\n]{0,10}?(\d+)\s*(?:s|sec|seconds)?\s*(?:off|rest)/);
        if (m) {
            result.mode = "hiit";
            result.rounds = parseInt(m[1], 10);
            result.work = parseInt(m[2], 10);
            result.rest = parseInt(m[3], 10);
            result.detectedLabel.push(`HIIT ${result.rounds}x (${result.work}s/${result.rest}s)`);
        }
    }

    if (result.cap && result.mode === "fortime") {
        result.detectedLabel.push(`Cap ${formatSecondsToMMSS(result.cap)}`);
    }

    if (!result.mode) return null;
    return result;
}
