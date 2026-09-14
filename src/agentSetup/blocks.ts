export const INSTRUCTION_BLOCK = `## semantic-index — semantic code search

This project is indexed by \`semantic-index\` (local Ollama embeddings + tree-sitter AST call-graph tracing). Prefer these over plain grep/ripgrep when the task is "find code by meaning" or "who calls / what does X call":

- \`semantic-index search "<plain-language description>"\` — semantic search, ranked by meaning, not keywords.
- \`semantic-index trace callers <functionName>\` / \`semantic-index trace callees <functionName>\` — AST-based call-graph tracing (handles arrow functions, namespace-import indirection, and class methods that a regex-based tracer would miss).

If these commands aren't available in the environment, fall back to normal grep/ripgrep.`;

export function subagentContent(): string {
  return `---
name: code-navigator
description: Use for "find code by meaning" or "who calls X" questions. Prefers semantic-index search/trace over grep.
tools: Bash, Read, Grep, Glob
model: inherit
---

Use \`semantic-index search "<query>"\` for meaning-based lookups and \`semantic-index trace callers|callees <name>\` for call-graph questions, before falling back to grep. Report file:line locations from the results.
`;
}
