import type { EmbeddingProvider } from "./provider.js";

/** Confirmed shape against a live local Ollama instance: POST /api/embeddings with {model, prompt} -> {embedding: number[]}. */
export class OllamaProvider implements EmbeddingProvider {
  constructor(
    private readonly baseUrl: string,
    readonly model: string,
  ) {}

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });
    if (!res.ok) {
      throw new Error(`Ollama embeddings call failed (${res.status}): ${await res.text()}`);
    }
    const body = (await res.json()) as { embedding: number[] };
    return body.embedding;
  }
}

/** Runs `embed` over `texts` with at most `concurrency` requests in flight — plain Promise.all would either serialize for no reason or overwhelm Ollama's single-model request queue. */
export async function embedBatch(provider: EmbeddingProvider, texts: string[], concurrency: number): Promise<number[][]> {
  const results = new Array<number[]>(texts.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= texts.length) return;
      results[i] = await provider.embed(texts[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, () => worker()));
  return results;
}
