// ============================================================
// BIGFLOAT: Punto fijo con 46 decimales de precisión
// ============================================================
const BF_SCALE = 10n ** 46n;
const BF_HALF_SCALE = 5n * (10n ** 45n);
const BF_SQRT_SCALE = 10n ** 23n; // 10^46 / 10^23 = 10^23

function BF_FromBigInt(n) {
    return { v: n * BF_SCALE };
}

function BF_ToBigInt(bf) {
    let val = bf.v;
    const rem = val % BF_SCALE;
    const absRem = rem < 0n ? -rem : rem;
    if (absRem >= BF_HALF_SCALE) {
        val = rem < 0n ? val - (BF_SCALE - absRem) : val + (BF_SCALE - rem);
    } else {
        val = val - rem;
    }
    return val / BF_SCALE;
}

function BF_Add(a, b) { return { v: a.v + b.v }; }
function BF_Sub(a, b) { return { v: a.v - b.v }; }
function BF_Mul(a, b) { return { v: (a.v * b.v) / BF_SCALE }; }
function BF_Div(a, b) { return { v: (a.v * BF_SCALE) / b.v }; }

function BF_Sqrt(a) {
    if (a.v <= 0n) return { v: 0n };
    let x = BigInt(Math.floor(Math.sqrt(Number(a.v) / 1e46) * 1e23));
    if (x === 0n) x = BF_SQRT_SCALE;
    x = x * BF_SQRT_SCALE;
    
    for (let i = 0; i < 50; i++) {
        let nx = (x + (a.v * BF_SCALE) / x) / 2n;
        if (nx === x) break;
        x = nx;
    }
    return { v: x };
}

function BF_Ln(a) {
    if (a.v <= 0n) return { v: 0n }; // ln(0) o negativo no soportado
    if (a.v === BF_SCALE) return { v: 0n }; // ln(1) = 0
    
    let x = a.v;
    let k = 0n;
    // Reducir x al rango [1, 10] usando raíces cuadradas
    while (x >= 10n * BF_SCALE) {
        x = BF_Sqrt({ v: x }).v;
        k++;
    }
    
    // Series de Taylor para ln((1+y)/(1-y)) con y = (x-1)/(x+1)
    let y = ((x - BF_SCALE) * BF_SCALE) / (x + BF_SCALE);
    let y2 = (y * y) / BF_SCALE;
    let term = y;
    let sum = y;
    let n = 3n;
    
    while (term !== 0n) {
        term = (term * y2) / BF_SCALE;
        sum += term / n;
        n += 2n;
    }
    
    let res = (2n * sum) << k; // Multiplicar por 2^k
    return { v: res };
}
