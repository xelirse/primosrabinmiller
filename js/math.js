// ============================================================
// BigInt ↔ Base64
// ============================================================
function bigIntToBase64(n) {
    const ALPHABET = CONST().B64_ALPHABET;
    if (n === 0n) return "A";
    const temp = [];
    while (n > 0n) {
        temp.push(ALPHABET[Number(n % 64n)]);
        n = n / 64n;
    }
    return temp.reverse().join('');
}

function base64ToBigInt(str) {
    const ALPHABET = CONST().B64_ALPHABET;
    let result = 0n;
    for (const ch of str) {
        const index = ALPHABET.indexOf(ch);
        if (index === -1) break;
        result = result * 64n + BigInt(index);
    }
    return result;
}

// ============================================================
// Aritmética modular y primalidad
// ============================================================
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

function modInverse(a, m) {
    let m0 = m, y = 0n, x = 1n;
    if (m === 1n) return 0n;
    while (a > 1n) {
        let q = a / m;
        let t = m;
        m = a % m;
        a = t;
        t = y;
        y = x - q * y;
        x = t;
    }
    if (x < 0n) x += m0;
    return x;
}

function gcd(a, b) {
    while (b) { const t = b; b = a % b; a = t; }
    return a;
}

function millerRabin(n, k = 12) {
    if (n < 2n) return false;
    if (n === 2n || n === 3n) return true;
    if (n % 2n === 0n) return false;
    const BASES = CONST().MILLER_RABIN_BASES;
    let d = n - 1n;
    let s = 0;
    while (d % 2n === 0n) { d = d / 2n; s++; }
    for (let i = 0; i < k && i < BASES.length; i++) {
        const a = BASES[i];
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
// POLLARD'S RHO (Brent)
// ============================================================
async function pollardRhoBrent(n, onProgress, maxIterations = 5000000n) {
    if (n % 2n === 0n) return 2n;
    if (n % 3n === 0n) return 3n;

    let y = 2n, c = 1n, m = 128n;
    let g = 1n, r = 1n, q = 1n;
    let x, ys;
    let iterations = 0n;
    const startTime = performance.now();

    while (g === 1n) {
        x = y;
        for (let i = 0n; i < r; i++) y = (y * y + c) % n;
        let k = 0n;
        while (k < r && g === 1n) {
            ys = y;
            let limit = m < r - k ? m : r - k;
            for (let i = 0n; i < limit; i++) {
                y = (y * y + c) % n;
                q = (q * (x > y ? x - y : y - x)) % n;
            }
            g = gcd(q, n);
            k += m;
            iterations += m;
            
            if (onProgress) {
                const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
                onProgress(`Pollard's Rho · ⏱ ${elapsed}s · Iter: ${iterations.toLocaleString('es-ES')}`);
            }
            
            if (iterations >= maxIterations) return null;
            
            await new Promise(res => setTimeout(res, 0));
        }
        r *= 2n;
    }
    if (g === n) {
        do {
            ys = (ys * ys + c) % n;
            g = gcd(x > ys ? x - ys : ys - x, n);
        } while (g === 1n);
    }
    return g === n ? await pollardRhoBrent(n, onProgress, maxIterations) : g;
}

// ============================================================
// ECM (Elliptic Curve Method)
// ============================================================
async function ecm(n, onProgress, B1 = 10000) {
    const startTime = performance.now();
    if (n % 2n === 0n) return 2n;
    
    const primes = [];
    const limit = 100000;
    const sieve = new Uint8Array(limit);
    for (let i = 2; i < limit; i++) {
        if (!sieve[i]) {
            primes.push(BigInt(i));
            for (let j = i * i; j < limit; j += i) sieve[j] = 1;
        }
    }

    for (let curveCount = 0; curveCount < 20; curveCount++) {
        let sigma = BigInt(Math.floor(Math.random() * 1000000) + 6);
        let u = (sigma * sigma - 5n) % n;
        let v = (4n * sigma) % n;
        let x = modPow(u, 3n, n);
        let z = modPow(v, 3n, n);
        let A = modPow((v - u), 3n, n) * (3n * u + v) % n;
        let A24 = modInverse(4n * x * z % n, n);

        if (A24 === null) return gcd(4n * x * z % n, n);
        A = (A * A24) % n;

        let P = { X: x, Z: z };
        let k = 1n;

        for (let i = 0; i < primes.length; i++) {
            let p = primes[i];
            let pe = p;
            while (pe * p < BigInt(B1)) pe *= p;
            
            P = montgomeryLadder(P, pe, A, n);
            
            if (curveCount === 0 && i % 100 === 0 && onProgress) {
                const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
                onProgress(`ECM (Stage 1) · ⏱ ${elapsed}s · Curva ${curveCount + 1} · P: ${p.toString()}`);
                await new Promise(res => setTimeout(res, 0));
            }

            let g = gcd(P.Z, n);
            if (g > 1n && g < n) return g;
            if (g === n) break;
        }
        
        if (onProgress && curveCount % 5 === 0) {
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
            onProgress(`ECM (Stage 2) · ⏱ ${elapsed}s · Curva ${curveCount + 1}`);
        }
    }
    return null;
}

function montgomeryAdd(P, Q, A24, n) {
    let u = ((P.X - P.Z) * (Q.X + Q.Z)) % n;
    let v = ((P.X + P.Z) * (Q.X - Q.Z)) % n;
    let addX = (u + v) % n;
    let subX = (u - v) % n;
    if (subX < 0n) subX += n;
    let X = (addX * addX) % n;
    let Z = (subX * subX) % n;
    return { X, Z };
}

function montgomeryDouble(P, A24, n) {
    let u = (P.X + P.Z) % n;
    let v = (P.X - P.Z) % n;
    let u2 = (u * u) % n;
    let v2 = (v * v) % n;
    let t = (u2 - v2) % n;
    if (t < 0n) t += n;
    let X = (u2 * v2) % n;
    let Z = (t * (v2 + (A24 * t) % n)) % n;
    return { X, Z };
}

function montgomeryLadder(P, k, A24, n) {
    let R0 = { X: P.X, Z: P.Z };
    let R1 = montgomeryDouble(P, A24, n);
    let bits = k.toString(2);
    for (let i = 1; i < bits.length; i++) {
        if (bits[i] === '1') {
            R0 = montgomeryAdd(R0, R1, A24, n);
            R1 = montgomeryDouble(R1, A24, n);
        } else {
            R1 = montgomeryAdd(R0, R1, A24, n);
            R0 = montgomeryDouble(R0, A24, n);
        }
    }
    return R0;
}

// ============================================================
// SIQS (Quadratic Sieve)
// ============================================================
async function siqs(n, onProgress) {
    const startTime = performance.now();
    const digits = n.toString().length;
    let M = 2000;
    if (digits > 30) M = 5000;
    if (digits > 40) M = 10000;

    const factorBase = [];
    const sieve = new Uint8Array(M * 10);
    for (let i = 2; i < M * 10 && factorBase.length < M; i++) {
        if (!sieve[i]) {
            if (modPow(n % BigInt(i), (BigInt(i) - 1n) / 2n, BigInt(i)) === 1n) {
                factorBase.push(BigInt(i));
            }
            for (let j = i * i; j < M * 10; j += i) sieve[j] = 1;
        }
    }

    if (onProgress) onProgress(`SIQS · Preparando base de ${factorBase.length} factores...`);
    await new Promise(res => setTimeout(res, 0));

    const relations = [];
    const intervalSize = M;
    const startX = BigInt(Math.floor(Math.sqrt(Number(n))));

    let iter = 0;
    while (relations.length < factorBase.length + 20) {
        let x = startX + BigInt(iter);
        let Q = (x * x) - n;
        let origQ = Q < 0n ? -Q : Q;

        let remainder = Q;
        let factors = [];
        for (let p of factorBase) {
            while (remainder % p === 0n) {
                remainder /= p;
                factors.push(p);
            }
        }

        if (remainder === 1n || millerRabin(remainder, 5)) {
            relations.push({ x, Q: origQ, factors, remainder });
            if (onProgress) onProgress(`SIQS · ⏱ ${((performance.now() - startTime) / 1000).toFixed(1)}s · Rel: ${relations.length}/${factorBase.length + 20}`);
            await new Promise(res => setTimeout(res, 0));
        }

        iter++;
        if (iter % 5000 === 0 && onProgress) {
            onProgress(`SIQS · ⏱ ${((performance.now() - startTime) / 1000).toFixed(1)}s · Iter: ${iter} · Rel: ${relations.length}`);
            await new Promise(res => setTimeout(res, 0));
        }
    }

    if (onProgress) onProgress(`SIQS · Resolviendo matriz...`);
    await new Promise(res => setTimeout(res, 0));

    for (let i = 0; i < relations.length; i++) {
        for (let j = i + 1; j < relations.length; j++) {
            let prod = relations[i].Q * relations[j].Q;
            let sqrtProd = BigInt(Math.floor(Math.sqrt(Number(prod))));
            if (sqrtProd * sqrtProd === prod) {
                let X = (relations[i].x * relations[j].x) % n;
                let Y = sqrtProd % n;
                let g = gcd(X > Y ? X - Y : Y - X, n);
                if (g > 1n && g < n) return g;
            }
        }
    }
    return null;
}

// ============================================================
// ENRUTADOR DE FACTORIZACIÓN
// ============================================================
async function factorize(n, factors = [], onProgress = null) {
    if (n === 1n) return factors;
    if (onProgress) onProgress(`Analizando número...`, factors, n);

    if (millerRabin(n, 12)) {
        factors.push(n);
        if (onProgress) onProgress(`Primo residual detectado`, factors, null);
        return factors;
    }
    
    // 1. Filtro rápido (Trial Division)
    for (let p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n]) {
        if (n % p === 0n) {
            factors.push(p);
            const nextN = n / p;
            if (onProgress) onProgress(`Factor pequeño encontrado: ${p.toString()}`, factors, nextN);
            await new Promise(res => setTimeout(res, 0));
            await factorize(nextN, factors, onProgress);
            return factors;
        }
    }
    
    // 2. Pollard's Rho
    let d = await pollardRhoBrent(n, (status) => {
        if (onProgress) onProgress(status, factors, n);
    }, 200000n);

    if (d && d !== n) {
        if (onProgress) onProgress(`Factor detectado: ${d.toString()}`, factors, n / d);
        await new Promise(res => setTimeout(res, 0));
        await factorize(d, factors, onProgress);
        await factorize(n / d, factors, onProgress);
        return factors;
    }

    // 3. ECM
    if (onProgress) onProgress(`Iniciando ECM...`, factors, n);
    d = await ecm(n, (status) => {
        if (onProgress) onProgress(status, factors, n);
    }, 10000);
    if (d && d !== n) {
        if (onProgress) onProgress(`Factor detectado por ECM: ${d.toString()}`, factors, n / d);
        await new Promise(res => setTimeout(res, 0));
        await factorize(d, factors, onProgress);
        await factorize(n / d, factors, onProgress);
        return factors;
    }

    // 4. SIQS
    if (onProgress) onProgress(`Iniciando SIQS...`, factors, n);
    d = await siqs(n, (status) => {
        if (onProgress) onProgress(status, factors, n);
    });
    if (d && d !== n) {
        if (onProgress) onProgress(`Factor detectado por SIQS: ${d.toString()}`, factors, n / d);
        await new Promise(res => setTimeout(res, 0));
        await factorize(d, factors, onProgress);
        await factorize(n / d, factors, onProgress);
        return factors;
    }

    factors.push(n);
    return factors;
}

// ============================================================
// Cálculo del índice de un primo (Optimizado con Criba)
// ============================================================
async function getPrimeIndexAsync(p) {
    if (p <= 1n) return { val: 0n, approx: false };
    if (p === 2n) return { val: 1n, approx: false };
    if (p === 3n) return { val: 2n, approx: false };
    if (p === 5n) return { val: 3n, approx: false };
    
    // Si es menor a 5 millones, usamos Criba de Eratóstenes (instantáneo)
    if (p < 5000000n) {
        const limit = Number(p);
        const sieve = new Uint8Array(limit + 1);
        let count = 0;
        for (let i = 2; i <= limit; i++) {
            if (sieve[i] === 0) {
                count++;
                for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
            }
        }
        return { val: BigInt(count), approx: false };
    }
    
    // Para números grandes, usamos la aproximación Riemann R
    const r = riemannR(p);
    return { val: r, approx: true };
}

// ============================================================
// Criba y Aproximaciones
// ============================================================
function generateBasePrimes(limitSqrt) {
    const limitNum = Number(limitSqrt);
    const sieveBytes = Math.floor(limitNum / 8) + 1;
    const maxBytes = CONST().MAX_BASE_SIEVE_BYTES;

    if (sieveBytes > maxBytes) {
        throw new Error(`El valor ingresado es demasiado grande. Memoria requerida: ~${formatBytes(sieveBytes)}.`);
    }

    const sieve = new Uint8Array(sieveBytes);
    for (let p = 2; p * p <= limitNum; p++) {
        if (((sieve[p >> 3] >> (p & 7)) & 1) === 0) {
            for (let i = p * p; i <= limitNum; i += p) sieve[i >> 3] |= (1 << (i & 7));
        }
    }
    let count = 0;
    for (let p = 2; p <= limitNum; p++) if (((sieve[p >> 3] >> (p & 7)) & 1) === 0) count++;
    const primes = new Uint32Array(count);
    let idx = 0;
    for (let p = 2; p <= limitNum; p++) {
        if (((sieve[p >> 3] >> (p & 7)) & 1) === 0) primes[idx++] = p;
    }
    return primes;
}

function sieveSegment(low, high, basePrimes, segmentArray) {
    const bits = CONST().SEGMENT_BITS;
    segmentArray.fill(0);
    const lowNum = Number(low);
    const highNum = Number(high);
    
    for (let i = 0; i < basePrimes.length; i++) {
        const pNum = basePrimes[i];
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
    for (let i = 0; i < bits; i++) {
        if (((segmentArray[i >> 3] >> (i & 7)) & 1) === 0) {
            count++;
            lastPrime = low + BigInt(i);
        }
    }
    return { count, lastPrime };
}

function riemannR(xBig) {
    if (xBig < 2n) return 0n;
    const xBF = BF_FromBigInt(xBig);
    const lnx = BF_Ln(xBF);
    if (lnx.v === 0n) return 0n;
    let sumBF = BF_FromBigInt(1n);
    let termBF = BF_FromBigInt(1n);
    for (let k = 1; k <= 20; k++) {
        termBF = BF_Mul(termBF, BF_Div(BF_FromBigInt(BigInt(k)), lnx));
        sumBF = BF_Add(sumBF, termBF);
    }
    return BF_ToBigInt(BF_Div(BF_Mul(xBF, sumBF), lnx));
}

function riemannRInverse(nBig) {
    if (nBig < 2n) return 2n;
    const nBF = BF_FromBigInt(nBig);
    const lnN = BF_Ln(nBF);
    const lnLnN = BF_Ln(lnN);
    let xBF = BF_Mul(nBF, BF_Sub(BF_Add(lnN, lnLnN), BF_FromBigInt(1n)));
    for (let i = 0; i < 5; i++) {
        const rBF = BF_FromBigInt(riemannR(BF_ToBigInt(xBF)));
        const drBF = BF_Div(BF_FromBigInt(1n), BF_Ln(xBF));
        const diff = BF_Sub(rBF, nBF);
        const step = BF_Div(diff, drBF);
        xBF = BF_Sub(xBF, step);
    }
    return BF_ToBigInt(xBF);
}
