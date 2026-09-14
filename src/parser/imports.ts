import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { findDescendantsOfType, type SyntaxNode } from "./treeSitter.js";

export interface ImportBinding {
  /** Local name the import is bound to in this file. */
  localName: string;
  /** Original exported name, or "default"/"*" — best-effort, not fully sound. */
  importedName: string;
  /** Raw module specifier as written, e.g. "./basketService". */
  specifier: string;
}

const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];

/** Resolves a relative module specifier to an on-disk file path. Returns null for bare/package imports and barrel re-exports (`export { x } from "./y"`) — out of scope for v1. */
export function resolveModuleSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), specifier);
  if (existsSync(base) && !base.endsWith("/")) {
    for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
      if (existsSync(base + ext)) return base + ext;
    }
  }
  for (const suffix of RESOLVABLE_EXTENSIONS) {
    const candidate = base + suffix;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Extracts import/require bindings from a parsed file's root node. Best-effort: named, default, and namespace imports plus `const x = require(...)` / destructured require. */
export function extractImportBindings(root: SyntaxNode): ImportBinding[] {
  const bindings: ImportBinding[] = [];

  for (const importStmt of findDescendantsOfType(root, "import_statement")) {
    const sourceNode = importStmt.namedChildren.find((c) => c.type === "string");
    const specifier = sourceNode ? stripQuotes(sourceNode.text) : null;
    if (!specifier) continue;

    const importClause = importStmt.namedChildren.find((c) => c.type === "import_clause");
    if (!importClause) continue;

    for (const child of importClause.namedChildren) {
      if (child.type === "identifier") {
        bindings.push({ localName: child.text, importedName: "default", specifier });
      } else if (child.type === "namespace_import") {
        const name = child.namedChildren.find((c) => c.type === "identifier");
        if (name) bindings.push({ localName: name.text, importedName: "*", specifier });
      } else if (child.type === "named_imports") {
        for (const spec of child.namedChildren) {
          if (spec.type !== "import_specifier") continue;
          const names = spec.namedChildren.filter((c) => c.type === "identifier");
          if (names.length === 1) {
            bindings.push({ localName: names[0].text, importedName: names[0].text, specifier });
          } else if (names.length === 2) {
            bindings.push({ localName: names[1].text, importedName: names[0].text, specifier });
          }
        }
      }
    }
  }

  for (const decl of findDescendantsOfType(root, "variable_declarator")) {
    const value = decl.childForFieldName("value");
    if (!value || value.type !== "call_expression") continue;
    const fn = value.childForFieldName("function");
    if (!fn || fn.text !== "require") continue;
    const args = value.childForFieldName("arguments");
    const stringArg = args?.namedChildren.find((c) => c.type === "string");
    if (!stringArg) continue;
    const specifier = stripQuotes(stringArg.text);

    const name = decl.childForFieldName("name");
    if (!name) continue;
    if (name.type === "identifier") {
      bindings.push({ localName: name.text, importedName: "*", specifier });
    } else if (name.type === "object_pattern") {
      for (const prop of name.namedChildren) {
        if (prop.type === "shorthand_property_identifier_pattern") {
          bindings.push({ localName: prop.text, importedName: prop.text, specifier });
        } else if (prop.type === "pair_pattern") {
          const key = prop.childForFieldName("key");
          const val = prop.childForFieldName("value");
          if (key && val) bindings.push({ localName: val.text, importedName: key.text, specifier });
        }
      }
    }
  }

  return bindings;
}

function stripQuotes(text: string): string {
  return text.slice(1, -1);
}
