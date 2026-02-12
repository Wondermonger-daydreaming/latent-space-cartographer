import type { CartographerResult } from '../types';

type Props = {
  result: CartographerResult | null;
};

export function ComparisonPanel({ result }: Props) {
  if (!result) {
    return (
      <div className="comparison-placeholder">
        <p>Comparison metrics appear after computing a topology.</p>
      </div>
    );
  }

  return (
    <div className="comparison-grid">
      <div>
        <h3>Shared feature families</h3>
        {result.summary.sharedFamilies.length ? (
          <ul className="badge-row">
            {result.summary.sharedFamilies.map((family) => (
              <li key={family}>{family}</li>
            ))}
          </ul>
        ) : (
          <p>None shared across all nodes.</p>
        )}
      </div>

      <div>
        <h3>Pairwise differentials</h3>
        <div className="pairwise-grid">
          {result.summary.pairwise.map((entry) => (
            <article key={entry.pair.join('-')}>
              <header>
                <strong>{entry.pair[0]}</strong> ↔ <strong>{entry.pair[1]}</strong>
                <span className="overlap">{(entry.overlap * 100).toFixed(0)}% overlap</span>
              </header>
              <div className="chip-group">
                <span>Shared</span>
                {entry.sharedFamilies.map((family) => (
                  <small key={family}>{family}</small>
                ))}
              </div>
              <div className="chip-columns">
                <div>
                  <span>Unique to {entry.pair[0]}</span>
                  {entry.uniqueA.map((family) => (
                    <small key={family}>{family}</small>
                  ))}
                </div>
                <div>
                  <span>Unique to {entry.pair[1]}</span>
                  {entry.uniqueB.map((family) => (
                    <small key={family}>{family}</small>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
