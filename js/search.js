// ============================================================
// BÚSQUEDA PRINCIPAL: N-ÉSIMO PRIMO
// ============================================================
async function findNthPrime(targetIndex, resumeState = null) {
    const st = estado();
    const SEGMENT_BITS = CONST().SEGMENT_BITS;
    const targetDouble = Number(targetIndex);
    let maxValEst = 20.0;
    if (targetDouble >= 6.0) {
        maxValEst = targetDouble * (Math.log(targetDouble) + Math.log(Math.log(targetDouble)) + 1.0);
    }
    const limitSqrtFloat = Math.sqrt(maxValEst) + 100000;
    const limitSqrt = BigInt(Math.floor(limitSqrtFloat));

    updateProgress(0, 'Generando primos base...');
    
    // Esta función ahora puede lanzar un Error si excede el límite de memoria
    st.basePrimesArray = generateBasePrimes(limitSqrt);
    
    const basePrimesCount = st.basePrimesArray.length;
    updateProgress(0, `Primos base generados: ${basePrimesCount.toLocaleString('es-ES')} (hasta ${Number(limitSqrt).toLocaleString('es-ES')})`);

    const segmentArray = new Uint8Array(CONST().SEGMENT_SIZE_BYTES);

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

    if (st.currentSession) {
        st.currentSession.basePrimesCount = basePrimesCount;
        st.currentSession.memoryBytes = estimateMemory(basePrimesCount);
    }

    while (count < targetIndex) {
        if (st.cancelRequested) { updateStatus('cancelled', '✖ Cancelado'); return null; }

        const high = low + BigInt(SEGMENT_BITS) - 1n;
        if (high > maxLimitSquared) {
            updateProgress(100, '❌ [Error Matemático] Se requiere ampliar la estimación base.');
            return null;
        }

        const result = sieveSegment(low, high, st.basePrimesArray, segmentArray);
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

            // --- NUEVO FORMATO DE PROGRESO (FLEXBOX) ---
            const progressText = `
                <div class="prog-row">
                    <span class="prog-pct">${percentage.toFixed(2)}%</span>
                    <span class="prog-ratio">${ratioStr}</span>
                    <span class="prog-eta">ETA: ${etaStr}</span>
                </div>
                <div class="prog-row">
                    <span><b>P:</b> ${latestPrimeFound.toString()}</span>
                </div>
                <div class="prog-row">
                    <span><b>Est:</b> ${estStr} <span class="b64-text">${estB64}</span></span>
                </div>
                <div class="prog-row">
                    <span><b>Seg:</b> ${segmentNumber.toLocaleString('es-ES')}</span>
                    <span><b>Primos:</b> ${count.toLocaleString('es-ES')} / ${Number(targetIndex).toLocaleString('es-ES')}</span>
                </div>
            `;
            updateProgress(percentage, progressText);
        }

        if (now - lastYieldTime >= 50 && count < targetIndex) {
            lastYieldTime = now;
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (nthPrimeValue > 0n) break;
        low += BigInt(SEGMENT_BITS);

        if (st.currentSession) {
            st.currentSession.count = count.toString();
            st.currentSession.low = low.toString();
            st.currentSession.latestPrimeFound = latestPrimeFound.toString();
            st.currentSession.segmentNumber = segmentNumber;
            st.currentSession.progress = (Number(count) / Number(targetIndex)) * 100;
            st.currentSession.elapsedSeconds = accumulatedSeconds + (performance.now() - perfStartTime) / 1000;
            st.currentSession.basePrimesCount = basePrimesCount;
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
    const st = estado();
    const SEGMENT_BITS = CONST().SEGMENT_BITS;
    if (!millerRabin(primeValue, 12)) return null;

    const primeDouble = Number(primeValue);
    const estimatedIndex = Math.max(1, primeDouble / Math.log(primeDouble));
    const limitSqrtFloat = Math.sqrt(primeDouble) + 100000;
    const limitSqrt = BigInt(Math.floor(limitSqrtFloat));

    updateProgress(0, 'Generando primos base...');
    
    // Esta función ahora puede lanzar un Error si excede el límite de memoria
    st.basePrimesArray = generateBasePrimes(limitSqrt);
    
    const basePrimesCount = st.basePrimesArray.length;
    updateProgress(0, `Primos base generados: ${basePrimesCount.toLocaleString('es-ES')} (hasta ${Number(limitSqrt).toLocaleString('es-ES')})`);

    const segmentArray = new Uint8Array(CONST().SEGMENT_SIZE_BYTES);

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

    if (st.currentSession) {
        st.currentSession.basePrimesCount = basePrimesCount;
        st.currentSession.memoryBytes = estimateMemory(basePrimesCount);
    }

    while (true) {
        if (st.cancelRequested) { updateStatus('cancelled', '✖ Cancelado'); return null; }

        const high = low + BigInt(SEGMENT_BITS) - 1n;
        if (high > maxLimitSquared) {
            updateProgress(100, '❌ [Error] Se requiere ampliar la estimación base.');
            return null;
        }

        const result = sieveSegment(low, high, st.basePrimesArray, segmentArray);
        latestPrimeFound = result.lastPrime;

        if (primeValue >= low && primeValue <= high) {
            let c = count;
            let found = false;
            for (let i = 0; i < SEGMENT_BITS; i++) {
                if (((segmentArray[i >> 3] >> (i & 7)) & 1) === 0) {
                    c++;
                    const val = low + BigInt(i);
                    if (val === primeValue) { primeIndex = c; found = true; break; }
                }
            }
            count = c;
            if (found) {
                updateProgress(100, `✅ Encontrado: primo nº ${primeIndex.toLocaleString('es-ES')} (${primeValue.toString()})`);
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

            // --- NUEVO FORMATO DE PROGRESO (FLEXBOX) ---
            const progressText = `
                <div class="prog-row">
                    <span class="prog-pct">${percentage.toFixed(2)}%</span>
                    <span class="prog-ratio">${ratioStr}</span>
                    <span class="prog-eta">ETA: ${etaStr}</span>
                </div>
                <div class="prog-row">
                    <span><b>Último:</b> ${latestPrimeFound.toString()}</span>
                </div>
                <div class="prog-row">
                    <span><b>Est:</b> ${estStr} <span class="b64-text">${estB64}</span></span>
                </div>
                <div class="prog-row">
                    <span><b>Primos:</b> ${count.toLocaleString('es-ES')} / ${estimatedIndex.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</span>
                </div>
            `;
            updateProgress(percentage, progressText);
        }

        if (now - lastYieldTime >= 50) {
            lastYieldTime = now;
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        low += BigInt(SEGMENT_BITS);

        if (st.currentSession) {
            st.currentSession.count = count.toString();
            st.currentSession.low = low.toString();
            st.currentSession.latestPrimeFound = latestPrimeFound.toString();
            st.currentSession.segmentNumber = segmentNumber;
            st.currentSession.progress = Math.min(100, (Number(count) / estimatedIndex) * 100);
            st.currentSession.elapsedSeconds = accumulatedSeconds + (performance.now() - perfStartTime) / 1000;
            st.currentSession.basePrimesCount = basePrimesCount;
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
