import { endLine1, findDescendantsOfType, line1, type SyntaxNode } from "../parser/treeSitter.js";
import type { FunctionInfo } from "./types.js";

function makeFunctionInfo(file: string, name: string, node: SyntaxNode): FunctionInfo {
  return { id: `${file}#${name}@${line1(node)}`, name, file, node, startLine: line1(node), endLine: endLine1(node) };
}

/**
 * Extracts every function in a file: named ones first (function
 * declarations, `const x = (…) => …` / `function` expressions, CommonJS
 * `exports.x = …` assignments, object-literal method shorthand, class
 * methods), then a final sweep for anonymous function/arrow expressions
 * not already captured by name.
 *
 * Anonymous functions matter here even though they have no name to look up
 * by: they can't be a *callee* target, but they absolutely can be a
 * *caller* — an inline route handler or `.then(item => …)` callback that
 * calls a named function needs that call recorded, or `trace callers`
 * silently misses every call made from inside a callback. Each gets a
 * synthetic `<anonymous:line>` name so it still has a graph identity.
 */
export function extractFunctions(file: string, root: SyntaxNode): FunctionInfo[] {
  const results: FunctionInfo[] = [];
  const capturedIds = new Set<number>();

  const capture = (name: string, node: SyntaxNode) => {
    results.push(makeFunctionInfo(file, name, node));
    capturedIds.add(node.id);
  };

  for (const decl of findDescendantsOfType(root, "function_declaration")) {
    const name = decl.childForFieldName("name");
    if (name) capture(name.text, decl);
  }

  for (const decl of findDescendantsOfType(root, "variable_declarator")) {
    const name = decl.childForFieldName("name");
    const value = decl.childForFieldName("value");
    if (!name || name.type !== "identifier" || !value) continue;
    if (value.type === "arrow_function" || value.type === "function_expression") {
      capture(name.text, value);
    }
  }

  for (const assign of findDescendantsOfType(root, "assignment_expression")) {
    const left = assign.childForFieldName("left");
    const right = assign.childForFieldName("right");
    if (!left || !right) continue;
    if (right.type !== "arrow_function" && right.type !== "function_expression") continue;
    if (left.type !== "member_expression") continue;
    const property = left.childForFieldName("property");
    if (property) capture(property.text, right);
  }

  for (const pair of findDescendantsOfType(root, "pair")) {
    const key = pair.childForFieldName("key");
    const value = pair.childForFieldName("value");
    if (!key || !value) continue;
    if (value.type === "arrow_function" || value.type === "function_expression") {
      const name = key.type === "property_identifier" || key.type === "string" ? key.text.replace(/^["']|["']$/g, "") : null;
      if (name) capture(name, value);
    }
  }

  for (const method of findDescendantsOfType(root, "method_definition")) {
    const name = method.childForFieldName("name");
    if (name) capture(name.text, method);
  }

  for (const node of [...findDescendantsOfType(root, "arrow_function"), ...findDescendantsOfType(root, "function_expression")]) {
    if (!capturedIds.has(node.id)) {
      capture(`<anonymous:${line1(node)}>`, node);
    }
  }

  return results;
}

/** True if `node`'s parent is an `export_statement` — used by chunking to include the leading `export` keyword in a chunk's text, since it lives on the parent, not the function node itself. */
export function isDirectlyExported(node: SyntaxNode): boolean {
  return node.parent?.type === "export_statement";
}
