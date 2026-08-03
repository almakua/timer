// ── Sincronizzazione Multi-Schermo (Firebase Firestore) ──
// Modulo caricato SOLO su richiesta (import dinamico), così l'uso in solitaria
// del timer resta interamente offline: nessuna chiamata di rete finché non si
// preme "Condividi" o "Segui un codice".

const FIREBASE_SDK_VERSION = "12.17.0";
const CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // esclude 0/O/1/I/L, facili da confondere
const SESSION_TTL_HOURS = 6;

let apiPromise = null;

async function getApi() {
    if (!apiPromise) {
        apiPromise = (async () => {
            const { firebaseConfig } = await import("./firebase-config.js");
            if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
                throw new Error(
                    "Firebase non configurato: inserisci i valori del tuo progetto in firebase-config.js",
                );
            }
            const [{ initializeApp }, firestore] = await Promise.all([
                import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
                import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`),
            ]);
            const app = initializeApp(firebaseConfig);
            const db = firestore.getFirestore(app);
            return { db, firestore };
        })();
    }
    return apiPromise;
}

function generateCode(length = 6) {
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr, (n) => CODE_CHARSET[n % CODE_CHARSET.length]).join("");
}

function generateControllerToken() {
    return crypto.randomUUID();
}

function expiryTimestamp(firestore) {
    return firestore.Timestamp.fromMillis(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
}

// Crea una nuova sessione condivisa. Ritorna { code, controllerToken }.
// Il controllerToken va tenuto solo sul dispositivo che comanda: serve a
// dimostrare, nelle security rules, che gli aggiornamenti vengono da chi ha creato la sessione.
export async function createSession(payload) {
    const { db, firestore } = await getApi();
    const { doc, getDoc, setDoc } = firestore;
    const controllerToken = generateControllerToken();

    let code;
    for (let attempt = 0; attempt < 5; attempt++) {
        code = generateCode();
        const snap = await getDoc(doc(db, "sessions", code));
        if (!snap.exists()) break;
    }

    await setDoc(doc(db, "sessions", code), {
        ...payload,
        controllerToken,
        updatedAt: firestore.serverTimestamp(),
        expireAt: expiryTimestamp(firestore),
    });

    return { code, controllerToken };
}

export async function updateSession(code, controllerToken, payload) {
    const { db, firestore } = await getApi();
    const { doc, updateDoc } = firestore;
    await updateDoc(doc(db, "sessions", code), {
        ...payload,
        controllerToken,
        updatedAt: firestore.serverTimestamp(),
        expireAt: expiryTimestamp(firestore),
    });
}

// Si iscrive agli aggiornamenti di una sessione. onData riceve i dati grezzi del documento.
// onError riceve un errore anche quando il codice non esiste (o è scaduto).
// Ritorna una funzione di unsubscribe.
export async function subscribeToSession(code, onData, onError) {
    const { db, firestore } = await getApi();
    const { doc, onSnapshot } = firestore;
    return onSnapshot(
        doc(db, "sessions", code),
        (snap) => {
            if (!snap.exists()) {
                onError(new Error("not-found"));
                return;
            }
            onData(snap.data());
        },
        (err) => onError(err),
    );
}
