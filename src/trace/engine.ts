import { buildCallGraph } from "../callgraph/graph.js";
import { buildProjectFiles } from "../indexer/pipeline.js";
import { loadConfig } from "../config/loader.js";
import { readCallGraphFile, type StoredCallGraph, type StoredFunctionInfo } from "../indexer/store.js";

export interface TraceMatch {
  functionName: string;
  file: string;
  startLine: number;
  endLine: number;
}

export interface TraceOutcome {
  /** Populated when the target function name resolved unambiguously. */
  results: TraceMatch[];
  /** Populated instead of `results` when the name matched more than one function and no `file` filter disambiguated it — caller should re-invoke with a specific file. */
  ambiguous?: TraceMatch[];
}

/** Uses the persisted callgraph.json if `init` has run; otherwise builds one on the fly scoped to `dir` — trace has no embedding cost, so it deliberately doesn't require indexing first. */
export function loadOrBuildGraph(dir: string): StoredCallGraph {
  try {
    const config = loadConfig(dir);
    const stored = readCallGraphFile(dir, config);
    if (stored) return stored;
  } catch {
    // No config yet — fall through to building live.
  }
  const files = buildProjectFiles(dir);
  const graph = buildCallGraph(files);
  return {
    version: 1,
    functions: [...graph.functions.values()].map((f) => ({ id: f.id, name: f.name, file: f.file, startLine: f.startLine, endLine: f.endLine })),
    edges: graph.edges,
    unresolved: graph.unresolved,
  };
}

function findTargets(graph: StoredCallGraph, functionName: string, file?: string): StoredFunctionInfo[] {
  const matches = graph.functions.filter((f) => f.name === functionName && (!file || f.file === file || f.file.endsWith(file)));
  return matches;
}

function toMatch(fn: StoredFunctionInfo): TraceMatch {
  return { functionName: fn.name, file: fn.file, startLine: fn.startLine, endLine: fn.endLine };
}

export function traceCallers(graph: StoredCallGraph, functionName: string, file?: string): TraceOutcome {
  const targets = findTargets(graph, functionName, file);
  if (targets.length === 0) return { results: [] };
  if (targets.length > 1) return { results: [], ambiguous: targets.map(toMatch) };

  const targetId = targets[0].id;
  const functionsById = new Map(graph.functions.map((f) => [f.id, f]));
  const callerIds = graph.edges.filter((e) => e.calleeId === targetId).map((e) => e.callerId);
  const results = callerIds.map((id) => functionsById.get(id)).filter((f): f is StoredFunctionInfo => f != null).map(toMatch);
  return { results };
}

export function traceCallees(graph: StoredCallGraph, functionName: string, file?: string): TraceOutcome {
  const targets = findTargets(graph, functionName, file);
  if (targets.length === 0) return { results: [] };
  if (targets.length > 1) return { results: [], ambiguous: targets.map(toMatch) };

  const targetId = targets[0].id;
  const functionsById = new Map(graph.functions.map((f) => [f.id, f]));
  const calleeIds = graph.edges.filter((e) => e.callerId === targetId).map((e) => e.calleeId);
  const results = calleeIds.map((id) => functionsById.get(id)).filter((f): f is StoredFunctionInfo => f != null).map(toMatch);
  return { results };
}
