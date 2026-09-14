import { readFileSync, statSync } from "node:fs";
import { extractFunctions } from "../callgraph/functions.js";
import { extractImportBindings } from "../parser/imports.js";
import { parseSource } from "../parser/treeSitter.js";
import { walkSourceFiles } from "../parser/repoScan.js";
import type { ParsedFile, ProjectFiles } from "../callgraph/types.js";

export function parseFile(path: string): ParsedFile {
  const source = readFileSync(path, "utf-8");
  const root = parseSource(source).rootNode;
  return { path, source, root, functions: extractFunctions(path, root), imports: extractImportBindings(root) };
}

/** Parses every source file under `dir` (respecting the same exclude-dir list as walkSourceFiles) into one ProjectFiles — the input both chunking and the call graph share, so each file is parsed exactly once. */
export function buildProjectFiles(dir: string, maxFileBytes = 200_000): ProjectFiles {
  const files = new Map<string, ParsedFile>();
  for (const path of walkSourceFiles(dir)) {
    if (statSync(path).size > maxFileBytes) continue;
    try {
      files.set(path, parseFile(path));
    } catch {
      // Unparseable file (e.g. binary misdetected by extension) — skip
      // rather than fail the whole index build over one bad file.
      continue;
    }
  }
  return { files };
}
