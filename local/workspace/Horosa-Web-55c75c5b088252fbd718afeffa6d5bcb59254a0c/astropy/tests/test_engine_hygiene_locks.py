# -*- coding: utf-8 -*-
"""引擎层精简锁:多余的兜底已删、重复实现已收成单源、无人调用的代码已删。

每组锁两件事:
  ① 结构不回潮 —— 源码里不再出现被删的兜底 / 副本,适配层拿到的是同一个对象;
  ② 行为不变 —— 期望值由删改前的实现算出后写死,删改后逐值相同。
"""
import ast
import os
import random
import sys
import types

import pytest

from source_sets import read_source, source_files  # 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def _src(rel):
    return read_source(rel)


def _trees(rel):
    """全集里每个文件各自解析(拼出来的文本不能当一个模块解析)。"""
    out = []
    for p in source_files(rel):
        with open(p, encoding='utf-8') as fh:
            out.append(ast.parse(fh.read()))
    return out


def _tree(rel):
    return _trees(rel)[-1]


def _class_bodies(rel, cls):
    """类本体 + 它的 mixin 基类(拆进子模块的方法所在)本体。"""
    trees = _trees(rel)
    node = next(n for n in trees[-1].body if isinstance(n, ast.ClassDef) and n.name == cls)
    bases = {b.id for b in node.bases if isinstance(b, ast.Name)}
    bodies = [node.body]
    for t in trees[:-1]:
        bodies += [n.body for n in t.body if isinstance(n, ast.ClassDef) and n.name in bases]
    return bodies


def _func(rel, name, cls=None):
    bodies = _class_bodies(rel, cls) if cls is not None else [t.body for t in _trees(rel)]
    return next(n for body in bodies for n in body if isinstance(n, ast.FunctionDef) and n.name == name)


def _has_try(node):
    return any(isinstance(n, ast.Try) for n in ast.walk(node))


def _swallowing_tries(node):
    """except 分支只有 pass 的 try(吞错兜底);接口层「打日志 + 回错误包」的 try 不算。"""
    return [n for n in ast.walk(node) if isinstance(n, ast.Try) and n.handlers
            and all(len(h.body) == 1 and isinstance(h.body[0], ast.Pass) for h in n.handlers)]


def _top_level_names(rel):
    names = set()
    for t in _trees(rel):
        for n in t.body:
            if isinstance(n, (ast.FunctionDef, ast.ClassDef)):
                names.add(n.name)
            elif isinstance(n, ast.Assign):
                names.update(t.id for t in n.targets if isinstance(t, ast.Name))
    return names


def _kentang_module(key):
    from websrv.kentang.registry import KENTANG_SERVICE_SPECS, _load_service
    spec = next(s for s in KENTANG_SERVICE_SPECS if s['key'] == key)
    _load_service(spec)
    return sys.modules[spec['module']]


# ── 多余兜底已删 ─────────────────────────────────────────────────────────────

def test_fortuna_whole_houses_body_is_not_under_constant_if():
    fn = _func('astrostudy/perchart.py', '_placeFortunaWholeHouses', cls='PerChart')
    assert not any(isinstance(n, ast.If) and isinstance(n.test, ast.Constant) and n.test.value is True
                   for n in ast.walk(fn))


