// ============================================================
// CONFIGURACIÓN Y CONSTANTES
// ============================================================
const SEGMENT_SIZE_BYTES = 4190208;            // Tamaño real del segmento (bytes)
const SEGMENT_BITS = SEGMENT_SIZE_BYTES * 8;   // Números cubiertos por segmento
const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const MILLER_RABIN_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

// --- Sesiones ---
const AUTOSAVE_INTERVAL_MS = 60000;            // 1 minuto
const SESSION_STORAGE_KEY = 'iprimo_sessions_v1';
const MAX_SESSIONS = 20;
const SESSION_FILE_VERSION = 1;

let isRunning = false;
let cancelRequested = false;
let basePrimesArray = [];
let currentSession = null;
let autosaveTimer = null;

// ============================================================
// UTILIDADES DE FORMATO (tamaño de segmento dinámico)
// ============================================================
function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
}

function describeSegment() {
    return `${formatBytes(SEGMENT_SIZE_BYTES)} (${SEGMENT_SIZE_BYTES.toLocaleString()} bytes · ${SEGMENT_BITS.toLocaleString()} números)`;
}

function estimateMemory(basePrimesCount) {
    const BASE_PRIME_BYTES = 32;
    return SEGMENT_SIZE_BYTES + basePrimesCount * BASE_PRIME_BYTES;
}

// ============================================================
// FUNCIONES AUXILIARES BigInt
// ============================================================
function bigIntToBase64(n) {
    if (n === 0n) return "A";
    let temp = [];
    while (n > 0n) {
        temp.push(B64_ALPHABET[Number(n % 64n)]);
        n = n / 64n;
    }
    return temp.reverse().join('');
}

function base64ToBigInt(str) {
    let result = 0n;
    for (let ch of str) {
        const index = B64_ALPHABET.indexOf(ch);
        if (index === -1) break;
        result = result * 64n + BigInt(index);
    }
    return result;
}

function modPow(base, exp, mod) {
    let result = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) result = (result * base) % mod;
        base = (base * base) % mod;
        exp = exp / 2n;
    }
    return result;
}

function millerRabin(n, k = 12) {
    if (n < 2n) return false;
    if (n === 2n || n === 3n) return true;
    if (n % 2n === 0n) return false;
    let d = n - 1n;
    let s = 0;
    while (d % 2n === 0n) { d = d / 2n; s++; }
    for (let i = 0; i < k && i < MILLER_RABIN_BASES.length; i++) {
        const a = MILLER_RABIN_BASES[i];
        if (n <= a) break;
        let x = modPow(a, d, n);
        if (x === 1n || x === n - 1n) continue;
        let composite = true;
        for (let r = 1; r < s; r++) {
            x = (x * x) % n;
            if (x === n - 1n) { composite = false; break; }
        }
        if (composite) return false;
    }
    return true;
}

function nextPrime(n) {
    if (n <= 2n) return 2n;
    if (n % 2n === 0n) n += 1n;
    while (!millerRabin(n, 5)) n += 2n;
    return n;
}

// ============================================================
// GENERACIÓN DE PRIMOS BASE
// ============================================================
function generateBasePrimes(limitSqrt) {
    const size = Number(limitSqrt) + 1;
    const sieve = new Uint8Array(Math.floor(size / 8) + 1);
    const limitNum = Number(limitSqrt);
    for (let p = 2; p * p <= limitNum; p++) {
        if (((sieve[p >> 3] >> (p & 7)) & 1) === 0) {
            for (let i = p * p; i <= limitNum; i += p) sieve[i >> 3] |= (1 << (i & 7));
        }
    }
    const primes = [];
    for (let p = 2; p <= limitNum; p++) {
        if (((sieve[p >> 3] >> (p & 7)) & 1) === 0) primes.push(BigInt(p));
    }
    return primes;
}

// ============================================================
// CRIBADO DE SEGMENTO
// ============================================================
function sieveSegment(low, high, basePrimes, segmentArray) {
    segmentArray.fill(0);
    const lowNum = Number(low);
    const highNum = Number(high);
    for (let i = 0; i < basePrimes.length; i++) {
        const pBig = basePrimes[i];
        const pNum = Number(pBig);
        if (pNum * pNum > highNum) break;
        let firstMultiple = Math.floor(lowNum / pNum) * pNum;
        if (firstMultiple < lowNum) firstMultiple += pNum;
        if (firstMultiple === pNum) firstMultiple += pNum;
        for (let j = firstMultiple; j <= highNum; j += pNum) {
            const idx = j - lowNum;
            segmentArray[idx >> 3] |= (1 << (idx & 7));
        }
    }
    let count = 0n;
    let lastPrime = 0n;
    for (let i = 0; i < SEGMENT_BITS; i++) {
        if (((segmentArray[i >> 3] >> (i & 7)) & 1) === 0) {
            count++;
            lastPrime = low + BigInt(i);
        }
    }
    return { count, lastPrime };
}

