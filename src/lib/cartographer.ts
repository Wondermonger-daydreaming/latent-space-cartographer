import type * as ort from 'onnxruntime-web';
import { SVD } from 'svd-js';
import { EmbeddingClient, computeAnalogyEmbedding } from './embedding';
import type {
  CartographerResult,
  ConceptInput,
  EmbeddingMode,
  FeatureActivation,
  TopologyEdge,
  TopologyNode,
} from '../types';

type VariantKind = 'pure' | 'analogy';

type ConceptVariant = {
  conceptId: string;
  variant: VariantKind;
  displayLabel: string;
  vector: Float32Array;
  features: FeatureActivation[];
  families: Set<string>;
};

const FEATURE_LIBRARY = [
  { id: 7, label: 'subjective_experience', family: 'Phenomenology' },
  { id: 15, label: 'temporal_flow', family: 'Temporality' },
  { id: 42, label: 'information_processing', family: 'Computation' },
  { id: 88, label: 'manufactured_object', family: 'Technology & Artifacts' },
  { id: 156, label: 'algorithmic_structure', family: 'Computation' },
  { id: 200, label: 'agency', family: 'Agency' },
  { id: 267, label: 'volitional_action', family: 'Agency' },
  { id: 315, label: 'social_contract', family: 'Collective Order' },
  { id: 377, label: 'biological_substrate', family: 'Biology' },
  { id: 401, label: 'mythic_symbolism', family: 'Mythos' },
  { id: 444, label: 'non_duality', family: 'Contemplative' },
  { id: 512, label: 'optimization_drive', family: 'Optimization' },
];

const FAMILY_COLORS: Record<string, string> = {
  Phenomenology: '#f472b6',
  Temporality: '#facc15',
  Computation: '#60a5fa',
  'Technology & Artifacts': '#34d399',
  Agency: '#fb923c',
  'Collective Order': '#c084fc',
  Biology: '#f97316',
  Mythos: '#a855f7',
  Contemplative: '#2dd4bf',
  Optimization: '#f87171',
};

export class CartographerEngine {
  private embedding = new EmbeddingClient();
  private session?: ort.InferenceSession;
  private inferenceMode: 'local' | 'serverless' = 'serverless';
  private initializing?: Promise<void>;

  constructor(private readonly modelUrl = 'model.onnx') {}

  async initialize() {
    if (this.session || this.initializing) {
      return this.initializing;
    }
    this.initializing = this.tryLoadOnnx();
    await this.initializing;
  }

  private async tryLoadOnnx() {
    try {
      const ortRuntime = await import('onnxruntime-web');
      this.session = await ortRuntime.InferenceSession.create(this.modelUrl);
      this.inferenceMode = 'local';
    } catch (error) {
      console.warn('ONNX.js session failed, staying in serverless mode', error);
      this.session = undefined;
      this.inferenceMode = 'serverless';
    }
  }

  get mode() {
    return this.inferenceMode;
  }

  async run(inputs: ConceptInput[], mode: EmbeddingMode): Promise<CartographerResult> {
    await this.initialize();
    const variants = await this.prepareVariants(inputs, mode);
    const nodes = this.buildNodes(variants);
    const edges = this.buildEdges(variants, mode);
    const featuresByConcept: CartographerResult['featuresByConcept'] = {};
    for (const variant of variants) {
      featuresByConcept[variant.displayLabel] = variant.features;
    }
    const summary = this.computeSummary(variants);
    return { nodes, edges, featuresByConcept, summary };
  }

  private async prepareVariants(inputs: ConceptInput[], mode: EmbeddingMode) {
    const variants: ConceptVariant[] = [];
    for (const concept of inputs) {
      if (!concept.phrase.trim()) continue;
      const baseVector = await this.embedding.embed(concept.phrase);
      const baseFeatures = await this.decomposeFeatures(baseVector);
      variants.push({
        conceptId: concept.id,
        variant: 'pure',
        displayLabel: concept.phrase.trim(),
        vector: baseVector,
        features: baseFeatures,
        families: new Set(baseFeatures.map((f) => f.familyLabel)),
      });

      if ((mode === 'analogy' || mode === 'comparative') && concept.domain?.trim()) {
        const analogyVector = await computeAnalogyEmbedding(
          this.embedding,
          concept.phrase,
          concept.domain,
        );
        const analogyFeatures = await this.decomposeFeatures(analogyVector);
        variants.push({
          conceptId: concept.id,
          variant: 'analogy',
          displayLabel: `${concept.phrase.trim()} ↦ ${concept.domain.trim()}`,
          vector: analogyVector,
          features: analogyFeatures,
          families: new Set(analogyFeatures.map((f) => f.familyLabel)),
        });
      } else if (mode === 'analogy') {
        variants.pop(); // remove base variant if analogy requested but no domain
      }
    }
    return variants;
  }

  private async decomposeFeatures(vector: Float32Array): Promise<FeatureActivation[]> {
    if (this.session) {
      try {
        const ortRuntime = await import('onnxruntime-web');
        const tensor = new ortRuntime.Tensor('float32', vector, [1, vector.length]);
        const outputs = await this.session.run({ embedding: tensor });
        const result = outputs[Object.keys(outputs)[0]];
        const features = Array.from(result.data as Float32Array);
        return this.mapActivations(features);
      } catch (error) {
        console.error('ONNX inference failed, falling back to procedural features', error);
      }
    }
    return this.mapActivations(Array.from(vector));
  }

