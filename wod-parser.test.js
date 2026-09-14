import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWodText } from "./wod-parser.js";

// Ogni caso qui sotto è stato verificato manualmente nel browser durante lo
// sviluppo del parser (incluso il testo reale del WOD del box dell'utente
// che aveva fatto fallire la prima versione). Fissarli come test evita che
// tornino silenziosamente con una futura modifica alle regex.

test("EMOM con numero dopo la parola chiave", () => {
    const r = parseWodText("EMOM 12\n5 Burpees");
    assert.equal(r.mode, "emom");
    assert.equal(r.rounds, 12);
});

test("EMOM con numero prima della parola chiave", () => {
    const r = parseWodText("10 min emom");
    assert.equal(r.mode, "emom");
    assert.equal(r.rounds, 10);
});

test("AMRAP in minuti", () => {
    const r = parseWodText("AMRAP 20\n10 Wall balls");
    assert.equal(r.mode, "amrap");
    assert.equal(r.cap, 20 * 60);
});

test("AMRAP in formato mm:ss", () => {
    const r = parseWodText("AMRAP 17:00");
    assert.equal(r.mode, "amrap");
    assert.equal(r.cap, 17 * 60);
});

test("Tabata", () => {
    const r = parseWodText("Tabata\n8 rounds squat");
    assert.equal(r.mode, "tabata");
});

test("For Time con schema di rep classico e cap dopo la parola chiave", () => {
    const r = parseWodText("21-15-9\nFor time, cap 12min");
    assert.equal(r.mode, "fortime");
    assert.equal(r.cap, 12 * 60);
});

test("For Time con cap prima della parola chiave, attraverso righe vuote e testo successivo (regressione reale)", () => {
    // Il testo dopo "cap" contiene righe vuote e poi "50 wall ball": la prima
    // versione del parser catturava "50" invece di "20", perché il gap di
    // ricerca tra la parola chiave e il numero attraversava gli a-capo.
    const r = parseWodText(`filer mignon
For Time, 20 minutes cap

50 wall ball
15 burpees
20 box jump over
50 medball box step over
20 box jump over
15 burpees
50 wall ball`);
    assert.equal(r.mode, "fortime");
    assert.equal(r.cap, 20 * 60);
});

test("For Time con 'round' al singolare e cap prima della parola chiave", () => {
    const r = parseWodText("8 round for time, 14 minutes cap:");
    assert.equal(r.mode, "fortime");
    assert.equal(r.cap, 14 * 60);
});

test("HIIT a intervalli con etichette work/rest e slash", () => {
    const r = parseWodText("5 rounds: 40s work / 20s rest\nAssault bike");
    assert.equal(r.mode, "hiit");
    assert.equal(r.rounds, 5);
    assert.equal(r.work, 40);
    assert.equal(r.rest, 20);
});

test("HIIT a intervalli con notazione on/off, senza slash", () => {
    const r = parseWodText("5 rounds of 40 on 20 off");
    assert.equal(r.mode, "hiit");
    assert.equal(r.rounds, 5);
    assert.equal(r.work, 40);
    assert.equal(r.rest, 20);
});

test("HIIT a intervalli, notazione slash minimale", () => {
    const r = parseWodText("8x 30/15");
    assert.equal(r.mode, "hiit");
    assert.equal(r.rounds, 8);
    assert.equal(r.work, 30);
    assert.equal(r.rest, 15);
});

test("Round a intervalli ripetuti: 'Nx mm:ss amrap' con rest dopo, in inglese", () => {
    const r = parseWodText(`6x 2:00 amrap
[wod descr]
*rest 2 minutes between sets`);
    assert.equal(r.mode, "hiit");
    assert.equal(r.rounds, 6);
    assert.equal(r.work, 120);
    assert.equal(r.rest, 120);
});

test("Round a intervalli ripetuti: 'Nxmm:ss AMRAP' con rest prima, in italiano", () => {
    const r = parseWodText("4x4:00 AMRAP, 2:00 rest tra i sets");
    assert.equal(r.mode, "hiit");
    assert.equal(r.rounds, 4);
    assert.equal(r.work, 240);
    assert.equal(r.rest, 120);
});

test("Round a intervalli ripetuti: 'N sets every N minutes' senza rest indicato", () => {
    const r = parseWodText("4 sets (new set every 7 minutes)");
    assert.equal(r.mode, "hiit");
    assert.equal(r.rounds, 4);
    assert.equal(r.work, 420);
    assert.equal(r.rest, 0);
});

test("Testo libero senza struttura riconoscibile ritorna null", () => {
    assert.equal(parseWodText("Bella lì, oggi ci divertiamo con gli anelli"), null);
});

test("Testo vuoto o solo spazi ritorna null", () => {
    assert.equal(parseWodText(""), null);
    assert.equal(parseWodText("   \n  "), null);
});

test("Notazione di forza (es. '3x3 back squat') non viene letta come intervallo a tempo", () => {
    assert.equal(parseWodText("3x3 back squat\n5x5 deadlift"), null);
});
