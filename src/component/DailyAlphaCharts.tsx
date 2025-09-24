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
const CustomTooltip = ({ active, payload }: any) => {
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
        
        // Create custom ticks for key times
        const customTicks: number[] = [];
        if (data.length > 0) {
          // For 24-hour view, show ticks every 3 hours
          const tickHours = hoursInRange > 12 ? 3 : hoursInRange > 6 ? 2 : 1;
          
          data.forEach((point, index) => {
            const hour = parseInt(point.time.split(':')[0]);
            const minute = parseInt(point.time.split(':')[1]);
            
            // Add tick if it's a key hour (divisible by tickHours) and close to 00 minutes
            if (hour % tickHours === 0 && minute < 10) {
              // Check if we don't already have a tick near this position
              const nearbyTick = customTicks.find(t => Math.abs(t - index) < 5);
              if (!nearbyTick) {
                customTicks.push(index);
              }
            }
          });
          
          // Ensure we have first and last ticks
          if (!customTicks.includes(0)) customTicks.unshift(0);
          if (!customTicks.includes(data.length - 1)) customTicks.push(data.length - 1);
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
                    ticks={customTicks}
                    angle={0}
                    textAnchor="middle"
                    height={30}
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