export type ConceptInput = {
  id: string;
  phrase: string;
  domain?: string;
};

export type EmbeddingMode = 'pure' | 'analogy' | 'comparative';

export type FeatureActivation = {
  id: number;
  label: string;
  value: number;
  familyId: string;
  familyLabel: string;
};

export type TopologyNode = {
  id: string;
  label: string;
  position: [number, number, number];
  dominantFamily: string;
  color: string;
};

export type TopologyEdge = {
  id: string;
  source: string;
  target: string;
  distance: number;
  overlap: number;
  mode: EmbeddingMode;
};

export type CartographerResult = {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  featuresByConcept: Record<string, FeatureActivation[]>;
  summary: {
    sharedFamilies: string[];
    pairwise: Array<{
      pair: [string, string];
      overlap: number;
      sharedFamilies: string[];
      uniqueA: string[];
      uniqueB: string[];
    }>;
  };
};