// ============================================================
// UTILIDADES DE SESIÓN (localStorage)
// ============================================================
function loadSessions() {
    try {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('No se pudieron cargar las sesiones:', e);
        return [];
    }
}

function saveSessions(sessions) {
    try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
    } catch (e) {
        console.warn('No se pudieron guardar las sesiones:', e);
    }
}

function upsertSession(session) {
    if (!session) return;
    const sessions = loadSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) sessions[idx] = session;
    else sessions.unshift(session);
    saveSessions(sessions);
    renderSessions();
}

function deleteSessionById(id) {
    const sessions = loadSessions().filter(s => s.id !== id);
    saveSessions(sessions);
    renderSessions();
}

function clearAllSessions() {
    if (!confirm('¿Eliminar todas las sesiones guardadas? Esta acción no se puede deshacer.')) return;
    saveSessions([]);
    renderSessions();
}

function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'hace unos segundos';
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)} h`;
    return `hace ${Math.floor(diff / 86400000)} d`;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// ============================================================
// EXPORTAR / IMPORTAR SESIONES
// ============================================================
function sanitizeSession(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const mode = raw.mode;
    if (mode !== 'decimal' && mode !== 'b64' && mode !== 'ab64') return null;
    const inputValue = typeof raw.inputValue === 'string' ? raw.inputValue : '';
    if (!inputValue) return null;

    const id = typeof raw.id === 'string' && raw.id.length > 0
        ? raw.id
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
        id,
        mode,
        inputValue,
        targetIndex: raw.targetIndex != null ? String(raw.targetIndex) : null,
        targetPrime: raw.targetPrime != null ? String(raw.targetPrime) : null,
        status: ['running', 'paused', 'completed'].includes(raw.status) ? raw.status : 'paused',
        progress: typeof raw.progress === 'number' ? Math.min(100, Math.max(0, raw.progress)) : 0,
        low: raw.low != null ? String(raw.low) : '2',
        count: raw.count != null ? String(raw.count) : '0',
        latestPrimeFound: raw.latestPrimeFound != null ? String(raw.latestPrimeFound) : '0',
        segmentNumber: typeof raw.segmentNumber === 'number' ? raw.segmentNumber : 0,
        elapsedSeconds: typeof raw.elapsedSeconds === 'number' ? raw.elapsedSeconds : 0,
        basePrimesCount: typeof raw.basePrimesCount === 'number' ? raw.basePrimesCount : 0,
        memoryBytes: typeof raw.memoryBytes === 'number' ? raw.memoryBytes : 0,
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    };
}

function exportSession(id) {
    const sessions = loadSessions();
    const session = sessions.find(s => s.id === id);
    if (!session) {
        alert('La sesión no existe.');
        return;
    }
    const payload = {
        app: 'iprimo',
        version: SESSION_FILE_VERSION,
        exportedAt: new Date().toISOString(),
        sessions: [session],
    };
    downloadJSON(payload, `iprimo-session-${session.id}.json`);
}

function exportAllSessions() {
    const sessions = loadSessions();
    if (sessions.length === 0) {
        alert('No hay sesiones para exportar.');
        return;
    }
    const payload = {
        app: 'iprimo',
        version: SESSION_FILE_VERSION,
        exportedAt: new Date().toISOString(),
        sessions,
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJSON(payload, `iprimo-sessions-${stamp}.json`);
}

function downloadJSON(obj, filename) {
    try {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
        console.error('Error al exportar:', e);
        alert('No se pudo exportar la sesión.');
    }
}

async function handleImportFile(file) {
    if (!file) return;
    try {
        const text = await file.text();
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            alert('El archivo no es un JSON válido.');
            return;
        }

        let rawList = [];
        if (Array.isArray(parsed)) rawList = parsed;
        else if (parsed && Array.isArray(parsed.sessions)) rawList = parsed.sessions;
        else if (parsed && typeof parsed === 'object') rawList = [parsed];
        else {
            alert('Formato de archivo no reconocido.');
            return;
        }

        const imported = rawList.map(sanitizeSession).filter(Boolean);
        if (imported.length === 0) {
            alert('No se encontraron sesiones válidas en el archivo.');
            return;
        }

        const existing = loadSessions();
        const existingIds = new Set(existing.map(s => s.id));
        let added = 0, replaced = 0;

        for (const s of imported) {
            if (existingIds.has(s.id)) {
                const idx = existing.findIndex(e => e.id === s.id);
                existing[idx] = s;
                replaced++;
            } else {
                existing.unshift(s);
                existingIds.add(s.id);
                added++;
            }
        }

        // Las sesiones importadas nunca quedan como 'running' huérfano
        for (const s of existing) {
            if (s.status === 'running' && !isRunning) {
                s.status = 'paused';
            }
        }

        saveSessions(existing);
        renderSessions();
        updateAutosaveInfo();
        alert(`✅ Importación completada.\n\nAñadidas: ${added}\nReemplazadas: ${replaced}\nTotal en lista: ${existing.length}`);
    } catch (e) {
        console.error('Error al importar:', e);
        alert('Error al procesar el archivo.');
    }
}

function renderSessions() {
    const list = document.getElementById('sessionsList');
    if (!list) return;
    const sessions = loadSessions();
    if (sessions.length === 0) {
        list.innerHTML = '<div class="session-empty">No hay sesiones guardadas todavía. Use «📂 Cargar sesión» para importar desde un archivo.</div>';
        return;
    }
    list.innerHTML = sessions.map(s => {
        const statusClass = s.status === 'running' ? 'running'
            : s.status === 'completed' ? 'completed' : 'paused';
        const statusText = s.status === 'running' ? '● En curso'
            : s.status === 'completed' ? '✔ Completada' : '⏸ Pausada';
        const progress = Math.min(100, Math.max(0, s.progress || 0));
        const modeLabel = s.mode === 'decimal' ? 'Índice dec'
            : s.mode === 'b64' ? 'Índice B64' : 'Primo B64';
        const raw = s.inputValue || '';
        const valueDisplay = raw.length > 44
            ? raw.slice(0, 22) + '…' + raw.slice(-18)
            : raw;
        const elapsed = (s.elapsedSeconds && s.elapsedSeconds > 0)
            ? `${s.elapsedSeconds.toFixed(1)}s` : '—';
        const updated = timeAgo(s.updatedAt || Date.now());
        const canResume = s.status === 'paused' || s.status === 'completed';
        const resumeLabel = s.status === 'completed' ? '🔁 Recalcular' : '▶ Reanudar';
        return `
            <div class="session-card" data-id="${s.id}">
                <div class="session-top">
                    <span class="session-mode">${modeLabel}</span>
                    <span class="session-value" title="${escapeHtml(raw)}">${escapeHtml(valueDisplay)}</span>
                    <span class="session-status ${statusClass}">${statusText}</span>
                </div>
                <div class="session-progress-bar">
                    <div class="session-progress-fill" style="width:${progress}%"></div>
                </div>
                <div class="session-bottom">
                    <div class="session-meta">
                        <span>${progress.toFixed(2)}%</span>
                        <span>⏱ ${elapsed}</span>
                        <span>🕒 ${updated}</span>
                    </div>
                    <div class="session-actions">
                        ${canResume
                            ? `<button class="session-btn resume-btn" onclick="resumeSession('${s.id}')">${resumeLabel}</button>`
                            : ''}
                        <button class="session-btn export-btn" title="Exportar a JSON" onclick="exportSession('${s.id}')">⬇ Exportar</button>
                        <button class="session-btn delete-btn" title="Eliminar" onclick="deleteSessionById('${s.id}')">🗑</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateAutosaveInfo() {
    const el = document.getElementById('autosaveInfo');
    if (!el) return;
    if (isRunning) {
        el.textContent = `Guardado automático cada 5 s · último: ${new Date().toLocaleTimeString()}`;
    } else {
        el.textContent = 'Guardado automático cada 5 s';
    }
}

