import { relative } from "node:path";
import { isDirectlyExported } from "../callgraph/functions.js";
import type { ParsedFile } from "../callgraph/types.js";
import { sha1 } from "../util/hash.js";

export interface Chunk {
  /** Stable "slot" identity across re-indexing — see indexer/diff.ts. */
  id: string;
  file: string;
  functionName: string;
  startLine: number;
  endLine: number;
  contentHash: string;
  text: string;
  truncated: boolean;
}

function nodeSourceText(fn: ParsedFile["functions"][number]): string {
  return isDirectlyExported(fn.node) ? fn.node.parent!.text : fn.node.text;
}

function truncateOnLineBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastNewline = slice.lastIndexOf("\n");
  return lastNewline > maxChars / 2 ? slice.slice(0, lastNewline) : slice;
}

/**
 * Converts one parsed file's functions into embeddable chunks. `slotKey`
 * (this chunk's `id`) is `sha1(file :: functionName :: occurrenceIndex)`,
 * where `occurrenceIndex` is that name's rank among same-named functions in
 * this file, in deterministic extraction order — the identity `indexer/diff.ts`
 * matches old vs. new chunk tables against when a file changes.
 */
export function chunkFile(parsed: ParsedFile, baseDir: string, maxChunkChars: number): Chunk[] {
  const occurrenceCounts = new Map<string, number>();
  const chunks: Chunk[] = [];

  for (const fn of parsed.functions) {
    const occurrenceIndex = occurrenceCounts.get(fn.name) ?? 0;
    occurrenceCounts.set(fn.name, occurrenceIndex + 1);

    const relPath = relative(baseDir, parsed.path).replace(/\\/g, "/");
    const header = `File: ${relPath}\nFunction: ${fn.name}\n\n`;
    const fullText = header + nodeSourceText(fn);
    const truncated = fullText.length > maxChunkChars;
    const text = truncated ? truncateOnLineBoundary(fullText, maxChunkChars) : fullText;

    chunks.push({
      id: sha1(`${parsed.path}::${fn.name}::${occurrenceIndex}`),
      file: parsed.path,
      functionName: fn.name,
      startLine: fn.startLine,
      endLine: fn.endLine,
      contentHash: sha1(text),
      text,
      truncated,
    });
  }

  return chunks;
}
