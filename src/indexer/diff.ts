import type { Chunk } from "./chunk.js";
import type { StoredChunk } from "./store.js";

export interface ChunkDiff {
  toEmbed: Chunk[];
  toKeep: StoredChunk[];
  toDeleteIds: Set<string>;
}

/**
 * Compares freshly-extracted chunks against previously-stored ones by
 * `id` (the stable slotKey) and `contentHash`. Same id + same hash means
 * the embedding is still valid and the Ollama call can be skipped entirely
 * — this is what makes `watch` cheap on an unchanged-content re-save.
 */
export function diffChunks(oldChunks: StoredChunk[], newChunks: Chunk[]): ChunkDiff {
  const oldById = new Map(oldChunks.map((c) => [c.id, c]));
  const newIds = new Set(newChunks.map((c) => c.id));

  const toEmbed: Chunk[] = [];
  const toKeep: StoredChunk[] = [];
  for (const chunk of newChunks) {
    const old = oldById.get(chunk.id);
    if (old && old.contentHash === chunk.contentHash) {
      toKeep.push(old);
    } else {
      toEmbed.push(chunk);
    }
  }

  const toDeleteIds = new Set([...oldById.keys()].filter((id) => !newIds.has(id)));
  return { toEmbed, toKeep, toDeleteIds };
}
