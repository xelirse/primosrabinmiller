// ============================================================
// Persistencia en localStorage
// ============================================================
function loadSessions() {
    try {
        const raw = localStorage.getItem(CONST().SESSION_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('No se pudieron cargar las sesiones:', e);
        return [];
    }
}

function saveSessions(sessions) {
    try {
        localStorage.setItem(
            CONST().SESSION_STORAGE_KEY,
            JSON.stringify(sessions.slice(0, CONST().MAX_SESSIONS))
        );
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

async function clearAllSessions() {
    const ok = await confirmar('¿Eliminar todas las sesiones guardadas? Esta acción no se puede deshacer.', {
        okText: 'Eliminar', cancelText: 'Cancelar'
    });
    if (!ok) return;
    saveSessions([]);
    renderSessions();
    notificar('Sesiones eliminadas.', 'success', 2500);
}

// ============================================================
// Sanitización de sesiones importadas
// ============================================================
function sanitizeSession(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const mode = raw.mode;
    if (mode !== 'decimal' && mode !== 'b64' && mode !== 'adec' && mode !== 'ab64') return null;
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
        primeIndex: raw.primeIndex != null ? String(raw.primeIndex) : null,
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

// ============================================================
// Exportar
// ============================================================
function exportSession(id) {
    const session = loadSessions().find(s => s.id === id);
    if (!session) { notificar('La sesión no existe.', 'error'); return; }
    const payload = {
        app: 'iprimo',
        version: CONST().SESSION_FILE_VERSION,
        exportedAt: new Date().toISOString(),
        sessions: [session],
    };
    downloadJSON(payload, `iprimo-session-${session.id}.json`);
}

function exportAllSessions() {
    const sessions = loadSessions();
    if (sessions.length === 0) { notificar('No hay sesiones para exportar.', 'warn'); return; }
    const payload = {
        app: 'iprimo',
        version: CONST().SESSION_FILE_VERSION,
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
        notificar('No se pudo exportar la sesión.', 'error');
    }
}

// ============================================================
// Importar
// ============================================================
async function handleImportFile(file) {
    if (!file) return;
    try {
        const text = await file.text();
        let parsed;
        try { parsed = JSON.parse(text); }
        catch (e) { notificar('El archivo no es un JSON válido.', 'error'); return; }

        let rawList = [];
        if (Array.isArray(parsed)) rawList = parsed;
        else if (parsed && Array.isArray(parsed.sessions)) rawList = parsed.sessions;
        else if (parsed && typeof parsed === 'object') rawList = [parsed];
        else { notificar('Formato de archivo no reconocido.', 'error'); return; }

        const imported = rawList.map(sanitizeSession).filter(Boolean);
        if (imported.length === 0) {
            notificar('No se encontraron sesiones válidas en el archivo.', 'warn');
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

        for (const s of existing) {
            if (s.status === 'running' && !estado().isRunning) s.status = 'paused';
        }

        saveSessions(existing);
        renderSessions();
        updateAutosaveInfo();
        notificar(
            `✅ Importación completada\nAñadidas: ${added} · Reemplazadas: ${replaced} · Total: ${existing.length}`,
            'success', 5000
        );
    } catch (e) {
        console.error('Error al importar:', e);
        notificar('Error al procesar el archivo.', 'error');
    }
}
