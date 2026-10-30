"""
Self-check for the Primary-Direction dial (主限法盘) house-system mapping.

Each 方位法 (PD method) is, at heart, a definition of how houses are divided, so
the directed dial's house cusps must follow the selected method's house system —
not the natal chart's. This guards `_PD_CHART_METHOD_HSYS` /
`_pdChartHouseSystem` / `_pdChartBuildAnglesAndHouses` in the predictive module.

Invariants asserted:
  1. Each confident method renders its mapped swisseph house system label.
  2. The Placidus-family methods produce *distinct* intermediate cusps
     (i.e. selecting a method actually moves the cusps).
  3. ASC/MC are house-system-independent, so they stay identical across methods
     (only intermediate cusps 2/3/5/6/8/9/11/12 may differ).
  4. Methods with no confident mapping (in_zodiaco_lon, in_zodiaco_abs, unknown)
     fall back to the resolved natal house system. equal_hour_circle now maps to
     Meridian (equal equatorial division projected along hour circles ==
     the Meridian system; matches the 3D sphere's closed-form cusps).

Run with:
    cd Horosa-Web/astropy && python -m pytest tests/test_pd_dial_house_system.py -v
"""
import gzip
import json
from pathlib import Path

from astrostudy import perchart, perpredict


GOLDEN_PATH = (
    Path(__file__).resolve().parent
    / 'data'
    / 'pd_calibration_corpus'
    / 'golden_alcabitius_ptolemy_v266.ndjson.gz'
)

# pdMethod -> expected swisseph house-system label (const.HOUSES_* value).
CONFIDENT = {
    'core_alchabitius': 'Alcabitus',
    'placidus': 'Placidus',
    'regiomontanus': 'Regiomontanus',
    'campanus': 'Campanus',
    'topocentric': 'Polich Page',
    'meridian': 'Meridian',
    'porphyry': 'Porphyrius',
    'equal_ecliptic': 'Equal',
    'morinus': 'Morinus',
    'equal_hour_circle': 'Meridian',   # 与 3D 天球赤经等分同口径
}
# Registered methods with no confident house-system mapping: they intentionally
# fall back to the resolved natal house system at the dial layer.
FALLBACK_METHODS = ['in_zodiaco_lon', 'in_zodiaco_abs']

DIAL_DATE = '2055-06-09 12:00:00'


def _first_case():
    with gzip.open(GOLDEN_PATH, 'rt', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                return json.loads(line)
    raise AssertionError('golden corpus empty')


def _dial(chart_data, method):
    cd = dict(chart_data)
    cd['pdMethod'] = method
    cd['pdTimeKey'] = 'Ptolemy'
    pc = perchart.PerChart(cd)
    pp = perpredict.PerPredict(pc)
    out = pp.getPrimaryDirectionChartByDate(DIAL_DATE)
    return pc, out['chart']


def _asc_lon(chart):
    for obj in chart['objects']:
        if obj.get('id') == 'Asc':
            return round(float(obj['lon']), 5)
    raise AssertionError('ASC missing from dial chart')


def test_confident_methods_use_mapped_house_system():
    case = _first_case()
    cd = case['chart_data']
    for method, expected in CONFIDENT.items():
        _, chart = _dial(cd, method)
        got = chart['houses'][0]['hsys']
        assert got == expected, f'{method}: dial hsys={got!r} expected={expected!r}'


def test_family_methods_produce_distinct_cusps():
    """Selecting a method must actually move the intermediate cusps."""
    case = _first_case()
    cd = case['chart_data']
    family = ['core_alchabitius', 'placidus', 'regiomontanus',
              'campanus', 'topocentric', 'porphyry', 'meridian']
    triples = set()
    for method in family:
        _, chart = _dial(cd, method)
        h = chart['houses']
        triples.add((round(h[1]['lon'], 4), round(h[2]['lon'], 4), round(h[10]['lon'], 4)))
    # All seven should be mutually distinct (no two house systems collide here).
    assert len(triples) == len(family), (
        f'expected {len(family)} distinct cusp-triples, got {len(triples)}'
    )


def test_asc_invariant_across_methods():
    """ASC is house-system-independent; it must not change when the method changes."""
    case = _first_case()
    cd = case['chart_data']
    ascs = set()
    for method in list(CONFIDENT) + FALLBACK_METHODS:
        _, chart = _dial(cd, method)
        ascs.add(_asc_lon(chart))
    assert len(ascs) == 1, f'ASC drifted across methods: {ascs}'


def test_fallback_methods_use_natal_house_system():
    case = _first_case()
    cd = case['chart_data']
    for method in FALLBACK_METHODS:
        pc, chart = _dial(cd, method)
        got = chart['houses'][0]['hsys']
        assert got == pc.house, (
            f'{method}: fallback hsys={got!r} expected natal {pc.house!r}'
        )


def test_unknown_method_normalizes_to_alcabitius():
    """perchart whitelists pdMethod: an unrecognised method normalises to
    core_alchabitius *before* the dial, so the dial renders Alcabitus houses."""
    case = _first_case()
    cd = case['chart_data']
    pc, chart = _dial(cd, 'totally_made_up_method')
    assert pc.pdMethod == 'core_alchabitius'
    assert chart['houses'][0]['hsys'] == 'Alcabitus'


# 盘面宫制(pdFrame,外圈宫头)显式选择:每档 → 该宫制的 swisseph 标签;整宫 / 等宫另验宫头几何。
FRAME_EXPECTED = {
    'alcabitius': 'Alcabitus',
    'placidus': 'Placidus',
    'regiomontanus': 'Regiomontanus',
    'campanus': 'Campanus',
    'topocentric': 'Polich Page',
    'meridian': 'Meridian',
    'porphyry': 'Porphyrius',
    'equal': 'Equal',
    'wholesign': 'Whole Sign',
    'morinus': 'Morinus',
    'koch': 'Koch',
    'equal_hour_circle': 'Meridian',   # 赤道等分沿时圈投到黄道 == Meridian 宫
}


def _dial_frame(chart_data, frame):
    cd = dict(chart_data)
    cd['pdProjection'] = 'ptolemy'
    cd['pdFrame'] = frame
    cd['pdTimeKey'] = 'Ptolemy'
    pc = perchart.PerChart(cd)
    out = perpredict.PerPredict(pc).getPrimaryDirectionChartByDate(DIAL_DATE)
    return out['chart']


def test_dial_frame_selects_house_system():
    """每个盘面宫制档 = 外圈宫头按该宫制;弧算法维固定 ptolemy,只拨宫制。"""
    cd = _first_case()['chart_data']
    for frame, expected in FRAME_EXPECTED.items():
        got = _dial_frame(cd, frame)['houses'][0]['hsys']
        assert got == expected, f'{frame}: dial hsys={got!r} expected={expected!r}'


def test_dial_frame_cusp_geometry():
    """整宫:宫头落在星座起点(30° 整倍数);等宫:宫头 = 上升 + 30°·k。ASC 与宫制无关。"""
    cd = _first_case()['chart_data']
    whole = _dial_frame(cd, 'wholesign')
    for h in whole['houses']:
        assert abs(float(h['lon']) % 30.0) < 1e-6 or abs(float(h['lon']) % 30.0 - 30.0) < 1e-6
    equal = _dial_frame(cd, 'equal')
    asc = _asc_lon(equal)
    for k, h in enumerate(equal['houses']):
        d = (float(h['lon']) - asc - 30.0 * k) % 360.0
        assert min(d, 360.0 - d) < 1e-4, f'equal cusp {k + 1}: {h["lon"]} vs asc {asc}'
    assert _asc_lon(whole) == asc
