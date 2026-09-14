# 🧭 Semantic Review CLI + Local MCP

**Agent-agnostic semantic code search.** Local embeddings for *"find code by meaning"*, AST-based call-graph tracing for *"who calls what"* — one engine, two surfaces: a CLI any agent can shell out to, and an MCP server for agents with native tool support.

## How it works

```mermaid
flowchart LR
    subgraph Agents["🤖 Any Agent CLI"]
        direction TB
        A1["Claude Code"]
        A2["GitHub Copilot CLI"]
        A3["Pi Agent CLI"]
    end

    subgraph Tool["⚡ semantic-index"]
        direction TB
        CLI["CLI\ninit · search · trace"]
        MCP["MCP Server\n(stdio)"]
        ENGINE["Shared Engine"]
        CLI --> ENGINE
        MCP --> ENGINE
    end

    subgraph Local["💻 100% Local"]
        direction TB
        OLLAMA[("Ollama\nnomic-embed-text")]
        AST["Tree-sitter\nAST Call Graph"]
    end

    CODE[["Your Codebase"]]

    A1 -. MCP .-> MCP
    A1 -- shell --> CLI
    A2 -- shell --> CLI
    A3 -- shell --> CLI

    ENGINE --> OLLAMA
    ENGINE --> AST
    OLLAMA --- CODE
    AST --- CODE

    classDef agent fill:#eef2ff,stroke:#6366f1,color:#1e1b4b
    classDef tool fill:#ecfdf5,stroke:#10b981,color:#064e3b
    classDef local fill:#fff7ed,stroke:#f97316,color:#7c2d12
    classDef code fill:#f5f3ff,stroke:#8b5cf6,color:#4c1d95,stroke-width:2px

    class A1,A2,A3 agent
    class CLI,MCP,ENGINE tool
    class OLLAMA,AST local
    class CODE code
```

## Quickstart

```bash
npm install && npm run build
ollama pull nomic-embed-text

semantic-index init                              # index this project
semantic-index search "who validates a login"    # search by meaning
semantic-index trace callers login               # who calls login()?
semantic-index agent-setup --with-subagent       # wire up CLAUDE.md / AGENTS.md / Copilot
semantic-index mcp                               # or run as an MCP server
```

## Why

Modeled on [grepai](https://github.com/yoanbernabeu/grepai) — same idea, one deliberate upgrade: `trace` is **AST-based, not regex**, so it correctly follows arrow functions, `import * as ns` indirection, and class methods a regex tracer misses.

This is a **navigation tool, not a vulnerability detector** — on purpose. Embeddings-search-then-reason is proven weak at cross-file vulnerability detection, so detection logic lives in a separate sibling project instead; here, embeddings only do what they're good at: finding relevant code.

## Status

Proof of concept, **live-tested** against a real local Ollama instance — no mocks. 30 tests passing, including a real MCP subprocess spawned over stdio.

**Known limits:** brute-force cosine search (fine to ~10k chunks, no ANN index yet); call resolution is import/name-based, not full points-to analysis; `nomic-embed-text` is strong at cross-domain search but weaker at distinguishing many similar helpers *within one file* — measured in tests, not hidden. Details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## License

MIT
