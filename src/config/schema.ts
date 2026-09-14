import { z } from "zod";

export const ConfigSchema = z.object({
  version: z.literal(1),
  provider: z.literal("ollama"),
  model: z.string().min(1).default("nomic-embed-text"),
  ollama: z.object({ baseUrl: z.string().url() }).default({ baseUrl: "http://localhost:11434" }),
  backend: z.literal("json").default("json"),
  index: z
    .object({
      dir: z.string().default(".semantic-index"),
      chunksFile: z.string().default("index.json"),
      callgraphFile: z.string().default("callgraph.json"),
    })
    .default({ dir: ".semantic-index", chunksFile: "index.json", callgraphFile: "callgraph.json" }),
  scan: z
    .object({
      excludeDirs: z.array(z.string()).default(["node_modules", ".git", "dist", "build", "coverage", ".next", ".semantic-index"]),
      maxFileBytes: z.number().int().positive().default(200_000),
    })
    .default({ excludeDirs: ["node_modules", ".git", "dist", "build", "coverage", ".next", ".semantic-index"], maxFileBytes: 200_000 }),
  embedding: z
    .object({
      maxChunkChars: z.number().int().positive().default(4000),
      concurrency: z.number().int().positive().default(4),
    })
    .default({ maxChunkChars: 4000, concurrency: 4 }),
});

export type Config = z.infer<typeof ConfigSchema>;
