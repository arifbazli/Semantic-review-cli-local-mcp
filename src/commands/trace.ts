import { resolve } from "node:path";
import { loadOrBuildGraph, traceCallees, traceCallers, type TraceOutcome } from "../trace/engine.js";

export interface TraceOptions {
  file?: string;
  dir?: string;
  json?: boolean;
}

export function runTrace(direction: "callers" | "callees", functionName: string, opts: TraceOptions): void {
  const dir = resolve(opts.dir ?? ".");
  const graph = loadOrBuildGraph(dir);
  const outcome = direction === "callers" ? traceCallers(graph, functionName, opts.file) : traceCallees(graph, functionName, opts.file);

  if (opts.json) {
    console.log(JSON.stringify(outcome, null, 2));
    return;
  }

  printOutcome(direction, functionName, outcome);
}

function printOutcome(direction: "callers" | "callees", functionName: string, outcome: TraceOutcome): void {
  if (outcome.ambiguous) {
    console.log(`"${functionName}" matches ${outcome.ambiguous.length} functions — re-run with --file to disambiguate:`);
    for (const m of outcome.ambiguous) console.log(`  ${m.file}:${m.startLine}`);
    return;
  }
  if (outcome.results.length === 0) {
    console.log(`No ${direction} found for "${functionName}".`);
    return;
  }
  for (const r of outcome.results) {
    console.log(`${r.functionName}  ${r.file}:${r.startLine}-${r.endLine}`);
  }
}
