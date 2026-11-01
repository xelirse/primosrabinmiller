// ============================================================
// CONSTANTES (función, sin variables globales)
// ============================================================
function CONST() {
    if (!CONST._v) {
        CONST._v = {
            SEGMENT_SIZE_BYTES: 4190208,
            SEGMENT_BITS: 4190208 * 8,
            B64_ALPHABET: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
            MILLER_RABIN_BASES: [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n],
            AUTOSAVE_INTERVAL_MS: 60000,
            SESSION_STORAGE_KEY: 'iprimo_sessions_v1',
            ACTIVE_SESSION_KEY: 'iprimo_active_session',
            MAX_SESSIONS: 20,
            SESSION_FILE_VERSION: 1
        };
    }
    return CONST._v;
}

// ============================================================
// ESTADO MUTABLE (función, sin variables globales)
// ============================================================
function estado() {
    if (!estado._v) {
        estado._v = {
            isRunning: false,
            cancelRequested: false,
            basePrimesArray: [],
            currentSession: null,
            autosaveTimer: null
        };
    }
    return estado._v;
}

// ============================================================
// HELPERS DE FORMATO
// ============================================================
function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
}

function describeSegment() {
    const c = CONST();
    return `${formatBytes(c.SEGMENT_SIZE_BYTES)} (${c.SEGMENT_SIZE_BYTES.toLocaleString()} bytes · ${c.SEGMENT_BITS.toLocaleString()} números)`;
}

function estimateMemory(basePrimesCount) {
    const BASE_PRIME_BYTES = 32;
    return CONST().SEGMENT_SIZE_BYTES + basePrimesCount * BASE_PRIME_BYTES;
}
