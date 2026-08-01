"""
Multi-method × multi-time-key smoke + invariance tests for primary direction.

Asserts:
 1. Every newly-registered (pdMethod, pdTimeKey) combo produces a non-empty pdlist
    for a representative chart sample without raising.
 2. arc values are independent of time-key (time-key only rescales the date axis).
 3. Date strings shift in the expected direction when scale != 1.0.
 4. Unknown pdMethod falls back to the default core_alchabitius output exactly.

Iron Rule ① guard:
    Default (core_alchabitius, Ptolemy, pdtype=0) is covered by
    test_pd_alcabitius_byteperfect.py with 540-case ==. This file is the
    coverage-extension layer; combined the two tests gate the full PD surface.
"""
import gzip
import json
import re
from pathlib import Path
import pytest

from astrostudy import perchart, perpredict
from astrostudy.perpredict import STATIC_TIME_KEY_SCALES, _PD_METHOD_REGISTRY


CALIBRATION_CORPUS = (
    Path(__file__).resolve().parent
    / 'data'
    / 'pd_calibration_corpus'
    / 'golden_alcabitius_ptolemy_v266.ndjson.gz'
)


def _load_sample_charts(n=20):
    """Load up to N representative chart-data dicts from the golden corpus (gzip)."""
    charts = []
    with gzip.open(CALIBRATION_CORPUS, 'rt', encoding='utf-8') as f:
        for line in f:
            obj = json.loads(line)
            charts.append(obj['chart_data'])
            if len(charts) >= n:
                break
    return charts


SAMPLE_CHARTS = _load_sample_charts(n=20)
NEW_METHODS = ['placidus']  # P0 additions (Alcabitius is covered by byteperfect test)
# time-key 只保留有公式定义的 key(方法论铁律：公式优先,不放拟合值)。
NEW_TIME_KEYS = ['Ptolemy', 'Naibod']


@pytest.mark.parametrize('pd_method', NEW_METHODS)
@pytest.mark.parametrize('pd_time_key', NEW_TIME_KEYS)
def test_new_method_timekey_runs_nonempty(pd_method, pd_time_key):
    """Every new (method, time_key) combo runs on every sample chart without crash."""
    for chart_data in SAMPLE_CHARTS:
        cd = dict(chart_data)
        cd['pdMethod'] = pd_method
        cd['pdTimeKey'] = pd_time_key
        pc = perchart.PerChart(cd)
        pp = perpredict.PerPredict(pc)
        pdlist = pp.getPrimaryDirection()
        assert isinstance(pdlist, list), f'pdlist must be a list (case {chart_data.get("date")})'
        # Allow occasional zero rows for charts where significators coincide
        # but a representative sample chart should have >= 50 rows
        assert len(pdlist) >= 50, (
            f'pdlist too short ({len(pdlist)} rows) for method={pd_method} time_key={pd_time_key}'
        )


@pytest.mark.parametrize('pd_method', NEW_METHODS)
def test_arc_independent_of_time_key(pd_method):
    """For a fixed chart + method, arc values must be identical across time-keys."""
    chart_data = SAMPLE_CHARTS[0]
    arcs_by_tk = {}
    for tk in NEW_TIME_KEYS:
        cd = dict(chart_data)
        cd['pdMethod'] = pd_method
        cd['pdTimeKey'] = tk
        pc = perchart.PerChart(cd)
        pp = perpredict.PerPredict(pc)
        pdlist = pp.getPrimaryDirection()
        # arc is item[0]; build (prom, sig, arc) tuple
        arcs_by_tk[tk] = [(r[1], r[2], r[0]) for r in pdlist]
    # All time-keys must produce identical arc sequences (arc has no scale dependence)
    base = arcs_by_tk[NEW_TIME_KEYS[0]]
    for tk in NEW_TIME_KEYS[1:]:
        assert arcs_by_tk[tk] == base, (
            f'arc mismatch between {NEW_TIME_KEYS[0]} and {tk}'
        )


@pytest.mark.parametrize('pd_method', NEW_METHODS)
def test_date_shifts_with_time_key_scale(pd_method):
    """For non-zero arc rows, date string differs across time-keys when scales differ."""
    chart_data = SAMPLE_CHARTS[0]
    dates_by_tk = {}
    for tk in NEW_TIME_KEYS:
        cd = dict(chart_data)
        cd['pdMethod'] = pd_method
        cd['pdTimeKey'] = tk
        pc = perchart.PerChart(cd)
        pp = perpredict.PerPredict(pc)
        pdlist = pp.getPrimaryDirection()
        # Pick first row with |arc| > 0.5 (clearly non-zero)
        for r in pdlist:
            if abs(r[0]) > 0.5:
                dates_by_tk[tk] = r[4]
                break

    # Naibod (0.9856 scale) must produce a DIFFERENT date from Ptolemy (1.0) on a non-zero arc row.
    assert dates_by_tk['Naibod'] != dates_by_tk['Ptolemy'], (
        f'Naibod date should differ from Ptolemy on non-zero arc row; '
        f'got same date {dates_by_tk["Naibod"]}'
    )


