import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";

export type SyntaxNode = Parser.SyntaxNode;

const tsxLanguage = TypeScript.tsx;

/** One parser instance per call keeps this side-effect-free for concurrent use. */
export function parseSource(source: string): Parser.Tree {
  const parser = new Parser();
  parser.setLanguage(tsxLanguage);
  return parser.parse(source);
}

export function line1(node: SyntaxNode): number {
  return node.startPosition.row + 1;
}

export function endLine1(node: SyntaxNode): number {
  return node.endPosition.row + 1;
}

/**
 * Flattens a simple property-access chain (identifier, `this`, and nested
 * member_expressions) into a dotted path, e.g. `req.user.data.id`.
 * Returns null for anything that isn't a plain static chain (call results,
 * computed/subscript access, etc.) — those are out of scope by design.
 */
export function flattenMemberPath(node: SyntaxNode | null): string | null {
  if (!node) return null;
  if (node.type === "identifier") return node.text;
  if (node.type === "this") return "this";
  if (node.type === "member_expression") {
    const object = node.childForFieldName("object");
    const property = node.childForFieldName("property");
    if (!property) return null;
    const objectPath = flattenMemberPath(object);
    if (objectPath == null) return null;
    return `${objectPath}.${property.text}`;
  }
  return null;
}

export function findDescendantsOfType(root: SyntaxNode, type: string): SyntaxNode[] {
  const results: SyntaxNode[] = [];
  const visit = (node: SyntaxNode) => {
    if (node.type === type) results.push(node);
    for (const child of node.namedChildren) visit(child);
  };
  visit(root);
  return results;
}
