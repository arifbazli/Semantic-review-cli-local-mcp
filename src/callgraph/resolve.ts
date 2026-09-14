import { resolveModuleSpecifier } from "../parser/imports.js";
import type { SyntaxNode } from "../parser/treeSitter.js";
import type { FunctionInfo, ProjectFiles } from "./types.js";

export function resolveLocalFunction(files: ProjectFiles, file: string, name: string): FunctionInfo | null {
  const parsed = files.files.get(file);
  if (!parsed) return null;
  const direct = parsed.functions.find((f) => f.name === name);
  if (direct) return direct;

  const binding = parsed.imports.find((b) => b.localName === name);
  if (!binding) return null;
  const resolved = resolveModuleSpecifier(file, binding.specifier);
  if (!resolved) return null;
  const targetParsed = files.files.get(resolved);
  if (!targetParsed) return null;
  return targetParsed.functions.find((f) => f.name === binding.importedName || f.name === name) ?? null;
}

/** Resolves `ns.fn()` where `ns` is a namespace import (`import * as ns from "./x"` or `const ns = require("./x")`). */
export function resolveNamespacedFunction(files: ProjectFiles, file: string, objectName: string, propertyName: string): FunctionInfo | null {
  const parsed = files.files.get(file);
  if (!parsed) return null;
  const binding = parsed.imports.find((b) => b.localName === objectName && b.importedName === "*");
  if (!binding) return null;
  const resolved = resolveModuleSpecifier(file, binding.specifier);
  if (!resolved) return null;
  const targetParsed = files.files.get(resolved);
  if (!targetParsed) return null;
  return targetParsed.functions.find((f) => f.name === propertyName) ?? null;
}

/** Resolves `this.fn()` inside a class method to a sibling `method_definition` in the same class. */
export function resolveThisMethod(files: ProjectFiles, file: string, callerNode: SyntaxNode, methodName: string): FunctionInfo | null {
  const parsed = files.files.get(file);
  if (!parsed) return null;
  let current: SyntaxNode | null = callerNode;
  while (current && current.type !== "class_declaration" && current.type !== "class") {
    current = current.parent;
  }
  if (!current) return null;
  const classBody = current.namedChildren.find((c) => c.type === "class_body");
  if (!classBody) return null;
  const method = classBody.namedChildren.find((c) => c.type === "method_definition" && c.childForFieldName("name")?.text === methodName);
  if (!method) return null;
  return parsed.functions.find((f) => f.node.id === method.id) ?? null;
}

/** Resolves an arbitrary callee expression node to a callable function, or null if it isn't one of the recognized shapes. Used by callgraph/graph.ts to classify every call_expression it finds. */
export function resolveCallee(files: ProjectFiles, file: string, callerNode: SyntaxNode, calleeNode: SyntaxNode): FunctionInfo | null {
  if (calleeNode.type === "identifier") {
    return resolveLocalFunction(files, file, calleeNode.text);
  }
  if (calleeNode.type === "member_expression") {
    const object = calleeNode.childForFieldName("object");
    const property = calleeNode.childForFieldName("property");
    if (!property) return null;
    if (object?.type === "identifier") {
      return resolveNamespacedFunction(files, file, object.text, property.text);
    }
    if (object?.type === "this") {
      return resolveThisMethod(files, file, callerNode, property.text);
    }
  }
  return null;
}
