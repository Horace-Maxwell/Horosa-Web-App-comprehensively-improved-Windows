#!/usr/bin/env python3
"""Duplicate-aware validation: local Horosa PD rows vs AstroApp dirs.csv.

Matches rows on the same logical key:
    (promissor_id, significator_id, canonical_aspect)

Within each key bucket, rows are paired by nearest arc so repeated keys are
preserved instead of overwritten.

AstroApp uses signed aspect keys for ordinary object significators, but its
virtual-point significators (`Asc`, `MC`, current `sID=28`) are bucketed by
absolute aspect only. The comparison key mirrors that behavior.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import random
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import swisseph


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _code_root() -> Path:
    root = _repo_root()
    nested = root / "Horosa-Web"
    return nested if nested.is_dir() else root


def _fs_path(path: Path) -> Path:
    resolved = path.resolve(strict=False)
    if os.name != "nt":
        return resolved
    value = str(resolved)
    if value.startswith("\\\\?\\"):
        return Path(value)
    if value.startswith("\\\\"):
        return Path("\\\\?\\UNC\\" + value.lstrip("\\"))
    if len(value) >= 240:
        return Path("\\\\?\\" + value)
    return resolved


def _read_text(path: Path) -> str:
    return _fs_path(path).read_text(encoding="utf-8")


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
from astrostudy.signasctime import SignAscTime  # noqa: E402
from flatlib import const  # noqa: E402


OBJ2ID = {
    "Sun": 0,
    "Moon": 1,
    "Mercury": 2,
    "Venus": 3,
    "Mars": 4,
    "Jupiter": 5,
    "Saturn": 6,
    "Uranus": 7,
    "Neptune": 8,
    "Pluto": 9,
    "North Node": 10,
    "South Node": 23,
    "Asc": 24,
    "MC": 25,
    "Pars Fortuna": 28,
}

ID2NAME = {v: k for k, v in OBJ2ID.items()}
ABS_ASPECT_SIG_IDS = {24, 25, 28}
SHARED_CORE_PROM_IDS = set(range(0, 11))
SHARED_CORE_SIG_IDS = set(range(0, 11)) | {24, 25}


def _as_float(x: Any, default: float = float("nan")) -> float:
    try:
        return float(x)
    except Exception:
        return default


def _norm_asp(x: float) -> float:
    if not math.isfinite(x):
        return x
    r = round(x)
    if abs(x - r) < 1e-9:
        x = float(r)
    else:
        x = float(x)
    if abs(abs(x) - 180.0) < 1e-9:
        return 180.0
    if abs(x) < 1e-9:
        return 0.0
    return x


def _canon_asp(sig_id: int, asp: float) -> float:
    asp = _norm_asp(asp)
    if sig_id in ABS_ASPECT_SIG_IDS:
        return abs(asp)
    return asp


def _in_scope(p_id: int, s_id: int, planet_only: bool, shared_core_only: bool) -> bool:
    if shared_core_only:
        return p_id in SHARED_CORE_PROM_IDS and s_id in SHARED_CORE_SIG_IDS
    if planet_only:
        return p_id in range(0, 10) and s_id in range(0, 10)
    return True


def _jd_to_utc_date_time(jd: float) -> tuple[str, str]:
    y, m, d, ut = swisseph.revjul(jd, swisseph.GREG_CAL)
    # Keep seconds truncated to match the stored sourceJD encoding.
    hh = int(ut)
    mm = int((ut - hh) * 60.0)
    ss = int((((ut - hh) * 60.0) - mm) * 60.0)
    return f"{y:04d}/{m:02d}/{d:02d}", f"{hh:02d}:{mm:02d}:{ss:02d}"


def _jd_to_utc_date_time_exact(jd: float) -> tuple[str, float]:
    y, m, d, ut = swisseph.revjul(jd, swisseph.GREG_CAL)
    return f"{y:04d}/{m:02d}/{d:02d}", float(ut)


def _load_csv(path: Path) -> list[dict[str, str]]:
    with _fs_path(path).open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _parse_prom_key(prom: str) -> tuple[int, float] | None:
    parts = str(prom or "").split("_")
    if len(parts) < 3:
        return None
    kind = parts[0]
    obj = "_".join(parts[1:-1]).strip()
    asp = _as_float(parts[-1])
    if obj not in OBJ2ID or not math.isfinite(asp):
        return None
    p_id = OBJ2ID[obj]
    if kind == "D":
        asp = -abs(asp)
    elif kind == "S":
        asp = abs(asp)
    elif kind == "N":
        asp = float(asp)
    else:
        return None
    return p_id, _norm_asp(asp)


def _parse_sig_key(sig: str) -> int | None:
    parts = str(sig or "").split("_")
    if len(parts) < 3:
        return None
    kind = parts[0]
    obj = "_".join(parts[1:-1]).strip()
    asp = _as_float(parts[-1])
    if kind != "N" or not math.isfinite(asp) or abs(asp) > 1e-9:
        return None
    return OBJ2ID.get(obj)


def _astro_key(row: dict[str, str]) -> tuple[int, int, float] | None:
    try:
        p_id = int(float(row["pID"]))
        s_id = int(float(row["sID"]))
        asp = _canon_asp(s_id, float(row["asp"]))
    except Exception:
        return None
    return p_id, s_id, asp


def _pair_by_nearest_arc(
    astro_rows: list[dict[str, Any]],
    local_rows: list[dict[str, Any]],
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    astro_pool = list(astro_rows)
    local_pool = list(local_rows)
    pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    while astro_pool and local_pool:
        best = None
        best_pair = None
        for ai, astro in enumerate(astro_pool):
            for li, local in enumerate(local_pool):
                err = abs(local["arc"] - astro["arc"])
                tie = (err, abs(astro["arc"]), astro["arc"], abs(local["arc"]), local["arc"])
                if best is None or tie < best:
                    best = tie
                    best_pair = (ai, li)
        ai, li = best_pair
        pairs.append((astro_pool.pop(ai), local_pool.pop(li)))
    return pairs


@dataclass
class Summary:
    cases: int
    rows_astro: int
    rows_local: int
    rows_matched: int
    arc_mae: float
    arc_median: float
    arc_p95: float
    arc_max: float
    date_mae_days: float
    date_median_days: float
    date_p95_days: float
    date_max_days: float


def _summary(vals: list[float]) -> tuple[float, float, float, float]:
    if not vals:
        nan = float("nan")
        return nan, nan, nan, nan
    s = sorted(vals)
    p95_idx = max(0, min(len(s) - 1, int(len(s) * 0.95) - 1))
    return float(statistics.mean(vals)), float(statistics.median(vals)), float(s[p95_idx]), float(max(s))


def compare_case(
    case_dir: Path,
    mode: str,
    planet_only: bool,
    shared_core_only: bool,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    meta = json.loads(_read_text(case_dir / "meta.json"))
    astro_rows = _load_csv(case_dir / "dirs.csv")

    source_jd = float(meta["sourceJD"])
    if mode == "utc_sourcejd":
        date_str, time_str = _jd_to_utc_date_time(source_jd)
        zone = "+00:00"
    elif mode == "utc_sourcejd_exact":
        date_str, time_str = _jd_to_utc_date_time_exact(source_jd)
        zone = "+00:00"
    elif mode == "birth_fields":
        date_str = meta["birth_date"].replace("-", "/")
        time_str = meta["birth_time"].split(".")[0]
        zone = "+00:00"
    else:
        raise ValueError(f"Unsupported mode: {mode}")

    hsys = int(float(meta.get("th_payload", {}).get("house_system_id", 1)))
    zodiacal = 1 if str(meta.get("th_payload", {}).get("zodiac_id", "100")) == "101" else 0

    payload = {
        "date": date_str,
        "time": time_str,
        "zone": zone,
        "lat": meta["birth_lat"],
        "lon": meta["birth_long"],
        "hsys": hsys,
        "zodiacal": zodiacal,
        "tradition": False,
        "predictive": True,
        "pdtype": 0,
        "pdaspects": [0, 60, 90, 120, 180],
    }

    perchart = PerChart(payload)
    local_pd = perchart.getPredict().getPrimaryDirection()
    asc = perchart.chart.angles.get(const.ASC)
    signasctime = SignAscTime(perchart.date, perchart.time, asc.sign, perchart.lat, perchart.zone)

    astro_buckets: dict[tuple[int, int, float], list[dict[str, Any]]] = {}
    for row in astro_rows:
        key = _astro_key(row)
        if key is None:
            continue
        p_id, s_id, _ = key
        if not _in_scope(p_id, s_id, planet_only, shared_core_only):
            continue
        arc = _as_float(row.get("arc"))
        jd = _as_float(row.get("dirJD"))
        if not (math.isfinite(arc) and math.isfinite(jd)):
            continue
        astro_buckets.setdefault(key, []).append(
            {
                "arc": arc,
                "jd": jd,
                "date": row.get("dirDate", ""),
            }
        )

    local_buckets: dict[tuple[int, int, float], list[dict[str, Any]]] = {}
    for row in local_pd:
        if not isinstance(row, list) or len(row) < 5:
            continue
        arc = _as_float(row[0])
        if not math.isfinite(arc):
            continue
        prom_parsed = _parse_prom_key(str(row[1]))
        sig_id = _parse_sig_key(str(row[2]))
        if prom_parsed is None or sig_id is None:
            continue
        p_id, asp = prom_parsed
        if not _in_scope(p_id, sig_id, planet_only, shared_core_only):
            continue
        key = (p_id, sig_id, _canon_asp(sig_id, asp))
        local_buckets.setdefault(key, []).append(
            {
                "arc": arc,
                "jd": signasctime.getJDFromPDArc(arc),
                "date": str(row[4]),
                "prom": str(row[1]),
                "sig": str(row[2]),
            }
        )

    rows_out: list[dict[str, Any]] = []
    keys = sorted(set(astro_buckets.keys()) & set(local_buckets.keys()))
    for key in keys:
        pairs = _pair_by_nearest_arc(astro_buckets[key], local_buckets[key])
        p_id, s_id, asp = key
        for astro, local in pairs:
            rows_out.append(
                {
                    "case": case_dir.name,
                    "city": meta.get("city_name", ""),
                    "birth_date": meta.get("birth_date", ""),
                    "birth_time": meta.get("birth_time", ""),
                    "pID": p_id,
                    "promissor": ID2NAME.get(p_id, str(p_id)),
                    "asp": asp,
                    "sID": s_id,
                    "significator": ID2NAME.get(s_id, str(s_id)),
                    "astro_arc": astro["arc"],
                    "horosa_arc": local["arc"],
                    "arc_abs_err": abs(local["arc"] - astro["arc"]),
                    "astro_dirJD": astro["jd"],
                    "horosa_dirJD": local["jd"],
                    "date_abs_err_days": abs(local["jd"] - astro["jd"]),
                    "astro_date": astro["date"],
                    "horosa_date": local["date"],
                    "prom_key": local["prom"],
                    "sig_key": local["sig"],
                }
            )

    return rows_out, {
        "rows_astro": sum(len(v) for v in astro_buckets.values()),
        "rows_local": sum(len(v) for v in local_buckets.values()),
        "rows_matched": len(rows_out),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases-root", required=True)
    ap.add_argument("--sample", type=int, default=0)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--mode", choices=["utc_sourcejd", "utc_sourcejd_exact", "birth_fields"], default="utc_sourcejd")
    ap.add_argument("--planet-only", action="store_true")
    ap.add_argument("--shared-core-only", action="store_true")
    ap.add_argument("--out-csv", required=True)
    ap.add_argument("--out-json", required=True)
    args = ap.parse_args()

    if args.planet_only and args.shared_core_only:
        raise ValueError("--planet-only and --shared-core-only are mutually exclusive")

    root = Path(args.cases_root)
    case_dirs = sorted(p for p in _fs_path(root).glob("case_*") if p.is_dir())
    if args.sample and args.sample < len(case_dirs):
        rng = random.Random(args.seed)
        case_dirs = sorted(rng.sample(case_dirs, args.sample))

    all_rows: list[dict[str, Any]] = []
    agg = {"rows_astro": 0, "rows_local": 0, "rows_matched": 0}
    for case_dir in case_dirs:
        rows, counts = compare_case(case_dir, args.mode, args.planet_only, args.shared_core_only)
        all_rows.extend(rows)
        for key, value in counts.items():
            agg[key] += value

    arc_errs = [row["arc_abs_err"] for row in all_rows]
    date_errs = [row["date_abs_err_days"] for row in all_rows]
    arc_mae, arc_median, arc_p95, arc_max = _summary(arc_errs)
    date_mae, date_median, date_p95, date_max = _summary(date_errs)
    summary = Summary(
        cases=len(case_dirs),
        rows_astro=agg["rows_astro"],
        rows_local=agg["rows_local"],
        rows_matched=agg["rows_matched"],
        arc_mae=arc_mae,
        arc_median=arc_median,
        arc_p95=arc_p95,
        arc_max=arc_max,
        date_mae_days=date_mae,
        date_median_days=date_median,
        date_p95_days=date_p95,
        date_max_days=date_max,
    )

    out_csv = Path(args.out_csv)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with _fs_path(out_csv).open("w", encoding="utf-8", newline="") as f:
        if all_rows:
            writer = csv.DictWriter(f, fieldnames=list(all_rows[0].keys()))
            writer.writeheader()
            writer.writerows(all_rows)
        else:
            f.write("")

    out_json = Path(args.out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(summary.__dict__)
    payload["scope"] = (
        "shared_core"
        if args.shared_core_only
        else ("planet_only" if args.planet_only else "all")
    )
    _fs_path(out_json).write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
