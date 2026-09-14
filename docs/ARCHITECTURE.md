# Architecture

## Pipeline

```
init/watch:  walk dir -> parse each file once (tree-sitter) -> {chunk for embedding, extract functions for the call graph}
                                                             -> Ollama /api/embeddings (diffed: unchanged content is never re-embedded)
                                                             -> .semantic-index/{index.json, callgraph.json}

search:      query -> embed via Ollama -> cosine similarity against index.json -> ranked results (snippet read live from disk)
trace:       functionName -> callgraph.json (or build live if absent) -> forward/reverse edge lookup
mcp:         same search/trace engine, wrapped as three MCP tools over stdio
```

## Why anonymous functions are in the call graph

`extractFunctions` (`src/callgraph/functions.ts`) captures named functions first (declarations, `const x = () => {}`, CommonJS `exports.x =`, object-method shorthand, class methods), then does a final sweep for arrow/function expressions not already captured, giving each a synthetic `<anonymous:line>` name.

This isn't cosmetic completeness — it fixes a real correctness bug found while building this: an inline route handler like `router.get("/items/:id", function (req, res) { getItemById(id).then(...) })` has no name, so it was initially excluded from the function table entirely, which meant its call to `getItemById` was **invisible to the call graph** — `trace callers getItemById` returned nothing, when the ground-truth answer (validated against `tests/fixtures/interprocedural/`) is "yes, this handler calls it." Anonymous functions can't be a *callee* lookup target (nothing to search for by name), but they must still be a *caller* node, or every call made from inside a callback silently disappears.

## Avoiding double-counted edges across nested callbacks

Once anonymous functions are captured, a naive "walk every `call_expression` under this function's node" (`findDescendantsOfType`) double-counts: a call inside a nested `.then(item => …)` callback is a descendant of *both* the callback's own node and its enclosing function's node, so it would be recorded as an edge from both.

`callgraph/graph.ts`'s `findCallsInOwnScope` walks a function's body but stops at any nested function boundary (`arrow_function`/`function_expression`/`function_declaration`/`method_definition`) — that nested function is extracted and walked separately as its own node. Verified in `tests/unit/graph.test.ts`: the outer handler's own unresolved-call list does *not* contain the callback's `res.json` call; the callback's does.

## Resolution (`callgraph/resolve.ts`)

Three callee shapes are resolved to a local `FunctionInfo`:
1. **Identifier call** (`fn()`) → same-file lookup, then import-binding + module-specifier resolution into another file.
2. **Namespace-import call** (`ns.fn()`, from `import * as ns from "./x"` or `const ns = require("./x")`) → resolve `ns`'s import binding to a file, look up `fn` there.
3. **`this.fn()`** inside a class method → walk up to the enclosing `class_declaration`, look up `fn` among its `method_definition`s.

Anything else (dynamic dispatch, calls into `node_modules`, barrel re-exports like `export { x } from "./y"`) is recorded in an explicit `unresolved` list with the flattened call text — never silently dropped. This is what makes "X has zero callees" and "X has calls we couldn't resolve" distinguishable in `trace` output, which matters for trusting a "no callees" result.

## Chunking and incremental re-indexing (`indexer/chunk.ts`, `indexer/diff.ts`)

Each chunk's identity for re-indexing purposes is a `slotKey` (`sha1(file :: functionName :: occurrenceIndex)`), separate from a `contentHash` (`sha1(finalChunkText)`). Same slot + same hash → the existing embedding is reused, no Ollama call. This is what makes `watch` cheap on a re-save that didn't actually change a function's content.

Known accepted imprecision: inserting a new same-named function earlier in a file shifts later same-named functions' `occurrenceIndex`, causing a spurious (but harmless — just an extra Ollama call) cache-miss for functions that didn't actually change.

`watch` re-walks and re-parses the whole directory on every debounced change rather than maintaining incremental in-memory state — a deliberate simplicity trade-off. The expensive part (embedding calls) is still correctly bounded by the diff logic; only the comparatively cheap directory-walk-and-parse work is repeated.

## MCP surface (`mcp/server.ts`)

`McpServer` from `@modelcontextprotocol/sdk` registers `search`, `trace_callers`, `trace_callees`, each calling the identical `search/engine.ts` / `trace/engine.ts` functions the CLI commands use. Confirmed API shape against the installed SDK's own `.d.ts` (`registerTool(name, {inputSchema: <raw zod shape>}, cb)`), not assumed from memory.
