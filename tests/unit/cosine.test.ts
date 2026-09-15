import { describe, expect, it } from "vitest";
import { cosineSimilarity, cosineSimilarityUnitB, normalizeVector, vectorNorm } from "../../src/search/cosine.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 6);
  });

  it("returns 0 rather than NaN for a zero vector", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe("vectorNorm / normalizeVector", () => {
  it("computes the Euclidean norm", () => {
    expect(vectorNorm([3, 4])).toBeCloseTo(5, 6);
  });

  it("scales a vector to unit length", () => {
    const normalized = normalizeVector([3, 4]);
    expect(vectorNorm(normalized)).toBeCloseTo(1, 6);
    expect(normalized).toEqual([0.6, 0.8]);
  });

  it("returns a zero vector unchanged rather than dividing by zero", () => {
    expect(normalizeVector([0, 0])).toEqual([0, 0]);
  });
});

describe("cosineSimilarityUnitB", () => {
  it("matches cosineSimilarity when b is already unit-length", () => {
    const a = [1, 2, 3];
    const b = normalizeVector([4, 5, 6]);
    expect(cosineSimilarityUnitB(a, vectorNorm(a), b)).toBeCloseTo(cosineSimilarity(a, b), 6);
  });

  it("returns 0 when a is the zero vector", () => {
    expect(cosineSimilarityUnitB([0, 0], 0, [1, 0])).toBe(0);
  });
});