def test_unknown_method_falls_back_to_alcabitius():
    """An unrecognized pdMethod must produce identical output to core_alchabitius."""
    chart_data = SAMPLE_CHARTS[0]
    cd_unknown = dict(chart_data)
    cd_unknown['pdMethod'] = 'regiomontanus_not_yet_implemented'
    cd_unknown['pdTimeKey'] = 'Ptolemy'
    pc_u = perchart.PerChart(cd_unknown)
    pp_u = perpredict.PerPredict(pc_u)
    out_u = pp_u.getPrimaryDirection()

    cd_alc = dict(chart_data)
    cd_alc['pdMethod'] = 'core_alchabitius'
    cd_alc['pdTimeKey'] = 'Ptolemy'
    pc_a = perchart.PerChart(cd_alc)
    pp_a = perpredict.PerPredict(pc_a)
    out_a = pp_a.getPrimaryDirection()

    assert out_u == out_a, (
        'Unknown pdMethod must fall back to core_alchabitius byte-perfectly'
    )


def test_static_time_key_scales_contain_required_keys():
    """STATIC_TIME_KEY_SCALES must expose the v11 static time keys with sane numeric values."""
    # Ptolemy + Naibod: the formula-anchored core (must stay in the ~0.98–1.0 band).
    for key in NEW_TIME_KEYS:
        assert key in STATIC_TIME_KEY_SCALES, f'missing static scale for {key}'
        v = STATIC_TIME_KEY_SCALES[key]
        assert isinstance(v, (int, float)), f'{key} scale must be numeric'
        assert 0.5 < v < 1.5, f'{key} scale {v} out of sane PD range'
    # Iron Rule ①: Ptolemy must be exactly 1.0 (not 1.0000... approximation)
    assert STATIC_TIME_KEY_SCALES['Ptolemy'] == 1.0
    # v12：静态常数标度集合。每一项都是有明确定义的古典/符号时间钥匙,其常数标度跨 30 例
    # 捕获语料逐键验证(spread≈0=真·静态;Kündig 实测恒 1.0 与 SymbolicDegree 同义)。
    # Simmonite/Kepler/Brahe 经数据证明为「每盘常数」型(标度=本命太阳日运动),已迁出
    # 静态表 → PER_CHART_TIME_KEY_FALLBACK + _pdTimeKeyScale 逐盘真算。
    # 锁定确切集合,防误增(拟合值混入)/误删(钥匙掉出白名单→UI 选了被回退默认)。
    EXPECTED_V12_STATIC_KEYS = {
        'Ptolemy', 'Naibod', 'Cardano', 'Umar', 'Wollner', 'Plantiko',
        'SynodicYear', 'Kundig', 'SymbolicDegree', 'SymbolicYear',
        'SymbolicMoon', 'SymbolicMonth', 'Quarterly', 'Quinary', 'Duodenary',
        'Novenary', 'SelfMeasure',
        # P0-6 有意扩表:Naibod-in-RA 命名对齐 + Ascendant-arc(界行自洽,1 上升度/年)
        'NaibodRA', 'AscendantArc',
    }
    assert set(STATIC_TIME_KEY_SCALES.keys()) == EXPECTED_V12_STATIC_KEYS, (
        f'STATIC_TIME_KEY_SCALES drifted from the v12 set: '
        f'extra={set(STATIC_TIME_KEY_SCALES) - EXPECTED_V12_STATIC_KEYS}, '
        f'missing={EXPECTED_V12_STATIC_KEYS - set(STATIC_TIME_KEY_SCALES)}'
    )
    # 量级因钥匙类型而异(符号月/年标度可 >1.5)，但都必须是正有限数。
    for k, v in STATIC_TIME_KEY_SCALES.items():
        assert isinstance(v, (int, float)) and v > 0 and v == v, (
            f'{k} scale {v!r} is not a positive finite number'
        )


