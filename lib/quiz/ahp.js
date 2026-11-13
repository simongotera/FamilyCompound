// Analytic Hierarchy Process helpers (Saaty, 1980).
// A judgment for the pair (a, b) is how much more important a is than b, on Saaty's 1–9 scale;
// values below 1 mean b is more important (1/5 = "b is strongly more important").

// Saaty's random consistency index for n = 0..10.
export const RANDOM_INDEX = [0, 0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49]

export const SAATY_MIN = 1 / 9
export const SAATY_MAX = 9

export function pairKey(a, b) {
  return `${a}|${b}`
}

// All unordered pairs, in a stable order.
export function pairsFor(items) {
  const pairs = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) pairs.push([items[i], items[j]])
  }
  return pairs
}

function clampSaaty(v) {
  return Math.min(SAATY_MAX, Math.max(SAATY_MIN, v))
}

// Read the judgment for (a, b) whichever way round it was stored. Missing → fallback(a, b).
export function judgment(judgments, a, b, fallback) {
  const direct = judgments?.[pairKey(a, b)]
  if (direct > 0) return clampSaaty(direct)
  const reverse = judgments?.[pairKey(b, a)]
  if (reverse > 0) return clampSaaty(1 / reverse)
  return fallback ? clampSaaty(fallback(a, b)) : 1
}

export function buildMatrix(items, judgments, fallback) {
  const n = items.length
  const m = Array.from({ length: n }, () => Array(n).fill(1))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = judgment(judgments, items[i], items[j], fallback)
      m[i][j] = v
      m[j][i] = 1 / v
    }
  }
  return m
}

// Principal eigenvector by power iteration, normalized to sum 1.
export function principalEigenvector(matrix, iterations = 200) {
  const n = matrix.length
  let w = Array(n).fill(1 / n)
  for (let k = 0; k < iterations; k++) {
    const next = matrix.map((row) => row.reduce((s, v, j) => s + v * w[j], 0))
    const sum = next.reduce((s, v) => s + v, 0)
    const normalized = next.map((v) => v / sum)
    const delta = normalized.reduce((s, v, i) => s + Math.abs(v - w[i]), 0)
    w = normalized
    if (delta < 1e-12) break
  }
  return w
}

// Returns { weights: {item: w}, lambdaMax, ci, cr, worstPair }.
// cr ≤ 0.10 is Saaty's usual "consistent enough" threshold.
export function ahp(items, judgments, fallback) {
  const n = items.length
  if (n === 0) return { weights: {}, lambdaMax: 0, ci: 0, cr: 0, worstPair: null }
  if (n === 1) return { weights: { [items[0]]: 1 }, lambdaMax: 1, ci: 0, cr: 0, worstPair: null }
  const m = buildMatrix(items, judgments, fallback)
  const w = principalEigenvector(m)
  const aw = m.map((row) => row.reduce((s, v, j) => s + v * w[j], 0))
  const lambdaMax = aw.reduce((s, v, i) => s + v / w[i], 0) / n
  const ci = n > 2 ? (lambdaMax - n) / (n - 1) : 0
  const ri = RANDOM_INDEX[n] ?? RANDOM_INDEX[RANDOM_INDEX.length - 1]
  const cr = ri > 0 ? Math.max(0, ci / ri) : 0

  // The pair whose judgment is furthest (in log terms) from what the final weights imply.
  let worstPair = null
  let worst = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const gap = Math.abs(Math.log(m[i][j]) - Math.log(w[i] / w[j]))
      if (gap > worst) {
        worst = gap
        worstPair = { a: items[i], b: items[j], said: m[i][j], implied: w[i] / w[j] }
      }
    }
  }

  const weights = {}
  items.forEach((item, i) => { weights[item] = w[i] })
  return { weights, lambdaMax, ci, cr, worstPair }
}
