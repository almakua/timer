// ── Utility di formattazione/parsing tempo ──
// Nessuna dipendenza dal DOM: pensate per essere testabili da sole (node --test)
// e importate sia da app.js che da wod-parser.js.

export function formatSecondsToMMSS(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function parseAndSanitizeTimeToSeconds(
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
