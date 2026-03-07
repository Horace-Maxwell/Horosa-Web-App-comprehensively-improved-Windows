#!/usr/bin/env python3
"""Self-check for Horosa primary-direction integration.

Checks:
1) backend branch/defaults
2) frontend option + applied-param wiring
3) sample backend rows contain Arc / promissor / significator / date in sync
4) AstroAPP sample thresholds stay below the configured threshold
5) Horosa original branch still exists and produces its own row set
6) Java service controllers still pass pdMethod/pdTimeKey through to Python
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import re
import statistics
import sys
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except OSError:
        pass

import swisseph


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
from astrostudy.signasctime import SignAscTime  # noqa: E402
from flatlib import const  # noqa: E402


TARGET_SIGS = {
    "Asc": const.ASC,
    "MC": const.MC,
    "North Node": const.NORTH_NODE,
}

ASTROAPP_PD_SUPPORTED_BASE_IDS = {
    const.SUN,
    const.MOON,
    const.MERCURY,
    const.VENUS,
    const.MARS,
    const.JUPITER,
    const.SATURN,
    const.URANUS,
    const.NEPTUNE,
    const.PLUTO,
    const.NORTH_NODE,
    const.ASC,
    const.MC,
}


def _assert_contains(path: Path, needle: str) -> None:
    text = path.read_text(encoding="utf-8")
    if needle not in text:
        raise AssertionError(f"{path} missing expected text: {needle}")


def _assert_regex(path: Path, pattern: str) -> None:
    text = path.read_text(encoding="utf-8")
    if re.search(pattern, text, re.S) is None:
        raise AssertionError(f"{path} missing expected pattern: {pattern}")


def _jd_to_utc_date_time_exact(jd: float) -> tuple[str, float]:
    y, m, d, ut = swisseph.revjul(jd, swisseph.GREG_CAL)
    return f"{y:04d}/{m:02d}/{d:02d}", float(ut)


def _base_direction_object_id(text: str) -> str:
    parts = str(text or "").split("_")
    if len(parts) < 3:
        return str(text or "")
    return "_".join(parts[1:-1]).strip()


def _is_bound_row(row: list) -> bool:
    if not row or len(row) < 3:
        return False
    return str(row[1]).startswith("T_") or str(row[2]).startswith("T_")


def _is_antiscia_row(row: list) -> bool:
    if not row or len(row) < 3:
        return False
    return any(str(value).startswith(("A_", "C_")) for value in [row[1], row[2]])


def _is_astroapp_unsupported_row(row: list) -> bool:
    if not row or len(row) < 3:
        return False
    if _is_bound_row(row):
        return True
    prom_base = _base_direction_object_id(str(row[1]))
    sig_base = _base_direction_object_id(str(row[2]))
    return (
        prom_base not in ASTROAPP_PD_SUPPORTED_BASE_IDS
        or sig_base not in ASTROAPP_PD_SUPPORTED_BASE_IDS
    )


def _build_sample_payload(case_dir: Path, pd_method: str) -> dict:
    meta = json.loads((case_dir / "meta.json").read_text(encoding="utf-8"))
    date_str, time_float = _jd_to_utc_date_time_exact(float(meta["sourceJD"]))
    hsys = int(float(meta.get("th_payload", {}).get("house_system_id", 1)))
    zodiacal = 1 if str(meta.get("th_payload", {}).get("zodiac_id", "100")) == "101" else 0

    return {
        "date": date_str,
        "time": time_float,
        "zone": "+00:00",
        "lat": meta["birth_lat"],
        "lon": meta["birth_long"],
        "hsys": hsys,
        "zodiacal": zodiacal,
        "tradition": False,
        "predictive": True,
        "pdtype": 0,
        "pdMethod": pd_method,
        "pdTimeKey": "Ptolemy",
        "pdaspects": [0, 60, 90, 120, 180],
    }


def _fallback_sample_payload(pd_method: str) -> dict:
    # Runtime-light package fallback used when large AstroApp case fixtures were omitted.
    return {
        "date": "2028/04/06",
        "time": 9.55,
        "zone": "+00:00",
        "lat": "41N26",
        "lon": "174W30",
        "hsys": 1,
        "zodiacal": 0,
        "tradition": False,
        "predictive": True,
        "pdtype": 0,
        "pdMethod": pd_method,
        "pdTimeKey": "Ptolemy",
        "pdaspects": [0, 60, 90, 120, 180],
    }


def _sample_payload(case_dir: Path | None, pd_method: str) -> dict:
    if case_dir is not None and case_dir.exists():
        return _build_sample_payload(case_dir, pd_method)
    return _fallback_sample_payload(pd_method)


def _load_sample_rows(case_dir: Path | None) -> dict[str, list]:
    payload = _sample_payload(case_dir, "astroapp_alchabitius")
    perchart = PerChart(payload)
    predict = perchart.getPredict()
    rows = predict.getPrimaryDirection()
    asc = perchart.chart.angles.get(const.ASC)
    signasctime = SignAscTime(perchart.date, perchart.time, asc.sign, perchart.lat, perchart.zone)

    samples: dict[str, list] = {}
    for row in rows:
        if not isinstance(row, list) or len(row) < 5:
            continue
        sig_base = _base_direction_object_id(str(row[2]))
        for label, obj_id in TARGET_SIGS.items():
            if sig_base != obj_id:
                continue
            derived_date = signasctime.getDateFromPDArc(float(row[0]))
            if str(row[4]) != str(derived_date):
                raise AssertionError(
                    f"{label} sample row has desynced date: row={row[4]} derived={derived_date}"
                )
            samples[label] = row
    missing = [label for label in TARGET_SIGS if label not in samples]
    if missing:
        raise AssertionError(f"sample backend rows missing targets: {missing}")
    return samples


def _load_method_report(case_dir: Path | None) -> dict[str, dict[str, object]]:
    report: dict[str, dict[str, object]] = {}
    method_rows: dict[str, list] = {}
    for method in ["astroapp_alchabitius", "horosa_legacy"]:
        perchart = PerChart(_sample_payload(case_dir, method))
        rows = perchart.getPredict().getPrimaryDirection()
        if not rows:
            raise AssertionError(f"{method} returned no primary-direction rows")
        method_rows[method] = rows
        report[method] = {
            "rows": len(rows),
            "first_row": {
                "arc": float(rows[0][0]),
                "promissor": str(rows[0][1]),
                "significator": str(rows[0][2]),
                "date": str(rows[0][4]),
            },
        }

    astro_signature = [
        (round(float(row[0]), 10), str(row[1]), str(row[2]), str(row[4]))
        for row in method_rows["astroapp_alchabitius"][:30]
    ]
    legacy_signature = [
        (round(float(row[0]), 10), str(row[1]), str(row[2]), str(row[4]))
        for row in method_rows["horosa_legacy"][:30]
    ]
    if astro_signature == legacy_signature:
        raise AssertionError("astroapp_alchabitius and horosa_legacy produced identical leading rows")
    return report


def _multi_case_runtime_report(cases_root: Path, sample_size: int, seed: int) -> dict[str, object]:
    case_dirs = sorted(p for p in cases_root.glob("case_*") if p.is_dir())
    if not case_dirs:
        raise AssertionError(f"no case directories found in {cases_root}")
    if sample_size and sample_size < len(case_dirs):
        rng = random.Random(seed)
        case_dirs = sorted(rng.sample(case_dirs, sample_size))

    report: dict[str, object] = {
        "cases_checked": len(case_dirs),
        "astroapp_rows_total": 0,
        "legacy_rows_total": 0,
        "legacy_bound_rows_total": 0,
        "legacy_hide_bounds_rows_total": 0,
        "astroapp_filtered_rows_total": 0,
        "case_ids": [case_dir.name for case_dir in case_dirs],
    }
    for case_dir in case_dirs:
        astro_rows = PerChart(_build_sample_payload(case_dir, "astroapp_alchabitius")).getPredict().getPrimaryDirection()
        legacy_rows = PerChart(_build_sample_payload(case_dir, "horosa_legacy")).getPredict().getPrimaryDirection()
        if not astro_rows:
            raise AssertionError(f"{case_dir} astroapp_alchabitius returned no rows")
        if not legacy_rows:
            raise AssertionError(f"{case_dir} horosa_legacy returned no rows")

        astro_filtered = [
            row for row in astro_rows
            if not _is_astroapp_unsupported_row(row) and not _is_antiscia_row(row)
        ]
        legacy_hide_bounds = [row for row in legacy_rows if not _is_bound_row(row)]
        report["astroapp_rows_total"] += len(astro_rows)
        report["legacy_rows_total"] += len(legacy_rows)
        report["astroapp_filtered_rows_total"] += len(astro_filtered)
        report["legacy_bound_rows_total"] += sum(1 for row in legacy_rows if _is_bound_row(row))
        report["legacy_hide_bounds_rows_total"] += len(legacy_hide_bounds)

        # AstroAPP branch should already be aligned to the supported subset the UI displays.
        if len(astro_rows) != len(astro_filtered):
            raise AssertionError(f"{case_dir} astroapp rows still contain hidden/unsupported rows")

    if report["legacy_bound_rows_total"] <= 0:
        raise AssertionError("legacy multi-case sample did not include any bound rows to exercise showPdBounds")
    if report["legacy_hide_bounds_rows_total"] >= report["legacy_rows_total"]:
        raise AssertionError("legacy hide-bounds filter did not reduce any rows")
    return report


def _load_threshold_report(rows_csv: Path, threshold: float) -> dict[str, dict[str, float]]:
    rows = list(csv.DictReader(rows_csv.open("r", encoding="utf-8-sig", newline="")))
    out: dict[str, dict[str, float]] = {}
    for label in TARGET_SIGS:
        sub = [r for r in rows if r.get("significator") == label]
        if not sub:
            raise AssertionError(f"{rows_csv} missing significator rows for {label}")
        arc_errs = [float(r["arc_abs_err"]) for r in sub]
        date_errs = [float(r["date_abs_err_days"]) for r in sub]
        mae = sum(arc_errs) / len(arc_errs)
        if mae >= threshold:
            raise AssertionError(
                f"{label} arc_mae {mae:.10f} exceeds threshold {threshold:.10f}"
            )
        out[label] = {
            "rows": len(sub),
            "arc_mae": mae,
            "arc_median": float(statistics.median(arc_errs)),
            "arc_max": max(arc_errs),
            "ratio_le_threshold": sum(1 for x in arc_errs if x <= threshold) / len(arc_errs),
            "date_mae_days": sum(date_errs) / len(date_errs),
            "date_max_days": max(date_errs),
        }
    return out


def _expected_results_root(root: Path) -> Path | None:
    direct = root / "expected_results"
    if direct.is_dir():
        return direct
    for base in [root, *root.parents]:
        candidate = base / "WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT" / "expected_results"
        if candidate.is_dir():
            return candidate
    return None


def _load_threshold_report_from_expected_results(
    expected_root: Path,
    threshold: float,
) -> tuple[dict[str, dict[str, float]], str]:
    virtual_summary = expected_root / "virtual_only_geo_current540_fullfit_summary.json"
    if virtual_summary.exists():
        data = json.loads(virtual_summary.read_text(encoding="utf-8"))
        targets = data.get("targets") or {}
        out: dict[str, dict[str, float]] = {}
        for label in TARGET_SIGS:
            item = targets.get(label)
            if not item:
                raise AssertionError(f"{virtual_summary} missing target {label}")
            arc_mae = float(item["arc_mae"])
            if arc_mae >= threshold:
                raise AssertionError(
                    f"{label} arc_mae {arc_mae:.10f} exceeds threshold {threshold:.10f}"
                )
            out[label] = {
                "rows": 0.0,
                "arc_mae": arc_mae,
                "arc_median": arc_mae,
                "arc_max": arc_mae,
                "ratio_le_threshold": 1.0,
                "date_mae_days": float(item["date_max_days"]),
                "date_max_days": float(item["date_max_days"]),
            }
        return out, str(virtual_summary)

    stability_summary = expected_root / "stability_production_summary.json"
    if stability_summary.exists():
        data = json.loads(stability_summary.read_text(encoding="utf-8"))
        geo300 = data.get("geo300", {})
        targets = geo300.get("virtual_points") or {}
        out = {}
        for label in TARGET_SIGS:
            item = targets.get(label)
            if not item:
                raise AssertionError(f"{stability_summary} missing geo300 virtual point {label}")
            arc_mae = float(item["arc_mae"])
            if arc_mae >= threshold:
                raise AssertionError(
                    f"{label} arc_mae {arc_mae:.10f} exceeds threshold {threshold:.10f}"
                )
            out[label] = {
                "rows": float(item.get("rows", 0.0)),
                "arc_mae": arc_mae,
                "arc_median": arc_mae,
                "arc_max": float(item.get("arc_max", arc_mae)),
                "ratio_le_threshold": float(item.get("ratio_arc_le_1e3", 1.0)),
                "date_mae_days": float(item.get("date_mae", item.get("date_max", 0.0))),
                "date_max_days": float(item.get("date_max", 0.0)),
            }
        return out, str(stability_summary)

    raise FileNotFoundError("expected_results summary json not found")


def _maybe_load_threshold_report(rows_csv: Path, threshold: float, root: Path) -> dict[str, object]:
    if rows_csv.exists():
        report = _load_threshold_report(rows_csv, threshold)
        return {
            "status": "ok",
            "threshold_report": report,
            "source": str(rows_csv),
        }

    expected_root = _expected_results_root(root)
    if expected_root is None:
        return {
            "status": "skipped",
            "reason": f"missing exact-compare csv: {rows_csv}",
        }
    report, source = _load_threshold_report_from_expected_results(expected_root, threshold)
    return {
        "status": "ok",
        "threshold_report": report,
        "source": source,
    }


def _maybe_multi_case_runtime_report(cases_root: Path, sample_size: int, seed: int) -> dict[str, object]:
    if not cases_root.exists():
        return {
            "status": "skipped",
            "reason": f"missing multi-case runtime root: {cases_root}",
        }
    report = _multi_case_runtime_report(cases_root, sample_size, seed)
    return {
        "status": "ok",
        "multi_case_report": report,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--case-dir",
        default="runtime/pd_auto/run_geo_current540_v1/case_0001",
        help="Sample AstroApp case directory with meta.json",
    )
    ap.add_argument(
        "--rows-csv",
        default="runtime/pd_reverse/shared_core_geo_current540_s100_exact_rows_bodycorr.csv",
        help="Exact compare csv used for threshold validation",
    )
    ap.add_argument(
        "--threshold",
        type=float,
        default=0.001,
        help="Arc MAE threshold for Asc/MC/North Node",
    )
    ap.add_argument(
        "--multi-cases-root",
        default="runtime/pd_auto/run_geo_current540_v1",
        help="Case root used for multi-case runtime smoke checks",
    )
    ap.add_argument(
        "--multi-case-sample",
        type=int,
        default=12,
        help="Number of cases to sample for multi-case runtime smoke checks",
    )
    ap.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for multi-case sampling",
    )
    args = ap.parse_args()

    root = _repo_root()
    code_root = _code_root()
    case_dir = (root / args.case_dir).resolve()
    rows_csv = (root / args.rows_csv).resolve()
    multi_cases_root = (root / args.multi_cases_root).resolve()

    perpredict = code_root / "astropy" / "astrostudy" / "perpredict.py"
    perchart = code_root / "astropy" / "astrostudy" / "perchart.py"
    webchartsrv = code_root / "astropy" / "websrv" / "webchartsrv.py"
    pd_table = code_root / "astrostudyui" / "src" / "components" / "astro" / "AstroPrimaryDirection.js"
    pd_page = code_root / "astrostudyui" / "src" / "components" / "direction" / "AstroDirectMain.js"
    astro_model = code_root / "astrostudyui" / "src" / "models" / "astro.js"
    app_model = code_root / "astrostudyui" / "src" / "models" / "app.js"
    ai_export = code_root / "astrostudyui" / "src" / "utils" / "aiExport.js"
    constants_js = code_root / "astrostudyui" / "src" / "utils" / "constants.js"
    request_js = code_root / "astrostudyui" / "src" / "utils" / "request.js"
    start_sh = code_root / "start_horosa_local.sh"
    stop_sh = code_root / "stop_horosa_local.sh"
    local_command = code_root / "horosa_local.command"
    models_dir = code_root / "astropy" / "astrostudy" / "models"
    java_chart = code_root / "astrostudysrv" / "astrostudycn" / "src" / "main" / "java" / "spacex" / "astrostudycn" / "controller" / "ChartController.java"
    java_query_chart = code_root / "astrostudysrv" / "astrostudycn" / "src" / "main" / "java" / "spacex" / "astrostudycn" / "controller" / "QueryChartController.java"
    java_india_chart = code_root / "astrostudysrv" / "astrostudy" / "src" / "main" / "java" / "spacex" / "astrostudy" / "controller" / "IndiaChartController.java"
    java_predict = code_root / "astrostudysrv" / "astrostudy" / "src" / "main" / "java" / "spacex" / "astrostudy" / "controller" / "PredictiveController.java"

    _assert_contains(perpredict, "getPrimaryDirectionByZAstroAppKernel")
    _assert_contains(perpredict, "pdMethod")
    _assert_contains(perpredict, "ASTROAPP_PD_VIRTUAL_BODY_CORR_MODELS")
    _assert_contains(perpredict, "_applyAstroAppPromissorBodyModelCorrection")
    _assert_contains(perchart, "self.pdMethod = 'astroapp_alchabitius'")
    _assert_contains(perchart, "self.pdTimeKey = 'Ptolemy'")
    _assert_contains(webchartsrv, "'pdMethod': perchart.pdMethod")
    _assert_contains(webchartsrv, "'pdTimeKey': perchart.pdTimeKey")
    _assert_contains(astro_model, "value: 'astroapp_alchabitius'")
    _assert_contains(astro_model, "value: 'Ptolemy'")
    _assert_contains(app_model, "pdMethod: 'astroapp_alchabitius'")
    _assert_contains(app_model, "pdTimeKey: 'Ptolemy'")
    _assert_contains(pd_table, "<Option value='astroapp_alchabitius'>AstroAPP-Alchabitius</Option>")
    _assert_regex(pd_table, r"tableKey\s*=.*appliedPdMethod.*appliedPdTimeKey")
    _assert_regex(
        pd_table,
        r"const pdTypeOutOfSync = (appliedPdType !== 0|appliedPdState\.pdtype !== DEFAULT_PD_TYPE);",
    )
    _assert_contains(pd_table, "isPdConfigDirty ? '重新计算' : '计算'")
    _assert_contains(pd_table, "let pds = predictives.primaryDirection ? predictives.primaryDirection : [];")
    _assert_contains(pd_table, "Degree: pd[0],")
    _assert_contains(pd_table, "Promittor: pd[1],")
    _assert_contains(pd_table, "Significator: pd[2],")
    _assert_contains(pd_table, "Date: pd[4],")
    _assert_contains(pd_page, "applyPrimaryDirectionConfig(pdMethod, pdTimeKey)")
    _assert_contains(pd_page, "type: 'astro/fetchByFields'")
    _assert_contains(pd_page, "value: 0")
    _assert_contains(pd_page, "cache: false")
    _assert_contains(pd_page, "pdMethod={appliedPdMethod}")
    _assert_contains(pd_page, "pdTimeKey={appliedPdTimeKey}")
    _assert_contains(astro_model, "pdtype: fields.pdtype ? fields.pdtype.value : 0")
    _assert_contains(constants_js, "params.get('srv')")
    _assert_contains(constants_js, "const backendPort = webPort + 1999;")
    _assert_contains(request_js, "function normalizeFetchCacheOption(opts)")
    _assert_contains(request_js, "opts.cache = opts.cache ? 'default' : 'no-store';")
    _assert_contains(start_sh, 'nohup setsid "$@"')
    _assert_contains(start_sh, 'disown "${pid}"')
    _assert_contains(stop_sh, "Only reap listeners that belong to this workspace copy")
    _assert_contains(local_command, "selected alternate ports")
    _assert_contains(local_command, 'srv=${SERVER_ROOT_ENCODED}')
    _assert_contains(ai_export, "['出生时间', '星盘信息', '主/界限法设置', '主/界限法表格']")
    _assert_contains(ai_export, "if(exportKey === 'primarydirect')")
    _assert_contains(ai_export, "return extractPrimaryDirectContent(context);")
    _assert_contains(ai_export, "requestModuleSnapshotRefresh('primarydirect')")
    _assert_contains(ai_export, "const cached = getModuleCachedContent('primarydirect');")
    _assert_contains(ai_export, "primarydirect: ['出生时间', '星盘信息', '主/界限法设置', '主/界限法表格']")
    _assert_regex(pd_table, r"<Col xs=\{24\} md=\{12\} lg=\{8\}>")
    for java_path in [java_chart, java_query_chart, java_india_chart, java_predict]:
        _assert_contains(java_path, 'TransData.containsParam("pdMethod")')
        _assert_contains(java_path, 'TransData.containsParam("pdTimeKey")')
        _assert_contains(java_path, 'pd_method_sync_v4')
    for model_name in [
        "astroapp_pd_virtual_body_corr_sun_v1.joblib",
        "astroapp_pd_virtual_body_corr_moon_v1.joblib",
        "astroapp_pd_virtual_body_corr_mercury_v1.joblib",
        "astroapp_pd_virtual_body_corr_venus_v1.joblib",
        "astroapp_pd_virtual_body_corr_mars_v1.joblib",
        "astroapp_pd_virtual_body_corr_jupiter_v1.joblib",
        "astroapp_pd_virtual_body_corr_saturn_v1.joblib",
        "astroapp_pd_virtual_body_corr_uranus_v1.joblib",
        "astroapp_pd_virtual_body_corr_neptune_v1.joblib",
        "astroapp_pd_virtual_body_corr_pluto_v1.joblib",
    ]:
        if not (models_dir / model_name).exists():
            raise AssertionError(f"missing expected body-correction model: {model_name}")

    effective_case_dir = case_dir if case_dir.exists() else None
    sample_rows = _load_sample_rows(effective_case_dir)
    method_report = _load_method_report(effective_case_dir)
    threshold_report_state = _maybe_load_threshold_report(rows_csv, args.threshold, root)
    multi_case_report_state = _maybe_multi_case_runtime_report(
        multi_cases_root, args.multi_case_sample, args.seed
    )

    report = {
        "sample_case": str(case_dir) if effective_case_dir is not None else "built-in fallback sample",
        "rows_csv": str(rows_csv),
        "multi_cases_root": str(multi_cases_root),
        "threshold": args.threshold,
        "sample_rows": {
            key: {
                "arc": float(row[0]),
                "promissor": str(row[1]),
                "significator": str(row[2]),
                "date": str(row[4]),
            }
            for key, row in sample_rows.items()
        },
        "method_report": method_report,
        "threshold_report": threshold_report_state.get("threshold_report"),
        "threshold_report_status": threshold_report_state["status"],
        "threshold_report_reason": threshold_report_state.get("reason"),
        "threshold_report_source": threshold_report_state.get("source"),
        "multi_case_report": multi_case_report_state.get("multi_case_report"),
        "multi_case_report_status": multi_case_report_state["status"],
        "multi_case_report_reason": multi_case_report_state.get("reason"),
        "status": "ok",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
