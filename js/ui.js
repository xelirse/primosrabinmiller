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
    
    list.innerHTML = '';
    
    const sessions = loadSessions();
    if (sessions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'session-empty';
        empty.textContent = 'No hay sesiones guardadas todavía. Use «📂 Cargar sesión» para importar desde un archivo.';
        list.appendChild(empty);
        return;
    }

    sessions.forEach(s => {
        const card = document.createElement('div');
        card.className = 'session-card';
        card.dataset.id = s.id;

        // --- Fila Superior ---
        const top = document.createElement('div');
        top.className = 'session-top';

        const modeSpan = document.createElement('span');
        modeSpan.className = 'session-mode';
        modeSpan.textContent = s.mode === 'decimal' ? 'Índice dec'
            : s.mode === 'b64' ? 'Índice B64'
            : s.mode === 'adec' ? 'Primo dec'
            : 'Primo B64';
        top.appendChild(modeSpan);

        const rawVal = s.inputValue || '';
        const valSpan = document.createElement('span');
        valSpan.className = 'session-value';
        valSpan.textContent = rawVal;
        valSpan.title = rawVal;
        top.appendChild(valSpan);

        const statusSpan = document.createElement('span');
        statusSpan.className = `session-status ${s.status === 'running' ? 'running' : s.status === 'completed' ? 'completed' : 'paused'}`;
        statusSpan.textContent = s.status === 'running' ? '● En curso'
            : s.status === 'completed' ? '✔ Completada' : '⏸ Pausada';
        top.appendChild(statusSpan);

        card.appendChild(top);

        // --- Barra de progreso ---
        const progressVal = Math.min(100, Math.max(0, s.progress || 0));
        const progBar = document.createElement('div');
        progBar.className = 'session-progress-bar';
        const progFill = document.createElement('div');
        progFill.className = 'session-progress-fill';
        progFill.style.width = `${progressVal}%`;
        progBar.appendChild(progFill);
        card.appendChild(progBar);

        // --- Fila Inferior ---
        const bottom = document.createElement('div');
        bottom.className = 'session-bottom';

        const meta = document.createElement('div');
        meta.className = 'session-meta';

        let algLabel = s.algorithm === 'pnt' ? 'PNT' : s.algorithm === 'riemann' ? 'Riemann R' : 'Exacta';
        if (s.isFallback) {
            const origLabel = s.originalAlgorithm === 'exact' ? 'Exacta' : s.originalAlgorithm === 'riemann' ? 'Riemann R' : 'PNT';
            algLabel = `${origLabel} → PNT (Fallback)`;
        }

        const elapsed = (s.elapsedSeconds && s.elapsedSeconds > 0) ? `${s.elapsedSeconds.toFixed(1)}s` : '—';
        const updated = timeAgo(s.updatedAt || Date.now());

        const spanAlg = document.createElement('span');
        spanAlg.textContent = `⚙ ${algLabel}`;
        meta.appendChild(spanAlg);

        const spanProg = document.createElement('span');
        spanProg.textContent = `${progressVal.toFixed(2)}%`;
        meta.appendChild(spanProg);

        const spanElapsed = document.createElement('span');
        spanElapsed.textContent = `⏱ ${elapsed}`;
        meta.appendChild(spanElapsed);

        const spanUpdated = document.createElement('span');
        spanUpdated.textContent = `🕒 ${updated}`;
        meta.appendChild(spanUpdated);

        bottom.appendChild(meta);

        // --- Botones de Acción ---
        const actions = document.createElement('div');
        actions.className = 'session-actions';
        const isIndexMode = s.mode === 'decimal' || s.mode === 'b64';

        if (s.status === 'completed') {
            const hasCompleteData = isIndexMode
                ? (s.targetIndex && s.latestPrimeFound && s.latestPrimeFound !== '0')
                : (s.targetPrime && s.primeIndex);
            if (hasCompleteData) {
                const btnLoad = document.createElement('button');
                btnLoad.className = 'session-btn load-btn';
                btnLoad.textContent = '📋 Cargar';
                btnLoad.title = 'Cargar resultados guardados sin recalcular';
                btnLoad.onclick = () => loadSessionResults(s.id);
                actions.appendChild(btnLoad);
            }
            const btnResume = document.createElement('button');
            btnResume.className = 'session-btn resume-btn';
            btnResume.textContent = '🔁 Recalcular';
            btnResume.title = 'Volver a calcular desde cero';
            btnResume.onclick = () => resumeSession(s.id);
            actions.appendChild(btnResume);
        } else if (s.status === 'paused') {
            const btnResume = document.createElement('button');
            btnResume.className = 'session-btn resume-btn';
            btnResume.textContent = '▶ Reanudar';
            btnResume.onclick = () => resumeSession(s.id);
            actions.appendChild(btnResume);
        }

        const btnExport = document.createElement('button');
        btnExport.className = 'session-btn export-btn';
        btnExport.textContent = '⬇ Exportar';
        btnExport.title = 'Exportar a JSON';
        btnExport.onclick = () => exportSession(s.id);
        actions.appendChild(btnExport);

        const btnDelete = document.createElement('button');
        btnDelete.className = 'session-btn delete-btn';
        btnDelete.textContent = '🗑';
        btnDelete.title = 'Eliminar';
        btnDelete.onclick = () => deleteSessionById(s.id);
        actions.appendChild(btnDelete);

        bottom.appendChild(actions);
        card.appendChild(bottom);

        list.appendChild(card);
    });
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
// Progreso / Estado / Resultados
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

