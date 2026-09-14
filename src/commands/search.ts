import { resolve } from "node:path";
import { searchIndex } from "../search/engine.js";

export interface SearchOptions {
  topK?: number;
  dir?: string;
  json?: boolean;
}

export async function runSearch(query: string, opts: SearchOptions): Promise<void> {
  const dir = resolve(opts.dir ?? ".");
  const results = await searchIndex(dir, query, opts.topK ?? 8);

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log("No results.");
    return;
  }
  for (const r of results) {
    console.log(`${r.score.toFixed(3)}  ${r.functionName}  ${r.file}:${r.startLine}-${r.endLine}${r.truncated ? " (truncated)" : ""}`);
    console.log(
      r.snippet
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n"),
    );
    console.log();
  }
}
