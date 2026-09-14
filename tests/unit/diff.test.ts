import { describe, expect, it } from "vitest";
import { diffChunks } from "../../src/indexer/diff.js";
import type { Chunk } from "../../src/indexer/chunk.js";
import type { StoredChunk } from "../../src/indexer/store.js";

function stored(id: string, contentHash: string): StoredChunk {
  return { id, file: "f.ts", functionName: "f", startLine: 1, endLine: 2, contentHash, truncated: false, embedding: [1, 2, 3] };
}
function chunk(id: string, contentHash: string): Chunk {
  return { id, file: "f.ts", functionName: "f", startLine: 1, endLine: 2, contentHash, text: "x", truncated: false };
}

describe("diffChunks", () => {
  it("everything is toEmbed when there is no old index", () => {
    const result = diffChunks([], [chunk("a", "h1"), chunk("b", "h2")]);
    expect(result.toEmbed.map((c) => c.id)).toEqual(["a", "b"]);
    expect(result.toKeep).toHaveLength(0);
    expect(result.toDeleteIds.size).toBe(0);
  });

  it("keeps a chunk whose id and content hash are unchanged", () => {
    const result = diffChunks([stored("a", "h1")], [chunk("a", "h1")]);
    expect(result.toEmbed).toHaveLength(0);
    expect(result.toKeep.map((c) => c.id)).toEqual(["a"]);
  });

  it("re-embeds a chunk whose content hash changed even though the id is the same", () => {
    const result = diffChunks([stored("a", "h1")], [chunk("a", "h2")]);
    expect(result.toEmbed.map((c) => c.id)).toEqual(["a"]);
    expect(result.toKeep).toHaveLength(0);
  });

  it("marks an old chunk for deletion when its slot no longer exists", () => {
    const result = diffChunks([stored("a", "h1"), stored("b", "h2")], [chunk("a", "h1")]);
    expect(result.toDeleteIds).toEqual(new Set(["b"]));
  });
});
