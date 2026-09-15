/** Splits an identifier into lowercase words at camelCase, PascalCase, snake_case, and kebab-case boundaries. */
function splitIdentifierWords(name: string): string[] {
  return name
    .replace(/<anonymous:\d+>/g, "anonymous")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function queryWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);
}

/**
 * Fraction (0..1) of the query's words that also appear as words in
 * `functionName` once split on identifier-casing boundaries. A cheap
 * lexical signal meant to be blended with, not replace, cosine similarity —
 * it helps rank the right helper among several similarly-embedded ones in
 * the same file, which `nomic-embed-text` alone is measurably weaker at
 * (see README's "Known limits" and tests/e2e/search.e2e.test.ts).
 */
export function functionNameOverlap(query: string, functionName: string): number {
  const qWords = queryWords(query);
  if (qWords.length === 0) return 0;
  const nameWordSet = new Set(splitIdentifierWords(functionName));
  if (nameWordSet.size === 0) return 0;
  const hits = qWords.filter((w) => nameWordSet.has(w)).length;
  return hits / qWords.length;
}