def test_per_chart_time_keys_follow_natal_sun_motion():
    """Simmonite/Kepler/Brahe 标度=本命太阳日运动(每盘常数型,数据 30 例逐盘 iqr≈3e-5 实证):
    Simmonite=出生时刻黄经瞬时日速;Kepler/Brahe=生日前向差分 λ☉(jd0+1)−λ☉(jd0)。"""
    import swisseph as _swe
    from astrostudy.perpredict import _pdTimeKeyScale, PER_CHART_TIME_KEY_FALLBACK
    pc = perchart.PerChart(dict(SAMPLE_CHARTS[0]))
    chart = pc.getChart()
    jd = float(chart.date.jd)
    inst = float(_swe.calc_ut(jd, _swe.SUN)[0][3])
    fwd = (float(_swe.calc_ut(jd + 1.0, _swe.SUN)[0][0])
           - float(_swe.calc_ut(jd, _swe.SUN)[0][0])) % 360.0
    assert abs(_pdTimeKeyScale('Simmonite', chart=chart) - inst) < 1e-9
    assert abs(_pdTimeKeyScale('Kepler', chart=chart) - fwd) < 1e-9
    assert _pdTimeKeyScale('Kepler', chart=chart) == _pdTimeKeyScale('Brahe', chart=chart)
    # chart 缺席时回退近似常数(防御路径)
    for k, v in PER_CHART_TIME_KEY_FALLBACK.items():
        assert _pdTimeKeyScale(k, chart=None) == v


def test_symbolic_solar_arc_roundtrip():
    """太阳弧(黄经)钥匙:正负弧统一前向 |arc| 进动;与盘逆函数 round-trip 一致。"""
    from astrostudy import pd_engine
    pc = perchart.PerChart(dict(SAMPLE_CHARTS[0]))
    jd0 = float(pc.getChart().date.jd)
    d_pos = pd_engine.key_symbolic_solar_arc(30.0, jd0)
    d_neg = pd_engine.key_symbolic_solar_arc(-30.0, jd0)
    assert d_pos > 0 and abs(d_neg + d_pos) < 1e-9, '负弧应为前向同长、带符号返回'
    back = pd_engine.symbolic_solar_arc_for_years(d_pos, jd0)
    assert abs(back - 30.0) < 1e-6, f'round-trip 失败: {back}'


def test_pd_method_registry_includes_p0_additions():
    assert 'core_alchabitius' in _PD_METHOD_REGISTRY
    assert 'horosa_legacy' in _PD_METHOD_REGISTRY
    assert 'placidus' in _PD_METHOD_REGISTRY
    # Iron Rule ①: default key must point to the original kernel
    assert _PD_METHOD_REGISTRY['core_alchabitius'] == 'getPrimaryDirectionByZCoreKernel'


# ---------------------------------------------------------------------------
# v10 进阶开关:方向类型(黄道/世俗) / 向运(顺逆同选) / 真太阳弧动态钥匙
# ---------------------------------------------------------------------------
def _engine_chart():
    """取第一张样本盘并强制走自研引擎方位法(placidus)。"""
    cd = dict(SAMPLE_CHARTS[0])
    cd['pdMethod'] = 'placidus'
    cd['pdTimeKey'] = 'Ptolemy'
    return cd


def test_pddirect_parsing_default_and_off():
    """顺逆默认都开(用户偏好「顺逆都开」);仅显式 0/'0'/false 才关。"""
    cd = _engine_chart()
    assert perchart.PerChart(cd).pdDirect is True   # 顺向缺省开
    assert perchart.PerChart(cd).pdConverse is True  # 逆向缺省也开(默认顺逆都开)
    cd0 = dict(cd); cd0['pdDirect'] = 0
    assert perchart.PerChart(cd0).pdDirect is False
    cd1 = dict(cd); cd1['pdDirect'] = '0'
    assert perchart.PerChart(cd1).pdDirect is False
    cd2 = dict(cd); cd2['pdDirect'] = 1
    assert perchart.PerChart(cd2).pdDirect is True
    cc0 = dict(cd); cc0['pdConverse'] = 0
    assert perchart.PerChart(cc0).pdConverse is False  # 显式关逆


def test_direct_and_converse_co_select_concatenates():
    """顺向+逆向可同时选:行数应为「仅顺」与「仅逆」之和(各跑一遍拼接)。"""
    cd = _engine_chart()
    cd['pdtype'] = 0
    d = dict(cd); d['pdDirect'] = 1; d['pdConverse'] = 0
    c = dict(cd); c['pdDirect'] = 0; c['pdConverse'] = 1
    b = dict(cd); b['pdDirect'] = 1; b['pdConverse'] = 1
    n_d = len(perpredict.PerPredict(perchart.PerChart(d)).getPrimaryDirection())
    n_c = len(perpredict.PerPredict(perchart.PerChart(c)).getPrimaryDirection())
    n_b = len(perpredict.PerPredict(perchart.PerChart(b)).getPrimaryDirection())
    assert n_d > 0 and n_c > 0
    assert n_b == n_d + n_c, f'co-select should concat: {n_b} vs {n_d}+{n_c}'


