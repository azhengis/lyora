from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


class DataProcessor:
    _TIMESTAMP_NAMES = {"timestamp", "time", "date", "datetime", "ts", "created_at"}

    def process(
        self, df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, np.ndarray, List[str], Dict[str, Dict[str, float]], List[str]]:
        errors: List[str] = []

        if df.empty:
            return df, np.array([]), [], {}, ["Dataset is empty"]
        if len(df) < 10:
            return df, np.array([]), [], {}, [f"Dataset too small ({len(df)} rows). Minimum 10 required."]

        df = df.copy()

        # --- Timestamp detection -------------------------------------------------
        ts_col: Optional[str] = None
        for col in df.columns:
            if str(col).strip().lower() in self._TIMESTAMP_NAMES:
                ts_col = col
                break

        if ts_col:
            try:
                df["timestamp"] = pd.to_datetime(df[ts_col])
                if ts_col != "timestamp":
                    df = df.drop(columns=[ts_col])
            except Exception:
                df["timestamp"] = pd.date_range("2024-01-01", periods=len(df), freq="1s")
        else:
            df["timestamp"] = pd.date_range("2024-01-01", periods=len(df), freq="1s")

        # --- Sensor column detection ---------------------------------------------
        sensor_cols = [
            c for c in df.columns
            if c != "timestamp" and pd.api.types.is_numeric_dtype(df[c])
        ]
        if not sensor_cols:
            return df, np.array([]), [], {}, ["No numeric sensor columns found in the dataset."]

        # --- Missing value imputation -------------------------------------------
        for col in sensor_cols:
            if df[col].isnull().any():
                df[col] = (
                    df[col]
                    .interpolate(method="linear")
                    .bfill()
                    .ffill()
                    .fillna(0.0)
                )

        # --- Stats (on raw values) -----------------------------------------------
        stats: Dict[str, Dict[str, float]] = {}
        for col in sensor_cols:
            std = float(df[col].std())
            stats[col] = {
                "mean": float(df[col].mean()),
                "std": std if std > 0 else 1.0,
                "min": float(df[col].min()),
                "max": float(df[col].max()),
                "median": float(df[col].median()),
            }

        # --- Z-score normalisation (for model only) -----------------------------
        raw = df[sensor_cols].values.astype(float)
        means = np.array([stats[c]["mean"] for c in sensor_cols])
        stds = np.array([stats[c]["std"] for c in sensor_cols])
        normalized = (raw - means) / stds

        return df, normalized, sensor_cols, stats, errors
