import { describe, expect, it } from "vitest";
import { chunkFile } from "../../src/indexer/chunk.js";
import { extractFunctions } from "../../src/callgraph/functions.js";
import { extractImportBindings } from "../../src/parser/imports.js";
import { parseSource } from "../../src/parser/treeSitter.js";
import type { ParsedFile } from "../../src/callgraph/types.js";

function parse(path: string, source: string): ParsedFile {
  const root = parseSource(source).rootNode;
  return { path, source, root, functions: extractFunctions(path, root), imports: extractImportBindings(root) };
}

describe("chunkFile", () => {
  it("includes the leading export keyword for a directly-exported function declaration", () => {
    const parsed = parse("/repo/src/foo.ts", `export function foo() { return 1; }`);
    const chunks = chunkFile(parsed, "/repo", 4000);
    const foo = chunks.find((c) => c.functionName === "foo")!;
    expect(foo.text).toContain("export function foo()");
  });

  it("does not duplicate export for a non-exported function", () => {
    const parsed = parse("/repo/src/foo.ts", `function bar() { return 1; }`);
    const chunks = chunkFile(parsed, "/repo", 4000);
    const bar = chunks.find((c) => c.functionName === "bar")!;
    expect(bar.text).toContain("function bar()");
    expect(bar.text).not.toContain("export");
  });

  it("uses a relative path in the header", () => {
    const parsed = parse("/repo/src/nested/foo.ts", `function bar() {}`);
    const chunks = chunkFile(parsed, "/repo", 4000);
    expect(chunks[0].text).toContain("File: src/nested/foo.ts");
  });

  it("assigns distinct slot ids to same-named functions in one file, by occurrence order", () => {
    const parsed = parse("/repo/src/foo.ts", `function bar() { return 1; } function bar() { return 2; }`);
    const chunks = chunkFile(parsed, "/repo", 4000);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].id).not.toBe(chunks[1].id);
  });

  it("truncates on a line boundary and marks truncated", () => {
    const longBody = Array.from({ length: 200 }, (_, i) => `  const x${i} = ${i};`).join("\n");
    const parsed = parse("/repo/src/foo.ts", `function bar() {\n${longBody}\n}`);
    const chunks = chunkFile(parsed, "/repo", 200);
    const fullText = `File: src/foo.ts\nFunction: bar\n\nfunction bar() {\n${longBody}\n}`;
    expect(chunks[0].truncated).toBe(true);
    expect(chunks[0].text.length).toBeLessThanOrEqual(200);
    // The truncated text must be an exact prefix of the full text, cut
    // immediately after a newline — not mid-line.
    expect(fullText.startsWith(chunks[0].text)).toBe(true);
    expect(fullText[chunks[0].text.length]).toBe("\n");
  });

  it("produces the same contentHash for identical text and a different one for different text", () => {
    const a = parse("/repo/src/foo.ts", `function bar() { return 1; }`);
    const b = parse("/repo/src/foo2.ts", `function bar() { return 1; }`);
    const c = parse("/repo/src/foo3.ts", `function bar() { return 2; }`);
    const chunkA = chunkFile(a, "/repo", 4000)[0];
    const chunkB = chunkFile(b, "/repo", 4000)[0];
    const chunkC = chunkFile(c, "/repo", 4000)[0];
    // Different files -> different header text -> different hash, even with identical bodies.
    expect(chunkA.contentHash).not.toBe(chunkB.contentHash);
    expect(chunkA.contentHash).not.toBe(chunkC.contentHash);
  });
});
