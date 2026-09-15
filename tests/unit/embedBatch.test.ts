import { describe, expect, it } from "vitest";
import { embedBatch } from "../../src/embeddings/ollama.js";
import type { EmbeddingProvider } from "../../src/embeddings/provider.js";

function fakeProvider(shouldFail: (text: string) => boolean): EmbeddingProvider {
  return {
    model: "fake",
    async embed(text: string): Promise<number[]> {
      if (shouldFail(text)) throw new Error(`simulated failure for ${text}`);
      return [text.length];
    },
  };
}

describe("embedBatch", () => {
  it("embeds every text successfully when nothing fails", async () => {
    const result = await embedBatch(fakeProvider(() => false), ["a", "bb", "ccc"], 2);
    expect(result.embeddings).toEqual([[1], [2], [3]]);
    expect(result.failedIndexes).toEqual([]);
  });

  it("records failed indexes without discarding embeddings that succeeded, and does not throw", async () => {
    const result = await embedBatch(fakeProvider((t) => t === "bad"), ["a", "bad", "c"], 3);
    expect(result.embeddings[0]).toEqual([1]);
    expect(result.embeddings[1]).toBeNull();
    expect(result.embeddings[2]).toEqual([1]);
    expect(result.failedIndexes).toEqual([1]);
  });

  it("never spawns more concurrent workers than there are texts", async () => {
    const result = await embedBatch(fakeProvider(() => false), ["x"], 10);
    expect(result.embeddings).toEqual([[1]]);
  });
});
