export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SensorStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
}

export interface DataPoint {
  timestamp: string;
  isAnomaly: boolean;
  anomalyScore: number;
  [sensor: string]: string | number | boolean;
}

export interface AnomalyExplanation {
  primary_sensor: string | null;
  reason: string;
  severity: "moderate" | "significant" | "extreme";
  deviations: Record<string, number>;
  anomaly_score: number;
}

export interface Anomaly {
  id: number;
  timestamp: string;
  sensors: Record<string, number>;
  score: number;
  explanation: AnomalyExplanation;
}

export interface Insight {
  type: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  sensor?: string;
}

export interface UploadResult {
  success: boolean;
  rows: number;
  sensors: string[];
  anomaly_count: number;
  stats: Record<string, SensorStats>;
}

export interface DataResponse {
  data: DataPoint[];
  sensors: string[];
  stats: Record<string, SensorStats>;
  total_rows: number;
}

export interface AnomaliesResponse {
  anomalies: Anomaly[];
  count: number;
  total: number;
}

export interface InsightsResponse {
  insights: Insight[];
  system_health: "normal" | "warning" | "critical";
  anomaly_rate: number;
}

export interface StreamPoint {
  timestamp: string;
  sensors: Record<string, number>;
  is_anomaly: boolean;
  score: number;
  index?: number;
  explanation?: AnomalyExplanation;
  heartbeat?: boolean;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.detail?.errors?.join(", ") ?? body?.detail ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  health: () => request<{ status: string }>("/health"),

  upload: (file: File, sensitivity: number): Promise<UploadResult> => {
    const form = new FormData();
    form.append("file", file);
    return request<UploadResult>(
      `/upload?sensitivity=${sensitivity}`,
      { method: "POST", body: form }
    );
  },

  getData: (limit = 2000): Promise<DataResponse> =>
    request<DataResponse>(`/data?limit=${limit}`),

  getAnomalies: (): Promise<AnomaliesResponse> =>
    request<AnomaliesResponse>("/anomalies"),

  getInsights: (): Promise<InsightsResponse> =>
    request<InsightsResponse>("/insights"),

  startSimulation: (interval = 1.5): Promise<{ message: string }> =>
    request<{ message: string }>(
      `/simulate/start?interval=${interval}`,
      { method: "POST" }
    ),

  stopSimulation: (): Promise<{ message: string }> =>
    request<{ message: string }>("/simulate/stop", { method: "POST" }),

  updateSensitivity: (value: number) =>
    request<{ anomaly_count: number; sensitivity: number; system_health: string }>(
      `/sensitivity?value=${value}`,
      { method: "POST" }
    ),
};
