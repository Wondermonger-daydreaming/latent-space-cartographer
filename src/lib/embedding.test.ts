import { describe, it, expect } from 'vitest';
import { pseudoEmbedding, normalizeVector } from './embedding';

describe('pseudoEmbedding', () => {
  it('returns a Float32Array of the requested length', () => {
    const vec = pseudoEmbedding('hello', 16);
    expect(vec).toBeInstanceOf(Float32Array);
    expect(vec.length).toBe(16);
  });

  it('is deterministic across calls with the same arguments', () => {
    const a = pseudoEmbedding('consciousness', 32);
    const b = pseudoEmbedding('consciousness', 32);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('produces all finite values', () => {
    const vec = pseudoEmbedding('finitude check', 64);
    for (const v of vec) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('produces generally different vectors for different texts', () => {
    const a = pseudoEmbedding('alpha', 32);
    const b = pseudoEmbedding('omega', 32);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe('normalizeVector', () => {
  it('returns a unit-norm vector for a nonzero input', () => {
    const vec = new Float32Array([3, 4, 12]);
    const normalized = normalizeVector(vec);
    let norm = 0;
    for (const v of normalized) norm += v * v;
    expect(Math.sqrt(norm)).toBeCloseTo(1, 6);
  });

  it('returns the input unchanged for an all-zero vector', () => {
    const vec = new Float32Array([0, 0, 0, 0]);
    const result = normalizeVector(vec);
    expect(result).toBe(vec);
  });
});
