declare module 'svd-js' {
  export function SVD(matrix: number[][]): {
    u: number[][];
    s: number[];
    v: number[][];
  };
}
