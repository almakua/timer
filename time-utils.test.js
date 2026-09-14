import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSecondsToMMSS, parseAndSanitizeTimeToSeconds } from "./time-utils.js";

test("formatSecondsToMMSS aggiunge lo zero iniziale", () => {
    assert.equal(formatSecondsToMMSS(5), "00:05");
});

test("formatSecondsToMMSS gestisce minuti esatti", () => {
    assert.equal(formatSecondsToMMSS(60), "01:00");
});

test("formatSecondsToMMSS gestisce minuti e secondi insieme", () => {
    assert.equal(formatSecondsToMMSS(125), "02:05");
});

test("formatSecondsToMMSS gestisce lo zero", () => {
    assert.equal(formatSecondsToMMSS(0), "00:00");
});

test("parseAndSanitizeTimeToSeconds interpreta il formato mm:ss", () => {
    assert.equal(parseAndSanitizeTimeToSeconds("2:30"), 150);
});

test("parseAndSanitizeTimeToSeconds interpreta i secondi semplici", () => {
    assert.equal(parseAndSanitizeTimeToSeconds("45"), 45);
});

test("parseAndSanitizeTimeToSeconds usa il fallback su input vuoto", () => {
    assert.equal(parseAndSanitizeTimeToSeconds("", 10), 10);
});

test("parseAndSanitizeTimeToSeconds impone il minimo di 5s sui campi di lavoro", () => {
    assert.equal(parseAndSanitizeTimeToSeconds("2", 10, true), 5);
});

test("parseAndSanitizeTimeToSeconds accetta lo zero nel formato mm:ss per campi non di lavoro", () => {
    assert.equal(parseAndSanitizeTimeToSeconds("0:00", 10, false), 0);
});

test("comportamento noto: '0' da solo (non mm:ss) ricade sul fallback, non su zero", () => {
    // Non è un bug che introduco qui: `parseInt(clean) || fallbackValue` tratta
    // 0 come falsy in JS, quindi "0" torna il fallback invece di 0. La via
    // mm:ss ("0:00", vedi test sopra) non ha questo problema. Documentato
    // qui come comportamento reale, non "corretto" di nascosto in un task
    // che doveva solo aggiungere test.
    assert.equal(parseAndSanitizeTimeToSeconds("0", 10, false), 10);
});

test("parseAndSanitizeTimeToSeconds tronca al tetto di 7200s", () => {
    assert.equal(parseAndSanitizeTimeToSeconds("9999", 10, false), 7200);
});

test("parseAndSanitizeTimeToSeconds rimuove i caratteri non numerici", () => {
    assert.equal(parseAndSanitizeTimeToSeconds("1a:2b0", 10), 80);
});
