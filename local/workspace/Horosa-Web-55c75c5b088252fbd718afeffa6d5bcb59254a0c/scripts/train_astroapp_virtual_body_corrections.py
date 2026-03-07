#!/usr/bin/env python3
"""Train AstroApp current-version virtual-row body correction models.

The models learn chartSubmit body deltas relative to local Horosa/Swiss bodies:
    astro_body_lon - local_body_lon
    astro_body_lat - local_body_lat

These corrections are intended only for the AstroAPP-Alchabitius virtual-point
rows (Asc / MC / North Node), leaving ordinary planet-to-planet rows untouched.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import xml.etree.ElementTree as ET
from pathlib import Path

import joblib
import numpy as np
import swisseph
from sklearn.ensemble import ExtraTreesRegressor


BODY_IDS = {
    0: swisseph.SUN,
    1: swisseph.MOON,
    2: swisseph.MERCURY,
    3: swisseph.VENUS,
    4: swisseph.MARS,
    5: swisseph.JUPITER,
    6: swisseph.SATURN,
    7: swisseph.URANUS,
    8: swisseph.NEPTUNE,
    9: swisseph.PLUTO,
    10: swisseph.TRUE_NODE,
}

BODY_NAMES = {
    0: "sun",
    1: "moon",
    2: "mercury",
    3: "venus",
    4: "mars",
    5: "jupiter",
    6: "saturn",
    7: "uranus",
    8: "neptune",
    9: "pluto",
    10: "north_node",
}


def _norm180(value: float) -> float:
    return (float(value) + 180.0) % 360.0 - 180.0


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _feature_names() -> list[str]:
    return [
        "jd_offset",
        "lon",
        "lon_sin",
        "lon_cos",
        "lat",
        "distance",
        "speed_lon",
        "speed_lat",
    ]


def _body_features(jd: float, swe_id: int) -> list[float]:
    flags = swisseph.FLG_SWIEPH | swisseph.FLG_SPEED
    calc = swisseph.calc_ut(jd, swe_id, flags)[0]
    lon, lat, distance, speed_lon, speed_lat = map(float, calc[:5])
    rad = math.radians(lon)
    return [
        float(jd) - 2460000.0,
        lon,
        math.sin(rad),
        math.cos(rad),
        lat,
        distance,
        speed_lon,
        speed_lat,
    ]


def _load_chartsubmit_bodies(case_dir: Path) -> dict[int, tuple[float, float]]:
    root = ET.parse(case_dir / "chartSubmit_response.xml").getroot()
    out: dict[int, tuple[float, float]] = {}
    for p in root.findall(".//bodies/p"):
        try:
            body_id = int(p.findtext("id", ""))
            out[body_id] = (
                float(p.findtext("lng", "nan")),
                float(p.findtext("lat", "nan")),
            )
        except Exception:
            continue
    return out


def _summary(values: list[float]) -> dict[str, float]:
    if not values:
        nan = float("nan")
        return {"mae": nan, "p95": nan, "max": nan, "ratio_le_1e4": nan}
    values = sorted(values)
    p95_idx = max(0, min(len(values) - 1, int(len(values) * 0.95) - 1))
    return {
        "mae": float(sum(values) / len(values)),
        "p95": float(values[p95_idx]),
        "max": float(values[-1]),
        "ratio_le_1e4": float(sum(1 for v in values if v <= 1e-4) / len(values)),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases-root", required=True)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--holdout-frac", type=float, default=0.2)
    ap.add_argument("--n-estimators", type=int, default=600)
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    case_dirs = sorted(Path(args.cases_root).glob("case_*"))
    body_rows: dict[int, list[tuple[str, list[float], float, float]]] = {bid: [] for bid in BODY_IDS}
    for idx, case_dir in enumerate(case_dirs, 1):
        meta = json.loads((case_dir / "meta.json").read_text(encoding="utf-8"))
        jd = float(meta["sourceJD"])
        astro_bodies = _load_chartsubmit_bodies(case_dir)
        for body_id, swe_id in BODY_IDS.items():
            astro = astro_bodies.get(body_id)
            if astro is None:
                continue
            feats = _body_features(jd, swe_id)
            lon = feats[1]
            lat = feats[4]
            body_rows[body_id].append(
                (
                    case_dir.name,
                    feats,
                    _norm180(float(astro[0]) - lon),
                    float(astro[1]) - lat,
                )
            )
        if idx % 25 == 0:
            print(json.dumps({"phase": "ingest", "cases_done": idx, "cases_total": len(case_dirs)}), flush=True)

    case_keys = [case_dir.name for case_dir in case_dirs]
    rng = random.Random(args.seed)
    rng.shuffle(case_keys)
    holdout_n = 0
    if args.holdout_frac > 0:
        holdout_n = max(1, int(round(len(case_keys) * args.holdout_frac)))
    eval_keys = set(case_keys[:holdout_n])
    train_keys = set(case_keys[holdout_n:])
    if not train_keys:
        train_keys = set(case_keys)

    summary: dict[str, object] = {
        "cases_root": str(Path(args.cases_root).resolve()),
        "seed": args.seed,
        "holdout_frac": args.holdout_frac,
        "n_estimators": args.n_estimators,
        "bodies": {},
    }

    feat_names = _feature_names()
    for body_id, rows in body_rows.items():
        if not rows:
            continue
        X_train = np.asarray([r[1] for r in rows if r[0] in train_keys], dtype=np.float32)
        y_lon_train = np.asarray([r[2] for r in rows if r[0] in train_keys], dtype=np.float32)
        y_lat_train = np.asarray([r[3] for r in rows if r[0] in train_keys], dtype=np.float32)
        X_eval = np.asarray([r[1] for r in rows if r[0] in eval_keys], dtype=np.float32)
        y_lon_eval = np.asarray([r[2] for r in rows if r[0] in eval_keys], dtype=np.float32)
        y_lat_eval = np.asarray([r[3] for r in rows if r[0] in eval_keys], dtype=np.float32)

        lon_model = ExtraTreesRegressor(
            n_estimators=args.n_estimators,
            random_state=args.seed + body_id,
            max_features=1.0,
            n_jobs=-1,
        )
        lat_model = ExtraTreesRegressor(
            n_estimators=args.n_estimators,
            random_state=args.seed + body_id + 100,
            max_features=1.0,
            n_jobs=-1,
        )
        lon_model.fit(X_train, y_lon_train)
        lat_model.fit(X_train, y_lat_train)

        lon_pred = lon_model.predict(X_eval) if len(X_eval) else np.asarray([], dtype=np.float32)
        lat_pred = lat_model.predict(X_eval) if len(X_eval) else np.asarray([], dtype=np.float32)
        lon_err = [abs(float(y) - float(p)) for y, p in zip(y_lon_eval, lon_pred)]
        lat_err = [abs(float(y) - float(p)) for y, p in zip(y_lat_eval, lat_pred)]

        payload = {
            "body_id": body_id,
            "body_name": BODY_NAMES[body_id],
            "feature_names": feat_names,
            "lon_model": lon_model,
            "lat_model": lat_model,
        }
        joblib.dump(payload, out_dir / f"astroapp_pd_virtual_body_corr_{BODY_NAMES[body_id]}_v1.joblib")

        body_summary = {
            "rows_total": len(rows),
            "train_cases": len(train_keys),
            "eval_cases": len(eval_keys),
            "lon_eval": _summary(lon_err),
            "lat_eval": _summary(lat_err),
        }
        summary["bodies"][BODY_NAMES[body_id]] = body_summary
        print(json.dumps({"phase": "fit", "body": BODY_NAMES[body_id], **body_summary}, indent=2), flush=True)

    (out_dir / "astroapp_pd_virtual_body_corr_summary_v1.json").write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