def test_neither_direction_falls_back_to_direct():
    """顺逆皆关时回退顺向(绝不产出空向运)。"""
    cd = _engine_chart()
    cd['pdtype'] = 0
    none_sel = dict(cd); none_sel['pdDirect'] = 0; none_sel['pdConverse'] = 0
    only_d = dict(cd); only_d['pdDirect'] = 1; only_d['pdConverse'] = 0
    n_none = len(perpredict.PerPredict(perchart.PerChart(none_sel)).getPrimaryDirection())
    n_d = len(perpredict.PerPredict(perchart.PerChart(only_d)).getPrimaryDirection())
    assert n_none == n_d and n_none > 0


def test_mundo_pdtype_diverges_regio_campanus():
    """pdtype=1(世俗 in mundo):Regiomontanus 与 Campanus 的行集应明显不同(Bug1 修复点)。"""
    cd = _engine_chart()
    cd['pdtype'] = 1
    r = dict(cd); r['pdMethod'] = 'regiomontanus'
    c = dict(cd); c['pdMethod'] = 'campanus'
    rows_r = perpredict.PerPredict(perchart.PerChart(r)).getPrimaryDirection()
    rows_c = perpredict.PerPredict(perchart.PerChart(c)).getPrimaryDirection()
    ar = {(x[1], x[2]): round(x[0], 4) for x in rows_r}
    ac = {(x[1], x[2]): round(x[0], 4) for x in rows_c}
    common = set(ar) & set(ac)
    diff = sum(1 for k in common if abs(ar[k] - ac[k]) > 1e-4)
    assert common and diff > 0, f'in-mundo Regio vs Campanus should diverge ({diff}/{len(common)})'


def test_truesolararc_dates_differ_from_ptolemy():
    """真太阳弧(动态钥匙)日期须与 Ptolemy 不同(Bug2 修复点);弧不变。"""
    cd = _engine_chart()
    cd['pdtype'] = 0
    pt = dict(cd); pt['pdTimeKey'] = 'Ptolemy'
    sa = dict(cd); sa['pdTimeKey'] = 'TrueSolarArc'
    rows_pt = perpredict.PerPredict(perchart.PerChart(pt)).getPrimaryDirection()
    rows_sa = perpredict.PerPredict(perchart.PerChart(sa)).getPrimaryDirection()
    dp = {(x[1], x[2]): x[4] for x in rows_pt}
    ds = {(x[1], x[2]): x[4] for x in rows_sa}
    common = set(dp) & set(ds)
    diff = sum(1 for k in common if dp[k] != ds[k])
    assert common and diff > 0, 'TrueSolarArc dates must differ from Ptolemy'


def test_pd_years_3000_multi_revolution():
    """pdYears>360 的多圈复发行(3000 年上限)与 ≤360 的逐位兼容性。

    断言:
      1. 默认 100 年行集 ⊂ 3000 年行集(弧/迫星/应星逐位一致——多圈仅追加,不动基行)。
      2. 复发结构: 任一正基弧在 3000 内存在全部 +360k 兄弟(k 到上限为止)。
      3. 最大 |弧| ≤ 3000;perchart 对 5000 的请求夹到 3000。
      4. 顺向 only 时复发翻号行被滤(无负弧)。
    """
    cd = dict(SAMPLE_CHARTS[0])
    cd['pdMethod'] = 'core_alchabitius'
    cd['pdTimeKey'] = 'Ptolemy'
    cd['pdDirect'] = 1
    cd['pdConverse'] = 1

    def rows_for(years, **over):
        d = dict(cd)
        d['pdYears'] = years
        d.update(over)
        pc = perchart.PerChart(d)
        return perpredict.PerPredict(pc).getPrimaryDirection()

    r100 = rows_for(100)
    r3000 = rows_for(3000)
    assert r100, 'sample chart must produce default rows'
    key3000 = {(round(r[0], 9), r[1], r[2]) for r in r3000}
    missing = [r for r in r100 if (round(r[0], 9), r[1], r[2]) not in key3000]
    assert not missing, f'100y rows must be a subset of 3000y rows, missing={missing[:3]}'

    base = next(r for r in r100 if 0 < r[0] < 100)
    sibs = sorted(r[0] for r in r3000
                  if r[1] == base[1] and r[2] == base[2] and r[0] > 0
                  and abs((r[0] - base[0]) % 360.0) < 1e-6)
    ks = [round((x - base[0]) / 360.0) for x in sibs]
    expect_kmax = int((3000.0 - base[0]) // 360.0)
    assert ks == list(range(0, expect_kmax + 1)), f'recurrence ladder broken: {ks}'

    assert max(abs(r[0]) for r in r3000) <= 3000.0 + 1e-9

    r_clamped = rows_for(5000)
    assert max(abs(r[0]) for r in r_clamped) <= 3000.0 + 1e-9, 'pdYears must clamp at 3000'

    r_direct = rows_for(3000, pdConverse=0)
    assert all(r[0] > 0 for r in r_direct), 'direct-only must filter sign-flipped recurrences'