function updateProgress(percentage, infoContent) {
    const fill = document.getElementById('progressFill');
    const info = document.getElementById('progressInfo');
    
    if (fill) {
        if (percentage === null) {
            fill.classList.add('indeterminate');
            fill.style.width = '100%';
        } else {
            fill.classList.remove('indeterminate');
            fill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        }
    }
    
    if (info) {
        if (typeof infoContent === 'string') {
            info.innerHTML = infoContent;
        } else if (infoContent instanceof Node) {
            info.innerHTML = '';
            info.appendChild(infoContent);
        } else if (infoContent === null) {
            info.innerHTML = '';
        }
    }
}

function updateStatus(status, text) {
    const badge = document.getElementById('statusBadge');
    if (badge) {
        badge.className = `status-badge ${status}`;
        badge.textContent = text;
    }
}

// Extrae y muestra los factores primos y números compuestos del árbol
function updateTreeFactorsUI(treeData) {
    const grid = document.querySelector('.results-grid');
    if (!grid) return;
    
    let primeItem = document.getElementById('resultTreePrimes');
    if (!primeItem) {
        primeItem = document.createElement('div');
        primeItem.className = 'result-item';
        primeItem.id = 'resultTreePrimes';
        primeItem.innerHTML = '<div class="result-label">FACTORES PRIMOS</div><div class="result-value" id="resultPrimesValue" style="color: #60a5fa;"></div>';
        grid.appendChild(primeItem);
    }
    
    let compItem = document.getElementById('resultTreeComposites');
    if (!compItem) {
        compItem = document.createElement('div');
        compItem.className = 'result-item';
        compItem.id = 'resultTreeComposites';
        compItem.innerHTML = '<div class="result-label">FACTORES COMPUESTOS</div><div class="result-value" id="resultCompositesValue" style="color: #fbbf24;"></div>';
        grid.appendChild(compItem);
    }
    
    const pVal = document.getElementById('resultPrimesValue');
    const cVal = document.getElementById('resultCompositesValue');
    
    if (!treeData) {
        pVal.textContent = 'Genere o cargue el árbol para ver los factores.';
        cVal.textContent = 'Genere o cargue el árbol para ver los factores.';
        return;
    }
    
    const primes = new Set();
    const composites = new Set();
    
    function traverse(node) {
        if (!node) return;
        const valStr = node.textStr.replace('~', '');
        if (node.type === 'Prime' || node.type === 'PrimeIndex') {
            primes.add(valStr);
        } else if (node.type === 'Index') {
            composites.add(valStr);
        }
        for (let i = 0; i < node.children.length; i++) {
            traverse(node.children[i]);
        }
    }
    
    traverse(treeData);
    
    // Función auxiliar para ordenar BigInts de mayor a menor
    const sortDesc = (a, b) => {
        const bigA = BigInt(a);
        const bigB = BigInt(b);
        return bigB > bigA ? 1 : (bigB < bigA ? -1 : 0);
    };

    const sortedPrimes = Array.from(primes).sort(sortDesc);
    const sortedComposites = Array.from(composites).sort(sortDesc);

    pVal.textContent = sortedPrimes.length > 0 ? sortedPrimes.join(' ') : 'Ninguno';
    cVal.textContent = sortedComposites.length > 0 ? sortedComposites.join(' ') : 'Ninguno';
}

