import type { EmbeddingProvider } from "./provider.js";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

/** Confirmed shape against a live local Ollama instance: POST /api/embeddings with {model, prompt} -> {embedding: number[]}. */
export class OllamaProvider implements EmbeddingProvider {
  constructor(
    private readonly baseUrl: string,
    readonly model: string,
  ) {}

  /** Retries transient failures (timeout, network error, non-2xx) with backoff before giving up, so one flaky request doesn't require redoing an entire reindex batch. */
  async embed(text: string): Promise<number[]> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.embedOnce(text);
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async embedOnce(text: string): Promise<number[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Ollama embeddings call failed (${res.status}): ${await res.text()}`);
      }
      const body = (await res.json()) as { embedding: number[] };
      return body.embedding;
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface EmbedBatchResult {
  embeddings: (number[] | null)[];
  /** Indexes into `texts` that failed even after retries — left null in `embeddings` rather than aborting the batch. */
  failedIndexes: number[];
}

/** Runs `embed` over `texts` with at most `concurrency` requests in flight — plain Promise.all would either serialize for no reason or overwhelm Ollama's single-model request queue. A slot that still fails after `OllamaProvider.embed`'s own retries is recorded in `failedIndexes` instead of rejecting the whole batch, so embeddings already computed in this run aren't discarded. */
export async function embedBatch(provider: EmbeddingProvider, texts: string[], concurrency: number): Promise<EmbedBatchResult> {
  const embeddings = new Array<number[] | null>(texts.length).fill(null);
  const failedIndexes: number[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= texts.length) return;
      try {
        embeddings[i] = await provider.embed(texts[i]);
      } catch {
        failedIndexes.push(i);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, () => worker()));
  return { embeddings, failedIndexes };
}
