import type { SyntaxNode } from "../parser/treeSitter.js";
import type { ImportBinding } from "../parser/imports.js";

export interface FunctionInfo {
  id: string;
  name: string;
  file: string;
  node: SyntaxNode;
  startLine: number;
  endLine: number;
}

export interface ParsedFile {
  path: string;
  source: string;
  root: SyntaxNode;
  functions: FunctionInfo[];
  imports: ImportBinding[];
}

export interface ProjectFiles {
  files: Map<string, ParsedFile>;
}

export interface CallEdge {
  callerId: string;
  calleeId: string;
}

export interface UnresolvedCall {
  callerId: string;
  calleeText: string;
  line: number;
}

export interface CallGraph {
  functions: Map<string, FunctionInfo>;
  edges: CallEdge[];
  unresolved: UnresolvedCall[];
}
