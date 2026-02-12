import type { CartographerResult } from '../types';

type Props = {
  result: CartographerResult | null;
  selected: string | null;
  onSelectNode: (label: string) => void;
};

const EDGE_CLASSES = {
  pure: 'edge edge-pure',
  analogy: 'edge edge-analogy',
  comparative: 'edge edge-comparative',
} as const;

export function TopologyCanvas({ result, selected, onSelectNode }: Props) {
  if (!result || !result.nodes.length) {
    return (
      <div className="topology-placeholder">
        <p>Enter up to five concepts and press Compute to generate the topology.</p>
      </div>
    );
  }

  const xs = result.nodes.map((node) => node.position[0]);
  const ys = result.nodes.map((node) => node.position[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const mapX = (x: number) => normalize(x, minX, maxX, 24, 476);
  const mapY = (y: number) => normalize(y, minY, maxY, 24, 276);

  return (
    <svg viewBox="0 0 500 300" className="topology-svg">
      {result.edges.map((edge) => {
        const source = result.nodes.find((node) => node.id === edge.source);
        const target = result.nodes.find((node) => node.id === edge.target);
        if (!source || !target) return null;
        return (
          <line
            key={edge.id}
            className={EDGE_CLASSES[edge.mode]}
            x1={mapX(source.position[0])}
            y1={mapY(source.position[1])}
            x2={mapX(target.position[0])}
            y2={mapY(target.position[1])}
            strokeWidth={Math.max(1, (1 - edge.distance) * 3)}
            strokeDasharray={edge.mode === 'analogy' ? '6 4' : undefined}
          />
        );
      })}

      {result.nodes.map((node) => {
        const isSelected = selected === node.label;
        return (
          <g
            key={node.id}
            className="node"
            onClick={() => onSelectNode(node.label)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={mapX(node.position[0])}
              cy={mapY(node.position[1])}
              r={isSelected ? 10 : 7}
              fill={node.color}
              stroke={isSelected ? '#ffffff' : '#0f172a'}
              strokeWidth={isSelected ? 3 : 1.5}
            />
            <text x={mapX(node.position[0]) + 10} y={mapY(node.position[1]) - 10}>
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function normalize(value: number, min: number, max: number, targetMin: number, targetMax: number) {
  if (max - min === 0) return (targetMin + targetMax) / 2;
  const ratio = (value - min) / (max - min);
  return targetMin + ratio * (targetMax - targetMin);
}
