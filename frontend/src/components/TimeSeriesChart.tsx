"use client";

import {
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { DataPoint, SensorStats } from "@/lib/api";

interface Props {
  data: DataPoint[];
  selectedSensor: string;
  stats: Record<string, SensorStats>;
  isLive: boolean;
}

function formatTick(ts: string): string {
  try {
    return format(parseISO(ts), "HH:mm:ss");
  } catch {
    return ts.slice(11, 19) || ts.slice(0, 8);
  }
}

// Custom dot: red circle for anomalies, nothing otherwise
const AnomalyDot = (props: {
  cx?: number;
  cy?: number;
  payload?: DataPoint;
  key?: string;
}) => {
  if (!props.payload?.isAnomaly) return null;
  const { cx = 0, cy = 0 } = props;
  return (
    <g key={`anom-${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r={7} fill="#ef444430" />
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#ef4444"
        stroke="#fff"
        strokeWidth={1.5}
      />
    </g>
  );
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: DataPoint }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#1f2937] bg-[#161b27] p-3 text-xs shadow-xl">
      <p className="mb-1 font-mono text-slate-400">{label}</p>
      <p className="text-slate-100">
        Value:{" "}
        <span className="font-semibold">{payload[0].value?.toFixed(4)}</span>
      </p>
      {d.isAnomaly && (
        <p className="mt-1 text-red-400 font-semibold">
          Anomaly · score {(d.anomalyScore as number).toFixed(3)}
        </p>
      )}
    </div>
  );
};

export function TimeSeriesChart({ data, selectedSensor, stats, isLive }: Props) {
  const s = stats[selectedSensor];
  const mean = s?.mean ?? 0;
  const upper = s ? mean + 2 * s.std : undefined;
  const lower = s ? mean - 2 * s.std : undefined;

  const WINDOW = 200;
  const visible = isLive ? data.slice(-WINDOW) : data;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-blue-400 rounded" />
          {selectedSensor}
        </span>
        {s && (
          <>
            <span>
              mean{" "}
              <span className="text-slate-200 font-mono">{mean.toFixed(2)}</span>
            </span>
            <span>
              2σ band{" "}
              <span className="text-slate-200 font-mono">
                [{lower?.toFixed(2)}, {upper?.toFixed(2)}]
              </span>
            </span>
          </>
        )}
        {isLive && (
          <span className="ml-auto flex items-center gap-1.5 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={visible}
          margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTick}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={{ stroke: "#1f2937" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Normal range band */}
          {upper !== undefined && lower !== undefined && (
            <ReferenceArea
              y1={lower}
              y2={upper}
              fill="#3b82f6"
              fillOpacity={0.06}
              strokeOpacity={0}
            />
          )}

          {/* Mean line */}
          {s && (
            <ReferenceLine
              y={mean}
              stroke="#3b82f640"
              strokeDasharray="4 3"
            />
          )}

          <Line
            type="monotone"
            dataKey={selectedSensor}
            stroke="#3b82f6"
            strokeWidth={1.8}
            dot={<AnomalyDot />}
            activeDot={{ r: 4, fill: "#60a5fa" }}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
