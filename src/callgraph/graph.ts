import { flattenMemberPath, line1, type SyntaxNode } from "../parser/treeSitter.js";
import { resolveCallee } from "./resolve.js";
import type { CallGraph, FunctionInfo, ProjectFiles } from "./types.js";

const FUNCTION_BOUNDARY_TYPES = new Set(["arrow_function", "function_expression", "function_declaration", "method_definition"]);

/**
 * Finds call_expressions in `fnNode`'s own body, stopping at any nested
 * function boundary — a nested arrow/function/method is extracted as its
 * own FunctionInfo (including anonymous ones, see callgraph/functions.ts)
 * and walked separately. Without this boundary, a call inside a nested
 * callback would be double-counted as an edge from *both* the callback and
 * its enclosing function.
 */
function findCallsInOwnScope(fnNode: SyntaxNode): SyntaxNode[] {
  const results: SyntaxNode[] = [];
  const visit = (node: SyntaxNode) => {
    if (node.type === "call_expression") results.push(node);
    for (const child of node.namedChildren) {
      if (FUNCTION_BOUNDARY_TYPES.has(child.type)) continue;
      visit(child);
    }
  };
  visit(fnNode);
  return results;
}

/**
 * Builds a whole-project bidirectional call graph: for every extracted
 * function, every call_expression in its own scope (not nested callbacks —
 * those are separate functions) is resolved to another local function
 * (identifier, `ns.fn()`, or `this.fn()`) if possible. Anything else —
 * dynamic dispatch, calls into node_modules, barrel re-exports — is
 * recorded in `unresolved` rather than silently dropped, so "this function
 * has no local callees" and "resolution failed" stay distinguishable.
 */
export function buildCallGraph(files: ProjectFiles): CallGraph {
  const functions = new Map<string, FunctionInfo>();
  const edges: CallGraph["edges"] = [];
  const unresolved: CallGraph["unresolved"] = [];

  for (const parsed of files.files.values()) {
    for (const fn of parsed.functions) functions.set(fn.id, fn);
  }

  for (const parsed of files.files.values()) {
    for (const fn of parsed.functions) {
      for (const call of findCallsInOwnScope(fn.node)) {
        const calleeNode = call.childForFieldName("function");
        if (!calleeNode) continue;

        const resolved = resolveCallee(files, parsed.path, call, calleeNode);
        if (resolved) {
          edges.push({ callerId: fn.id, calleeId: resolved.id });
        } else {
          unresolved.push({
            callerId: fn.id,
            calleeText: flattenMemberPath(calleeNode) ?? calleeNode.text,
            line: line1(call),
          });
        }
      }
    }
  }

  return { functions, edges, unresolved };
}
