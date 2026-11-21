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
// Factorización (Pollard's Rho + Trial Division)
// ============================================================
function gcd(a, b) {
    while (b) { const t = b; b = a % b; a = t; }
    return a;
}

function pollardRho(n) {
    if (n % 2n === 0n) return 2n;
    let x = 2n, y = 2n, d = 1n;
    const f = (x) => (x * x + 1n) % n;
    while (d === 1n) {
        x = f(x);
        y = f(f(y));
        d = gcd(x > y ? x - y : y - x, n);
    }
    return d;
}

function factorize(n, factors = []) {
    if (n === 1n) return factors;
    if (millerRabin(n, 12)) { factors.push(n); return factors; }
    
    // Probar divisores pequeños primero para acelerar
    for (let p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
        if (n % p === 0n) {
            factorize(p, factors);
            factorize(n / p, factors);
            return factors;
        }
    }
    
    // Pollard Rho
    let d = pollardRho(n);
    factorize(d, factors);
    factorize(n / d, factors);
    return factors;
}

// ============================================================
// Cálculo del índice de un primo (síncrono para el árbol)
// ============================================================
function getPrimeIndexSync(p) {
    if (p <= 1n) return { val: 0n, approx: false };
    if (p === 2n) return { val: 1n, approx: false };
    if (p === 3n) return { val: 2n, approx: false };
    if (p === 5n) return { val: 3n, approx: false };
    
    // Si es pequeño, contar primos exactamente
    if (p < 5000000n) {
        let count = 3n;
        for (let i = 7n; i <= p; i += 2n) {
            if (millerRabin(i, 5)) count++;
        }
        return { val: count, approx: false };
    }
    
    // Aproximación usando Riemann R
    const r = riemannR(p);
    return { val: r, approx: true };
}

// ============================================================
// Criba segmentada
// ============================================================
function generateBasePrimes(limitSqrt) {
    const limitNum = Number(limitSqrt);
    const sieveBytes = Math.floor(limitNum / 8) + 1;
    const maxBytes = CONST().MAX_BASE_SIEVE_BYTES;

    if (sieveBytes > maxBytes) {
        const maxLimit = Math.floor(maxBytes * 8);
        const maxVal = maxLimit * maxLimit;
        const exp = Math.floor(Math.log10(maxVal));
        const base = (maxVal / Math.pow(10, exp)).toFixed(2);
        const maxValStr = `${base} × 10^${exp}`;

        throw new Error(
            `El valor ingresado es demasiado grande.\n\n` +
            `Se requieren primos base hasta ${limitNum.toLocaleString()}, lo cual necesita ~${formatBytes(sieveBytes)} de memoria.\n` +
            `El límite seguro de su navegador es de ${formatBytes(maxBytes)} (permite calcular hasta ~${maxValStr}).\n\n` +
            `Intente con un número más pequeño.`
        );
    }

    const sieve = new Uint8Array(sieveBytes);
    for (let p = 2; p * p <= limitNum; p++) {
        if (((sieve[p >> 3] >> (p & 7)) & 1) === 0) {
            for (let i = p * p; i <= limitNum; i += p) sieve[i >> 3] |= (1 << (i & 7));
        }
    }

    let count = 0;
    for (let p = 2; p <= limitNum; p++) {
        if (((sieve[p >> 3] >> (p & 7)) & 1) === 0) count++;
    }

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

// ============================================================
// Aproximaciones
// ============================================================
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
