from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.ensemble import IsolationForest


class AnomalyDetector:
    def __init__(self) -> None:
        self.model: Optional[IsolationForest] = None
        self._score_min: float = -0.5
        self._score_max: float = 0.0

    def train(self, data: np.ndarray, contamination: float = 0.1) -> None:
        self.model = IsolationForest(
            n_estimators=100,
            contamination=float(contamination),
            random_state=42,
            max_samples="auto",
        )
        self.model.fit(data)
        scores = self.model.score_samples(data)
        self._score_min = float(scores.min())
        self._score_max = float(scores.max())

    def _normalize(self, raw: float) -> float:
        rng = self._score_max - self._score_min
        if rng == 0:
            return 0.0
        return float(1.0 - (raw - self._score_min) / rng)

    def predict(self, data: np.ndarray) -> Dict[str, Any]:
        if self.model is None:
            raise RuntimeError("Model not trained")
        labels_raw = self.model.predict(data)
        scores_raw = self.model.score_samples(data)
        return {
            "labels": [bool(l == -1) for l in labels_raw],
            "scores": [self._normalize(s) for s in scores_raw],
        }

    def predict_single(self, values: List[float]) -> Dict[str, Any]:
        if self.model is None:
            raise RuntimeError("Model not trained")
        arr = np.array(values, dtype=float).reshape(1, -1)
        label = int(self.model.predict(arr)[0])
        score_raw = float(self.model.score_samples(arr)[0])
        return {"is_anomaly": label == -1, "score": self._normalize(score_raw)}