function startAutosave() {
    stopAutosave();
    autosaveTimer = setInterval(() => {
        if (isRunning && currentSession) {
            persistCurrentSession('running');
        }
    }, AUTOSAVE_INTERVAL_MS);
}

function stopAutosave() {
    if (autosaveTimer) {
        clearInterval(autosaveTimer);
        autosaveTimer = null;
    }
}

function persistCurrentSession(status) {
    if (!currentSession) return;
    currentSession.status = status;
    currentSession.updatedAt = Date.now();
    upsertSession({ ...currentSession });
    updateAutosaveInfo();
}

// ============================================================
// REANUDACIÓN AUTOMÁTICA TRAS CIERRE / RECARGA
// ============================================================
function markActiveSession(id) {
    try {
        if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id);
        else localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch (e) { /* almacenamiento no disponible */ }
}

// Las sesiones que quedaron como 'running' (cierre abrupto) pasan a 'paused'
// para que siempre puedan reanudarse desde la lista.
function recoverInterruptedSessions() {
    const sessions = loadSessions();
    let changed = false;
    for (const s of sessions) {
        if (s.status === 'running') { s.status = 'paused'; changed = true; }
    }
    if (changed) { saveSessions(sessions); renderSessions(); }
}

// Al cargar la página: si había una búsqueda en curso cuando se cerró,
// se ofrece reanudarla directamente, sin necesidad de exportar/importar.
function offerInterruptedResume() {
    recoverInterruptedSessions();

    let activeId = null;
    try { activeId = localStorage.getItem(ACTIVE_SESSION_KEY); } catch (e) { /* ignore */ }
    if (!activeId) return;
    markActiveSession(null);

    const session = loadSessions().find(s => s.id === activeId);
    if (!session || session.status === 'completed') return;

    const progress = (session.progress || 0).toFixed(2);
    const modeLabel = session.mode === 'decimal' ? 'índice decimal'
        : session.mode === 'b64' ? 'índice en Base64' : 'valor del primo en Base64';
    const msg = `⚡ Se detectó una búsqueda interrumpida al cerrar la página:\n\n` +
        `Modo: ${modeLabel}\nValor: ${session.inputValue}\nProgreso: ${progress}%\n\n` +
        `¿Desea reanudarla ahora?\n(También puede hacerlo luego desde «Sesiones guardadas», sin exportar nada.)`;
    if (confirm(msg)) {
        resumeSession(session.id);
    } else {
        updateProgress(session.progress || 0,
            '⏸ Sesión recuperada. Reanúdela cuando quiera desde la lista de sesiones.');
    }
}

