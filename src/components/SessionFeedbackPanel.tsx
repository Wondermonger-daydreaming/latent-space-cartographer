type Props = {
  corrections: Record<number, string>;
};

export function SessionFeedbackPanel({ corrections }: Props) {
  const entries = Object.entries(corrections);
  if (!entries.length) {
    return (
      <div className="session-placeholder">
        <p>No label corrections yet. Tweak any feature label to start training your map.</p>
      </div>
    );
  }

  return (
    <div className="session-feedback">
      <h3>Label corrections this session</h3>
      <ul>
        {entries.map(([id, label]) => (
          <li key={id}>
            Feature {id}: <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
