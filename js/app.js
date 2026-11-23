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
    const algSelect = document.getElementById('algorithmSelect');
    const inputField = document.getElementById('inputValue');

    let mode, algorithm, inputValue;
    let targetIndex = null;
    let targetPrime = null;
    let resumeState = null;

    if (resumeSessionObj) {
        mode = resumeSessionObj.mode;
        algorithm = resumeSessionObj.algorithm || 'exact';
        inputValue = resumeSessionObj.inputValue || '';
        modeSelect.value = mode;
        if(algSelect) algSelect.value = algorithm;
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
        algorithm = algSelect ? algSelect.value : 'exact';
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

        // NUEVO: Verificar si ya existe una sesión completada con esta misma configuración
        const sessions = loadSessions();
        const existingSession = sessions.find(s => 
            s.status === 'completed' &&
            s.mode === mode &&
            s.inputValue === inputValue &&
            (s.algorithm === algorithm || s.originalAlgorithm === algorithm) &&
            (s.latestPrimeFound !== '0' || s.primeIndex) // Asegurarse de que tiene datos válidos
        );

        if (existingSession) {
            notificar('✅ Sesión ya calculada encontrada. Cargando resultados...', 'success', 3000);
            loadSessionResults(existingSession.id);
            return; // Detener la ejecución aquí, no hace falta calcular
        }

        st.currentSession = {
            id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            mode,
            algorithm,
            originalAlgorithm: algorithm,
            isFallback: false,
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
            treeData: null
        };
    }

    st.isRunning = true;
    st.cancelRequested = false;
    hideResults();
    setButtonsEnabled(false, true);
    updateStatus('running', '● Calculando...');
    updateProgress(0, 'Inicializando...');
    refreshSegmentLabels();
    startAutosave();
    upsertSession({ ...st.currentSession });

    try {
        const isIndexMode = mode === 'decimal' || mode === 'b64';

        // --- LÓGICA PARA APROXIMACIONES DIRECTAS (PNT o RIEMANN) ---
        if (algorithm !== 'exact') {
            let estBigInt;
            const algName = algorithm === 'riemann' ? 'Riemann R' : 'PNT';
            
            if (isIndexMode) {
                if (algorithm === 'riemann') {
                    estBigInt = riemannRInverse(targetIndex);
                } else {
                    const nBF = BF_FromBigInt(targetIndex);
                    const lnN = BF_Ln(nBF);
                    const lnLnN = BF_Ln(lnN);
                    const factor = BF_Sub(BF_Add(lnN, lnLnN), BF_FromBigInt(1n));
                    estBigInt = BF_ToBigInt(BF_Mul(nBF, factor));
                }
                // Forzar a que sea un primo real buscando el siguiente
                estBigInt = nextPrime(estBigInt);
                showResults(targetIndex, estBigInt, "Aproximación instantánea", "~ 0 MB", algName);
            } else {
                if (algorithm === 'riemann') {
                    estBigInt = riemannR(targetPrime);
                } else {
                    const pBF = BF_FromBigInt(targetPrime);
                    const lnP = BF_Ln(pBF);
                    estBigInt = BF_ToBigInt(BF_Div(pBF, lnP));
                }
                // Forzar a que sea un primo real
                estBigInt = nextPrime(estBigInt);
                showResults(estBigInt, targetPrime, "Aproximación instantánea", "~ 0 MB", algName);
            }
            
            updateStatus('completed', `✔ Estimado (${algName})`);
            updateProgress(100,
                `<b>Método:</b> ${algName}<br>` +
                `⚠️ Se usó la aproximación <b>${algName}</b>.<br>` +
                `Se ha verificado y ajustado al primo más cercano.`
            );

            st.currentSession.status = 'completed';
            st.currentSession.progress = 100;
            st.currentSession.updatedAt = Date.now();
            if (isIndexMode) st.currentSession.latestPrimeFound = estBigInt.toString();
            else st.currentSession.primeIndex = estBigInt.toString();
            upsertSession({ ...st.currentSession });
            
            notificar(`✅ Estimación (${algName}) completada y guardada.`, 'success', 3000);
            return;
        }

        // --- LÓGICA PARA CRIBA EXACTA ---
        const algExact = 'Criba Exacta';

        if (isIndexMode) {
            const result = await findNthPrime(targetIndex, resumeState);
            if (result && result.nthPrime > 0n) {
                const timeStr = `${result.elapsedSeconds.toFixed(2)} segundos`;
                const memStr = `~ ${formatBytes(result.memoryBytes)}`;
                showResults(targetIndex, result.nthPrime, timeStr, memStr, algExact);
                updateStatus('completed', '✔ Completado');
                updateProgress(100, `<b>Método:</b> ${algExact}<br>✅ Primo nº ${targetIndex.toString()} = ${result.nthPrime.toString()}`);

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
                    showResults(result.primeIndex, targetPrime, timeStr, memStr, algExact);
                    updateStatus('completed', '✔ Completado');
                    updateProgress(100, `<b>Método:</b> ${algExact}<br>✅ El primo ${targetPrime.toString()} es el nº ${result.primeIndex.toString()}`);

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
        // --- FALLBACK: Si la Criba Exacta falla por falta de memoria ---
        if (err.message.includes('demasiado grande')) {
            const isIndexMode = mode === 'decimal' || mode === 'b64';
            const algFallback = 'PNT (Fallback)';
            
            if (isIndexMode) {
                const nBF = BF_FromBigInt(targetIndex);
                const lnN = BF_Ln(nBF);
                const lnLnN = BF_Ln(lnN);
                const factor = BF_Sub(BF_Add(lnN, lnLnN), BF_FromBigInt(1n));
                let estBigInt = BF_ToBigInt(BF_Mul(nBF, factor));

                // Forzar a que sea un primo real
                estBigInt = nextPrime(estBigInt);

                showResults(targetIndex, estBigInt, "Aproximación instantánea", "~ 0 MB", algFallback);
                updateStatus('completed', '✔ Estimado (PNT)');
                updateProgress(100, `<b>Método:</b> ${algFallback}<br>⚠️ Límite de memoria excedido. Se usó PNT y se ajustó al primo real más cercano.`);
                
                st.currentSession.status = 'completed';
                st.currentSession.progress = 100;
                st.currentSession.latestPrimeFound = estBigInt.toString();
                
                st.currentSession.originalAlgorithm = st.currentSession.algorithm;
                st.currentSession.algorithm = 'pnt';
                st.currentSession.isFallback = true;
                
                upsertSession({ ...st.currentSession });
                notificar('Límite excedido. Estimación PNT guardada en sesiones.', 'warn', 6000);
            } else {
                const pBF = BF_FromBigInt(targetPrime);
                const lnP = BF_Ln(pBF);
                let estBigInt = BF_ToBigInt(BF_Div(pBF, lnP));

                // Forzar a que sea un primo real
                estBigInt = nextPrime(estBigInt);

                showResults(estBigInt, targetPrime, "Aproximación instantánea", "~ 0 MB", algFallback);
                updateStatus('completed', '✔ Estimado (PNT)');
                updateProgress(100, `<b>Método:</b> ${algFallback}<br>⚠️ Límite de memoria excedido. Se usó PNT y se ajustó al primo real más cercano.`);
                
                st.currentSession.status = 'completed';
                st.currentSession.progress = 100;
                st.currentSession.primeIndex = estBigInt.toString();
                
                st.currentSession.originalAlgorithm = st.currentSession.algorithm;
                st.currentSession.algorithm = 'pnt';
                st.currentSession.isFallback = true;
                
                upsertSession({ ...st.currentSession });
                notificar('Límite excedido. Estimación PNT guardada en sesiones.', 'warn', 6000);
            }
        } else {
            // Otros errores
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
        
        if (st.currentSession) {
            st.lastSessionId = st.currentSession.id;
        }
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
