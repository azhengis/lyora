"use client";

type Health = "normal" | "warning" | "critical";

const config: Record<
  Health,
  { label: string; dot: string; ring: string; text: string }
> = {
  normal: {
    label: "System Normal",
    dot: "bg-emerald-400",
    ring: "bg-emerald-400/20",
    text: "text-emerald-400",
  },
  warning: {
    label: "Warning",
    dot: "bg-amber-400",
    ring: "bg-amber-400/20",
    text: "text-amber-400",
  },
  critical: {
    label: "Critical",
    dot: "bg-red-500",
    ring: "bg-red-500/20",
    text: "text-red-400",
  },
};

export function StatusBadge({ health }: { health: Health }) {
  const c = config[health];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${c.ring} ${c.text}`}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${c.dot}`}
        />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
      </span>
      {c.label}
    </span>
  );
}
