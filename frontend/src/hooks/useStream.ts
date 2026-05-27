"use client";

import { useEffect, useRef } from "react";
import { API_BASE, type StreamPoint } from "@/lib/api";

export function useStream(
  enabled: boolean,
  onData: (point: StreamPoint) => void
): void {
  // Use a ref so the callback is always fresh without re-opening EventSource
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  useEffect(() => {
    if (!enabled) return;

    const es = new EventSource(`${API_BASE}/stream/events`);

    es.onmessage = (e: MessageEvent) => {
      try {
        const point: StreamPoint = JSON.parse(e.data as string);
        if (!point.heartbeat) onDataRef.current(point);
      } catch {
        /* ignore malformed frames */
      }
    };

    es.onerror = () => {
      // Reconnection is handled automatically by EventSource
    };

    return () => es.close();
  }, [enabled]);
}
