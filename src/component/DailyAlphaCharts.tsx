import React from "react";

type Point = { t: number; v: number };

interface Series {
  key: string;
  label: string;
  points: Point[];
}

interface DailyAlphaChartsProps {
  dataByKey: Record<string, Point[]>;
  notesByKey?: Record<string, string>;
  maxPoints?: number;
}

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

function computeBounds(points: Point[]) {
  if (points.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  let minX = points[0].t;
  let maxX = points[0].t;
  let minY = points[0].v;
  let maxY = points[0].v;
  for (const p of points) {
    if (p.t < minX) minX = p.t;
    if (p.t > maxX) maxX = p.t;
    if (p.v < minY) minY = p.v;
    if (p.v > maxY) maxY = p.v;
  }
  if (minY === maxY) {
    // add a small range so flat lines still render nicely
    const pad = Math.max(1, Math.abs(minY) * 0.1);
    minY -= pad;
    maxY += pad;
  }
  return { minX, maxX, minY, maxY };
}

function pointsToPath(points: Point[], width: number, height: number, padding = 24): string {
  if (points.length === 0) return "";
  const { minX, maxX, minY, maxY } = computeBounds(points);
  const w = width - padding * 2;
  const h = height - padding * 2;
  const scaleX = (t: number) => (w === 0 ? padding : padding + ((t - minX) / (maxX - minX || 1)) * w);
  const scaleY = (v: number) => (h === 0 ? padding : padding + h - ((v - minY) / (maxY - minY || 1)) * h);
  let d = `M ${scaleX(points[0].t)} ${scaleY(points[0].v)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${scaleX(points[i].t)} ${scaleY(points[i].v)}`;
  }
  return d;
}

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="bg-white rounded-lg shadow-sm p-3">
    <div className="flex items-baseline justify-between mb-2">
      <div className="font-semibold text-gray-800 truncate mr-2">{title}</div>
      {subtitle && <div className="text-xs text-gray-500 truncate">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const DailyAlphaCharts: React.FC<DailyAlphaChartsProps> = ({ dataByKey, notesByKey = {}, maxPoints = 60 }) => {
  const series: Series[] = React.useMemo(() => {
    return Object.entries(dataByKey).map(([key, points]) => ({
      key,
      label: notesByKey[key] ? `${key} — ${notesByKey[key]}` : key,
      points: points.slice(-maxPoints),
    }));
  }, [dataByKey, notesByKey, maxPoints]);

  if (series.length === 0) {
    return <div className="p-3 text-sm text-gray-500">No history yet. It will populate as data refreshes.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {series.map((s) => {
        const width = 360;
        const height = 140;
        const path = pointsToPath(s.points, width, height);
        const last = s.points[s.points.length - 1];
        return (
          <Card key={s.key} title={s.label} subtitle={last ? `$${last.v} @ ${formatTime(last.t)}` : undefined}>
            <svg width={width} height={height + 24} className="w-full">
              <rect x={0} y={0} width={width} height={height + 24} fill="#fafafa" stroke="#eee" />
              <text x={6} y={12} fontSize={10} fill="#6b7280">$ Alpha Price</text>
              <text x={width - 80} y={height + 18} fontSize={10} fill="#6b7280">Time</text>
              <g transform={`translate(0,12)`}>
                <path d={path} stroke="#ef4444" strokeWidth={2} fill="none" />
              </g>
            </svg>
          </Card>
        );
      })}
    </div>
  );
};

export default DailyAlphaCharts;


