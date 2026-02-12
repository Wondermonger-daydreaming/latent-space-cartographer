import { useEffect, useMemo, useState } from 'react';
import { CartographerEngine } from './lib/cartographer';
import { createId } from './lib/id';
import { loadCorrections, loadSession, saveCorrection, saveSession } from './lib/storage';
import type { CartographerResult, ConceptInput, EmbeddingMode, FeatureActivation } from './types';
import { TopologyCanvas } from './components/TopologyCanvas';
import { ComparisonPanel } from './components/ComparisonPanel';
import { FeatureFamiliesPanel } from './components/FeatureFamiliesPanel';
import { SessionFeedbackPanel } from './components/SessionFeedbackPanel';

const DEFAULT_CONCEPTS = ['consciousness', 'simulation', 'qualia'];

function buildConceptInputs(): ConceptInput[] {
  return DEFAULT_CONCEPTS.map((concept) => ({
    id: createId(),
    phrase: concept,
    domain: '',
  })) as ConceptInput[];
}

const ENGINE = new CartographerEngine();

export default function App() {
  const [concepts, setConcepts] = useState<ConceptInput[]>(() => buildConceptInputs());
  const [mode, setMode] = useState<EmbeddingMode>('pure');
  const [result, setResult] = useState<CartographerResult | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<number, string>>(() => loadCorrections());

  useEffect(() => {
    const restored = loadSession();
    if (restored) {
      setMode((restored.mode as EmbeddingMode) ?? 'pure');
      setConcepts(
        restored.concepts.map((item) => ({
          id: createId(),
          phrase: item.phrase,
          domain: item.domain,
        })),
      );
    }
  }, []);

  const handleConceptChange = (index: number, field: 'phrase' | 'domain', value: string) => {
    setConcepts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddConcept = () => {
    setConcepts((prev) => [...prev, { id: createId(), phrase: '', domain: '' }]);
  };

  const handleClear = () => {
    setConcepts(buildConceptInputs());
    setResult(null);
    setSelectedConcept(null);
  };

  const handleLoadSession = () => {
    const restored = loadSession();
    if (!restored) return;
    setMode((restored.mode as EmbeddingMode) ?? 'pure');
    setConcepts(
      restored.concepts.map((item) => ({
        id: createId(),
        phrase: item.phrase,
        domain: item.domain,
      })),
    );
  };

  const handleSaveSession = () => {
    saveSession({
      mode,
      concepts: concepts.map(({ phrase, domain }) => ({ phrase, domain })),
    });
  };

  const handleCompute = async () => {
    setError(null);
    setLoading(true);
    try {
      const filtered = concepts.filter((concept) => concept.phrase.trim().length);
      const output = await ENGINE.run(filtered, mode);
      setResult(output);
      setSelectedConcept(output.nodes[0]?.label ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const featureSelection = useMemo(() => {
    if (!result) return [];
    const target =
      result.featuresByConcept[selectedConcept ?? ''] ??
      result.featuresByConcept[result.nodes[0]?.label ?? ''];
    return target ?? [];
  }, [result, selectedConcept]);

  const handleCorrectLabel = (feature: FeatureActivation) => {
    const next = window.prompt('New label for this feature', feature.label);
    if (!next) return;
    saveCorrection({ featureId: feature.id, label: next });
    setCorrections(loadCorrections());
  };

  return (
    <div className="app-shell">
      <header>
        <div>
          <h1>Latent Space Cartographer</h1>
          <p className="subtitle">
            Decompose semantic neighborhoods into interpretable feature families and compare how
            contexts warp meaning.
          </p>
        </div>
        <div className="mode-indicator">
          Inference: <span>{ENGINE.mode === 'local' ? 'ONNX.js' : 'serverless fallback'}</span>
        </div>
      </header>

      <section className="panel input-panel">
        <div className="inputs">
          {concepts.map((concept, idx) => (
            <div className="concept-row" key={concept.id}>
              <input
                aria-label={`Concept ${idx + 1}`}
                placeholder="e.g., consciousness"
                value={concept.phrase}
                onChange={(event) => handleConceptChange(idx, 'phrase', event.target.value)}
              />
              <input
                aria-label={`Domain context for ${concept.phrase || `concept ${idx + 1}`}`}
                placeholder="Domain context (optional)"
                value={concept.domain}
                onChange={(event) => handleConceptChange(idx, 'domain', event.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="input-actions">
          <button type="button" onClick={handleAddConcept}>
            + Add concept
          </button>
          <div className="spacer" />
          <button type="button" onClick={handleClear}>
            Clear
          </button>
          <button type="button" onClick={handleLoadSession}>
            Load previous session
          </button>
          <button type="button" onClick={handleSaveSession}>
            Save session
          </button>
          <button className="primary" type="button" onClick={handleCompute} disabled={loading}>
            {loading ? 'Computing…' : 'Compute'}
          </button>
        </div>
      </section>

      <section className="panel mode-panel">
        <ModeSelector value={mode} onChange={setMode} />
      </section>

      {error && (
        <section className="panel error-panel">
          <p>{error}</p>
        </section>
      )}

      <section className="workspace">
        <div className="panel topology-panel">
          <TopologyCanvas
            result={result}
            selected={selectedConcept}
            onSelectNode={setSelectedConcept}
          />
        </div>
        <div className="panel feature-panel">
          <FeatureFamiliesPanel
            features={featureSelection}
            corrections={corrections}
            onCorrect={handleCorrectLabel}
          />
        </div>
      </section>

      <section className="panel comparison-panel">
        <ComparisonPanel result={result} />
      </section>

      <section className="panel feedback-panel">
        <SessionFeedbackPanel corrections={corrections} />
      </section>
    </div>
  );
}

type ModeSelectorProps = {
  value: EmbeddingMode;
  onChange: (value: EmbeddingMode) => void;
};

function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      {(['pure', 'analogy', 'comparative'] as EmbeddingMode[]).map((option) => (
        <label key={option}>
          <input
            type="radio"
            name="mode"
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          <span className="label">{option}</span>
        </label>
      ))}
    </div>
  );
}
