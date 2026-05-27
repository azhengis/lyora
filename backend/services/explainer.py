from __future__ import annotations

from typing import Any, Dict, List


class Explainer:
    """Turns numeric anomaly signals into human-readable explanations."""

    def explain(
        self,
        norm_values: Dict[str, float],
        stats: Dict[str, Dict[str, float]],
        sensor_cols: List[str],
        anomaly_score: float,
    ) -> Dict[str, Any]:
        if not norm_values or not stats:
            return {
                "primary_sensor": None,
                "reason": "Anomaly detected by model.",
                "severity": "moderate",
                "deviations": {},
                "anomaly_score": round(float(anomaly_score), 3),
            }

        deviations = {c: abs(float(norm_values.get(c, 0))) for c in sensor_cols}
        primary = max(deviations, key=deviations.get)
        z = float(norm_values.get(primary, 0))
        abs_z = abs(z)

        s = stats.get(primary, {})
        actual = z * s.get("std", 1.0) + s.get("mean", 0.0)
        baseline = s.get("mean", 0.0)

        severity = "extreme" if abs_z > 3 else "significant" if abs_z > 2 else "moderate"
        direction = "spike" if z > 0 else "drop"

        reason = (
            f"Unusual {direction} in {primary}: value ({actual:.2f}) is "
            f"{abs_z:.1f}σ from the baseline ({baseline:.2f})"
        )

        sorted_devs = dict(
            sorted(deviations.items(), key=lambda kv: kv[1], reverse=True)
        )

        return {
            "primary_sensor": primary,
            "reason": reason,
            "severity": severity,
            "deviations": {k: round(v, 3) for k, v in sorted_devs.items()},
            "anomaly_score": round(float(anomaly_score), 3),
        }

    def generate_insights(
        self,
        anomalies: List[Dict],
        sensor_cols: List[str],
        stats: Dict,
        total_points: int,
    ) -> List[Dict[str, Any]]:
        if not anomalies:
            return [
                {
                    "type": "summary",
                    "title": "All Systems Normal",
                    "description": (
                        "No anomalies detected. All sensors are operating "
                        "within normal parameters."
                    ),
                    "severity": "info",
                }
            ]

        insights: List[Dict[str, Any]] = []
        rate = len(anomalies) / max(total_points, 1) * 100
        health_sev = "critical" if rate > 20 else "warning" if rate > 10 else "info"

        insights.append(
            {
                "type": "summary",
                "title": f"{rate:.1f}% Anomaly Rate",
                "description": (
                    f"Detected {len(anomalies)} anomalous readings out of "
                    f"{total_points} total data points."
                ),
                "severity": health_sev,
            }
        )

        sensor_hits: Dict[str, int] = {}
        for a in anomalies:
            ps = a.get("explanation", {}).get("primary_sensor")
            if ps:
                sensor_hits[ps] = sensor_hits.get(ps, 0) + 1

        if sensor_hits:
            top = max(sensor_hits, key=sensor_hits.get)
            cnt = sensor_hits[top]
            insights.append(
                {
                    "type": "sensor",
                    "title": f"Most Affected: {top}",
                    "description": (
                        f"{top} is the primary driver in {cnt} anomalies "
                        f"({cnt / len(anomalies) * 100:.0f}% of all detected events). "
                        "Consider inspecting this sensor or its upstream data source."
                    ),
                    "severity": "warning",
                    "sensor": top,
                }
            )

        extreme = [
            a for a in anomalies
            if a.get("explanation", {}).get("severity") == "extreme"
        ]
        if extreme:
            insights.append(
                {
                    "type": "alert",
                    "title": f"{len(extreme)} Extreme Anomalies",
                    "description": (
                        f"These events exceed 3σ from baseline and may indicate "
                        "critical system failures or sensor malfunctions requiring "
                        "immediate attention."
                    ),
                    "severity": "critical",
                }
            )

        if len(sensor_hits) > 1:
            insights.append(
                {
                    "type": "trend",
                    "title": "Multi-Sensor Event",
                    "description": (
                        f"Anomalies span {len(sensor_hits)} sensors "
                        f"({', '.join(list(sensor_hits.keys())[:3])}). "
                        "Correlated deviations may indicate a systemic issue."
                    ),
                    "severity": "warning",
                }
            )
        elif len(anomalies) >= 5:
            sname = list(sensor_hits.keys())[0] if sensor_hits else sensor_cols[0]
            insights.append(
                {
                    "type": "trend",
                    "title": "Concentrated Pattern",
                    "description": (
                        f"Anomalies are concentrated in {sname}. "
                        "Check for calibration drift or input noise."
                    ),
                    "severity": "info",
                }
            )

        return insights
