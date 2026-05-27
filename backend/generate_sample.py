"""
Run this to generate a sample dataset for testing:
  python generate_sample.py
Produces: sample_data.csv
"""
import pandas as pd
import numpy as np

rng = np.random.default_rng(42)
n = 500
t = pd.date_range("2024-01-01", periods=n, freq="1min")

temperature  = 22 + rng.normal(0, 0.5, n)
pressure     = 101.3 + rng.normal(0, 0.2, n)
vibration    = rng.normal(0, 1, n)
humidity     = 55 + rng.normal(0, 2, n)

# Inject anomalies
for idx in [50, 120, 200, 310, 410, 450]:
    temperature[idx] += rng.choice([-1, 1]) * rng.uniform(6, 12)
    pressure[idx]    += rng.choice([-1, 1]) * rng.uniform(3, 6)
    vibration[idx]   += rng.choice([-1, 1]) * rng.uniform(5, 10)

df = pd.DataFrame({
    "timestamp": t,
    "temperature": temperature.round(3),
    "pressure": pressure.round(3),
    "vibration": vibration.round(3),
    "humidity": humidity.round(3),
})

df.to_csv("sample_data.csv", index=False)
print(f"Generated sample_data.csv  ({n} rows, 4 sensors, ~6 injected anomalies)")
