// ============================================================
// Helpers de presentación
// ============================================================
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
// Render de la lista de sesiones
// ============================================================
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
            : s.mode === 'b64' ? 'Índice B64'
            : s.mode === 'adec' ? 'Primo dec'
            : 'Primo B64';
        const raw = s.inputValue || '';
        const valueDisplay = raw.length > 44 ? raw.slice(0, 22) + '…' + raw.slice(-18) : raw;
        const elapsed = (s.elapsedSeconds && s.elapsedSeconds > 0)
            ? `${s.elapsedSeconds.toFixed(1)}s` : '—';
        const updated = timeAgo(s.updatedAt || Date.now());
        const isIndexMode = s.mode === 'decimal' || s.mode === 'b64';

        let actionsHtml = '';
        if (s.status === 'completed') {
            const hasCompleteData = isIndexMode
                ? (s.targetIndex && s.latestPrimeFound && s.latestPrimeFound !== '0')
                : (s.targetPrime && s.primeIndex);
            if (hasCompleteData) {
                actionsHtml += `<button class="session-btn load-btn" title="Cargar resultados guardados sin recalcular" onclick="loadSessionResults('${s.id}')">📋 Cargar</button>`;
            }
            actionsHtml += `<button class="session-btn resume-btn" title="Volver a calcular desde cero" onclick="resumeSession('${s.id}')">🔁 Recalcular</button>`;
        } else if (s.status === 'paused') {
            actionsHtml += `<button class="session-btn resume-btn" onclick="resumeSession('${s.id}')">▶ Reanudar</button>`;
        }
        actionsHtml += `<button class="session-btn export-btn" title="Exportar a JSON" onclick="exportSession('${s.id}')">⬇ Exportar</button>`;
        actionsHtml += `<button class="session-btn delete-btn" title="Eliminar" onclick="deleteSessionById('${s.id}')">🗑</button>`;

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
                    <div class="session-actions">${actionsHtml}</div>
                </div>
            </div>`;
    }).join('');
}

// ============================================================
// Autoguardado
// ============================================================
function updateAutosaveInfo() {
    const el = document.getElementById('autosaveInfo');
    if (!el) return;
    if (estado().isRunning) {
        el.textContent = `Guardado automático cada 60 s · último: ${new Date().toLocaleTimeString()}`;
    } else {
        el.textContent = 'Guardado automático cada 60 s';
    }
}

function startAutosave() {
    stopAutosave();
    const st = estado();
    st.autosaveTimer = setInterval(() => {
        if (st.isRunning && st.currentSession) persistCurrentSession('running');
    }, CONST().AUTOSAVE_INTERVAL_MS);
}

function stopAutosave() {
    const st = estado();
    if (st.autosaveTimer) {
        clearInterval(st.autosaveTimer);
        st.autosaveTimer = null;
    }
}

function persistCurrentSession(status) {
    const st = estado();
    if (!st.currentSession) return;
    st.currentSession.status = status;
    st.currentSession.updatedAt = Date.now();
    upsertSession({ ...st.currentSession });
    updateAutosaveInfo();
}

// ============================================================
// Progreso / estado / resultados
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

// Nueva firma: calcula ambas representaciones Base64 internamente
function showResults(primeIndex, primeValue, timeStr, memStr) {
    const section = document.getElementById('resultsSection');
    if (section) section.classList.add('visible');
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    set('resultIndex', primeIndex.toString());
    set('resultIndexBase64', bigIntToBase64(primeIndex));
    set('resultPrime', primeValue.toString());
    set('resultBase64', bigIntToBase64(primeValue));
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
    const size = CONST().SEGMENT_SIZE_BYTES;
    const sizeLabel = document.getElementById('segmentSizeLabel');
    if (sizeLabel) sizeLabel.textContent = `${formatBytes(size)} por segmento`;

    const noteLabel = document.getElementById('noteSegmentLabel');
    if (noteLabel) noteLabel.textContent = describeSegment();

    const memInfo = document.getElementById('memoryInfo');
    if (memInfo) memInfo.textContent = `Segmento: ${formatBytes(size)}`;
}

// ============================================================
// Cargar resultados ya calculados (sin recalcular)
// ============================================================
function loadSessionResults(id) {
    if (estado().isRunning) {
        notificar('Hay una búsqueda en curso. Espere o cancélela antes de cargar otra sesión.', 'warn');
        return;
    }
    const session = loadSessions().find(s => s.id === id);
    if (!session) { notificar('La sesión no existe.', 'error'); return; }
    if (session.status !== 'completed') {
        notificar('Esta sesión no está completada todavía.', 'warn');
        return;
    }

    const isIndexMode = session.mode === 'decimal' || session.mode === 'b64';
    let primeIndex, primeValue;
    if (isIndexMode) {
        if (!session.latestPrimeFound || session.latestPrimeFound === '0' || !session.targetIndex) {
            notificar('La sesión no tiene resultados completos guardados.', 'error');
            return;
        }
        primeIndex = BigInt(session.targetIndex);
        primeValue = BigInt(session.latestPrimeFound);
    } else {
        if (!session.targetPrime || !session.primeIndex) {
            notificar('Esta sesión fue completada antes de guardar el índice. Use «🔁 Recalcular» una vez para regenerarla.', 'warn', 5000);
            return;
        }
        primeValue = BigInt(session.targetPrime);
        primeIndex = BigInt(session.primeIndex);
    }

    const modeSelect = document.getElementById('modeSelect');
    const inputField  = document.getElementById('inputValue');
    if (modeSelect) modeSelect.value = session.mode;
    if (inputField)  inputField.value  = session.inputValue || '';

    const timeStr = `${(session.elapsedSeconds || 0).toFixed(2)} segundos`;
    const memStr  = `~ ${formatBytes(session.memoryBytes || 0)}`;

    showResults(primeIndex, primeValue, timeStr, memStr);
    updateStatus('completed', '✔ Completado (cargado)');
    updateProgress(100,
        `📋 Sesión cargada desde el historial<br>` +
        `Primo nº ${primeIndex.toString()} = ${primeValue.toString()}`);
}
