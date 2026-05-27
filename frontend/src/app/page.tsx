"use client";

import { useState, useCallback, useRef } from "react";
import {
  Activity,
  Settings,
  Play,
  Pause,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { api, type DataPoint, type Anomaly, type Insight, type SensorStats, type UploadResult, type StreamPoint } from "@/lib/api";
import { useStream } from "@/hooks/useStream";
import { StatusBadge } from "@/components/StatusBadge";
import { TimeSeriesChart } from "@/components/TimeSeriesChart";
import { AnomalyPanel } from "@/components/AnomalyPanel";
import { InsightsPanel } from "@/components/InsightsPanel";
import { DataOverview } from "@/components/DataOverview";
import { UploadPanel } from "@/components/UploadPanel";
import { Notifications, type Toast } from "@/components/Notifications";

type Health = "normal" | "warning" | "critical";

const MAX_LIVE_POINTS = 300;
let toastId = 0;

export default function Home() {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [hasData, setHasData] = useState(false);
  const [sensors, setSensors] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, SensorStats>>({});
  const [allData, setAllData] = useState<DataPoint[]>([]);
  const [liveData, setLiveData] = useState<DataPoint[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [health, setHealth] = useState<Health>("normal");
  const [totalRows, setTotalRows] = useState(0);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [selectedSensor, setSelectedSensor] = useState<string>("");
  const [sensitivity, setSensitivity] = useState(0.1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [showUpload, setShowUpload] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sensitivityUpdating, setSensitivityUpdating] = useState(false);

  const sensitivityTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const addToast = useCallback((t: Omit<Toast, "id">) => {
    setToasts((prev) => [...prev, { ...t, id: ++toastId }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadDashboard = useCallback(async () => {
    const [dataRes, anomalyRes, insightRes] = await Promise.all([
      api.getData(),
      api.getAnomalies(),
      api.getInsights(),
    ]);
    setAllData(dataRes.data);
    setLiveData(dataRes.data.slice(-MAX_LIVE_POINTS));
    setSensors(dataRes.sensors);
    setStats(dataRes.stats);
    setTotalRows(dataRes.total_rows);
    setAnomalies(anomalyRes.anomalies);
    setInsights(insightRes.insights);
    setHealth(insightRes.system_health as Health);
    setSelectedSensor(dataRes.sensors[0] ?? "");
  }, []);

  // ── Upload success handler ────────────────────────────────────────────────────
  const handleUploadSuccess = useCallback(
    async (result: UploadResult) => {
      setLoading(true);
      try {
        await loadDashboard();
        setHasData(true);
        setShowUpload(false);

        // Auto-start simulation
        await api.startSimulation(1.5);
        setIsSimulating(true);
        setIsLiveMode(true);
      } finally {
        setLoading(false);
      }
    },
    [loadDashboard]
  );

  // ── Simulation controls ───────────────────────────────────────────────────────
  const toggleSimulation = useCallback(async () => {
    if (isSimulating) {
      await api.stopSimulation();
      setIsSimulating(false);
      setIsLiveMode(false);
    } else {
      await api.startSimulation(1.5);
      setIsSimulating(true);
      setIsLiveMode(true);
      setLiveData([]);
    }
  }, [isSimulating]);

  // ── SSE stream handler ────────────────────────────────────────────────────────
  const handleStreamPoint = useCallback(
    (point: StreamPoint) => {
      if (!point.sensors) return;

      const dp: DataPoint = {
        timestamp: point.timestamp,
        isAnomaly: point.is_anomaly,
        anomalyScore: point.score,
        ...point.sensors,
      };

      setLiveData((prev) => {
        const next = [...prev, dp];
        return next.length > MAX_LIVE_POINTS ? next.slice(-MAX_LIVE_POINTS) : next;
      });

      if (point.is_anomaly && point.explanation) {
        addToast({
          message: point.explanation.reason,
          sensor: point.explanation.primary_sensor ?? undefined,
          severity: point.explanation.severity,
        });
      }
    },
    [addToast]
  );

  useStream(isSimulating, handleStreamPoint);

  // ── Sensitivity slider (debounced API call) ───────────────────────────────────
  const handleSensitivityChange = useCallback(
    async (value: number) => {
      setSensitivity(value);
      if (!hasData) return;
      if (sensitivityTimeout.current) clearTimeout(sensitivityTimeout.current);
      sensitivityTimeout.current = setTimeout(async () => {
        setSensitivityUpdating(true);
        try {
          await api.updateSensitivity(value);
          await loadDashboard();
        } finally {
          setSensitivityUpdating(false);
        }
      }, 600);
    },
    [hasData, loadDashboard]
  );

  const chartData = isLiveMode ? liveData : allData;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-[#1f2937] bg-[#0f1117]/90 px-5 backdrop-blur">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-400" />
          <span className="text-base font-bold tracking-tight text-white">Lyora</span>
          <span className="hidden sm:block text-xs text-slate-500 ml-1">
            AI Infrastructure Monitor
          </span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {hasData && (
            <>
              <StatusBadge health={health} />

              {/* Sensor selector */}
              <select
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value)}
                className="rounded-lg border border-[#1f2937] bg-[#161b27] px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {sensors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {/* Simulation toggle */}
              <button
                onClick={toggleSimulation}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isSimulating
                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                }`}
              >
                {isSimulating ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Simulate
                  </>
                )}
              </button>
            </>
          )}

          {/* Upload toggle */}
          <button
            onClick={() => setShowUpload((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-[#1f2937] px-3 py-1.5 text-xs text-slate-400 hover:border-slate-600 transition-all"
          >
            <Settings className="h-3.5 w-3.5" />
            Upload
            {showUpload ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 flex flex-col gap-5">
        {/* Upload panel */}
        {showUpload && (
          <section className="animate-fade-in rounded-2xl border border-[#1f2937] bg-[#161b27] p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">
              {hasData ? "Upload New Dataset" : "Get Started — Upload Your Data"}
            </h2>
            <UploadPanel
              onSuccess={handleUploadSuccess}
              sensitivity={sensitivity}
              onSensitivityChange={handleSensitivityChange}
            />
          </section>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
            <span className="text-sm">Analyzing dataset…</span>
          </div>
        )}

        {/* Dashboard */}
        {hasData && !loading && (
          <>
            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Readings", value: totalRows.toLocaleString(), color: "text-slate-200" },
                { label: "Sensors", value: sensors.length, color: "text-blue-400" },
                {
                  label: "Anomalies",
                  value: anomalies.length,
                  color: anomalies.length > 0 ? "text-red-400" : "text-emerald-400",
                },
                {
                  label: "Anomaly Rate",
                  value: `${(anomalies.length / Math.max(totalRows, 1) * 100).toFixed(1)}%`,
                  color:
                    anomalies.length / Math.max(totalRows, 1) > 0.2
                      ? "text-red-400"
                      : anomalies.length / Math.max(totalRows, 1) > 0.1
                      ? "text-amber-400"
                      : "text-emerald-400",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-[#1f2937] bg-[#161b27] px-4 py-3"
                >
                  <p className="text-[11px] text-slate-500 mb-0.5">{stat.label}</p>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Main chart */}
            <section className="rounded-2xl border border-[#1f2937] bg-[#161b27] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">
                    Time-Series Monitor
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isLiveMode
                      ? `Live — last ${Math.min(liveData.length, MAX_LIVE_POINTS)} points`
                      : `Full dataset — ${allData.length} points`}
                    {sensitivityUpdating && (
                      <span className="ml-2 text-blue-400">Updating…</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsLiveMode((v) => !v)}
                    className={`text-[11px] rounded-lg px-2.5 py-1 border transition-colors ${
                      isLiveMode
                        ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                        : "border-[#1f2937] text-slate-500 hover:border-slate-600"
                    }`}
                  >
                    {isLiveMode ? "Live View" : "Full View"}
                  </button>
                </div>
              </div>
              {selectedSensor ? (
                <TimeSeriesChart
                  data={chartData}
                  selectedSensor={selectedSensor}
                  stats={stats}
                  isLive={isLiveMode}
                />
              ) : (
                <p className="text-sm text-slate-500 py-12 text-center">
                  Select a sensor to view
                </p>
              )}
            </section>

            {/* Bottom grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Anomaly Panel */}
              <section className="rounded-2xl border border-[#1f2937] bg-[#161b27] p-5">
                <AnomalyPanel anomalies={anomalies} />
              </section>

              {/* Insights Panel */}
              <section className="rounded-2xl border border-[#1f2937] bg-[#161b27] p-5">
                <InsightsPanel insights={insights} />
              </section>

              {/* Data Overview */}
              <section className="rounded-2xl border border-[#1f2937] bg-[#161b27] p-5">
                <DataOverview
                  sensors={sensors}
                  stats={stats}
                  anomalies={anomalies}
                  totalRows={totalRows}
                  selectedSensor={selectedSensor}
                  onSelectSensor={setSelectedSensor}
                />
              </section>
            </div>

            {/* Sensitivity (visible after upload) */}
            <section className="rounded-2xl border border-[#1f2937] bg-[#161b27] px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-400">
                      Anomaly Sensitivity
                    </label>
                    <span className="text-xs font-mono text-blue-400">
                      {(sensitivity * 100).toFixed(0)}% contamination
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.01}
                    max={0.49}
                    step={0.01}
                    value={sensitivity}
                    onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-[#1f2937] accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>Conservative (fewer alerts)</span>
                    <span>Aggressive (more alerts)</span>
                  </div>
                </div>
                {sensitivityUpdating && (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-400 shrink-0" />
                )}
              </div>
            </section>
          </>
        )}

        {/* Empty state */}
        {!hasData && !loading && !showUpload && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-slate-500">
            <Activity className="h-12 w-12 opacity-30" />
            <p className="text-sm">No data yet. Open the Upload panel to get started.</p>
            <button
              onClick={() => setShowUpload(true)}
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Open Upload Panel
            </button>
          </div>
        )}
      </main>

      {/* Toast notifications */}
      <Notifications toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
