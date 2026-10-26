import { useState } from "react";
import { display, dateLabel } from "./uiHelpers";

export function TrendChart({
  points,
  label,
}: {
  points: { date: string; value: number | null }[];
  label: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const known = points.filter(
    (point): point is { date: string; value: number } => point.value !== null,
  );
  if (!known.length)
    return (
      <div className="nutrition-empty">
        <strong>Sem registros de {label.toLocaleLowerCase("pt-BR")}</strong>
        <p>O gráfico aparece quando você registrar dados reais.</p>
      </div>
    );
  const min = Math.min(...known.map((point) => point.value));
  const max = Math.max(...known.map((point) => point.value));
  const span = Math.max(max - min, 1);
  const start = Date.parse(`${points[0].date}T12:00:00`),
    end = Date.parse(`${points.at(-1)!.date}T12:00:00`);
  const x = (point: { date: string }) =>
    36 +
    (end === start
      ? 0.5
      : (Date.parse(`${point.date}T12:00:00`) - start) / (end - start)) *
      348;
  const y = (value: number) => 164 - ((value - min) / span) * 126;
  const paths: string[] = [];
  let path = "";
  for (const point of points) {
    if (point.value === null) {
      if (path) paths.push(path);
      path = "";
    } else path += `${path ? " L" : "M"}${x(point)},${y(point.value)}`;
  }
  if (path) paths.push(path);
  return (
    <div className="nutrition-chart">
      <svg viewBox="0 0 420 210" role="img" aria-label={`Evolução: ${label}`}>
        <text x="4" y="24">
          {display(max)}
        </text>
        <text x="4" y="178">
          {display(min)}
        </text>
        <line
          x1="36"
          x2="385"
          y1="177"
          y2="177"
          stroke="currentColor"
          opacity=".2"
        />
        {paths.map((line, index) => (
          <path
            d={line}
            key={index}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
          />
        ))}
        {known.map((point) => (
          <g key={point.date}>
            <circle
              cx={x(point)}
              cy={y(point.value)}
              r="5"
              fill="var(--accent)"
            >
              <title>
                {dateLabel(point.date)}: {display(point.value)} {label}
              </title>
            </circle>
          </g>
        ))}
        <text x="36" y="202">
          {dateLabel(known[0].date)}
        </text>
        <text x="280" y="202">
          {dateLabel(known.at(-1)!.date)}
        </text>
      </svg>
      <label>
        Conferir ponto
        <select
          value={selected ?? known.at(-1)!.date}
          onChange={(event) => setSelected(event.target.value)}
        >
          {known.map((point) => (
            <option key={point.date} value={point.date}>
              {dateLabel(point.date)}: {display(point.value)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
