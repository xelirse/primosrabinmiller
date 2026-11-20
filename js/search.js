// ============================================================
// BÚSQUEDA PRINCIPAL: N-ÉSIMO PRIMO
// ============================================================
async function findNthPrime(targetIndex, resumeState = null) {
    var st = estado();
    var SEGMENT_BITS = CONST().SEGMENT_BITS;
    var targetDouble = Number(targetIndex);
    var maxValEst = 20.0;
    if (targetDouble >= 6.0) {
        maxValEst = targetDouble * (Math.log(targetDouble) + Math.log(Math.log(targetDouble)) + 1.0);
    }
    var limitSqrtFloat = Math.sqrt(maxValEst) + 100000;
    var limitSqrt = BigInt(Math.floor(limitSqrtFloat));

    updateProgress(0, '<b>Método:</b> Criba Exacta<br>Generando primos base...');
    
    // Esta función ahora puede lanzar un Error si excede el límite de memoria
    st.basePrimesArray = generateBasePrimes(limitSqrt);
    
    var basePrimesCount = st.basePrimesArray.length;
    updateProgress(0, `<b>Método:</b> Criba Exacta<br>Primos base generados: ${basePrimesCount.toLocaleString('es-ES')} (hasta ${Number(limitSqrt).toLocaleString('es-ES')})`);

    var segmentArray = new Uint8Array(CONST().SEGMENT_SIZE_BYTES);

    var count = resumeState && resumeState.count ? BigInt(resumeState.count) : 0n;
    var low = resumeState && resumeState.low ? BigInt(resumeState.low) : 2n;
    var segmentNumber = resumeState && resumeState.segmentNumber ? resumeState.segmentNumber : 0;
    var latestPrimeFound = resumeState && resumeState.latestPrimeFound
        ? BigInt(resumeState.latestPrimeFound) : 0n;
    var accumulatedSeconds = resumeState && resumeState.elapsedSeconds
        ? resumeState.elapsedSeconds : 0;
    var nthPrimeValue = 0n;

    var wallStartTime = Date.now();
    var perfStartTime = performance.now();
    var lastProgressUpdate = performance.now();
    var lastYieldTime = performance.now();

    var maxLimitSquared = limitSqrt * limitSqrt;

    if (st.currentSession) {
        st.currentSession.basePrimesCount = basePrimesCount;
        st.currentSession.memoryBytes = estimateMemory(basePrimesCount);
    }

    while (count < targetIndex) {
        if (st.cancelRequested) { updateStatus('cancelled', '✖ Cancelado'); return null; }

        var high = low + BigInt(SEGMENT_BITS) - 1n;
        if (high > maxLimitSquared) {
            updateProgress(100, '<b>Método:</b> Criba Exacta<br>❌ [Error Matemático] Se requiere ampliar la estimación base.');
            return null;
        }

        var result = sieveSegment(low, high, st.basePrimesArray, segmentArray);
        var primesInSegment = result.count;
        if (count + primesInSegment >= targetIndex) {
            var offsetInSegment = Number(targetIndex - count) - 1;
            var foundCount = 0;
            for (var i = 0; i < SEGMENT_BITS; i++) {
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

        var now = performance.now();
        if (now - lastProgressUpdate >= 250 || count >= targetIndex) {
            lastProgressUpdate = now;
            var percentage = (Number(count) / Number(targetIndex)) * 100;
            var ratioStr = calculateRatio(percentage).trim();

            var estimatedPrime = latestPrimeFound;
            var countDouble = Number(count);
            if (countDouble > 1000 && countDouble < Number(targetIndex)) {
                var pntTarget = Number(targetIndex) * Math.log(Number(targetIndex));
                var pntCurrent = countDouble * Math.log(countDouble);
                var estVal = Number(latestPrimeFound) * (pntTarget / pntCurrent);
                estimatedPrime = nextPrime(BigInt(Math.floor(estVal)));
            }

            var estStr = estimatedPrime.toString();
            var estB64 = bigIntToBase64(estimatedPrime);
            var elapsedWallSec = (Date.now() - wallStartTime) / 1000.0 + accumulatedSeconds;
            var etaStr = "Calculando...";
            if (elapsedWallSec >= 2 && countDouble > 0) {
                var rate = countDouble / elapsedWallSec;
                var remainingSec = (Number(targetIndex) - countDouble) / rate;
                var etaTime = new Date(Date.now() + remainingSec * 1000);
                etaStr = formatDateTime(etaTime);
            }

            // --- FORMATO DE PROGRESO (FLEXBOX) CON MÉTODO ---
            var progressText = `
                <div class="prog-row">
                    <span><b>Método:</b> Criba Exacta</span>
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

    var elapsedTotal = accumulatedSeconds + (performance.now() - perfStartTime) / 1000.0;
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
    var st = estado();
    var SEGMENT_BITS = CONST().SEGMENT_BITS;
    if (!millerRabin(primeValue, 12)) return null;

    var primeDouble = Number(primeValue);
    var estimatedIndex = Math.max(1, primeDouble / Math.log(primeDouble));
    var limitSqrtFloat = Math.sqrt(primeDouble) + 100000;
    var limitSqrt = BigInt(Math.floor(limitSqrtFloat));

    updateProgress(0, '<b>Método:</b> Criba Exacta<br>Generando primos base...');
    
    // Esta función ahora puede lanzar un Error si excede el límite de memoria
    st.basePrimesArray = generateBasePrimes(limitSqrt);
    
    var basePrimesCount = st.basePrimesArray.length;
    updateProgress(0, `<b>Método:</b> Criba Exacta<br>Primos base generados: ${basePrimesCount.toLocaleString('es-ES')} (hasta ${Number(limitSqrt).toLocaleString('es-ES')})`);

    var segmentArray = new Uint8Array(CONST().SEGMENT_SIZE_BYTES);

    var count = resumeState && resumeState.count ? BigInt(resumeState.count) : 0n;
    var low = resumeState && resumeState.low ? BigInt(resumeState.low) : 2n;
    var segmentNumber = resumeState && resumeState.segmentNumber ? resumeState.segmentNumber : 0;
    var latestPrimeFound = resumeState && resumeState.latestPrimeFound
        ? BigInt(resumeState.latestPrimeFound) : 0n;
    var accumulatedSeconds = resumeState && resumeState.elapsedSeconds
        ? resumeState.elapsedSeconds : 0;
    var primeIndex = 0n;

    var wallStartTime = Date.now();
    var perfStartTime = performance.now();
    var lastProgressUpdate = performance.now();
    var lastYieldTime = performance.now();

    var maxLimitSquared = limitSqrt * limitSqrt;

    if (st.currentSession) {
        st.currentSession.basePrimesCount = basePrimesCount;
        st.currentSession.memoryBytes = estimateMemory(basePrimesCount);
    }

    while (true) {
        if (st.cancelRequested) { updateStatus('cancelled', '✖ Cancelado'); return null; }

        var high = low + BigInt(SEGMENT_BITS) - 1n;
        if (high > maxLimitSquared) {
            updateProgress(100, '<b>Método:</b> Criba Exacta<br>❌ [Error] Se requiere ampliar la estimación base.');
            return null;
        }

        var result = sieveSegment(low, high, st.basePrimesArray, segmentArray);
        latestPrimeFound = result.lastPrime;

        if (primeValue >= low && primeValue <= high) {
            var c = count;
            var found = false;
            for (var i = 0; i < SEGMENT_BITS; i++) {
                if (((segmentArray[i >> 3] >> (i & 7)) & 1) === 0) {
                    c++;
                    var val = low + BigInt(i);
                    if (val === primeValue) { primeIndex = c; found = true; break; }
                }
            }
            count = c;
            if (found) {
                updateProgress(100, `<b>Método:</b> Criba Exacta<br>✅ Encontrado: primo nº ${primeIndex.toLocaleString('es-ES')} (${primeValue.toString()})`);
                break;
            }
        } else {
            count += result.count;
        }
        segmentNumber++;

        var now = performance.now();
        if (now - lastProgressUpdate >= 250) {
            lastProgressUpdate = now;
            var percentage = Math.min(100, (Number(count) / estimatedIndex) * 100);
            var ratioStr = calculateRatio(percentage).trim();

            var estimatedPrime = latestPrimeFound;
            var countDouble = Number(count);
            if (countDouble > 10) {
                var estVal = countDouble * Math.log(countDouble);
                estimatedPrime = nextPrime(BigInt(Math.floor(estVal)));
            }
            var estStr = estimatedPrime.toString();
            var estB64 = bigIntToBase64(estimatedPrime);

            var elapsedWallSec = (Date.now() - wallStartTime) / 1000.0 + accumulatedSeconds;
            var etaStr = "Calculando...";
            if (elapsedWallSec >= 2 && countDouble > 0) {
                var rate = countDouble / elapsedWallSec;
                var remaining = Math.max(0, (estimatedIndex - countDouble) / rate);
                var etaTime = new Date(Date.now() + remaining * 1000);
                etaStr = formatDateTime(etaTime);
            }

            // --- FORMATO DE PROGRESO (FLEXBOX) CON MÉTODO ---
            var progressText = `
                <div class="prog-row">
                    <span><b>Método:</b> Criba Exacta</span>
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

    var elapsedTotal = accumulatedSeconds + (performance.now() - perfStartTime) / 1000.0;
    return {
        primeIndex,
        elapsedSeconds: elapsedTotal,
        segmentCount: segmentNumber,
        basePrimesCount,
        memoryBytes: estimateMemory(basePrimesCount)
    };
}
