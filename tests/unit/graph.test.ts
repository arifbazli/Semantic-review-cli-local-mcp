import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildCallGraph } from "../../src/callgraph/graph.js";
import { buildProjectFiles } from "../../src/indexer/pipeline.js";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures", import.meta.url));

function edgeExists(edges: { callerId: string; calleeId: string }[], callerNamePart: string, calleeNamePart: string): boolean {
  return edges.some((e) => e.callerId.includes(callerNamePart) && e.calleeId.includes(calleeNamePart));
}

describe("buildCallGraph — interprocedural fixture (cross-file identifier resolution)", () => {
  const dir = resolve(FIXTURES_DIR, "interprocedural");
  const graph = buildCallGraph(buildProjectFiles(dir));

  it("resolves the anonymous route handler's call to the imported getItemById", () => {
    expect(edgeExists(graph.edges, "routes.ts#<anonymous", "service.ts#getItemById")).toBe(true);
  });

  it("getItemById has zero resolved callees but a recorded unresolved call (ItemModel.findOne is not locally defined)", () => {
    const getItemById = [...graph.functions.values()].find((f) => f.name === "getItemById")!;
    const resolvedCallees = graph.edges.filter((e) => e.callerId === getItemById.id);
    const unresolvedFromIt = graph.unresolved.filter((u) => u.callerId === getItemById.id);
    expect(resolvedCallees).toHaveLength(0);
    expect(unresolvedFromIt.length).toBeGreaterThan(0);
    expect(unresolvedFromIt[0].calleeText).toContain("ItemModel.findOne");
  });

  it("does not double-count a nested callback's call as also belonging to its enclosing function", () => {
    // The `.then(item => res.json(item))` callback is its own function; res.json
    // must be attributed to it, not to the outer route handler.
    const outerHandler = [...graph.functions.values()].find((f) => f.name.startsWith("<anonymous") && f.startLine === 8);
    const innerCallback = [...graph.functions.values()].find((f) => f.name.startsWith("<anonymous") && f.startLine === 10);
    expect(outerHandler).toBeDefined();
    expect(innerCallback).toBeDefined();
    const outerUnresolved = graph.unresolved.filter((u) => u.callerId === outerHandler!.id);
    expect(outerUnresolved.some((u) => u.calleeText === "res.json")).toBe(false);
    const innerUnresolved = graph.unresolved.filter((u) => u.callerId === innerCallback!.id);
    expect(innerUnresolved.some((u) => u.calleeText === "res.json")).toBe(true);
  });
});

describe("buildCallGraph — namespace-import and this.method() resolution", () => {
  const dir = resolve(FIXTURES_DIR, "namespace");
  const graph = buildCallGraph(buildProjectFiles(dir));

  it("resolves ns.fn() through a namespace import", () => {
    expect(edgeExists(graph.edges, "caller.ts#main", "utils.ts#helper")).toBe(true);
  });

  it("resolves this.fn() to a sibling class method", () => {
    expect(edgeExists(graph.edges, "caller.ts#run", "caller.ts#helper2")).toBe(true);
  });

  it("resolves a namespace call made from inside a class method", () => {
    expect(edgeExists(graph.edges, "caller.ts#helper2", "utils.ts#helper")).toBe(true);
  });
});
