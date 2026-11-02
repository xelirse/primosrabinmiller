// ============================================================
// Sesión activa / recuperación tras cierre
// ============================================================
function markActiveSession(id) {
    try {
        if (id) localStorage.setItem(CONST().ACTIVE_SESSION_KEY, id);
        else localStorage.removeItem(CONST().ACTIVE_SESSION_KEY);
    } catch (e) { /* almacenamiento no disponible */ }
}

function recoverInterruptedSessions() {
    const sessions = loadSessions();
    let changed = false;
    for (const s of sessions) {
        if (s.status === 'running') { s.status = 'paused'; changed = true; }
    }
    if (changed) { saveSessions(sessions); renderSessions(); }
}

async function offerInterruptedResume() {
    recoverInterruptedSessions();

    let activeId = null;
    try { activeId = localStorage.getItem(CONST().ACTIVE_SESSION_KEY); } catch (e) { /* ignore */ }
    if (!activeId) return;
    markActiveSession(null);

    const session = loadSessions().find(s => s.id === activeId);
    if (!session || session.status === 'completed') return;

    const progress = (session.progress || 0).toFixed(2);
    const modeLabel = session.mode === 'decimal' ? 'índice decimal'
        : session.mode === 'b64' ? 'índice en Base64'
        : session.mode === 'adec' ? 'valor del primo en decimal'
        : 'valor del primo en Base64';
    const msg = `⚡ Se detectó una búsqueda interrumpida al cerrar la página.\n\n` +
        `Modo: ${modeLabel}\nValor: ${session.inputValue}\nProgreso: ${progress}%\n\n` +
        `¿Desea reanudarla ahora?\n(También puede hacerlo luego desde «Sesiones guardadas».)`;
    const reanudar = await confirmar(msg, { okText: 'Reanudar', cancelText: 'Más tarde' });
    if (reanudar) {
        await resumeSession(session.id);
    } else {
        updateProgress(session.progress || 0,
            '⏸ Sesión recuperada. Reanúdela cuando quiera desde la lista de sesiones.');
    }
}

