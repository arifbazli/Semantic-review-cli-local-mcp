export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function vectorNorm(v: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

/** Scales `v` to unit length. Returns `v` unchanged (as a copy) for a zero vector rather than dividing by zero. */
export function normalizeVector(v: readonly number[]): number[] {
  const norm = vectorNorm(v);
  if (norm === 0) return v.slice();
  return v.map((x) => x / norm);
}

/**
 * Cosine similarity when `b` is already known to be unit-length (see
 * `indexer/reindex.ts`, which normalizes every stored embedding) and the
 * caller has already computed `aNorm` once. Scoring N chunks against the
 * same query then costs one sqrt total instead of the 2N sqrts
 * `cosineSimilarity` would do if called once per chunk with a fixed `a`.
 */
export function cosineSimilarityUnitB(a: readonly number[], aNorm: number, b: readonly number[]): number {
  if (aNorm === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot / aNorm;
}