def test_fortuna_whole_houses_start_at_fortuna_sign():
    from flatlib import const
    from astrostudy.perchart import PerChart
    pc = PerChart({'date': '1990/06/15', 'time': '10:30:00', 'ad': 1, 'lat': '39n54', 'lon': '116e24',
                   'zone': '+08:00', 'hsys': 24, 'zodiacal': 'Tropical', 'tradition': False})
    start = int(pc.chart.getObject(const.PARS_FORTUNA).lon // 30) * 30
    for i, hid in enumerate(const.LIST_HOUSES):
        h = pc.chart.getHouse(hid)
        assert h.lon == (start + 30 * i) % 360 and h.size == 30, hid


def test_disabled_distar_ra_keeps_only_its_guard():
    fn = _func('astrostudy/perchart.py', '_moira_distar_ra')
    body = fn.body[1:] if isinstance(fn.body[0], ast.Expr) else fn.body
    assert len(body) == 1 and isinstance(body[0], ast.Raise)
    from astrostudy import perchart
    with pytest.raises(RuntimeError, match='已停用'):
        perchart._moira_distar_ra(perchart.MOIRA_DISTAR_J2000[0], 2451545.0)


def test_tajaka_imports_const_without_fallback():
    tree = _tree('astrostudy/india/tajaka.py')
    assert not any(isinstance(n, ast.Try) for n in tree.body)
    assert not any(isinstance(n, ast.IfExp) and isinstance(n.test, ast.Name) and n.test.id == 'const'
                   for n in ast.walk(tree))
    from flatlib import const
    from astrostudy.india import tajaka as T
    assert T.const is const
    assert T.SEVEN_PLANETS == [const.SUN, const.MOON, const.MARS, const.MERCURY,
                               const.JUPITER, const.VENUS, const.SATURN]
    assert T.MASCULINE == {const.SUN, const.MARS, const.JUPITER}
    for name in ('SIGN_LORD', 'EXALTATION', 'DEEPTAMSA', 'HADDA_LORDS', 'TRIRAASI_LORDS', '_SPEED_RANK', 'MUDDA_SEQUENCE'):
        assert getattr(T, name), name


def test_dasha_condition_context_reads_sign_lords_directly():
    fn = _func('astrostudy/india/jyotish_engine.py', '_dasha_condition_context', cls='JyotishEngine')
    for n in ast.walk(fn):
        if isinstance(n, ast.If):
            assert not (isinstance(n.test, ast.Name) and n.test.id == 'SIGN_LORDS')
        if isinstance(n, ast.Assign):
            assert not any(isinstance(t, ast.Name) and t.id == 'SIGN_LORDS' for t in n.targets)
    from astrostudy.india.india_chart_kernel import IndiaChartKernel
    from astrostudy.india.jyotish_engine import JyotishEngine
    eng = JyotishEngine(IndiaChartKernel({
        'date': '2000/01/01', 'time': '12:00:00', 'zone': '+00:00', 'lat': 51.4769, 'lon': 0.0, 'ad': 1,
        'tradition': False, 'predictive': False, 'zodiacal': 1, 'siderealMode': 'lahiri', 'hsys': 0}))
    ctx = eng._dasha_condition_context()
    assert isinstance(ctx.get('tenth_lord_in_tenth'), bool)
    assert isinstance(ctx.get('lagna_lord_in_1_or_7'), bool)


def test_acg_reuses_india_ayanamsa_registry_object():
    assert not any(isinstance(n, ast.Try) for n in _tree('astrostudy/acg/ACGraph.py').body)
    from astrostudy.acg import ACGraph as A
    from astrostudy.india import india_chart_kernel as K
    assert A._AYAN_MODES is K.INDIA_AYANAMSA_MODES
    assert A._AYAN_ALIASES is K.INDIA_AYANAMSA_ALIASES


def test_validate_geo_imports_geopos_without_fallback():
    fn = _func('websrv/_guards.py', 'validate_geo')
    for n in ast.walk(fn):
        if isinstance(n, ast.Try):
            assert not any(isinstance(x, ast.ImportFrom) and x.module == 'flatlib' for x in ast.walk(n))
    from websrv._guards import validate_geo
    assert validate_geo({'lat': '26n04', 'lon': '119e19'}) is None
    assert validate_geo({'lat': 'abc'})['err'] == 'invalid_coordinates'


def test_fast_json_allow_list_is_built_without_fallbacks():
    assert not _has_try(_func('websrv/fastjson.py', '_allowed_types'))
    from flatlib.datetime import Date, Datetime, Time
    from flatlib.geopos import GeoPos
    from flatlib.object import FixedStar, GenericObject, House, Object
    from websrv import fastjson as FJ
    assert FJ._allowed_types() == frozenset((GenericObject, Object, House, FixedStar, Datetime, Date, Time, GeoPos))


def test_india_house_ruler_and_exalt_read_table_directly():
    for n in ast.walk(_func('astrostudy/india/india_chart_kernel.py', 'reinit', cls='IndiaChartKernel')):
        if isinstance(n, ast.Try):
            assert 'ESSENTIAL_DIGNITIES' not in ast.unparse(n)
    from flatlib import const
    from flatlib.dignities import tables
    from astrostudy.india.india_chart_kernel import IndiaChartKernel
    k = IndiaChartKernel({'date': '1990/06/15', 'time': '10:30:00', 'zone': '+08:00', 'lat': 39.9, 'lon': 116.4,
                          'ad': 1, 'tradition': False, 'predictive': False, 'zodiacal': 1,
                          'siderealMode': 'lahiri', 'hsys': 0})
    asc_idx = const.LIST_SIGNS.index(k.chart.getAngle(const.ASC).sign)
    for i, hid in enumerate(const.LIST_HOUSES):
        sign = const.LIST_SIGNS[(asc_idx + i) % 12]
        h = k.chart.getHouse(hid)
        assert h.ruler == tables.ESSENTIAL_DIGNITIES[sign]['ruler']
        assert h.exalt == tables.ESSENTIAL_DIGNITIES[sign]['exalt'][0]


def test_wangji_late_zi_setters_are_called_without_fallbacks():
    for t in _swallowing_tries(_tree('websrv/webwangjisrv.py')):
        assert not any(isinstance(x, ast.ImportFrom) and (x.module or '').startswith('kinwangji') for x in ast.walk(t))
    for n in ast.walk(_tree('websrv/webwangjisrv.py')):
        if isinstance(n, ast.ExceptHandler) and isinstance(n.type, ast.Tuple):
            assert {getattr(e, 'id', None) for e in n.type.elts} != {'ImportError', 'AttributeError'}


def test_jinkou_day_boundary_setters_are_called_without_fallbacks():
    src = _src('websrv/webjinkousrv.py')
    assert 'hasattr(_jk_api' not in src
    for t in _swallowing_tries(ast.parse(src)):
        assert not any(isinstance(x, ast.ImportFrom) and x.module == 'kinjinkou.jinkoujue' for x in ast.walk(t))


def test_gate_and_priority_tools_have_no_swallowing_try():
    assert not _has_try(_func('websrv/webchartsrv.py', '_startup_gate_tool'))
    assert not _has_try(_func('websrv/webchartsrv.py', '_priority_lane_tool'))


def test_priority_lane_tool_sets_request_priority(monkeypatch):
    import websrv.webchartsrv as srv
    from astrostudy import perchart
    monkeypatch.setattr(srv, '_PRIORITY_LANE_ON', True)
    for header, expect in ((' Prefetch ', 'prefetch'), (None, 'fg'), ('other', 'fg')):
        headers = {} if header is None else {'X-Horosa-Priority': header}
        monkeypatch.setattr(srv, 'cherrypy', types.SimpleNamespace(request=types.SimpleNamespace(headers=headers)))
        srv._priority_lane_tool()
        assert perchart.get_request_priority() == expect, header
    perchart.set_request_priority(None)


# ── 无人调用的代码已删 ───────────────────────────────────────────────────────

DEAD = {
    'astrostudy/perchart.py': {'_moira_distar_ras'},
    'astrostudy/helper.py': {'calRealDate', 'getChartJson', 'isLeap'},
    'astrostudy/jieqi/jieqiconst.py': {'getJieQiInterval'},
    'websrv/webplanetariumsrv.py': {'_build_line_from_equatorial'},
    'astrostudy/india/dasha_variants.py': {'non_default_variants'},
    'astrostudy/india/varga.py': {'get_supported_vargas'},
    'astrostudy/india/shadbala_bphs.py': {'_house_distance'},
    'astrostudy/india/india_chart_kernel.py': {'build_india_chart'},
    'astrostudy/india/jyotish_engine.py': {'sign_from_lon'},
    'astrostudy/india_election_scan.py': {'_weekday_of_rise'},
    'astrostudy/signasctime.py': {'getSignAscTimeFactor', 'getYearAndDateByAscTimeFactor', 'getDaysByAscTimeFactor'},
    'astrostudy/geomancy/figures.py': {'figure_rows', 'to_ascii'},
    'websrv/webshenyishusrv.py': {'_line'},
    'astrostudy/cetian_ziwei.py': {
        '_compute_cetian_feixing', 'render_cetian_ziwei_chart', '_render_info', '_day_to_chinese', '_palace_cell_html',
        '_center_info_html', '_render_palace_grid', '_render_star_table', '_render_sihua_legend',
        '_render_flying_star_table', '_render_feixing_table', '_render_patterns', '_render_palace_details',
        'build_cetian_flyingstar_svg'},
    'websrv/horosa_engine_common.py': {
        'HOROSA_WEB_ROOT', 'KINASTRO_SRC', 'ensure_kinastro_path', 'SOURCE_REPLACEMENTS', 'source_text',
        'display_safe', 'gender_mf', 'read_vendor_text', 'kinastro_source_sections'},
}


@pytest.mark.parametrize('rel', sorted(DEAD))
def test_dead_definitions_stay_removed(rel):
    assert not (_top_level_names(rel) & DEAD[rel])


def test_dead_methods_stay_removed():
    perchart_methods = {n.name for body in _class_bodies('astrostudy/perchart.py', 'PerChart') for n in body
                        if isinstance(n, ast.FunctionDef)}
    assert not perchart_methods & {'getHyleg', 'getAlcochocen', 'getSimpleAspect', 'getBirthBySystime',
                                   'surroundSun', 'surroundMoon'}
    yoga_methods = {n.name for n in next(n for n in _tree('astrostudy/india/yoga_engine.py').body
                                         if isinstance(n, ast.ClassDef) and n.name == 'YogaEngine').body
                    if isinstance(n, ast.FunctionDef)}
    assert 'sign_has_planet' not in yoga_methods
    assert not os.path.exists(os.path.join(ROOT, 'astrostudy', 'jieqi', 'TimeDecider.py'))


def test_cetian_engine_still_serves_constants_after_render_layer_removal():
    from websrv import webcetiansrv  # noqa: F401  该服务导入的常量表必须仍在
    from astrostudy import cetian_ziwei as C
    for name in ('LUNAR_MONTH_NAMES', 'HOUR_BRANCH_NAMES', 'WU_XING_JU_NAMES', 'EARTHLY_BRANCHES', 'HEAVENLY_STEMS'):
        assert getattr(C, name), name


# ── 重复实现收成单源 ─────────────────────────────────────────────────────────

ADAPTER_SHARED = {
    'taiyi': {'_to_int': 'to_int'},
    'taixuan': {'_to_int': 'to_int', '_json_safe': 'plain_json_safe', '_row': 'plain_row',
                '_build_snapshot': 'build_snapshot', '_with_seed': 'with_seed'},
    'jingjue': {'_to_int': 'to_int', '_json_safe': 'plain_json_safe', '_row': 'plain_row',
                '_build_snapshot': 'build_snapshot', '_with_seed': 'with_seed'},
    'geomancy': {'_to_int': 'to_int', '_clean': 'clean_text'},
    'qimen': {'_to_int': 'to_int', '_clean_text': 'clean_text', '_json_safe': 'plain_json_safe', '_row': 'plain_row'},
    'wangji': {'_to_int': 'to_int', '_clean_text': 'clean_text', '_json_safe': 'plain_json_safe',
               '_format_value': 'plain_format_value', '_row': 'plain_row'},
    'wuzhao': {'_to_int': 'to_int', '_clean_text': 'clean_text', '_json_safe': 'plain_json_safe', '_row': 'plain_row',
               '_build_snapshot': 'build_snapshot'},
    'jinkou': {'_to_int': 'to_int'},
    'shenyishu': {'_to_int': 'to_int', '_clean_text': 'clean_text', '_json_safe': 'plain_json_safe',
                  '_build_snapshot': 'build_snapshot'},
}


@pytest.mark.parametrize('key', sorted(ADAPTER_SHARED))
def test_adapter_helpers_are_the_shared_ones(key):
    from websrv import horosa_engine_common as H
    mod = _kentang_module(key)
    for local, shared in ADAPTER_SHARED[key].items():
        assert getattr(mod, local) is getattr(H, shared), (key, local)


def test_adapter_helpers_that_differ_stay_local():
    from websrv import horosa_engine_common as H
    # 语义不同的那几份必须仍是各自的(太乙 None→「未得」、金口 删 None、地占 无 .item 分支、神易 显示替换)
    assert _kentang_module('taiyi')._clean_text is not H.clean_text
    assert _kentang_module('jinkou')._clean_text is not H.clean_text
    assert _kentang_module('geomancy')._json_safe is not H.plain_json_safe
    assert _kentang_module('shenyishu')._format_value is not H.plain_format_value


def test_shared_adapter_helpers_values():
    import numpy as np
    from websrv import horosa_engine_common as H
    assert H.plain_json_safe({'a': 1, 2: [np.int64(3), (4.5, True)], None: 'x'}) == {'a': 1, '2': [3, [4.5, True]], '': 'x'}
    assert H.plain_json_safe([np.float32(2.5), {'k': None}]) == [2.5, {'k': None}]
    d = __import__('datetime').date(2026, 7, 19)
    assert H.plain_json_safe(d) is d                       # 不转日期(与 json_safe 不同)
    assert H.plain_json_safe({1, 2}) == {1, 2}              # 不展开 set
    assert H.plain_format_value(None) == '' and H.plain_format_value('') == ''
    assert H.plain_format_value({'a': 1, 'b': None, 'c': [1, '', 'x']}) == 'a：1；c：1、x'
    assert H.plain_format_value([1, [2, 3], '']) == '1、2、3'
    assert H.plain_format_value(' t ') == 't' and H.plain_format_value(False) == 'False'
    assert H.plain_row('L', None) == {'label': 'L', 'value': '—'}
    assert H.plain_row('L', 3.5) == {'label': 'L', 'value': '3.5'}
    pan = {'sections': [{'title': 'A', 'rows': [{'label': 'x', 'value': 1}, {'label': 'y'}]},
                        {'rows': [{'value': 'v'}]}, {'title': 'C'}]}
    assert H.build_snapshot(pan) == '[A]\nx：1\ny：None\n\n[]\nNone：v\n\n[C]'
    for v, want_int, want_text in ((None, -1, 'D'), ('', -1, 'D'), ('  ', -1, 'D'), ('abc', -1, 'abc'),
                                   ('12', 12, '12'), (12.9, 12, '12.9'), ('7.0', -1, '7.0'), (True, 1, 'True')):
        assert H.to_int(v, -1) == want_int, v
        assert H.clean_text(v, 'D') == want_text, v
    before = random.getstate()
    assert H.with_seed(11, lambda: [random.randint(0, 999) for _ in range(4)]) == [463, 886, 573, 877]
    assert random.getstate() == before


def test_kinastro_common_takes_generic_helpers_from_one_place():
    from websrv import horosa_engine_common as H
    from websrv.kentang import kinastro_common as K
    for name in ('DISPLAY_REPLACEMENTS', 'to_int', 'to_float', 'clean_text', 'json_safe', 'gender_cn',
                 'timezone_to_float', 'coord_to_float', 'build_snapshot'):
        assert getattr(K, name) is getattr(H, name), name
    assert _kentang_module('shaozi')._normalize_ganzhi is K.normalize_ganzhi
    assert _kentang_module('tieban')._normalize_ganzhi is K.normalize_ganzhi
    for v, want in (('甲子', '甲子'), (' 乙丑 ', '乙丑'), ('子甲', 'FB'), ('甲', 'FB'), (None, 'FB'), ('癸亥x', 'FB')):
        assert K.normalize_ganzhi(v, 'FB') == want, v


def test_display_replacements_have_no_duplicate_or_identity_entries():
    for n in _tree('websrv/horosa_engine_common.py').body:
        if isinstance(n, ast.Assign) and getattr(n.targets[0], 'id', '') == 'DISPLAY_REPLACEMENTS':
            keys = [k.value for k in n.value.keys]
            vals = [v.value for v in n.value.values]
            assert len(keys) == len(set(keys)), '替换表出现重复键'
            assert all(k != v for k, v in zip(keys, vals)), '替换表出现恒等项'
            break
    else:
        raise AssertionError('DISPLAY_REPLACEMENTS 不见了')
    assert 'DISPLAY_REPLACEMENTS' not in _top_level_names('websrv/kentang/kinastro_common.py')


INDIA_SHARED = {
    'bhava_bala': {'SIGN_LORDS': 'SIGN_LORDS'},
    'functional_nature': {'SIGN_RULER': 'SIGN_LORDS', 'SIGN_ORDER': 'SIGNS', 'PLANET_CN': 'PLANET_CN'},
    'yoga_engine': {'SIGN_LORDS': 'SIGN_LORDS', 'SIGN_CN': 'SIGN_CN', 'PLANET_CN': 'PLANET_CN',
                    'MOOLATRIKONA': 'MOOLATRIKONA'},
    'arudha': {'SIGN_LORDS': 'SIGN_LORDS'},
    'rasi_dasha': {'SIGN_LORDS': 'SIGN_LORDS'},
    'gochara': {'SIGN_CN': 'SIGN_CN', 'PLANET_CN': 'PLANET_CN'},
    'dasha_extended': {'_SIGN_LABEL': 'SIGN_CN'},
    'supplementary_lagna': {'SIGN_CN': 'SIGN_CN'},
    'jyotish_engine': {'SIGN_CN': 'SIGN_CN', 'PLANET_CN': 'PLANET_CN', 'MOOLATRIKONA': 'MOOLATRIKONA'},
    'sensitive_points': {'_SIGN_CN': 'SIGN_CN', '_PLANET_CN': 'PLANET_CN'},
    'shadbala_bphs': {'SIGNS': 'SIGNS'},
}


@pytest.mark.parametrize('mod', sorted(INDIA_SHARED))
def test_india_tables_come_from_primitives(mod):
    import importlib
    from astrostudy.india import primitives as P
    m = importlib.import_module('astrostudy.india.' + mod)
    for local, shared in INDIA_SHARED[mod].items():
        assert getattr(m, local) is getattr(P, shared), (mod, local)


def test_primitives_shared_table_values():
    from flatlib import const as c
    from astrostudy.india import primitives as P
    assert list(P.SIGN_LORDS.items()) == [
        (c.ARIES, c.MARS), (c.TAURUS, c.VENUS), (c.GEMINI, c.MERCURY), (c.CANCER, c.MOON), (c.LEO, c.SUN),
        (c.VIRGO, c.MERCURY), (c.LIBRA, c.VENUS), (c.SCORPIO, c.MARS), (c.SAGITTARIUS, c.JUPITER),
        (c.CAPRICORN, c.SATURN), (c.AQUARIUS, c.SATURN), (c.PISCES, c.JUPITER)]
    assert list(P.SIGN_CN.values()) == ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼']
    assert list(P.SIGN_CN) == P.SIGNS == list(c.LIST_SIGNS)
    assert list(P.PLANET_CN.items()) == [
        (c.SUN, '太阳'), (c.MOON, '月亮'), (c.MARS, '火星'), (c.MERCURY, '水星'), (c.JUPITER, '木星'),
        (c.VENUS, '金星'), (c.SATURN, '土星'), (c.NORTH_NODE, '罗睺'), (c.SOUTH_NODE, '计都')]
    assert list(P.MOOLATRIKONA.items()) == [
        (c.SUN, (c.LEO, 0, 20)), (c.MOON, (c.TAURUS, 4, 30)), (c.MARS, (c.ARIES, 0, 12)),
        (c.MERCURY, (c.VIRGO, 16, 20)), (c.JUPITER, (c.SAGITTARIUS, 0, 10)), (c.VENUS, (c.LIBRA, 0, 15)),
        (c.SATURN, (c.AQUARIUS, 0, 20))]


def test_jyotish_engine_reuses_yoga_engine_helpers():
    from astrostudy.india import jyotish_engine as J
    from astrostudy.india import yoga_engine as Y
    assert J.safe_get is Y.safe_get and J.house_number is Y.house_number
    assert J.house_number(types.SimpleNamespace(house='House7')) == 7
    assert J.house_number(types.SimpleNamespace(house='Housex')) is None
    assert J.house_number(types.SimpleNamespace(house=7)) is None
    assert J.safe_get(types.SimpleNamespace(get=lambda _i: 1 / 0), 'Sun') is None


def test_election_zone_days_single_source():
    from astrostudy import election_scan_kernel as K
    from astrostudy import india_election_scan as IN
    from astrostudy import qizheng_election_scan as QZ
    assert QZ._zone_days is K.zone_days and IN._zone_days is K.zone_days
    for zone, days in (('+08:00', 0.3333333333333333), ('-05:30', -0.22916666666666666), ('+05:45', 0.23958333333333334),
                       ('', 0.3333333333333333), (None, 0.3333333333333333), ('9', 0.375),
                       ('-0:30', -0.020833333333333332), ('+14:00', 0.5833333333333334)):
        assert K.zone_days(zone) == days, zone


def test_cors_tool_uses_the_shared_handler(monkeypatch):
    import websrv.webchartsrv as srv
    from websrv import helper
    assert not hasattr(srv, 'CORS')
    assert 'HandlerTool(enable_crossdomain)' in _src('websrv/webchartsrv.py')
    for method, expect_ret, expect_keys in (('OPTIONS', True, {'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers',
                                                                'Access-Control-Allow-Origin'}),
                                            ('POST', None, {'Access-Control-Allow-Origin'})):
        fake = types.SimpleNamespace(request=types.SimpleNamespace(method=method),
                                     response=types.SimpleNamespace(headers={}))
        monkeypatch.setattr(helper, 'cherrypy', fake)
        assert helper.enable_crossdomain() is expect_ret
        assert set(fake.response.headers) == expect_keys
        assert fake.response.headers['Access-Control-Allow-Origin'] == '*'


def test_prewarm_loops_share_one_implementation():
    body = _func('websrv/webchartsrv.py', 'prewarm_core_services').body
    assert len(body) == 1 and '_prewarm_specs(CORE_SERVICE_SPECS' in ast.unparse(body[0])
    body = _func('websrv/kentang/registry.py', 'prewarm_kentang_services').body
    assert '_prewarm_specs(KENTANG_SERVICE_SPECS' in ast.unparse(body[-1])


def _fake_tree_with(specs, lazy_good, lazy_bad, monkeypatch):
    from websrv.kentang.registry import _LazyMountedService
    mod = types.ModuleType('tests_fake_prewarm_target')

    class FakeSrv(object):
        pass

    mod.FakeSrv = FakeSrv
    monkeypatch.setitem(sys.modules, 'tests_fake_prewarm_target', mod)
    apps = {}
    for i, spec in enumerate(specs):
        if i in lazy_good:
            root = _LazyMountedService(dict(spec, module='tests_fake_prewarm_target', class_name='FakeSrv', engine=None))
        elif i in lazy_bad:
            root = _LazyMountedService(dict(spec, module='tests_fake_prewarm_absent', class_name='FakeSrv', engine=None))
        else:
            root = object()
        apps[spec['mount']] = types.SimpleNamespace(root=root)
    return types.SimpleNamespace(tree=types.SimpleNamespace(apps=apps))


def test_core_prewarm_counts_loaded_and_failed(monkeypatch, capsys):
    import websrv.webchartsrv as srv
    fake = _fake_tree_with(srv.CORE_SERVICE_SPECS, {0, 2}, {1}, monkeypatch)
    monkeypatch.setitem(sys.modules, 'cherrypy', fake)
    monkeypatch.setattr(srv, 'cherrypy', fake)
    assert srv.prewarm_core_services() == (2, 1)
    assert '[core] prewarm failed %s' % srv.CORE_SERVICE_SPECS[1]['key'] in capsys.readouterr().out


def test_kentang_prewarm_counts_loaded_and_failed(monkeypatch, capsys):
    from websrv.kentang import registry
    fake = _fake_tree_with(registry.KENTANG_SERVICE_SPECS, {1}, {0}, monkeypatch)
    monkeypatch.setitem(sys.modules, 'cherrypy', fake)
    assert registry.prewarm_kentang_services() == (1, 1)
    assert '[kentang] prewarm failed %s' % registry.KENTANG_SERVICE_SPECS[0]['key'] in capsys.readouterr().out


def test_astroextra_request_number_args():
    import re
    from astrostudy import astroextra as AX
    assert not re.search(r"try:\n\s+\w+ = (int|float)\(data\.get\(", _src('astrostudy/astroextra.py'))
    for data, want in (({}, 1900), ({'k': '1990'}, 1990), ({'k': 'x'}, 1900), ({'k': None}, 1900),
                       ({'k': 2000.7}, 2000), ({'k': '2000.7'}, 1900), ({'k': True}, 1)):
        assert AX._int_arg(data, 'k', 1900) == want, data
    assert AX._int_arg(None, 'k', 3) == 3
    for data, want in (({}, 0.0), ({'aspect': '180'}, 180.0), ({'aspect': 'bad'}, 0.0), ({'aspect': None}, 0.0)):
        got = AX._float_arg(data, 'aspect', 0.0)
        assert got == want and isinstance(got, float), data