function showResults(primeIndex, primeValue, timeStr, memStr, algName = 'Criba Exacta', exactIndex = true, exactPrime = true) {
    const section = document.getElementById('resultsSection');
    if (section) section.classList.add('visible');
    
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    
    set('resultAlgorithm', algName);
    set('resultIndex', primeIndex.toString());
    set('resultIndexBase64', bigIntToBase64(primeIndex));
    set('resultPrime', primeValue.toString());
    set('resultBase64', bigIntToBase64(primeValue));
    set('resultTime', timeStr);
    set('resultMem', memStr);
    
    const st = estado();
    st.lastResult = { prime: primeValue, index: primeIndex, exactIndex, exactPrime };
    
    // Resetear los factores al mostrar nuevos resultados
    updateTreeFactorsUI(null);
    
    const treeBtn = document.getElementById('treeToggleBtn');
    if (treeBtn) treeBtn.style.display = 'block';
    
    const treeContainer = document.getElementById('treeContainer');
    if (treeContainer) treeContainer.style.display = 'none';
}

function hideResults() {
    const section = document.getElementById('resultsSection');
    if (section) section.classList.remove('visible');
    const treeContainer = document.getElementById('treeContainer');
    if (treeContainer) treeContainer.style.display = 'none';
    const treeBtn = document.getElementById('treeToggleBtn');
    if (treeBtn) treeBtn.style.display = 'none';
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

    let algLabel = session.algorithm === 'pnt' ? 'PNT' : session.algorithm === 'riemann' ? 'Riemann R' : 'Exacta';
    if (session.isFallback) {
        const origLabel = session.originalAlgorithm === 'exact' ? 'Exacta' : session.originalAlgorithm === 'riemann' ? 'Riemann R' : 'PNT';
        algLabel = `${origLabel} → PNT (Fallback)`;
    }

    const timeStr = `${(session.elapsedSeconds || 0).toFixed(2)} segundos`;
    const memStr  = `~ ${formatBytes(session.memoryBytes || 0)}`;

    const isExact = session.algorithm === 'exact';
    let exactIndex = true, exactPrime = true;
    if (!isExact) {
        if (isIndexMode) exactPrime = false;
        else exactIndex = false;
    }

    const st = estado();
    st.lastSessionId = session.id;
    showResults(primeIndex, primeValue, timeStr, memStr, algLabel, exactIndex, exactPrime);
    updateStatus('completed', '✔ Completado (cargado)');
    
    const frag = document.createDocumentFragment();
    
    const p1 = document.createElement('div');
    p1.textContent = '📋 Sesión cargada desde el historial';
    frag.appendChild(p1);
    
    const p2 = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = 'Método:';
    p2.appendChild(b);
    p2.appendChild(document.createTextNode(` ${algLabel}`));
    frag.appendChild(p2);
    
    const p3 = document.createElement('div');
    p3.textContent = `Primo nº ${primeIndex.toString()} = ${primeValue.toString()}`;
    frag.appendChild(p3);

    updateProgress(100, frag);

    // Si la sesión ya tiene un árbol guardado, actualizamos las filas de factores
    if (session.treeData) {
        const primeNode = {
            type: 'Prime',
            approx: !isExact,
            children: [session.treeData],
            depth: 0,
            textStr: (!isExact ? '~' : '') + primeValue.toString()
        };
        updateTreeFactorsUI(primeNode);
    }
}
