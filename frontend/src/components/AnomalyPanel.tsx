"use client";

import { AlertTriangle, Zap, TrendingDown, TrendingUp } from "lucide-react";
import type { Anomaly } from "@/lib/api";

interface Props {
  anomalies: Anomaly[];
}

const sevConfig = {
  extreme: { color: "text-red-400", bg: "bg-red-400/10 border-red-500/30", label: "Extreme" },
  significant: { color: "text-amber-400", bg: "bg-amber-400/10 border-amber-500/30", label: "Significant" },
  moderate: { color: "text-blue-400", bg: "bg-blue-400/10 border-blue-500/30", label: "Moderate" },
};

function AnomalyCard({ a }: { a: Anomaly }) {
  const sev = sevConfig[a.explanation?.severity ?? "moderate"];
  const ts = a.timestamp.slice(0, 19).replace("T", " ");
  const topSensors = Object.entries(a.explanation?.deviations ?? {}).slice(0, 3);

  return (
    <div
      className={`rounded-lg border p-3 mb-2 transition-all hover:brightness-110 ${sev.bg} animate-fade-in`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${sev.color}`} />
          <span className={`text-xs font-semibold ${sev.color}`}>{sev.label}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">{ts}</span>
      </div>

      {a.explanation?.reason && (
        <p className="mt-1.5 text-xs text-slate-300 leading-snug">
          {a.explanation.reason}
        </p>
      )}

      {topSensors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {topSensors.map(([sensor, dev]) => (
            <span
              key={sensor}
              className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300"
            >
              {sensor}
              <span className={dev > 2 ? "text-red-400" : "text-slate-400"}>
                {dev > 0 ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
              </span>
              {dev.toFixed(1)}σ
            </span>
          ))}
        </div>
      )}

      <div className="mt-1.5 text-[10px] text-slate-500">
        Score: <span className="font-mono text-slate-400">{a.score.toFixed(3)}</span>
      </div>
    </div>
  );
}

export function AnomalyPanel({ anomalies }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-red-400" />
        <h2 className="text-sm font-semibold text-slate-200">Anomalies</h2>
        {anomalies.length > 0 && (
          <span className="ml-auto rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
            {anomalies.length}
          </span>
        )}
      </div>

      {anomalies.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-500 py-8">
          <AlertTriangle className="h-8 w-8 opacity-30" />
          <p className="text-sm">No anomalies detected</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: 400 }}>
          {[...anomalies].reverse().map((a) => (
            <AnomalyCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
