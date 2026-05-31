import { describe, it, expect } from 'vitest';
import {
  computePcaCoords,
  cosineDistance,
  jaccardIndex,
  intersectSets,
  transpose,
} from './cartographer';

describe('cosineDistance', () => {
  it('returns ~0 for identical vectors', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineDistance(a, b)).toBeCloseTo(0, 6);
  });

  it('returns ~1 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineDistance(a, b)).toBeCloseTo(1, 6);
  });

  it('returns ~2 for opposite vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([-1, 0]);
    expect(cosineDistance(a, b)).toBeCloseTo(2, 6);
  });
});

describe('jaccardIndex', () => {
  it('returns 1 for two empty sets', () => {
    expect(jaccardIndex(new Set<string>(), new Set<string>())).toBe(1);
  });

  it('returns 1/3 for {a,b} vs {b,c}', () => {
    expect(jaccardIndex(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3, 6);
  });

  it('returns 1 for identical sets', () => {
    expect(jaccardIndex(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    expect(jaccardIndex(new Set(['a', 'b']), new Set(['c', 'd']))).toBe(0);
  });
});

describe('intersectSets', () => {
  it('returns the common members', () => {
    const result = intersectSets(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']));
    expect([...result].sort()).toEqual(['b', 'c']);
  });
});

describe('transpose', () => {
  it('flips rows and columns', () => {
    expect(
      transpose([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });
});

describe('computePcaCoords', () => {
  it('returns [] for an empty matrix', () => {
    expect(computePcaCoords([])).toEqual([]);
  });

  it('returns [[0,0,0]] for a single row', () => {
    expect(computePcaCoords([[1, 2, 3, 4]])).toEqual([[0, 0, 0]]);
  });

  it('returns finite, deterministic 3-tuples without collapsing distinct rows', () => {
    const matrix = [
      [1, 2, 3, 4, 5, 6],
      [6, 5, 4, 3, 2, 1],
      [1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1],
    ];
    const coords = computePcaCoords(matrix);

    // One 3-tuple of finite numbers per input row.
    expect(coords).toHaveLength(matrix.length);
    for (const row of coords) {
      expect(row).toHaveLength(3);
      for (const value of row) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }

    // Deterministic across calls.
    expect(computePcaCoords(matrix)).toEqual(coords);

    // Distinct input rows must not all collapse onto the same point.
    const unique = new Set(coords.map((row) => row.join(',')));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('orders components by descending variance (largest spread on the first axis)', () => {
    // Rows vary a lot on dim 0, a little on dim 1, none elsewhere.
    const matrix = [
      [10, 1, 0, 0],
      [-10, -1, 0, 0],
      [5, 0, 0, 0],
      [-5, 0, 0, 0],
    ];
    const coords = computePcaCoords(matrix);
    const spread = (axis: number) => {
      const vals = coords.map((row) => row[axis]);
      return Math.max(...vals) - Math.min(...vals);
    };
    expect(spread(0)).toBeGreaterThanOrEqual(spread(1));
    expect(spread(1)).toBeGreaterThanOrEqual(spread(2));
  });
});
