# Lyora — AI Infrastructure Monitoring Platform

Adaptive anomaly detection for any time-series sensor data.  
Upload a CSV (or push a live stream), get real-time AI-powered anomaly detection, explanations, and an interactive dark dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 · Recharts · Tailwind · Vercel)       │
│  - Upload panel with drag-drop                              │
│  - Live time-series chart (SSE stream)                      │
│  - Anomaly panel with explanations                          │
│  - AI Insights cards                                        │
│  - Sensitivity slider (re-trains model on-the-fly)          │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST + SSE
┌───────────────────────────▼─────────────────────────────────┐
│  Backend (FastAPI · uvicorn · Render)                        │
│  - POST /upload       CSV ingestion + model training        │
│  - GET  /data         Processed data + anomaly flags        │
│  - GET  /anomalies    Anomaly list with explanations        │
│  - GET  /insights     AI-generated summaries                │
│  - GET  /stream/events SSE live stream                      │
│  - POST /simulate/start  Drip-feed data at interval         │
│  - POST /sensitivity  Re-train with new contamination %     │
│                                                             │
│  ML: Isolation Forest (sklearn)                             │
│  Explainability: z-score deviation per sensor               │
└─────────────────────────────────────────────────────────────┘
```





## ML Details

**Algorithm**: Isolation Forest (scikit-learn)
- `n_estimators=100`, `random_state=42`
- `contamination` = sensitivity slider value (default 10%)
- Input: z-score normalized sensor values
- Output: anomaly label + anomaly score (0–1, higher = more anomalous)

**Explainability**:
- For each anomaly: find sensor with highest z-score deviation
- Compute: actual value, baseline (mean), direction (spike/drop), σ deviation
- Classify severity: moderate (1–2σ), significant (2–3σ), extreme (>3σ)

**Insights generated**:
- Overall anomaly rate + health classification
- Most affected sensor
- Extreme anomaly count
- Multi-sensor correlation patterns

---

## Project Structure

```
lyora/
├── backend/
│   ├── main.py                    FastAPI app + all endpoints
│   ├── models/
│   │   └── anomaly_detector.py    Isolation Forest wrapper
│   ├── services/
│   │   ├── data_processor.py      CSV parsing + normalization
│   │   └── explainer.py           Anomaly explanation + insights
│   ├── generate_sample.py         Sample CSV generator
│   ├── requirements.txt
│   └── render.yaml                Render deploy config
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx            Main dashboard (state + layout)
    │   │   └── globals.css
    │   ├── components/
    │   │   ├── TimeSeriesChart.tsx Recharts line chart + anomaly dots
    │   │   ├── AnomalyPanel.tsx    Anomaly list with explanations
    │   │   ├── InsightsPanel.tsx   AI insight cards
    │   │   ├── DataOverview.tsx    Sensor stats table
    │   │   ├── UploadPanel.tsx     Drag-drop upload
    │   │   ├── StatusBadge.tsx     Health indicator
    │   │   └── Notifications.tsx   Toast alerts
    │   ├── hooks/
    │   │   └── useStream.ts        EventSource SSE hook
    │   └── lib/
    │       └── api.ts              Typed API client
    ├── package.json
    ├── tailwind.config.ts
    ├── next.config.ts
    └── vercel.json
```
