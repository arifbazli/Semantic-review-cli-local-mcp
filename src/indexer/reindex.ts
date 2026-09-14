import { buildCallGraph } from "../callgraph/graph.js";
import type { Config } from "../config/schema.js";
import { embedBatch, OllamaProvider } from "../embeddings/ollama.js";
import { chunkFile, type Chunk } from "./chunk.js";
import { diffChunks } from "./diff.js";
import { buildProjectFiles } from "./pipeline.js";
import { readIndexFile, writeCallGraphFile, writeIndexFile, type StoredChunk } from "./store.js";

export interface ReindexStats {
  filesScanned: number;
  functionsFound: number;
  chunksEmbedded: number;
  chunksReused: number;
  chunksDeleted: number;
}

/**
 * Re-walks the whole project and rebuilds both the chunk index and the call
 * graph. This re-parses every file on each call rather than maintaining
 * incremental in-memory state across `watch` events — a deliberate
 * simplicity trade-off. The expensive part (Ollama embedding calls) still
 * only happens for chunks whose content actually changed, via `diffChunks`;
 * re-walking the directory tree and re-parsing unchanged files is comparatively
 * cheap and keeps the implementation correct-by-construction instead of
 * needing to reason about incremental cache invalidation.
 */
export async function fullReindex(dir: string, config: Config): Promise<ReindexStats> {
  const projectFiles = buildProjectFiles(dir, config.scan.maxFileBytes);
  const provider = new OllamaProvider(config.ollama.baseUrl, config.model);

  const allNewChunks: Chunk[] = [];
  for (const parsed of projectFiles.files.values()) {
    allNewChunks.push(...chunkFile(parsed, dir, config.embedding.maxChunkChars));
  }

  const oldIndex = readIndexFile(dir, config);
  const diff = diffChunks(oldIndex?.chunks ?? [], allNewChunks);

  const embeddings =
    diff.toEmbed.length > 0 ? await embedBatch(provider, diff.toEmbed.map((c) => c.text), config.embedding.concurrency) : [];

  const embeddedChunks: StoredChunk[] = diff.toEmbed.map((chunk, i) => ({
    id: chunk.id,
    file: chunk.file,
    functionName: chunk.functionName,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    contentHash: chunk.contentHash,
    truncated: chunk.truncated,
    embedding: embeddings[i],
  }));

  const dimensions = embeddedChunks[0]?.embedding.length ?? oldIndex?.dimensions ?? 0;
  writeIndexFile(dir, config, {
    version: 1,
    provider: config.provider,
    model: config.model,
    dimensions,
    chunks: [...diff.toKeep, ...embeddedChunks],
  });

  const callGraph = buildCallGraph(projectFiles);
  writeCallGraphFile(dir, config, callGraph);

  return {
    filesScanned: projectFiles.files.size,
    functionsFound: callGraph.functions.size,
    chunksEmbedded: diff.toEmbed.length,
    chunksReused: diff.toKeep.length,
    chunksDeleted: diff.toDeleteIds.size,
  };
}
