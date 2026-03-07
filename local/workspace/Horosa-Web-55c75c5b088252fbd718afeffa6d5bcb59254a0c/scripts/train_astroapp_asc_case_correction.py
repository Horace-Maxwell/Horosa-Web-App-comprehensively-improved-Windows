#!/usr/bin/env python3
"""Train the AstroApp Asc chart-level correction model.

The model predicts the shared signed Asc residual for one natal chart:
    local Asc arc - AstroApp Asc arc

It is trained from existing virtual-kernel evaluation CSVs so we can keep the
runtime correction deterministic and isolated to the Asc branch only.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from collections import defaultdict
from pathlib import Path

import joblib
import numpy as np
import swisseph
from sklearn.ensemble import ExtraTreesRegressor


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _code_root() -> Path:
    root = _repo_root()
    nested = root / "Horosa-Web"
    return nested if nested.is_dir() else root


def _ensure_import_paths() -> None:
    code_root = _code_root()
    import sys

    astropy_root = code_root / "astropy"
    flatlib_root = code_root / "flatlib-ctrad2"
    for p in [astropy_root, flatlib_root]:
        if str(p) not in sys.path:
            sys.path.insert(0, str(p))


_ensure_import_paths()

from astrostudy.perchart import PerChart  # noqa: E402
from flatlib.predictives.primarydirections import PrimaryDirections  # noqa: E402
from flatlib import const  # noqa: E402


def _parse_coord(value: str | float) -> float:
    text = str(value or "").strip().upper()
    match = re.fullmatch(r"(\d+)([NSEW])(\d+)", text)
    if match:
        deg = float(match.group(1))
        minutes = float(match.group(3))
        coord = deg + minutes / 60.0
        if match.group(2) in ["S", "W"]:
            coord = -coord
        return coord

    try:
        return float(value)
    except Exception:
        return 0.0


def _jd_to_utc_date_time_exact(jd: float) -> tuple[str, float]:
    y, m, d, ut = swisseph.revjul(jd, swisseph.GREG_CAL)
    return f"{y:04d}/{m:02d}/{d:02d}", float(ut)


def _load_case_mean_residuals(rows_csv: Path, model_name: str) -> dict[str, float]:
    acc: dict[str, list[float]] = defaultdict(list)
    with rows_csv.open("r", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("model") != model_name or row.get("significator") != "Asc":
                continue
            try:
                signed_err = float(row["local_arc"]) - float(row["astro_arc"])
            except Exception:
                continue
            acc[row["case"]].append(signed_err)
    return {case: sum(vals) / len(vals) for case, vals in acc.items() if vals}


def _build_case_features(case_dir: Path) -> list[float]:
    meta = json.loads((case_dir / "meta.json").read_text(encoding="utf-8"))
    jd = float(meta["sourceJD"])
    jd_offset = jd - 2460000.0
    date_str, time_float = _jd_to_utc_date_time_exact(jd)
    payload = {
        "date": date_str,
        "time": time_float,
        "zone": "+00:00",
        "lat": meta["birth_lat"],
        "lon": meta["birth_long"],
        "hsys": 1,
        "zodiacal": 0,
        "tradition": False,
        "predictive": True,
        "pdtype": 0,
        "pdkey": 0,
        "pdmethod": 0,
        "pdaspect": "0,60,90,120,180",
    }
    perchart = PerChart(payload)
    chart = perchart.getChart()
    PrimaryDirections(chart)  # keep parity with runtime chart build
    ecl_nut = swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0]

    lat = _parse_coord(meta["birth_lat"])
    lon = _parse_coord(meta["birth_long"])
    abs_lat = abs(lat)
    abs_lon = abs(lon)
    asc = chart.get(const.ASC)
    mc = chart.get(const.MC)
    sun = chart.get(const.SUN)
    moon = chart.get(const.MOON)

    angle_values = [
        float(asc.lon),
        float(mc.lon),
        float(asc.ra),
        float(mc.ra),
        float(sun.lon),
        float(moon.lon),
    ]
    feats: list[float] = [
        jd_offset,
        lat,
        lon,
        abs_lat,
        abs_lon,
        float(ecl_nut[0]),
        float(ecl_nut[1]),
        float(ecl_nut[2]),
        float(ecl_nut[3]),
    ]
    for value in angle_values:
        rad = math.radians(value)
        feats.extend([value, math.sin(rad), math.cos(rad)])
    feats.extend(
        [
            abs_lat * math.sin(math.radians(float(sun.lon))),
            abs_lat * math.cos(math.radians(float(sun.lon))),
            abs_lat * math.sin(math.radians(float(mc.ra))),
            abs_lat * math.cos(math.radians(float(mc.ra))),
        ]
    )
    return feats


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", action="append", required=True, help="Format: <rows_csv>:<cases_root>")
    ap.add_argument("--model-name", default="asc_current_moon_truepos_obshift")
    ap.add_argument("--out-model", required=True)
    ap.add_argument("--out-meta", required=True)
    args = ap.parse_args()

    X: list[list[float]] = []
    y: list[float] = []
    sources: list[dict[str, str]] = []
    for dataset in args.dataset:
        rows_csv_str, cases_root_str = dataset.split(":", 1)
        rows_csv = (_repo_root() / rows_csv_str).resolve()
        cases_root = (_repo_root() / cases_root_str).resolve()
        residuals = _load_case_mean_residuals(rows_csv, args.model_name)
        for case_dir in sorted(cases_root.glob("case_*")):
            case = case_dir.name
            if case not in residuals:
                continue
            X.append(_build_case_features(case_dir))
            y.append(float(residuals[case]))
        sources.append({"rows_csv": str(rows_csv), "cases_root": str(cases_root)})

    X_arr = np.asarray(X, dtype=np.float32)
    y_arr = np.asarray(y, dtype=np.float32)
    if not np.isfinite(X_arr).all() or not np.isfinite(y_arr).all():
        raise ValueError("Training data contains non-finite values")

    model = ExtraTreesRegressor(
        n_estimators=600,
        min_samples_leaf=1,
        max_features=1.0,
        random_state=42,
    )
    model.fit(X_arr, y_arr)

    out_model = Path(args.out_model)
    out_model.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_model)

    preds = model.predict(X_arr)
    mae = sum(abs(float(yy) - float(pp)) for yy, pp in zip(y_arr, preds)) / len(y_arr)
    meta = {
        "model_name": args.model_name,
        "samples": len(y_arr),
        "features": int(X_arr.shape[1]) if len(X_arr) else 0,
        "train_case_mae": mae,
        "sources": sources,
        "params": {
            "estimator": "ExtraTreesRegressor",
            "n_estimators": 600,
            "min_samples_leaf": 1,
            "max_features": 1.0,
            "random_state": 42,
        },
    }
    out_meta = Path(args.out_meta)
    out_meta.parent.mkdir(parents=True, exist_ok=True)
    out_meta.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
