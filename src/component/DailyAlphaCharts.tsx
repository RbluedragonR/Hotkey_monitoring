import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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
        const data = s.points.map(p => ({ time: formatTime(p.t), value: p.v }));
        const last = s.points[s.points.length - 1];
        return (
          <Card key={s.key} title={s.label} subtitle={last ? `$${last.v} @ ${formatTime(last.t)}` : undefined}>
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v: any) => [`$${v}`, '$ Alpha']} labelFormatter={(l) => `Time: ${l}`} />
                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default DailyAlphaCharts;


