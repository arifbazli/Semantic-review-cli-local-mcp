import { readFileSync } from "node:fs";
import { loadConfig } from "../config/loader.js";
import { OllamaProvider } from "../embeddings/ollama.js";
import { readIndexFile } from "../indexer/store.js";
import { cosineSimilarity } from "./cosine.js";

export interface SearchResult {
  file: string;
  functionName: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  truncated: boolean;
}

function readSnippet(file: string, startLine: number, endLine: number, maxLines = 12): string {
  try {
    const lines = readFileSync(file, "utf-8").split("\n");
    return lines.slice(startLine - 1, Math.min(endLine, startLine - 1 + maxLines)).join("\n");
  } catch {
    return "";
  }
}

export async function searchIndex(dir: string, query: string, topK = 8): Promise<SearchResult[]> {
  const config = loadConfig(dir);
  const index = readIndexFile(dir, config);
  if (!index || index.chunks.length === 0) return [];

  const provider = new OllamaProvider(config.ollama.baseUrl, config.model);
  const queryEmbedding = await provider.embed(query);

  const scored = index.chunks
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(({ chunk, score }) => ({
    file: chunk.file,
    functionName: chunk.functionName,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    score,
    snippet: readSnippet(chunk.file, chunk.startLine, chunk.endLine),
    truncated: chunk.truncated,
  }));
}