// ============================================================
// BÚSQUEDA PRINCIPAL: N-ÉSIMO PRIMO
// ============================================================
async function findNthPrime(targetIndex, resumeState = null) {
    const targetDouble = Number(targetIndex);
    let maxValEst = 20.0;
    if (targetDouble >= 6.0) {
        maxValEst = targetDouble * (Math.log(targetDouble) + Math.log(Math.log(targetDouble)) + 1.0);
    }
    const limitSqrtFloat = Math.sqrt(maxValEst) + 100000;
    const limitSqrt = BigInt(Math.floor(limitSqrtFloat));

    updateProgress(0, 'Generando primos base...');
    basePrimesArray = generateBasePrimes(limitSqrt);
    const basePrimesCount = basePrimesArray.length;
    updateProgress(0, `Primos base generados: ${basePrimesCount.toLocaleString()} (hasta ${Number(limitSqrt).toLocaleString()})`);

    const segmentArray = new Uint8Array(SEGMENT_SIZE_BYTES);

    let count = resumeState && resumeState.count ? BigInt(resumeState.count) : 0n;
    let low = resumeState && resumeState.low ? BigInt(resumeState.low) : 2n;
    let segmentNumber = resumeState && resumeState.segmentNumber ? resumeState.segmentNumber : 0;
    let latestPrimeFound = resumeState && resumeState.latestPrimeFound
        ? BigInt(resumeState.latestPrimeFound) : 0n;
    const accumulatedSeconds = resumeState && resumeState.elapsedSeconds
        ? resumeState.elapsedSeconds : 0;
    let nthPrimeValue = 0n;

    const wallStartTime = Date.now();
    const perfStartTime = performance.now();
    let lastProgressUpdate = performance.now();
    let lastYieldTime = performance.now();

    const maxLimitSquared = limitSqrt * limitSqrt;

    if (currentSession) {
        currentSession.basePrimesCount = basePrimesCount;
        currentSession.memoryBytes = estimateMemory(basePrimesCount);
    }

    while (count < targetIndex) {
        if (cancelRequested) { updateStatus('cancelled', '✖ Cancelado'); return null; }

        const high = low + BigInt(SEGMENT_BITS) - 1n;
        if (high > maxLimitSquared) {
            updateProgress(100, '❌ [Error Matemático] Se requiere ampliar la estimación base.');
            return null;
        }

        const result = sieveSegment(low, high, basePrimesArray, segmentArray);
        const primesInSegment = result.count;
        if (count + primesInSegment >= targetIndex) {
            const offsetInSegment = Number(targetIndex - count) - 1;
            let foundCount = 0;
            for (let i = 0; i < SEGMENT_BITS; i++) {
                if (((segmentArray[i >> 3] >> (i & 7)) & 1) === 0) {
                    if (foundCount === offsetInSegment) {
                        nthPrimeValue = low + BigInt(i);
                        break;
                    }
                    foundCount++;
                }
            }
            count = targetIndex;
        } else {
            count += primesInSegment;
            latestPrimeFound = result.lastPrime;
        }
        segmentNumber++;

        const now = performance.now();
        if (now - lastProgressUpdate >= 250 || count >= targetIndex) {
            lastProgressUpdate = now;
            const percentage = (Number(count) / Number(targetIndex)) * 100;
            const ratioStr = calculateRatio(percentage).trim();

            let estimatedPrime = latestPrimeFound;
            const countDouble = Number(count);
            if (countDouble > 1000 && countDouble < Number(targetIndex)) {
                const pntTarget = Number(targetIndex) * Math.log(Number(targetIndex));
                const pntCurrent = countDouble * Math.log(countDouble);
                const estVal = Number(latestPrimeFound) * (pntTarget / pntCurrent);
                estimatedPrime = nextPrime(BigInt(Math.floor(estVal)));
            }

            const estStr = estimatedPrime.toString();
            const estB64 = bigIntToBase64(estimatedPrime);
            const elapsedWallSec = (Date.now() - wallStartTime) / 1000.0 + accumulatedSeconds;
            let etaStr = "Calculando...";
            if (elapsedWallSec >= 2 && countDouble > 0) {
                const rate = countDouble / elapsedWallSec;
                const remainingSec = (Number(targetIndex) - countDouble) / rate;
                const etaTime = new Date(Date.now() + remainingSec * 1000);
                etaStr = formatDateTime(etaTime);
            }

            const progressText = `
                ${percentage.toFixed(2)}%<br>
                ${ratioStr}<br>
                P: ${latestPrimeFound.toString()}<br>
                Est: ${estStr} ${estB64}<br>
                ETA: ${etaStr}<br>
                Seg: ${segmentNumber.toLocaleString()}<br><br>
                Primos:<br>
                ${count.toLocaleString()} /<br>
                ${Number(targetIndex).toLocaleString()}
            `;
            updateProgress(percentage, progressText);
        }

        if (now - lastYieldTime >= 50 && count < targetIndex) {
            lastYieldTime = now;
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (nthPrimeValue > 0n) break;
        low += BigInt(SEGMENT_BITS);

        if (currentSession) {
            currentSession.count = count.toString();
            currentSession.low = low.toString();
            currentSession.latestPrimeFound = latestPrimeFound.toString();
            currentSession.segmentNumber = segmentNumber;
            currentSession.progress = (Number(count) / Number(targetIndex)) * 100;
            currentSession.elapsedSeconds = accumulatedSeconds + (performance.now() - perfStartTime) / 1000;
            currentSession.basePrimesCount = basePrimesCount;
        }
    }

    const elapsedTotal = accumulatedSeconds + (performance.now() - perfStartTime) / 1000.0;
    return {
        nthPrime: nthPrimeValue,
        elapsedSeconds: elapsedTotal,
        segmentCount: segmentNumber,
        basePrimesCount,
        memoryBytes: estimateMemory(basePrimesCount)
    };
}

// ============================================================
// BÚSQUEDA INVERSA: ÍNDICE DE UN PRIMO DADO
// ============================================================
async function findIndexByPrime(primeValue, resumeState = null) {
    if (!millerRabin(primeValue, 12)) return null;

    const primeDouble = Number(primeValue);
    const estimatedIndex = Math.max(1, primeDouble / Math.log(primeDouble));
    const limitSqrtFloat = Math.sqrt(primeDouble) + 100000;
    const limitSqrt = BigInt(Math.floor(limitSqrtFloat));

    updateProgress(0, 'Generando primos base...');
    basePrimesArray = generateBasePrimes(limitSqrt);
    const basePrimesCount = basePrimesArray.length;
    updateProgress(0, `Primos base generados: ${basePrimesCount.toLocaleString()} (hasta ${Number(limitSqrt).toLocaleString()})`);

    const segmentArray = new Uint8Array(SEGMENT_SIZE_BYTES);

    let count = resumeState && resumeState.count ? BigInt(resumeState.count) : 0n;
    let low = resumeState && resumeState.low ? BigInt(resumeState.low) : 2n;
    let segmentNumber = resumeState && resumeState.segmentNumber ? resumeState.segmentNumber : 0;
    let latestPrimeFound = resumeState && resumeState.latestPrimeFound
        ? BigInt(resumeState.latestPrimeFound) : 0n;
    const accumulatedSeconds = resumeState && resumeState.elapsedSeconds
        ? resumeState.elapsedSeconds : 0;
    let primeIndex = 0n;

    const wallStartTime = Date.now();
    const perfStartTime = performance.now();
    let lastProgressUpdate = performance.now();
    let lastYieldTime = performance.now();

    const maxLimitSquared = limitSqrt * limitSqrt;

    if (currentSession) {
        currentSession.basePrimesCount = basePrimesCount;
        currentSession.memoryBytes = estimateMemory(basePrimesCount);
    }

    while (true) {
        if (cancelRequested) { updateStatus('cancelled', '✖ Cancelado'); return null; }

        const high = low + BigInt(SEGMENT_BITS) - 1n;
        if (high > maxLimitSquared) {
            updateProgress(100, '❌ [Error] Se requiere ampliar la estimación base.');
            return null;
        }

        const result = sieveSegment(low, high, basePrimesArray, segmentArray);
        latestPrimeFound = result.lastPrime;

        if (primeValue >= low && primeValue <= high) {
            let c = count;
            let found = false;
            for (let i = 0; i < SEGMENT_BITS; i++) {
                if (((segmentArray[i >> 3] >> (i & 7)) & 1) === 0) {
                    c++;
                    const val = low + BigInt(i);
                    if (val === primeValue) {
                        primeIndex = c;
                        found = true;
                        break;
                    }
                }
            }
            count = c;
            if (found) {
                updateProgress(100, `✅ Encontrado: primo nº ${primeIndex.toString()} (${primeValue.toString()})`);
                break;
            }
        } else {
            count += result.count;
        }
        segmentNumber++;

        const now = performance.now();
        if (now - lastProgressUpdate >= 250) {
            lastProgressUpdate = now;
            const percentage = Math.min(100, (Number(count) / estimatedIndex) * 100);
            const ratioStr = calculateRatio(percentage).trim();

            let estimatedPrime = latestPrimeFound;
            const countDouble = Number(count);
            if (countDouble > 10) {
                const estVal = countDouble * Math.log(countDouble);
                estimatedPrime = nextPrime(BigInt(Math.floor(estVal)));
            }
            const estStr = estimatedPrime.toString();
            const estB64 = bigIntToBase64(estimatedPrime);

            const elapsedWallSec = (Date.now() - wallStartTime) / 1000.0 + accumulatedSeconds;
            let etaStr = "Calculando...";
            if (elapsedWallSec >= 2 && countDouble > 0) {
                const rate = countDouble / elapsedWallSec;
                const remaining = Math.max(0, (estimatedIndex - countDouble) / rate);
                const etaTime = new Date(Date.now() + remaining * 1000);
                etaStr = formatDateTime(etaTime);
            }

            const progressText = `
                ${percentage.toFixed(2)}%<br>
                ${ratioStr}<br>
                Último: ${latestPrimeFound.toString()}<br>
                Est: ${estStr} ${estB64}<br>
                ETA: ${etaStr}<br><br>
                Primos:<br>
                ${count.toString()} /<br>
                ${estimatedIndex.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            `;
            updateProgress(percentage, progressText);
        }

        if (now - lastYieldTime >= 50) {
            lastYieldTime = now;
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        low += BigInt(SEGMENT_BITS);

        if (currentSession) {
            currentSession.count = count.toString();
            currentSession.low = low.toString();
            currentSession.latestPrimeFound = latestPrimeFound.toString();
            currentSession.segmentNumber = segmentNumber;
            currentSession.progress = Math.min(100, (Number(count) / estimatedIndex) * 100);
            currentSession.elapsedSeconds = accumulatedSeconds + (performance.now() - perfStartTime) / 1000;
            currentSession.basePrimesCount = basePrimesCount;
        }
    }

    const elapsedTotal = accumulatedSeconds + (performance.now() - perfStartTime) / 1000.0;
    return {
        primeIndex,
        elapsedSeconds: elapsedTotal,
        segmentCount: segmentNumber,
        basePrimesCount,
        memoryBytes: estimateMemory(basePrimesCount)
    };
}

// ============================================================
// FUNCIONES DE UI
// ============================================================
function calculateRatio(percentage) {
    if (percentage <= 0 || percentage >= 100) return "  1 / 1.0000";
    if (percentage < 50) {
        const val = 100 / percentage;
        return `  1 / ${val.toFixed(4)}`;
    } else {
        const val = percentage / (100 - percentage);
        return `${val.toFixed(4)} / 1  `;
    }
}

function formatDateTime(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
           `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function updateProgress(percentage, infoText) {
    const fill = document.getElementById('progressFill');
    const info = document.getElementById('progressInfo');
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    if (info) info.innerHTML = infoText;
}

function updateStatus(status, text) {
    const badge = document.getElementById('statusBadge');
    if (badge) {
        badge.className = `status-badge ${status}`;
        badge.textContent = text;
    }
}

function showResults(primeIndex, primeValue, b64Value, timeStr, memStr) {
    const section = document.getElementById('resultsSection');
    if (section) section.classList.add('visible');
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    set('resultIndex', primeIndex.toString());
    set('resultPrime', primeValue.toString());
    set('resultBase64', b64Value);
    set('resultTime', timeStr);
    set('resultMem', memStr);
}

function hideResults() {
    const section = document.getElementById('resultsSection');
    if (section) section.classList.remove('visible');
}

function setButtonsEnabled(startEnabled, cancelEnabled) {
    const startBtn = document.getElementById('startBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    if (startBtn) startBtn.disabled = !startEnabled;
    if (cancelBtn) cancelBtn.disabled = !cancelEnabled;
}

function refreshSegmentLabels() {
    const sizeLabel = document.getElementById('segmentSizeLabel');
    if (sizeLabel) sizeLabel.textContent = `${formatBytes(SEGMENT_SIZE_BYTES)} por segmento`;

    const noteLabel = document.getElementById('noteSegmentLabel');
    if (noteLabel) noteLabel.textContent = describeSegment();

    const memInfo = document.getElementById('memoryInfo');
    if (memInfo) memInfo.textContent = `Segmento: ${formatBytes(SEGMENT_SIZE_BYTES)}`;
}

// ============================================================
// MANEJADOR PRINCIPAL
// ============================================================
async function startSearch(resumeSessionObj = null) {
    if (isRunning) return;

    const modeSelect = document.getElementById('modeSelect');
    const inputField = document.getElementById('inputValue');

    let mode, inputValue;
    let targetIndex = null;
    let targetPrime = null;
    let resumeState = null;

    if (resumeSessionObj) {
        mode = resumeSessionObj.mode;
        inputValue = resumeSessionObj.inputValue || '';
        modeSelect.value = mode;
        inputField.value = inputValue;

        if (mode === 'decimal' || mode === 'b64') {
            targetIndex = BigInt(resumeSessionObj.targetIndex);
        } else {
            targetPrime = BigInt(resumeSessionObj.targetPrime);
        }
        resumeState = {
            low: resumeSessionObj.low || '2',
            count: resumeSessionObj.count || '0',
            latestPrimeFound: resumeSessionObj.latestPrimeFound || '0',
            segmentNumber: resumeSessionObj.segmentNumber || 0,
            elapsedSeconds: resumeSessionObj.elapsedSeconds || 0,
        };
        currentSession = {
            ...resumeSessionObj,
            status: 'running',
            updatedAt: Date.now(),
        };
    } else {
        mode = modeSelect.value;
        inputValue = inputField.value.trim();

        if (inputValue === '') {
            alert('Por favor, ingrese un valor.');
            return;
        }

        if (mode === 'decimal') {
            if (!/^\d+$/.test(inputValue)) { alert('Ingrese un número decimal válido.'); return; }
            targetIndex = BigInt(inputValue);
            if (targetIndex < 1n) { alert('El índice debe ser mayor o igual a 1.'); return; }
        } else if (mode === 'b64') {
            if (!/^[A-Za-z0-9+/]+$/.test(inputValue)) { alert('Ingrese un Base64 válido (sin padding).'); return; }
            targetIndex = base64ToBigInt(inputValue);
            if (targetIndex < 1n) { alert('El índice debe ser mayor o igual a 1.'); return; }
        } else if (mode === 'ab64') {
            if (!/^[A-Za-z0-9+/]+$/.test(inputValue)) { alert('Ingrese un Base64 válido.'); return; }
            targetPrime = base64ToBigInt(inputValue);
            if (targetPrime < 2n) { alert('El valor debe ser mayor o igual a 2.'); return; }
        }

        currentSession = {
            id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            mode,
            inputValue,
            targetIndex: targetIndex !== null ? targetIndex.toString() : null,
            targetPrime: targetPrime !== null ? targetPrime.toString() : null,
            status: 'running',
            progress: 0,
            low: '2',
            count: '0',
            latestPrimeFound: '0',
            segmentNumber: 0,
            elapsedSeconds: 0,
            basePrimesCount: 0,
            memoryBytes: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
    }

    isRunning = true;
    cancelRequested = false;
    hideResults();
    setButtonsEnabled(false, true);
    updateStatus('running', '● Buscando...');
    updateProgress(0, 'Inicializando búsqueda...');
    refreshSegmentLabels();
    startAutosave();
    upsertSession({ ...currentSession });

    try {
        if (mode === 'decimal' || mode === 'b64') {
            const result = await findNthPrime(targetIndex, resumeState);
            if (result && result.nthPrime > 0n) {
                const b64 = bigIntToBase64(result.nthPrime);
                const timeStr = `${result.elapsedSeconds.toFixed(2)} segundos`;
                const memStr = `~ ${formatBytes(result.memoryBytes)}`;
                showResults(targetIndex, result.nthPrime, b64, timeStr, memStr);
                updateStatus('completed', '✔ Completado');
                updateProgress(100, `✅ Primo nº ${targetIndex.toString()} = ${result.nthPrime.toString()}`);

                currentSession.status = 'completed';
                currentSession.progress = 100;
                currentSession.updatedAt = Date.now();
                currentSession.elapsedSeconds = result.elapsedSeconds;
                currentSession.latestPrimeFound = result.nthPrime.toString();
                upsertSession({ ...currentSession });
            } else if (!cancelRequested) {
                updateStatus('idle', '● En espera');
                updateProgress(0, 'La búsqueda falló.');
                currentSession.status = 'paused';
                currentSession.updatedAt = Date.now();
                upsertSession({ ...currentSession });
            }
        } else {
            if (!millerRabin(targetPrime, 12)) {
                alert('El número proporcionado no es primo.');
                updateStatus('idle', '● En espera');
                updateProgress(0, 'El número no es primo.');
                deleteSessionById(currentSession.id);
            } else {
                const result = await findIndexByPrime(targetPrime, resumeState);
                if (result && result.primeIndex > 0n) {
                    const b64 = bigIntToBase64(targetPrime);
                    const timeStr = `${result.elapsedSeconds.toFixed(2)} segundos`;
                    const memStr = `~ ${formatBytes(result.memoryBytes)}`;
                    showResults(result.primeIndex, targetPrime, b64, timeStr, memStr);
                    updateStatus('completed', '✔ Completado');
                    updateProgress(100, `✅ El primo ${targetPrime.toString()} es el nº ${result.primeIndex.toString()}`);

                    currentSession.status = 'completed';
                    currentSession.progress = 100;
                    currentSession.updatedAt = Date.now();
                    currentSession.elapsedSeconds = result.elapsedSeconds;
                    upsertSession({ ...currentSession });
                } else if (!cancelRequested) {
                    updateStatus('idle', '● En espera');
                    updateProgress(0, 'No se pudo encontrar el índice.');
                    currentSession.status = 'paused';
                    currentSession.updatedAt = Date.now();
                    upsertSession({ ...currentSession });
                }
            }
        }
    } catch (err) {
        updateStatus('idle', '● En espera');
        updateProgress(0, `Error: ${err.message}`);
        console.error(err);
        if (currentSession) {
            currentSession.status = 'paused';
            currentSession.updatedAt = Date.now();
            upsertSession({ ...currentSession });
        }
    } finally {
        isRunning = false;
        stopAutosave();
        setButtonsEnabled(true, false);
        updateAutosaveInfo();
        currentSession = null;
    }
}

function cancelSearch() {
    if (isRunning) {
        cancelRequested = true;
        updateStatus('cancelled', '✖ Cancelando...');
        if (currentSession) {
            currentSession.status = 'paused';
            currentSession.updatedAt = Date.now();
            upsertSession({ ...currentSession });
        }
    }
}

async function resumeSession(id) {
    if (isRunning) {
        alert('Ya hay una búsqueda en curso. Espere o cancele antes de reanudar otra sesión.');
        return;
    }
    const sessions = loadSessions();
    const session = sessions.find(s => s.id === id);
    if (!session) {
        alert('La sesión no existe o fue eliminada.');
        return;
    }
    if (session.status === 'completed') {
        if (!confirm('Esta sesión ya está completada. ¿Desea recalcularla desde cero?')) return;
        session.low = '2';
        session.count = '0';
        session.latestPrimeFound = '0';
        session.segmentNumber = 0;
        session.elapsedSeconds = 0;
        session.progress = 0;
        session.status = 'paused';
        session.updatedAt = Date.now();
        upsertSession({ ...session });
    }
    await startSearch(session);
}

// ============================================================
// PERSISTENCIA ANTE CIERRE / OCULTAMIENTO DE PESTAÑA
// ============================================================
function persistOnHide() {
    if (isRunning && currentSession) {
        currentSession.status = 'paused';
        currentSession.updatedAt = Date.now();
        upsertSession({ ...currentSession });
    }
}

window.addEventListener('beforeunload', persistOnHide);
window.addEventListener('pagehide', persistOnHide);
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning && currentSession) {
        currentSession.updatedAt = Date.now();
        upsertSession({ ...currentSession });
    }
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    refreshSegmentLabels();
    setButtonsEnabled(true, false);
    updateStatus('idle', '● En espera');
    updateProgress(0, 'Seleccione el modo e ingrese el valor correspondiente.');
    renderSessions();
    updateAutosaveInfo();
    offerInterruptedResume();

    const input = document.getElementById('inputValue');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !isRunning) startSearch();
        });
    }

    // --- Importación de archivo JSON ---
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) await handleImportFile(file);
            fileInput.value = '';
        });
    }

    // --- Arrastrar y soltar JSON sobre la sección de sesiones ---
    const section = document.querySelector('.sessions-section');
    if (section) {
        section.addEventListener('dragover', (e) => {
            e.preventDefault();
            section.style.borderColor = 'var(--accent)';
        });
        section.addEventListener('dragleave', () => {
            section.style.borderColor = 'var(--border)';
        });
        section.addEventListener('drop', async (e) => {
            e.preventDefault();
            section.style.borderColor = 'var(--border)';
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) await handleImportFile(file);
        });
    }
});

// Exponer funciones usadas por los onclick del HTML
window.startSearch = startSearch;
window.cancelSearch = cancelSearch;
window.resumeSession = resumeSession;
window.deleteSessionById = deleteSessionById;
window.clearAllSessions = clearAllSessions;
window.exportSession = exportSession;
window.exportAllSessions = exportAllSessions;