// ============================================================
// MANEJADOR PRINCIPAL
// ============================================================
async function startSearch(resumeSessionObj = null) {
    const st = estado();
    if (st.isRunning) return;

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
        st.currentSession = { ...resumeSessionObj, status: 'running', updatedAt: Date.now() };
    } else {
        mode = modeSelect.value;
        inputValue = inputField.value.trim();

        if (inputValue === '') { notificar('Por favor, ingrese un valor.', 'warn'); return; }

        if (mode === 'decimal') {
            if (!/^\d+$/.test(inputValue)) { notificar('Ingrese un número decimal válido.', 'error'); return; }
            targetIndex = BigInt(inputValue);
            if (targetIndex < 1n) { notificar('El índice debe ser mayor o igual a 1.', 'error'); return; }
        } else if (mode === 'b64') {
            if (!/^[A-Za-z0-9+/]+$/.test(inputValue)) { notificar('Ingrese un Base64 válido (sin padding).', 'error'); return; }
            targetIndex = base64ToBigInt(inputValue);
            if (targetIndex < 1n) { notificar('El índice debe ser mayor o igual a 1.', 'error'); return; }
        } else if (mode === 'adec') {
            if (!/^\d+$/.test(inputValue)) { notificar('Ingrese un número decimal válido.', 'error'); return; }
            targetPrime = BigInt(inputValue);
            if (targetPrime < 2n) { notificar('El valor debe ser mayor o igual a 2.', 'error'); return; }
        } else if (mode === 'ab64') {
            if (!/^[A-Za-z0-9+/]+$/.test(inputValue)) { notificar('Ingrese un Base64 válido.', 'error'); return; }
            targetPrime = base64ToBigInt(inputValue);
            if (targetPrime < 2n) { notificar('El valor debe ser mayor o igual a 2.', 'error'); return; }
        }

        st.currentSession = {
            id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            mode,
            inputValue,
            targetIndex: targetIndex !== null ? targetIndex.toString() : null,
            targetPrime: targetPrime !== null ? targetPrime.toString() : null,
            primeIndex: null,
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

    st.isRunning = true;
    st.cancelRequested = false;
    hideResults();
    setButtonsEnabled(false, true);
    updateStatus('running', '● Buscando...');
    updateProgress(0, 'Inicializando búsqueda...');
    refreshSegmentLabels();
    startAutosave();
    upsertSession({ ...st.currentSession });

    try {
        if (mode === 'decimal' || mode === 'b64') {
            const result = await findNthPrime(targetIndex, resumeState);
            if (result && result.nthPrime > 0n) {
                const timeStr = `${result.elapsedSeconds.toFixed(2)} segundos`;
                const memStr = `~ ${formatBytes(result.memoryBytes)}`;
                showResults(targetIndex, result.nthPrime, timeStr, memStr);
                updateStatus('completed', '✔ Completado');
                updateProgress(100, `✅ Primo nº ${targetIndex.toString()} = ${result.nthPrime.toString()}`);

                st.currentSession.status = 'completed';
                st.currentSession.progress = 100;
                st.currentSession.updatedAt = Date.now();
                st.currentSession.elapsedSeconds = result.elapsedSeconds;
                st.currentSession.latestPrimeFound = result.nthPrime.toString();
                upsertSession({ ...st.currentSession });
                notificar(`✅ Primo nº ${targetIndex.toString()} encontrado.`, 'success', 3000);
            } else if (!st.cancelRequested) {
                updateStatus('idle', '● En espera');
                updateProgress(0, 'La búsqueda falló.');
                st.currentSession.status = 'paused';
                st.currentSession.updatedAt = Date.now();
                upsertSession({ ...st.currentSession });
            }
        } else {
            // Modos de valor de primo: 'adec' y 'ab64'
            if (!millerRabin(targetPrime, 12)) {
                notificar('El número proporcionado no es primo.', 'error');
                updateStatus('idle', '● En espera');
                updateProgress(0, 'El número no es primo.');
                deleteSessionById(st.currentSession.id);
            } else {
                const result = await findIndexByPrime(targetPrime, resumeState);
                if (result && result.primeIndex > 0n) {
                    const timeStr = `${result.elapsedSeconds.toFixed(2)} segundos`;
                    const memStr = `~ ${formatBytes(result.memoryBytes)}`;
                    showResults(result.primeIndex, targetPrime, timeStr, memStr);
                    updateStatus('completed', '✔ Completado');
                    updateProgress(100, `✅ El primo ${targetPrime.toString()} es el nº ${result.primeIndex.toString()}`);

                    st.currentSession.status = 'completed';
                    st.currentSession.progress = 100;
                    st.currentSession.updatedAt = Date.now();
                    st.currentSession.elapsedSeconds = result.elapsedSeconds;
                    st.currentSession.primeIndex = result.primeIndex.toString();
                    upsertSession({ ...st.currentSession });
                    notificar(`✅ Primo encontrado en índice nº ${result.primeIndex.toString()}.`, 'success', 3000);
                } else if (!st.cancelRequested) {
                    updateStatus('idle', '● En espera');
                    updateProgress(0, 'No se pudo encontrar el índice.');
                    st.currentSession.status = 'paused';
                    st.currentSession.updatedAt = Date.now();
                    upsertSession({ ...st.currentSession });
                }
            }
        }
    } catch (err) {
        // --- Estimación con BigInt para preservar precisión en los últimos dígitos ---
        if (err.message.includes('demasiado grande')) {
            if (mode === 'decimal' || mode === 'b64') {
                const nDouble = Number(targetIndex);
                const lnN = Math.log(nDouble);
                const lnLnN = Math.log(lnN);
                const factor = lnN + lnLnN - 1;
                
                // Multiplicamos el factor por 1,000,000 para conservar 6 decimales de precisión y usamos BigInt
                const factorScaled = BigInt(Math.round(factor * 1000000));
                const estBigInt = (targetIndex * factorScaled) / 1000000n;

                showResults(targetIndex, estBigInt, "Aproximación instantánea", "~ 0 MB");
                updateStatus('completed', '✔ Estimado (PNT)');
                updateProgress(100,
                    `⚠️ El índice es demasiado grande para calcularlo exactamente en tu navegador.\n` +
                    `Se muestra el valor <b>estimado</b> usando el Teorema de los Números Primos.`
                );
                notificar('Límite de memoria excedido. Se usó el Teorema de los Números Primos para estimar el resultado.', 'warn', 6000);
                if (st.currentSession) deleteSessionById(st.currentSession.id);
                
            } else {
                const pDouble = Number(targetPrime);
                const lnP = Math.log(pDouble);
                
                // Escalamiento para división precisa en BigInt
                const lnPScaled = BigInt(Math.round(lnP * 1000000));
                const estBigInt = (targetPrime * 1000000n) / lnPScaled;

                showResults(estBigInt, targetPrime, "Aproximación instantánea", "~ 0 MB");
                updateStatus('completed', '✔ Estimado (PNT)');
                updateProgress(100,
                    `⚠️ El primo es demasiado grande para calcular su índice exacto en tu navegador.\n` +
                    `Se muestra el índice <b>estimado</b> usando el Teorema de los Números Primos.`
                );
                notificar('Límite de memoria excedido. Se usó el Teorema de los Números Primos para estimar el índice.', 'warn', 6000);
                if (st.currentSession) deleteSessionById(st.currentSession.id);
            }
        } else {
            // Errores normales
            updateStatus('idle', '● En espera');
            updateProgress(0, `Error: ${err.message}`);
            console.error(err);
            notificar(`Error: ${err.message}`, 'error');
            
            if (st.currentSession) {
                st.currentSession.status = 'paused';
                st.currentSession.updatedAt = Date.now();
                upsertSession({ ...st.currentSession });
            }
        }
    } finally {
        st.isRunning = false;
        stopAutosave();
        setButtonsEnabled(true, false);
        updateAutosaveInfo();
        st.currentSession = null;
    }
}

function cancelSearch() {
    const st = estado();
    if (st.isRunning) {
        st.cancelRequested = true;
        updateStatus('cancelled', '✖ Cancelando...');
        if (st.currentSession) {
            st.currentSession.status = 'paused';
            st.currentSession.updatedAt = Date.now();
            upsertSession({ ...st.currentSession });
        }
    }
}

async function resumeSession(id) {
    if (estado().isRunning) {
        notificar('Ya hay una búsqueda en curso. Espere o cancele antes de reanudar otra sesión.', 'warn');
        return;
    }
    const sessions = loadSessions();
    const session = sessions.find(s => s.id === id);
    if (!session) { notificar('La sesión no existe o fue eliminada.', 'error'); return; }
    if (session.status === 'completed') {
        const ok = await confirmar('Esta sesión ya está completada. ¿Desea recalcularla desde cero?', {
            okText: 'Recalcular', cancelText: 'Cancelar'
        });
        if (!ok) return;
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
// Persistencia ante cierre / ocultamiento
// ============================================================
function persistOnHide() {
    const st = estado();
    if (st.isRunning && st.currentSession) {
        st.currentSession.status = 'paused';
        st.currentSession.updatedAt = Date.now();
        upsertSession({ ...st.currentSession });
    }
}
