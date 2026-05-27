from __future__ import annotations

import asyncio
import io
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models.anomaly_detector import AnomalyDetector
from services.data_processor import DataProcessor
from services.explainer import Explainer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Lyora API",
    version="1.0.0",
    description="AI-powered infrastructure monitoring platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global application state (in-memory for MVP)
# ---------------------------------------------------------------------------
class _State:
    def __init__(self) -> None:
        self.data_df: Optional[pd.DataFrame] = None
        self.normalized: Optional[np.ndarray] = None
        self.sensor_cols: List[str] = []
        self.stats: Dict[str, Dict[str, float]] = {}
        self.anomaly_results: List[Dict[str, Any]] = []
        self.insights: List[Dict[str, Any]] = []
        self.sensitivity: float = 0.1
        self.sim_index: int = 0
        self.is_simulating: bool = False
        self.stream_clients: List[asyncio.Queue] = []
        self.detector = AnomalyDetector()
        self.processor = DataProcessor()
        self.explainer = Explainer()


S = _State()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _run_detection() -> List[Dict[str, Any]]:
    assert S.normalized is not None and S.data_df is not None
    results = S.detector.predict(S.normalized)
    anomalies: List[Dict[str, Any]] = []
    for i, (is_anom, score) in enumerate(zip(results["labels"], results["scores"])):
        if not is_anom:
            continue
        row = S.data_df.iloc[i]
        raw_vals = {c: float(row[c]) for c in S.sensor_cols}
        norm_vals = {
            c: float(S.normalized[i, j]) for j, c in enumerate(S.sensor_cols)
        }
        explanation = S.explainer.explain(norm_vals, S.stats, S.sensor_cols, score)
        anomalies.append(
            {
                "id": i,
                "timestamp": str(row["timestamp"]),
                "sensors": raw_vals,
                "score": round(float(score), 4),
                "explanation": explanation,
            }
        )
    return anomalies


def _system_health() -> str:
    if S.data_df is None or len(S.data_df) == 0:
        return "normal"
    rate = len(S.anomaly_results) / len(S.data_df)
    if rate > 0.20:
        return "critical"
    if rate > 0.10:
        return "warning"
    return "normal"


async def _broadcast(data: Dict[str, Any]) -> None:
    dead: List[asyncio.Queue] = []
    for q in list(S.stream_clients):
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        if q in S.stream_clients:
            S.stream_clients.remove(q)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post("/upload")
async def upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    sensitivity: float = Query(0.1, ge=0.01, le=0.49),
) -> Dict[str, Any]:
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported.")

    contents = await file.read()
    try:
        df_raw = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(422, f"Cannot parse CSV: {exc}")

    data_df, normalized, sensor_cols, stats, errors = S.processor.process(df_raw)

    if errors:
        raise HTTPException(422, {"errors": errors})

    # Stop any running simulation before replacing state
    S.is_simulating = False
    await asyncio.sleep(0.15)

    S.data_df = data_df
    S.normalized = normalized
    S.sensor_cols = sensor_cols
    S.stats = stats
    S.sensitivity = sensitivity
    S.sim_index = 0

    S.detector.train(normalized, contamination=sensitivity)
    S.anomaly_results = _run_detection()
    S.insights = S.explainer.generate_insights(
        S.anomaly_results, sensor_cols, stats, len(data_df)
    )

    logger.info(
        "Uploaded %d rows, %d sensors, %d anomalies",
        len(data_df),
        len(sensor_cols),
        len(S.anomaly_results),
    )

    return {
        "success": True,
        "rows": len(data_df),
        "sensors": sensor_cols,
        "anomaly_count": len(S.anomaly_results),
        "stats": stats,
    }


@app.get("/data")
async def get_data(limit: int = Query(2000, le=10000)) -> Dict[str, Any]:
    if S.data_df is None:
        raise HTTPException(404, "No data uploaded yet.")

    df = S.data_df.head(limit).copy()
    df["timestamp"] = df["timestamp"].astype(str)

    anomaly_map = {a["id"]: a["score"] for a in S.anomaly_results}
    anomaly_ids = set(anomaly_map)
    df["isAnomaly"] = [i in anomaly_ids for i in range(len(df))]
    df["anomalyScore"] = [round(anomaly_map.get(i, 0.0), 4) for i in range(len(df))]

    return {
        "data": df.to_dict(orient="records"),
        "sensors": S.sensor_cols,
        "stats": S.stats,
        "total_rows": len(S.data_df),
    }