  private mapActivations(values: number[]): FeatureActivation[] {
    const top = values
      .map((value, index) => ({ value: Math.abs(value), index }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return top.map(({ value, index }) => {
      const feature = FEATURE_LIBRARY[index % FEATURE_LIBRARY.length];
      return {
        id: feature.id,
        label: feature.label,
        value,
        familyId: feature.family,
        familyLabel: feature.family,
      };
    });
  }

  private buildNodes(variants: ConceptVariant[]): TopologyNode[] {
    if (!variants.length) return [];
    const matrix = variants.map((variant) => Array.from(variant.vector));

    const coords = computePcaCoords(matrix);

    return variants.map((variant, idx) => {
      const [x, y] = coords[idx] ?? [0, 0];
      const dominantFamily = variant.features[0]?.familyLabel ?? 'Unknown';
      return {
        id: `${variant.conceptId}-${variant.variant}-${idx}`,
        label: variant.displayLabel,
        position: [x, y],
        dominantFamily,
        color: FAMILY_COLORS[dominantFamily] ?? '#94a3b8',
      };
    });
  }

  private buildEdges(variants: ConceptVariant[], mode: EmbeddingMode): TopologyEdge[] {
    const edges: TopologyEdge[] = [];
    for (let i = 0; i < variants.length; i++) {
      for (let j = i + 1; j < variants.length; j++) {
        const a = variants[i];
        const b = variants[j];
        const distance = cosineDistance(a.vector, b.vector);
        const overlap = jaccardIndex(a.families, b.families);
        let edgeMode: EmbeddingMode = mode;
        if (a.variant === 'pure' && b.variant === 'pure') {
          edgeMode = 'pure';
        } else if (a.conceptId === b.conceptId) {
          edgeMode = 'analogy';
        } else if (mode === 'comparative') {
          edgeMode = 'comparative';
        }
        edges.push({
          id: `${i}-${j}`,
          source: `${a.conceptId}-${a.variant}-${i}`,
          target: `${b.conceptId}-${b.variant}-${j}`,
          distance,
          overlap,
          mode: edgeMode,
        });
      }
    }
    return edges;
  }

  private computeSummary(variants: ConceptVariant[]): CartographerResult['summary'] {
    const familySets = variants.map((variant) => variant.families);
    const sharedFamilies = intersectAll(familySets);

    const pairwise = [];
    for (let i = 0; i < variants.length; i++) {
      for (let j = i + 1; j < variants.length; j++) {
        const aFamilies = variants[i].families;
        const bFamilies = variants[j].families;
        const shared = intersectSets(aFamilies, bFamilies);
        const uniqueA = [...aFamilies].filter((f) => !bFamilies.has(f));
        const uniqueB = [...bFamilies].filter((f) => !aFamilies.has(f));
        pairwise.push({
          pair: [variants[i].displayLabel, variants[j].displayLabel] as [string, string],
          overlap: jaccardIndex(aFamilies, bFamilies),
          sharedFamilies: [...shared],
          uniqueA,
          uniqueB,
        });
      }
    }
    return { sharedFamilies: [...sharedFamilies], pairwise };
  }
}

function computePcaCoords(matrix: number[][]) {
  if (!matrix.length) return [];
  if (matrix.length === 1) return [[0, 0]];

  const dims = matrix[0].length;
  const means = new Array(dims).fill(0);
  matrix.forEach((row) => {
    row.forEach((value, idx) => {
      means[idx] += value;
    });
  });
  for (let i = 0; i < dims; i++) {
    means[i] /= matrix.length;
  }

  const centered = matrix.map((row) => row.map((value, idx) => value - means[idx]));
  const { v } = SVD(centered);
  const projected = multiplyMatrices(centered, v);
  return projected.map((row) => [row[0] ?? 0, row[1] ?? 0]);
}

function multiplyMatrices(a: number[][], b: number[][]) {
  const rows = a.length;
  const cols = b[0]?.length ?? 0;
  const shared = b.length;
  const result = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < shared; k++) {
      const val = a[i][k] ?? 0;
      for (let j = 0; j < cols; j++) {
        result[i][j] += val * (b[k]?.[j] ?? 0);
      }
    }
  }
  return result;
}

function cosineDistance(a: Float32Array, b: Float32Array) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  const cosine = denom ? dot / denom : 0;
  return 1 - cosine;
}

function jaccardIndex(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 1;
  const intersection = intersectSets(a, b);
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function intersectSets<T>(a: Set<T>, b: Set<T>) {
  const intersection = new Set<T>();
  for (const item of a) {
    if (b.has(item)) {
      intersection.add(item);
    }
  }
  return intersection;
}

function intersectAll<T>(sets: Array<Set<T>>) {
  if (!sets.length) return new Set<T>();
  return sets.reduce((acc, curr) => {
    const next = new Set<T>();
    for (const value of acc) {
      if (curr.has(value)) {
        next.add(value);
      }
    }
    return next;
  });
}
