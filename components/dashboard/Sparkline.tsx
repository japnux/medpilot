/**
 * Sparkline SVG inline ultra-léger.
 * Trace une courbe simple d'une série de valeurs, plus efficace que Recharts
 * pour les mini-graphes intégrés dans les cartes.
 */
interface Props {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  /** Affiche les bornes target_min/target_max en zones rect dimmer. */
  targetMin?: number | null;
  targetMax?: number | null;
}

export default function Sparkline({
  values,
  color,
  width = 100,
  height = 28,
  targetMin,
  targetMax,
}: Props) {
  if (values.length < 2) {
    return (
      <span className="text-[10px] text-muted-soft italic">
        {values.length === 1 ? "1 mesure" : "Pas d'historique"}
      </span>
    );
  }

  // Étendre min/max à la zone cible si elle existe pour que celle-ci soit visible
  const visualMin = Math.min(...values, targetMin ?? Infinity);
  const visualMax = Math.max(...values, targetMax ?? -Infinity);
  const range = visualMax - visualMin || 1;

  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${height - ((v - visualMin) / range) * (height - 4) - 2}`)
    .join(" ");

  // Rect de la zone cible (en pixel sur le SVG)
  const targetRect =
    targetMin != null && targetMax != null
      ? {
          y: height - ((targetMax - visualMin) / range) * (height - 4) - 2,
          h:
            ((targetMax - targetMin) / range) * (height - 4),
        }
      : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      {targetRect && (
        <rect
          x={0}
          y={targetRect.y}
          width={width}
          height={Math.max(2, targetRect.h)}
          fill="var(--gradient-mint)"
          opacity={0.25}
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Dernier point mis en évidence */}
      <circle
        cx={(values.length - 1) * step}
        cy={
          height -
          ((values[values.length - 1] - visualMin) / range) * (height - 4) -
          2
        }
        r={2}
        fill={color}
      />
    </svg>
  );
}