@app.get("/anomalies")
async def get_anomalies() -> Dict[str, Any]:
    return {
        "anomalies": S.anomaly_results,
        "count": len(S.anomaly_results),
        "total": len(S.data_df) if S.data_df is not None else 0,
    }


@app.get("/insights")
async def get_insights() -> Dict[str, Any]:
    total = len(S.data_df) if S.data_df is not None else 1
    return {
        "insights": S.insights,
        "system_health": _system_health(),
        "anomaly_rate": len(S.anomaly_results) / max(total, 1),
    }


@app.post("/stream")
async def receive_stream(payload: Dict[str, Any]) -> Dict[str, Any]:
    if S.detector.model is None:
        raise HTTPException(400, "No model trained. Upload data first.")
    norm_vals_list = [
        (float(payload.get(c, 0)) - S.stats[c]["mean"]) / S.stats[c]["std"]
        for c in S.sensor_cols
    ]
    result = S.detector.predict_single(norm_vals_list)
    point: Dict[str, Any] = {
        "timestamp": payload.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "sensors": {c: payload.get(c, 0) for c in S.sensor_cols},
        "is_anomaly": result["is_anomaly"],
        "score": result["score"],
    }
    if result["is_anomaly"]:
        norm_map = {c: norm_vals_list[j] for j, c in enumerate(S.sensor_cols)}
        point["explanation"] = S.explainer.explain(
            norm_map, S.stats, S.sensor_cols, result["score"]
        )
    await _broadcast(point)
    return point


@app.get("/stream/events")
async def stream_events() -> StreamingResponse:
    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    S.stream_clients.append(queue)

    async def generator():
        try:
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'heartbeat': True})}\n\n"
        finally:
            if queue in S.stream_clients:
                S.stream_clients.remove(queue)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/simulate/start")
async def start_simulation(
    background_tasks: BackgroundTasks,
    interval: float = Query(1.5, ge=0.3, le=5.0),
) -> Dict[str, Any]:
    if S.data_df is None:
        raise HTTPException(400, "Upload data first.")
    if S.is_simulating:
        return {"message": "Simulation already running."}
    S.is_simulating = True
    S.sim_index = 0
    background_tasks.add_task(_simulation_loop, interval)
    return {"message": "Simulation started.", "interval": interval}


@app.post("/simulate/stop")
async def stop_simulation() -> Dict[str, str]:
    S.is_simulating = False
    return {"message": "Simulation stopped."}


@app.get("/simulate/status")
async def simulation_status() -> Dict[str, Any]:
    return {
        "is_running": S.is_simulating,
        "current_index": S.sim_index,
        "total_rows": len(S.data_df) if S.data_df is not None else 0,
    }


@app.post("/sensitivity")
async def update_sensitivity(
    value: float = Query(..., ge=0.01, le=0.49),
) -> Dict[str, Any]:
    if S.data_df is None:
        raise HTTPException(400, "No data loaded.")
    S.sensitivity = value
    S.detector.train(S.normalized, contamination=value)
    S.anomaly_results = _run_detection()
    S.insights = S.explainer.generate_insights(
        S.anomaly_results, S.sensor_cols, S.stats, len(S.data_df)
    )
    return {
        "anomaly_count": len(S.anomaly_results),
        "sensitivity": value,
        "system_health": _system_health(),
    }


# ---------------------------------------------------------------------------
# Background simulation task
# ---------------------------------------------------------------------------
async def _simulation_loop(interval: float) -> None:
    assert S.data_df is not None and S.normalized is not None
    n = len(S.data_df)
    while S.is_simulating:
        i = S.sim_index % n
        row = S.data_df.iloc[i]
        raw_vals = {c: float(row[c]) for c in S.sensor_cols}
        norm_list = [float(S.normalized[i, j]) for j, _ in enumerate(S.sensor_cols)]
        result = S.detector.predict_single(norm_list)

        point: Dict[str, Any] = {
            "timestamp": str(row["timestamp"]),
            "sensors": raw_vals,
            "is_anomaly": result["is_anomaly"],
            "score": round(result["score"], 4),
            "index": i,
        }
        if result["is_anomaly"]:
            norm_map = {c: norm_list[j] for j, c in enumerate(S.sensor_cols)}
            point["explanation"] = S.explainer.explain(
                norm_map, S.stats, S.sensor_cols, result["score"]
            )

        await _broadcast(point)
        S.sim_index = (S.sim_index + 1) % n
        await asyncio.sleep(interval)

    S.is_simulating = False
