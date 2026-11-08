import { useState } from 'react';
import type { Session } from '../types';
import { avg } from '../lib/utils';

export function TrendChart({ sessions, days }: { sessions: Session[]; days: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const count = 7;
  const data = Array.from({ length: count }, (_, i) => {
    const end = new Date(Date.now() - (((count - i - 1) * days) / count) * 86400000);
    const start = new Date(end.getTime() - (days / count) * 86400000);
    const filtered = sessions.filter(
      (s) => Date.parse(s.startedAt) >= +start && Date.parse(s.startedAt) <= +end,
    );
    return {
      label: end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      value: filtered.length ? avg(filtered.map((s) => s.score || 0)) : 0,
      count: filtered.length,
    };
  });
  const points = data.map((d, i) => ({ x: 44 + i * (586 / (count - 1)), y: 192 - d.value * 1.53 }));
  const smooth = points.reduce(
    (path, p, i) =>
      i
        ? `${path} C${(points[i - 1].x + p.x) / 2},${points[i - 1].y} ${(points[i - 1].x + p.x) / 2},${p.y} ${p.x},${p.y}`
        : `M${p.x},${p.y}`,
    '',
  );
  return (
    <div className="trend-chart">
      <svg
        viewBox="0 0 660 233"
        role="img"
        aria-label="Average training score over the selected period"
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#b3cf8d" stopOpacity=".3" />
            <stop offset="1" stopColor="#b3cf8d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line
              x1="44"
              x2="640"
              y1={192 - value * 1.53}
              y2={192 - value * 1.53}
              stroke="#eceee7"
              strokeDasharray="3 5"
            />
            <text x="26" y={196 - value * 1.53} textAnchor="end" fill="#8c9287" fontSize="10">
              {value}
            </text>
          </g>
        ))}
        <line
          x1="44"
          x2="640"
          y1={192 - 85 * 1.53}
          y2={192 - 85 * 1.53}
          stroke="#b5bbab"
          strokeDasharray="5 5"
        />
        <path d={`${smooth} L630,192 L44,192 Z`} fill="url(#chart-fill)" />
        <path d={smooth} fill="none" stroke="#617d49" strokeWidth="2.8" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={points[i].x - 35} y="20" width="70" height="180" fill="transparent" />
            <circle
              cx={points[i].x}
              cy={points[i].y}
              r={hover === i ? 5 : 3.4}
              fill="#fff"
              stroke="#617d49"
              strokeWidth="2"
            />
            <text x={points[i].x} y="220" textAnchor="middle" fill="#8c9287" fontSize="10">
              {d.label}
            </text>
            {hover === i && (
              <g>
                <rect
                  x={Math.min(Math.max(points[i].x - 51, 44), 538)}
                  y={Math.max(4, points[i].y - 48)}
                  width="100"
                  height="33"
                  rx="6"
                  fill="#263e31"
                />
                <text
                  x={Math.min(Math.max(points[i].x - 1, 94), 588)}
                  y={Math.max(4, points[i].y - 48) + 21}
                  fontSize="11"
                  fill="#fff"
                  textAnchor="middle"
                >
                  {Math.round(d.value)}% · {d.count} sessions
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
export function Sparkline({ index }: { index: number }) {
  const shapes = [
    '0,28 10,21 21,25 30,16 40,20 50,12 59,17 70,4 80,9',
    '0,25 11,22 20,27 30,15 41,19 51,9 60,13 70,5 80,8',
    '0,10 10,15 20,9 30,18 40,15 50,24 60,20 70,26 80,29',
    '0,28 10,24 20,26 30,14 40,19 50,12 60,16 70,5 80,8',
  ];
  return (
    <svg className="sparkline" viewBox="0 0 82 34" aria-hidden="true">
      <polyline
        points={shapes[index % 4]}
        fill="none"
        stroke={index === 2 ? '#b6976c' : '#839969'}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
