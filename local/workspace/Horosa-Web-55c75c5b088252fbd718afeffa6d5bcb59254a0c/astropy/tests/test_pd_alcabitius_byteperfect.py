"""
Byte-perfect regression for the Alcabitius + Ptolemy primary-direction path.

This is the highest-priority guardrail for the Primary Direction multi-method
buildout: any change to the predictive / chart modules is required to leave the
default (pdMethod='core_alchabitius', pdTimeKey='Ptolemy', pdtype=0) output
byte-identical to the current first-principles snapshot stored under
`tests/data/pd_calibration_corpus/golden_alcabitius_ptolemy_v266.ndjson`.

The corpus is referred to internally as 'pd_calibration_corpus' — see manifest.

Environment knobs:
    HOROSA_PD_BYTEPERFECT_LIMIT=N   only run the first N cases (default: all 540)
    HOROSA_PD_BYTEPERFECT_VERBOSE=1 print first 5 mismatches per case

Run with:
    cd Horosa-Web/astropy && python -m pytest tests/test_pd_alcabitius_byteperfect.py -v
"""
import gzip
import json
import os
from pathlib import Path

import pytest

from astrostudy import perchart, perpredict


GOLDEN_PATH = (
    Path(__file__).resolve().parent
    / 'data'
    / 'pd_calibration_corpus'
    / 'golden_alcabitius_ptolemy_v266.ndjson.gz'
)


def _load_golden():
    """Stream-load golden NDJSON (gzip-compressed); one dict per case."""
    assert GOLDEN_PATH.exists(), f'Golden corpus missing: {GOLDEN_PATH}'
    with gzip.open(GOLDEN_PATH, 'rt', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def _limit():
    raw = os.environ.get('HOROSA_PD_BYTEPERFECT_LIMIT', '').strip()
    if not raw:
        return None
    try:
        v = int(raw)
        return v if v > 0 else None
    except ValueError:
        return None


def _verbose():
    return os.environ.get('HOROSA_PD_BYTEPERFECT_VERBOSE', '').strip() == '1'


def _row_diff(actual_row, golden_row):
    """Return list of (field_name, actual, golden) tuples for fields that differ."""
    field_names = ['arc', 'prom_id', 'sig_id', 'cat', 'date']
    diffs = []
    for idx, name in enumerate(field_names):
        a = actual_row[idx] if idx < len(actual_row) else None
        g = golden_row[idx] if idx < len(golden_row) else None
        if a != g:
            diffs.append((name, a, g))
    return diffs


def test_alcabitius_ptolemy_byteperfect():
    """
    For every chart in pd_calibration_corpus, the default Alcabitius+Ptolemy
    path must produce a pdlist that is element-wise == the golden snapshot.

    A single non-equal arc, promissor id, significator id, category, or
    formatted date string fails the entire test. == is used (not math.isclose)
    because the v2.5.3 path has hard byte-perfect lock.
    """
    limit = _limit()
    verbose = _verbose()

    total = 0
    matched = 0
    case_failures = []  # list of (case_name, [first few row diffs])

    for case_obj in _load_golden():
        if limit is not None and total >= limit:
            break
        total += 1
        case_name = case_obj['case']
        chart_data = case_obj['chart_data']
        golden_pdlist = case_obj['pdlist']
        golden_count = case_obj['pdlist_count']

        pc = perchart.PerChart(chart_data)
        pp = perpredict.PerPredict(pc)
        actual_pdlist = pp.getPrimaryDirection()

        if len(actual_pdlist) != golden_count:
            case_failures.append((
                case_name,
                f'row count mismatch: actual={len(actual_pdlist)} golden={golden_count}',
                [],
            ))
            continue

        per_case_diffs = []
        for ri, (act, exp) in enumerate(zip(actual_pdlist, golden_pdlist)):
            row_diffs = _row_diff(act, exp)
            if row_diffs:
                per_case_diffs.append((ri, row_diffs))
        if per_case_diffs:
            case_failures.append((case_name, 'row diffs', per_case_diffs[:5]))
        else:
            matched += 1

    summary = f'byte-perfect: {matched}/{total} cases matched, {len(case_failures)} failed'
    print('\n' + summary)

    if case_failures:
        if verbose:
            for cn, why, diffs in case_failures[:5]:
                print(f'\n  [{cn}] {why}')
                for ri, rd in diffs[:5]:
                    print(f'    row {ri}:')
                    for fn, a, g in rd:
                        print(f'      {fn}: actual={a!r} golden={g!r}')
        first_case = case_failures[0]
        pytest.fail(
            f'{summary}; first failure: {first_case[0]} ({first_case[1]}). '
            f'Set HOROSA_PD_BYTEPERFECT_VERBOSE=1 for diff details.'
        )
    else:
        assert matched == total
