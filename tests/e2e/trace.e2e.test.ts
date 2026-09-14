import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadOrBuildGraph, traceCallees, traceCallers } from "../../src/trace/engine.js";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures", import.meta.url));

describe("trace engine — no init required, ground truth via the interprocedural fixture", () => {
  const dir = resolve(FIXTURES_DIR, "interprocedural");
  const graph = loadOrBuildGraph(dir);

  it("traceCallers finds the route handler as the sole caller of getItemById", () => {
    const outcome = traceCallers(graph, "getItemById");
    expect(outcome.ambiguous).toBeUndefined();
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0].file).toContain("routes.ts");
  });

  it("traceCallees reports zero results for getItemById — distinct from a resolution failure, verified via the unresolved list", () => {
    const outcome = traceCallees(graph, "getItemById");
    expect(outcome.results).toHaveLength(0);
    expect(graph.unresolved.some((u) => u.calleeText.includes("ItemModel.findOne"))).toBe(true);
  });

  it("returns an empty result, not a crash, for a function name that doesn't exist", () => {
    const outcome = traceCallers(graph, "doesNotExist");
    expect(outcome.results).toHaveLength(0);
    expect(outcome.ambiguous).toBeUndefined();
  });
});

describe("trace engine — ambiguous name resolution", () => {
  const dir = resolve(FIXTURES_DIR, "ambiguous");
  const graph = loadOrBuildGraph(dir);

  it("reports ambiguous matches when a name exists in two files and no --file filter is given", () => {
    const outcome = traceCallers(graph, "handler");
    expect(outcome.ambiguous).toBeDefined();
    expect(outcome.ambiguous).toHaveLength(2);
  });

  it("disambiguates via the file filter", () => {
    const aFile = resolve(dir, "a.ts");
    const outcome = traceCallers(graph, "handler", aFile);
    expect(outcome.ambiguous).toBeUndefined();
    expect(outcome.results).toHaveLength(0); // no callers, but resolved unambiguously
  });
});
