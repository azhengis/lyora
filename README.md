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

---

## Local Development

### 1 — Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# (Optional) generate sample data
python generate_sample.py       # creates sample_data.csv

# Start server
uvicorn main:app --reload --port 8000
```

API is now live at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

---

### 2 — Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure backend URL
cp .env.local.example .env.local
# Edit .env.local → NEXT_PUBLIC_API_URL=http://localhost:8000

# Start dev server
npm run dev
```

Open **http://localhost:3000**

---

### 3 — Test the system locally

1. Open http://localhost:3000
2. Click **Upload & Analyze**, select `backend/sample_data.csv`
3. Adjust the sensitivity slider (default 10%)
4. Click **Upload & Analyze** — the dashboard populates automatically
5. Simulation starts: the chart updates live every 1.5 s
6. Red markers = anomalies · toast alerts appear for each new one
7. Click any row in **Data Overview** to switch the chart sensor
8. Drag the **Anomaly Sensitivity** slider to re-run the model

---

## Deployment

### Backend → Render (free tier)

1. Push the `lyora/backend` folder to a GitHub repo (or the full monorepo)
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Root directory**: `backend`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Environment**: Python 3.11
5. Click **Deploy** — Render gives you a URL like  
   `https://lyora-api.onrender.com`

> **Free tier note**: Render spins down idle services after 15 min.  
> The first request after idle takes ~30 s. Use a free cron ping (e.g. UptimeRobot) to keep it alive.

---

### Frontend → Vercel

1. Push the `lyora/frontend` folder to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your repo, set **Root Directory** to `frontend`
4. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL = https://lyora-api.onrender.com
   ```
   (use your actual Render URL)
5. Click **Deploy** — Vercel gives you a URL like  
   `https://lyora.vercel.app`

---

### Environment variables

| Variable | Where | Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel | `https://your-render-url.onrender.com` |

No backend secrets needed for the MVP.

---

### Connecting frontend ↔ backend

The frontend reads `NEXT_PUBLIC_API_URL` at build time.  
All API calls in `src/lib/api.ts` prefix with that URL.  
CORS is set to `allow_origins=["*"]` in `backend/main.py` — safe for MVP.  
For production, change this to:
```python
allow_origins=["https://lyora.vercel.app"],
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/upload?sensitivity=0.1` | Upload CSV, train model |
| `GET` | `/data?limit=2000` | Return processed data + anomaly flags |
| `GET` | `/anomalies` | All detected anomalies with explanations |
| `GET` | `/insights` | AI-generated insight cards |
| `GET` | `/stream/events` | SSE stream of live data points |
| `POST` | `/simulate/start?interval=1.5` | Start drip-feeding data |
| `POST` | `/simulate/stop` | Stop simulation |
| `GET` | `/simulate/status` | Check simulation state |
| `POST` | `/sensitivity?value=0.15` | Re-train with new sensitivity |
| `POST` | `/stream` | Push a single live data point |

---

## CSV Format

```csv
timestamp,temperature,pressure,vibration,humidity
2024-01-01 00:00:00,22.3,101.2,0.12,55.1
2024-01-01 00:01:00,22.1,101.4,-0.05,54.9
...
```

- The `timestamp` column is auto-detected (accepts: `timestamp`, `time`, `date`, `datetime`, `ts`)
- If no timestamp column is found, one is generated automatically
- All other numeric columns are treated as sensors
- Minimum 10 rows required
- Missing values are filled via linear interpolation

---

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
