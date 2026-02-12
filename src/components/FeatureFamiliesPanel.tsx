import type { FeatureActivation } from '../types';

type Props = {
  features: FeatureActivation[];
  corrections: Record<number, string>;
  onCorrect: (feature: FeatureActivation) => void;
};

export function FeatureFamiliesPanel({ features, corrections, onCorrect }: Props) {
  if (!features?.length) {
    return (
      <div className="feature-placeholder">
        <p>Select a concept node to inspect its dominant feature families.</p>
      </div>
    );
  }

  const grouped = features.reduce<Record<string, FeatureActivation[]>>((acc, feature) => {
    if (!acc[feature.familyLabel]) acc[feature.familyLabel] = [];
    acc[feature.familyLabel].push(feature);
    return acc;
  }, {});

  return (
    <div className="feature-families">
      {Object.entries(grouped).map(([family, items]) => (
        <div key={family} className="family-card">
          <div className="family-header">
            <h3>{family}</h3>
            <span className="activation">
              avg {(items.reduce((sum, item) => sum + item.value, 0) / items.length).toFixed(2)}
            </span>
          </div>
          <ul>
            {items.map((item) => {
              const correctedLabel = corrections[item.id];
              return (
                <li key={item.id}>
                  <div>
                    <strong>{correctedLabel ?? item.label}</strong>
                    <span className="value">{item.value.toFixed(2)}</span>
                  </div>
                  <button onClick={() => onCorrect(item)}>Correct label</button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
