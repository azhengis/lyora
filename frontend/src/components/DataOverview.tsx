"use client";

import { BarChart2 } from "lucide-react";
import type { SensorStats, Anomaly } from "@/lib/api";

interface Props {
  sensors: string[];
  stats: Record<string, SensorStats>;
  anomalies: Anomaly[];
  totalRows: number;
  selectedSensor: string;
  onSelectSensor: (s: string) => void;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "—";
}

export function DataOverview({
  sensors,
  stats,
  anomalies,
  totalRows,
  selectedSensor,
  onSelectSensor,
}: Props) {
  const anomalyCountBySensor = sensors.reduce<Record<string, number>>((acc, s) => {
    acc[s] = anomalies.filter(
      (a) => a.explanation?.primary_sensor === s
    ).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="h-4 w-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-slate-200">Data Overview</h2>
        <span className="ml-auto text-xs text-slate-500">
          {totalRows.toLocaleString()} rows
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-[#1f2937]">
              <th className="pb-2 text-left font-medium">Sensor</th>
              <th className="pb-2 text-right font-medium">Mean</th>
              <th className="pb-2 text-right font-medium">Std</th>
              <th className="pb-2 text-right font-medium">Min</th>
              <th className="pb-2 text-right font-medium">Max</th>
              <th className="pb-2 text-right font-medium">Anomalies</th>
            </tr>
          </thead>
          <tbody>
            {sensors.map((sensor) => {
              const s = stats[sensor];
              const aCount = anomalyCountBySensor[sensor] ?? 0;
              const isSelected = sensor === selectedSensor;
              return (
                <tr
                  key={sensor}
                  onClick={() => onSelectSensor(sensor)}
                  className={`border-b border-[#1f2937]/50 cursor-pointer transition-colors hover:bg-white/5 ${
                    isSelected ? "bg-blue-500/10" : ""
                  }`}
                >
                  <td className="py-2 pr-2">
                    <span
                      className={`font-mono ${
                        isSelected ? "text-blue-400 font-semibold" : "text-slate-300"
                      }`}
                    >
                      {sensor}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-slate-400">
                    {s ? fmt(s.mean) : "—"}
                  </td>
                  <td className="py-2 text-right font-mono text-slate-400">
                    {s ? fmt(s.std) : "—"}
                  </td>
                  <td className="py-2 text-right font-mono text-slate-400">
                    {s ? fmt(s.min) : "—"}
                  </td>
                  <td className="py-2 text-right font-mono text-slate-400">
                    {s ? fmt(s.max) : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {aCount > 0 ? (
                      <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-red-400 font-semibold">
                        {aCount}
                      </span>
                    ) : (
                      <span className="text-emerald-500">✓</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
