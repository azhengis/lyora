"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export interface Toast {
  id: number;
  message: string;
  sensor?: string;
  severity: "moderate" | "significant" | "extreme";
}

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const sevColor = {
  moderate: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  significant: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  extreme: "border-red-500/40 bg-red-500/10 text-red-300",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`toast-enter flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-xl max-w-sm pointer-events-auto ${
        sevColor[toast.severity]
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">Anomaly Detected</p>
        <p className="text-[11px] mt-0.5 leading-snug opacity-90">{toast.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Notifications({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.slice(-4).map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
