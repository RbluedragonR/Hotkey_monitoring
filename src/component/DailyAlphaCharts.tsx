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
  visibleUids?: string[]; // Only show charts for these UIDs
  maxPoints?: number;
}

const formatTime = (ts: number): string => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const formatDatetime = (ts: number): string => {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hh}:${mm}`;
};

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="bg-white rounded-lg shadow-sm p-3">
    <div className="flex items-baseline justify-between mb-2">
      <div className="font-semibold text-gray-800 truncate mr-2">{title}</div>
      {subtitle && <div className="text-xs text-gray-500 truncate">{subtitle}</div>}
    </div>
    {children}
  </div>
);

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-2 border border-gray-200 rounded shadow-lg">
        <p className="text-sm font-medium">{data.fullTime}</p>
        <p className="text-sm text-gray-600">$ Alpha: ${data.value}</p>
      </div>
    );
  }
  return null;
};

const DailyAlphaCharts: React.FC<DailyAlphaChartsProps> = ({ 
  dataByKey, 
  notesByKey = {}, 
  visibleUids = [], 
  maxPoints = 1440 // Default to 1440 points (24 hours * 60 minutes)
}) => {
  const series: Series[] = React.useMemo(() => {
    // Only show charts for UIDs that exist in current miner data
    const filteredKeys = visibleUids.length > 0 
      ? Object.keys(dataByKey).filter(key => visibleUids.includes(key))
      : Object.keys(dataByKey);
    
    return filteredKeys.map((key) => {
      const points = dataByKey[key] || [];
      
      // Get last 24 hours of data
      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      
      // Filter points to last 24 hours
      const last24Hours = points.filter(p => p.t >= twentyFourHoursAgo);
      
      // If we have 24 hours of data, use it; otherwise use all available data up to maxPoints
      const pointsToUse = last24Hours.length > 0 ? last24Hours : points.slice(-maxPoints);
      
      return {
        key,
        label: notesByKey[key] ? `${key} — ${notesByKey[key]}` : key,
        points: pointsToUse,
      };
    });
  }, [dataByKey, notesByKey, visibleUids, maxPoints]);

  if (series.length === 0) {
    return <div className="p-3 text-sm text-gray-500">No history yet. It will populate as data refreshes.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {series.map((s) => {
        const dataToShow = s.points;
        
        // Downsample data if we have too many points (more than 200) for better performance
        let sampledData = dataToShow;
        if (dataToShow.length > 200) {
          const sampleRate = Math.ceil(dataToShow.length / 200);
          sampledData = dataToShow.filter((_, index) => index % sampleRate === 0);
          // Always include the last point
          if (dataToShow.length > 0 && sampledData[sampledData.length - 1] !== dataToShow[dataToShow.length - 1]) {
            sampledData.push(dataToShow[dataToShow.length - 1]);
          }
        }
        
        const data = sampledData.map(p => ({ 
          time: formatTime(p.t), 
          fullTime: formatDatetime(p.t),
          timestamp: p.t,
          value: p.v 
        }));
        
        const last = dataToShow[dataToShow.length - 1];
        
        // Calculate the appropriate tick interval based on data range
        const timeRange = dataToShow.length > 0 
          ? dataToShow[dataToShow.length - 1].t - dataToShow[0].t 
          : 0;
        const hoursInRange = timeRange / (1000 * 60 * 60);
        
        // Determine tick interval: show fewer ticks for longer time ranges
        let tickInterval = 0; // 0 means auto
        if (hoursInRange > 12) {
          tickInterval = Math.ceil(sampledData.length / 8); // Show ~8 ticks for 24 hours
        } else if (hoursInRange > 6) {
          tickInterval = Math.ceil(sampledData.length / 6); // Show ~6 ticks for 6-12 hours
        }
        
        return (
          <Card key={s.key} title={s.label} subtitle={last ? `$${last.v} @ ${formatTime(last.t)}` : undefined}>
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10 }} 
                    interval={tickInterval}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
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