import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../config/schema.js";
import type { CallGraph, CallEdge, UnresolvedCall } from "../callgraph/types.js";

export interface StoredChunk {
  id: string;
  file: string;
  functionName: string;
  startLine: number;
  endLine: number;
  contentHash: string;
  truncated: boolean;
  embedding: number[];
}

export interface IndexFile {
  version: 1;
  provider: string;
  model: string;
  dimensions: number;
  /** True when every chunk's embedding has been scaled to unit length (see indexer/reindex.ts) — lets search skip re-deriving each chunk's norm on every query. Absent/false on indexes written before this field existed; search falls back to full cosine similarity for those. */
  normalized: boolean;
  chunks: StoredChunk[];
}

export interface StoredFunctionInfo {
  id: string;
  name: string;
  file: string;
  startLine: number;
  endLine: number;
}

export interface StoredCallGraph {
  version: 1;
  functions: StoredFunctionInfo[];
  edges: CallEdge[];
  unresolved: UnresolvedCall[];
}

function writeAtomic(path: string, contents: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, contents, "utf-8");
  renameSync(tmp, path);
}

export function indexFilePath(dir: string, config: Config): string {
  return join(dir, config.index.dir, config.index.chunksFile);
}

export function callGraphFilePath(dir: string, config: Config): string {
  return join(dir, config.index.dir, config.index.callgraphFile);
}

export function readIndexFile(dir: string, config: Config): IndexFile | null {
  const path = indexFilePath(dir, config);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as IndexFile;
}

export function writeIndexFile(dir: string, config: Config, index: IndexFile): void {
  writeAtomic(indexFilePath(dir, config), JSON.stringify(index));
}

export function readCallGraphFile(dir: string, config: Config): StoredCallGraph | null {
  const path = callGraphFilePath(dir, config);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as StoredCallGraph;
}

export function writeCallGraphFile(dir: string, config: Config, graph: CallGraph): void {
  const stored: StoredCallGraph = {
    version: 1,
    functions: [...graph.functions.values()].map((f) => ({ id: f.id, name: f.name, file: f.file, startLine: f.startLine, endLine: f.endLine })),
    edges: graph.edges,
    unresolved: graph.unresolved,
  };
  writeAtomic(callGraphFilePath(dir, config), JSON.stringify(stored));
}
