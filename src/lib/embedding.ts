import type { PreTrainedModel } from '@xenova/transformers';

type TransformersPipeline = {
  model: PreTrainedModel;
  tokenizer: unknown;
  (text: string | string[]): Promise<number[][]>;
};

const EMBED_DIM = 384;

export class EmbeddingClient {
  private pipeline?: TransformersPipeline;
  private loading?: Promise<void>;

  async ensureLoaded() {
    if (this.pipeline) {
      return;
    }
    if (!this.loading) {
      this.loading = this.init();
    }
    await this.loading;
  }

  private async init() {
    try {
      const transformers = await import('@xenova/transformers');
      const { pipeline } = transformers;
      this.pipeline = await pipeline('feature-extraction', 'sentence-transformers/all-MiniLM-L6-v2');
    } catch (error) {
      console.warn('Falling back to pseudo embeddings:', error);
      this.pipeline = undefined;
    }
  }

  async embed(text: string): Promise<Float32Array> {
    await this.ensureLoaded();
    if (this.pipeline) {
      const embeddings = await this.pipeline(text);
      const vector = embeddings[0];
      return new Float32Array(vector);
    }
    // Deterministic pseudo-embedding fallback for offline dev
    return pseudoEmbedding(text, EMBED_DIM);
  }
}

export function pseudoEmbedding(text: string, dim: number) {
  const vector = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    const hash = Math.sin(i + hashCode(text));
    vector[i] = hash - Math.floor(hash);
  }
  return vector;
}

function hashCode(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function normalizeVector(vec: Float32Array) {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (!norm) {
    return vec;
  }
  return new Float32Array(vec.map((v) => v / norm));
}

export async function computeAnalogyEmbedding(
  client: EmbeddingClient,
  phrase: string,
  domain: string,
) {
  const base = await client.embed(phrase);
  if (!domain) {
    return base;
  }
  const domainVector = await client.embed(domain);
  const anchor = await client.embed('science');
  const shifted = new Float32Array(base.length);
  for (let i = 0; i < base.length; i++) {
    shifted[i] = base[i] + (domainVector[i] - anchor[i]);
  }
  return normalizeVector(shifted);
}
