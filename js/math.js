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
// Criba segmentada
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

function sieveSegment(low, high, basePrimes, segmentArray) {
    const bits = CONST().SEGMENT_BITS;
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
    for (let i = 0; i < bits; i++) {
        if (((segmentArray[i >> 3] >> (i & 7)) & 1) === 0) {
            count++;
            lastPrime = low + BigInt(i);
        }
    }
    return { count, lastPrime };
}
