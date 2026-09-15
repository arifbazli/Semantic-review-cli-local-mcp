import { readFileSync } from "node:fs";
import { loadConfig } from "../config/loader.js";
import { OllamaProvider } from "../embeddings/ollama.js";
import { readIndexFile } from "../indexer/store.js";
import { cosineSimilarity, cosineSimilarityUnitB, vectorNorm } from "./cosine.js";
import { functionNameOverlap } from "./lexical.js";

/** Small nudge, not a replacement for cosine similarity — see functionNameOverlap. */
const LEXICAL_BOOST_WEIGHT = 0.1;

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

  if (index.model !== config.model) {
    throw new Error(
      `Index at ${dir} was built with model "${index.model}" but the current config specifies "${config.model}" — cosine similarity across two different embedding spaces is meaningless. Run "semantic-index init --force" to re-index with the current model.`,
    );
  }

  const provider = new OllamaProvider(config.ollama.baseUrl, config.model);
  const queryEmbedding = await provider.embed(query);

  if (index.dimensions > 0 && queryEmbedding.length !== index.dimensions) {
    throw new Error(
      `Query embedding has ${queryEmbedding.length} dimensions but the index was built with ${index.dimensions}-dimension embeddings — run "semantic-index init --force" to re-index.`,
    );
  }

  const queryNorm = vectorNorm(queryEmbedding);
  const scored = index.chunks
    .map((chunk) => {
      const cosine = index.normalized
        ? cosineSimilarityUnitB(queryEmbedding, queryNorm, chunk.embedding)
        : cosineSimilarity(queryEmbedding, chunk.embedding);
      const lexicalBoost = LEXICAL_BOOST_WEIGHT * functionNameOverlap(query, chunk.functionName);
      return { chunk, score: cosine + lexicalBoost };
    })
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
