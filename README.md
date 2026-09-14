# semantic-index

Agent-agnostic semantic code search: local Ollama embeddings for "find code by meaning," and tree-sitter AST-based call-graph tracing for "who calls / what does X call" — usable by any coding agent that can either run a shell command or speak MCP (Claude Code, GitHub Copilot CLI, an internal "Pi agent CLI," or anything else).

Modeled on [grepai](https://github.com/yoanbernabeu/grepai), with one deliberate difference: `trace` is AST-based, not regex-based, so it correctly follows arrow functions, namespace-import indirection (`import * as ns`), and class methods — patterns a per-language regex table has no way to represent (grepai's own docs note it misses arrow-function handlers).

## Relationship to `semantic-code-review`

This is a **navigation tool**, not a detector, and deliberately so. A sibling project, [`semantic-code-review`](../semantic-code-review), does diff-scoped IDOR detection using tree-sitter taint/guard analysis + a bounded LLM adjudication call — that engine stays as-is. The reason: a published Semgrep study found pure "embeddings search, then let the LLM reason freely" collapses to near-0% accuracy on cross-file IDOR. Embeddings are excellent at navigation (see the live search results below) and are not being asked to double as a vulnerability detector here.

## Status

Proof of concept, fully live-tested against a real local Ollama instance (`nomic-embed-text`) — no mocking. 30 tests passing: unit tests for chunking/diffing/the call graph, and e2e tests that make real embedding calls and spawn the actual compiled CLI as an MCP subprocess.

## Install

```bash
npm install
npm run build
ollama pull nomic-embed-text   # if not already pulled
```

## CLI

```bash
semantic-index init [--dir .] [--force] [--model nomic-embed-text]
semantic-index watch [--dir .] [--debounce 2000]
semantic-index search "<plain-language query>" [--top-k 8] [--dir .] [--json]
semantic-index trace callers|callees <functionName> [--file <path>] [--dir .] [--json]
semantic-index agent-setup [--claude] [--copilot] [--agents-md] [--with-subagent] [--dir .]
semantic-index mcp [--dir .]
```

`trace` does **not** require `init` — it has no embedding cost, so it builds a call graph on the fly if `callgraph.json` isn't there yet. `search` does require `init` (it needs the embeddings).

## Using it from an agent

**Any agent that can run shell commands**: just call the CLI directly. `semantic-index agent-setup` writes usage instructions into `CLAUDE.md`, `AGENTS.md` (the tool-agnostic convention), and `.github/copilot-instructions.md` (confirmed as what Copilot Chat and the Copilot coding agent read — the standalone Copilot CLI's own file-discovery behavior wasn't confirmable from current docs at the time of writing, so treat that specific case as unverified).

**Agents with native MCP support** (Claude Code, and others): run `semantic-index mcp --dir <project>` as an MCP server exposing three tools — `search`, `trace_callers`, `trace_callees` — over stdio. Both surfaces call the exact same engine code; nothing behaves differently between them.

## What actually gets indexed

One tree-sitter parse per file feeds both the embedding index and the call graph. Each named function (plus every anonymous one — inline callbacks and route handlers matter as *callers* even though they have no name to be looked up *as*, see `docs/ARCHITECTURE.md`) becomes one chunk: a short header plus its full source text, embedded via Ollama and stored with metadata in `.semantic-index/index.json`. The call graph — resolved identifier calls, `ns.fn()` namespace-import calls, and `this.fn()` class-method calls — is stored separately in `.semantic-index/callgraph.json`, so `trace` never has to load embedding vectors and `search` never has to load the graph.

## Known limitations (measured, not hand-waved)

- **Same-file discrimination is weak.** `nomic-embed-text` cleanly separates unrelated domains (a basket-vs-address query on OWASP Juice Shop scores >0.5 for the right function, cleanly above the wrong one — see `tests/e2e/search.e2e.test.ts`), but a behavioral-description query for one specific helper among ~47 similar ones in the same file ranked it outside the top 10. This is measured directly in the test suite, not asserted away — see that test's comments for the exact numbers.
- Resolution is name/import-based, not points-to analysis: dynamic dispatch, higher-order function calls, and barrel re-exports (`export { x } from "./y"`) aren't resolved — such calls land in an explicit `unresolved` list rather than being silently dropped, so "no callees" and "resolution failed" stay distinguishable.
- Brute-force cosine search: fine to tens of thousands of chunks; no ANN index in v1.
- `watch` has no daemon/service wrapper — closing the terminal stops indexing.
- Whole-project indexing has no cost ceiling; a large initial `init` can take minutes given local Ollama throughput.

## Development

```bash
npm install
npm test        # unit + live e2e (needs Ollama running with nomic-embed-text pulled)
npm run build
npm run lint
```

## License

MIT
