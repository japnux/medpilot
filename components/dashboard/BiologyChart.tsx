"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MarkerDef } from "@/lib/cancer-profiles";
import { computeReferenceZones } from "@/lib/markers";
import { formatDateShort } from "@/lib/dates";

interface DataPoint {
  date: string;
  value: number;
}

interface Props {
  marker: MarkerDef;
  data: DataPoint[];
}

/**
 * Courbe Recharts d'un marqueur biologique avec zones de référence.
 * Zones target en vert pointillé, zones alert en rouge pointillé.
 */
export default function BiologyChart({ marker, data }: Props) {
  const zones = computeReferenceZones(marker);
  // Recharts attend des données triées par date asc
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const display = sorted.map((d) => ({
    ...d,
    dateLabel: formatDateShort(d.date),
  }));

  return (
    <div className="h-48 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={display} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value) => [`${value} ${marker.unit}`, marker.label]}
          />
          {zones.map((z, i) => (
            <ReferenceLine
              key={i}
              y={z.y}
              stroke={z.color}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{ value: z.label, fontSize: 10, fill: z.color, position: "right" }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="value"
            stroke={marker.color}
            strokeWidth={2}
            dot={{ r: 3, fill: marker.color }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
