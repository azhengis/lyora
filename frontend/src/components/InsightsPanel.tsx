"use client";

import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  TrendingUp,
  Cpu,
} from "lucide-react";
import type { Insight } from "@/lib/api";

interface Props {
  insights: Insight[];
}

const sevStyle = {
  info: {
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    icon: "text-blue-400",
    title: "text-blue-300",
    Icon: CheckCircle2,
  },
  warning: {
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
    icon: "text-amber-400",
    title: "text-amber-300",
    Icon: AlertTriangle,
  },
  critical: {
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    icon: "text-red-400",
    title: "text-red-300",
    Icon: XOctagon,
  },
};

const typeIcon: Record<string, React.ElementType> = {
  trend: TrendingUp,
  sensor: Cpu,
};

function InsightCard({ insight }: { insight: Insight }) {
  const s = sevStyle[insight.severity];
  const OverrideIcon = typeIcon[insight.type];
  const IconComp = OverrideIcon ?? s.Icon;

  return (
    <div
      className={`rounded-lg border p-3.5 mb-2 ${s.border} ${s.bg} animate-fade-in`}
    >
      <div className="flex items-start gap-2">
        <IconComp className={`mt-0.5 h-4 w-4 shrink-0 ${s.icon}`} />
        <div>
          <p className={`text-sm font-semibold ${s.title}`}>{insight.title}</p>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            {insight.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function InsightsPanel({ insights }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="h-4 w-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-slate-200">AI Insights</h2>
      </div>

      {insights.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-500 py-8">
          <Brain className="h-8 w-8 opacity-30" />
          <p className="text-sm">Upload data to generate insights</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: 400 }}>
          {insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
